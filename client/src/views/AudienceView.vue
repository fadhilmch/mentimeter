<script setup lang="ts">
import { isPresentationGone } from '../live/errors'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useLiveStore } from '../stores/live'
import { getTheme, readableOn, themeVars } from '../themes'
import logoLight from '../assets/logo-light.svg'
import logoDark from '../assets/logo-dark.svg'
import ColorModeToggle from '../components/ColorModeToggle.vue'
import { useColorMode } from '../colorMode'
import { shouldPromptNow } from '../namePrompt'
import { playerKey, randomNickname } from '../alias'
import { setThenSave } from '../optimistic'
import { participantId } from '../participant'
import ParticipantAvatar from '../components/ParticipantAvatar.vue'
import type { RankingOption } from '../types'

const route = useRoute()
const live = useLiveStore()
const code = String(route.params.code)
const error = ref('')
// Set once the server says the presentation no longer exists; nothing can be sent after that.
const ended = ref(false)
watch(error, (message) => {
  if (isPresentationGone(message)) ended.value = true
})
// A reconnect proves the server is reachable again, so a leftover connection error no longer applies.
watch(() => live.reconnects, () => {
  if (!ended.value) error.value = ''
})
const draft = ref('')
// One id per distinct comment, kept until it is accepted: tapping Send again after a lost
// acknowledgment reuses it, so the server stores the comment once. Edited text gets a new id.
const sendIds = new Map<string, string>()
const wordDraft = ref('')
const myVotes = reactive<Record<number, number>>({})
const myUpvotes = reactive<Record<string, boolean>>({})
const myWords = reactive<Record<number, string>>({})
const myRatings = reactive<Record<number, number>>({})
interface MyAnswers { vote?: number; rating?: number; word?: string; ranking?: string[]; upvotes?: number[] }
const rankingDraft = ref<string[]>([])
const submittedRankings = reactive<Record<number, string[]>>({})

onMounted(async () => {
  if (!live.connected || live.state?.accessCode !== code) {
    try {
      await live.join(code)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Could not join.'
    }
  }
  await restoreMyAnswers()
})

onBeforeUnmount(() => live.leave())

const slide = computed(() => live.currentSlide)
const state = computed(() => live.state)
const theme = computed(() => getTheme(state.value?.theme))
const { mode } = useColorMode()
const pageStyle = computed(() => themeVars(theme.value, mode.value))
const pal = computed(() => theme.value.pal)
const accent = computed(() => slide.value?.design?.accent ?? pal.value[0])
const onAccent = computed(() => readableOn(accent.value))
// Medal colours come from the theme palette. On the light stage they are mixed toward the ink so
// the rank number stays readable (the bright palette colours are only 1.4-2.6:1 on white).
const rankColor = (rank: number): string | undefined => {
  if (rank < 1 || rank > 3) return undefined
  const colour = pal.value[rank + 1]
  return mode.value === 'light' ? `color-mix(in srgb, ${colour} 40%, var(--t-ink))` : colour
}
const votingOpen = computed(() => state.value?.votingOpen !== false && !ended.value)
const resultsVisible = computed(() => state.value?.resultsVisible !== false)
const savedName = ref(localStorage.getItem('livepoll.nickname') ?? '')
const nameDraft = ref('')
const askName = computed(() => !!state.value && shouldPromptNow(state.value.slides, state.value.currentSlide, savedName.value))
function generateName() { nameDraft.value = randomNickname() }
async function saveName() {
  const name = nameDraft.value.trim()
  if (!name) return
  try {
    await live.identify(name)
    savedName.value = name.slice(0, 24)
  } catch {
    // Not saved: the card stays so they can try again. Answering is never blocked.
  }
}
const myKey = computed(() => (state.value ? playerKey(state.value.accessCode, participantId()) : ''))
const myEntry = computed(() => state.value?.leaderboard?.find((e) => e.key === myKey.value) ?? null)


// Start each slide's ranking with a clean slate.
watch(
  () => state.value?.currentSlide,
  (slideIndex) => { rankingDraft.value = [...(submittedRankings[slideIndex ?? -1] ?? [])] },
)

function optionsOf(): RankingOption[] {
  const s = slide.value
  if (!s?.options) return []
  return (s.options as (string | RankingOption)[]).map((o, i) =>
    typeof o === 'string' ? { id: String(i), text: o } : o,
  )
}

const cloudWords = computed(() => {
  const words = slide.value?.tally?.words ?? []
  const max = Math.max(1, ...words.map((w) => w.count))
  return words.slice(0, 40).map((w, i) => ({
    ...w,
    size: 1 + (w.count / max) * 1.9,
    color: pal.value[i % pal.value.length],
  }))
})

/** After a refresh the server still has this person's answers: show them again. */
async function restoreMyAnswers() {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/live/${code}/me`, {
      headers: { 'x-participant-id': participantId() },
    })
    if (!res.ok) return
    const { data } = (await res.json()) as { data: Record<string, MyAnswers> }
    for (const [key, mine] of Object.entries(data)) {
      const slideIndex = Number(key)
      if (mine.vote !== undefined) myVotes[slideIndex] = mine.vote
      if (mine.rating !== undefined) myRatings[slideIndex] = mine.rating
      if (mine.word !== undefined) myWords[slideIndex] = mine.word
      if (mine.ranking) submittedRankings[slideIndex] = mine.ranking
      for (const responseIndex of mine.upvotes ?? []) myUpvotes[`${slideIndex}:${responseIndex}`] = true
    }
    rankingDraft.value = [...(submittedRankings[state.value?.currentSlide ?? -1] ?? [])]
  } catch {
    // Offline or an older server: the page works as before, just without the highlight.
  }
}

async function choose(optionIndex: number) {
  if (!state.value) return
  const slideIndex = state.value.currentSlide
  error.value = ''
  try {
    // A failed vote must not stay shown as locked in.
    await setThenSave(myVotes, slideIndex, optionIndex, () => live.vote(slideIndex, optionIndex))
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Vote failed.'
  }
}

async function submitResponse() {
  const text = draft.value.trim()
  if (!text || !state.value) return
  error.value = ''
  try {
    const idKey = `${state.value.currentSlide}:${text}`
    const clientId = sendIds.get(idKey) ?? crypto.randomUUID()
    sendIds.set(idKey, clientId)
    await live.respond(state.value.currentSlide, text, clientId)
    sendIds.delete(idKey)
    draft.value = ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not send.'
  }
}

async function upvote(responseIndex: number) {
  if (!state.value) return
  const key = `${state.value.currentSlide}:${responseIndex}`
  error.value = ''
  const want = !myUpvotes[key]
  myUpvotes[key] = want
  try {
    await live.upvote(state.value.currentSlide, responseIndex, want)
  } catch (err) {
    myUpvotes[key] = !myUpvotes[key]
    error.value = err instanceof Error ? err.message : 'Upvote failed.'
  }
}

async function submitWord() {
  const word = wordDraft.value.trim()
  if (!word || !state.value) return
  error.value = ''
  try {
    await live.submitWord(state.value.currentSlide, word)
    myWords[state.value.currentSlide] = word.toLowerCase()
    wordDraft.value = ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not send.'
  }
}

async function rate(value: number) {
  if (!state.value) return
  const slideIndex = state.value.currentSlide
  error.value = ''
  try {
    await setThenSave(myRatings, slideIndex, value, () => live.castRating(slideIndex, value))
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Rating failed.'
  }
}

function tapRank(id: string) {
  const at = rankingDraft.value.indexOf(id)
  if (at >= 0) rankingDraft.value.splice(at, 1)
  else rankingDraft.value.push(id)
}

async function sendRanking() {
  if (!state.value) return
  const order = [...rankingDraft.value]
  error.value = ''
  try {
    await live.submitRanking(state.value.currentSlide, order)
    submittedRankings[state.value.currentSlide] = order
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not send.'
  }
}
</script>

<template>
  <div class="audience-themed" :style="pageStyle">
    <header class="stage-topbar audience-topbar">
      <img class="stage-logo" :src="mode === 'dark' ? logoDark : logoLight" alt="CrowdFlow" />
      <div class="stage-actions"><ColorModeToggle /></div>
    </header>
  <div class="audience-page">
    <p v-if="ended" class="error-banner" role="alert">This presentation has ended or was deleted. Answers can no longer be sent.</p>
    <p v-else-if="error" class="error-banner" role="alert">{{ error }}</p>
    <p v-if="!state" class="connecting">Connecting…</p>
    <template v-else>
      <p class="audience-title"><span class="live-dot"></span>{{ state.title }}</p>
      <form v-if="askName" class="name-card" @submit.prevent="saveName">
        <label for="leaderboard-name">Choose your nickname</label>
        <input id="leaderboard-name" v-model="nameDraft" maxlength="24" placeholder="e.g. Fika Fan" autocomplete="off" />
        <button class="button ghost pill" type="button" @click="generateName">&#10024; Generate nickname</button>
        <p class="name-hint">Up to 24 characters. Shown on the leaderboard.</p>
        <button class="button block" type="submit" :disabled="!nameDraft.trim()" :style="{ background: accent, color: onAccent }">Save nickname</button>
      </form>
      <template v-if="slide && !askName">
        <div
          class="audience-slide"
          :class="{ 'has-image': slide.design?.imageUrl, [`layout-${slide.design?.imageLayout ?? 'beside'}`]: slide.design?.imageUrl }"
          :style="slide.design?.imageUrl && (slide.design?.imageLayout ?? 'beside') === 'behind' ? { backgroundImage: `linear-gradient(rgba(10,10,12,0.55), rgba(10,10,12,0.55)), url(${slide.design.imageUrl})` } : {}"
        >
          <img v-if="slide.design?.imageUrl && (slide.design?.imageLayout ?? 'beside') === 'beside'" :src="slide.design.imageUrl" alt="" class="slide-image beside" />
          <h1 class="audience-question">{{ slide.question }}</h1>
        </div>

        <template v-if="slide.questionType === 'multiple-choice' || slide.questionType === 'quiz'">
          <button
            v-for="(option, i) in optionsOf()"
            :key="i"
            class="option-button"
            :class="{
              chosen: myVotes[state.currentSlide] === i,
              'quiz-correct': slide.questionType === 'quiz' && resultsVisible && slide.tally?.correctOptionIndex === i,
            }"
            :style="myVotes[state.currentSlide] === i ? { borderColor: pal[i % pal.length] } : {}"
            :disabled="!votingOpen || (slide.questionType === 'quiz' && slide.tally?.correctOptionIndex !== undefined)"
            @click="choose(i)"
          >
            <span class="option-dot" :style="myVotes[state.currentSlide] === i ? { background: pal[i % pal.length], borderColor: pal[i % pal.length] } : { borderColor: pal[i % pal.length] }"></span>
            {{ option.text }}
            <span v-if="slide.questionType === 'quiz' && resultsVisible && slide.tally?.correctOptionIndex === i" class="quiz-mark">✓</span>
          </button>
          <p v-if="slide.questionType === 'quiz' && resultsVisible && slide.tally && slide.tally.correctCount !== undefined" class="muted">
            {{ slide.tally.correctCount }} of {{ slide.tally.total }} got it right.
            <template v-if="myVotes[state.currentSlide] !== undefined">
              {{ myVotes[state.currentSlide] === slide.tally.correctOptionIndex ? 'You did!' : 'Not yours this time.' }}
            </template>
          </p>
          <p v-else-if="votingOpen && myVotes[state.currentSlide] !== undefined" class="muted">
            Answer locked in - tap another option to change it.
          </p>
          <p v-if="!votingOpen && !ended" class="voting-closed">Voting is closed - waiting for the presenter…</p>
        </template>

        <template v-else-if="slide.questionType === 'word-cloud'">
          <div class="card">
            <form @submit.prevent="submitWord">
              <label class="field" style="margin-bottom:10px;">
                <span>One word</span>
                <input v-model="wordDraft" maxlength="40" placeholder="Type a single word…" :disabled="!votingOpen" />
              </label>
              <button class="button block" type="submit" :disabled="!wordDraft.trim() || !votingOpen" :style="{ background: accent, color: onAccent }">
                {{ myWords[state.currentSlide] ? 'Replace my word' : 'Send' }}
              </button>
            </form>
          </div>
          <p v-if="myWords[state.currentSlide]" class="muted">Your word: "{{ myWords[state.currentSlide] }}"<template v-if="votingOpen"> - sending a new one replaces it</template>.</p>
          <p v-if="!resultsVisible" class="voting-closed">The presenter has hidden the cloud for now.</p>
          <div v-else-if="cloudWords.length" class="cloud-box" aria-live="polite">
            <span v-for="w in cloudWords" :key="w.text" class="cloud-word" :style="{ fontSize: `${w.size}rem`, color: w.color }">{{ w.text }}</span>
          </div>
          <p v-if="!votingOpen && !ended" class="voting-closed">Voting is closed - waiting for the presenter…</p>
        </template>

        <template v-else-if="slide.questionType === 'rating'">
          <div class="rating-row" role="radiogroup" aria-label="Rate from 1 to 10">
            <button
              v-for="n in 10"
              :key="n"
              class="rating-button"
              :class="{ chosen: (myRatings[state.currentSlide] ?? 0) >= n }"
              :style="(myRatings[state.currentSlide] ?? 0) >= n ? { background: accent, borderColor: accent, color: onAccent } : {}"
              :disabled="!votingOpen"
              :aria-checked="myRatings[state.currentSlide] === n"
              role="radio"
              @click="rate(n)"
            >{{ n }}</button>
          </div>
          <p v-if="myRatings[state.currentSlide]" class="muted">You rated {{ myRatings[state.currentSlide] }} of 10<template v-if="votingOpen"> - tap again to change it</template>.</p>
          <p v-if="resultsVisible && slide.tally" class="muted">Room average: {{ slide.tally.average }} from {{ slide.tally.total }} rating{{ slide.tally.total === 1 ? '' : 's' }}.</p>
          <p v-if="!votingOpen && !ended" class="voting-closed">Voting is closed - waiting for the presenter…</p>
        </template>

        <template v-else-if="slide.questionType === 'ranking'">
          <p class="muted" style="margin-top:0;">Tap the options in your order, best first.</p>
          <button
            v-for="option in optionsOf()"
            :key="option.id"
            class="option-button"
            :class="{ chosen: rankingDraft.includes(option.id) }"
            :style="rankingDraft.includes(option.id) ? { borderColor: accent } : {}"
            :disabled="!votingOpen"
            @click="tapRank(option.id)"
          >
            <span class="rank-badge" :style="rankingDraft.includes(option.id) ? { background: accent, borderColor: accent, color: onAccent } : {}">
              {{ rankingDraft.includes(option.id) ? rankingDraft.indexOf(option.id) + 1 : '' }}
            </span>
            {{ option.text }}
          </button>
          <button
            class="button block"
            style="margin-top:var(--space-3);"
            :style="{ background: accent, color: onAccent }"
            :disabled="rankingDraft.length !== optionsOf().length || !votingOpen"
            @click="sendRanking"
          >
            {{ submittedRankings[state.currentSlide] ? 'Update my ranking' : 'Send ranking' }}
          </button>
          <p v-if="rankingDraft.length && rankingDraft.length !== optionsOf().length" class="muted">
            {{ optionsOf().length - rankingDraft.length }} left to place.
          </p>
          <p v-if="submittedRankings[state.currentSlide]" class="muted">Ranking sent<template v-if="votingOpen"> - reorder and send again to change it</template>.</p>
          <p v-if="!votingOpen && !ended" class="voting-closed">Voting is closed - waiting for the presenter…</p>
        </template>

        <template v-else>
          <div class="card">
            <form @submit.prevent="submitResponse">
              <label class="field" style="margin-bottom:10px;">
                <span>Your answer</span>
                <textarea v-model="draft" rows="2" maxlength="280" placeholder="Type your answer…" :disabled="!votingOpen"></textarea>
              </label>
              <button class="button block" type="submit" :disabled="!draft.trim() || !votingOpen">Send</button>
            </form>
          </div>
          <p v-if="!resultsVisible" class="voting-closed">The presenter has hidden the results for now.</p>
          <div v-else-if="slide.responses?.length" class="response-list" style="margin-top:18px;">
            <div v-for="r in slide.responses" :key="r.index" class="response-item">
              <span>{{ r.text }}</span>
              <button class="upvote-button" :class="{ on: myUpvotes[`${state.currentSlide}:${r.index}`] }" :disabled="!votingOpen" @click="upvote(r.index)">
                ▲ {{ r.upvotes }}
              </button>
            </div>
          </div>
          <p v-if="!votingOpen && !ended" class="voting-closed">Voting is closed - waiting for the presenter…</p>
        </template>
      </template>
      <p v-else class="muted">Waiting for the presenter…</p>
    </template>
    <div v-if="state?.leaderboard?.length" class="card leaderboard-card">
      <div class="lb-head">
        <p class="eyebrow">Quiz leaderboard</p>
        <span class="lb-count">{{ state.leaderboard.length }} player{{ state.leaderboard.length === 1 ? '' : 's' }}</span>
      </div>
      <ol class="leaderboard-list">
        <li v-for="entry in state.leaderboard.slice(0, 5)" :key="entry.key" :class="{ me: entry.key === myKey }">
          <span class="lb-rank" :style="rankColor(entry.rank) ? { color: rankColor(entry.rank) } : {}">#{{ entry.rank }}</span>
          <ParticipantAvatar :name="entry.name" :size="32" />
          <span class="lb-name"><span class="lb-name-text">{{ entry.name }}</span><span v-if="entry.key === myKey" class="you-chip">You</span></span>
          <span class="lb-score" :class="{ zero: entry.score === 0 }">{{ entry.score }} pt{{ entry.score === 1 ? '' : 's' }}</span>
        </li>
      </ol>
      <p v-if="myEntry && myEntry.rank > 5" class="muted">You are #{{ myEntry.rank }} of {{ state.leaderboard.length }} with {{ myEntry.score }} pt{{ myEntry.score === 1 ? '' : 's' }}. Every correct answer adds a point.</p>
      <p v-else-if="myEntry" class="muted">That's you - #{{ myEntry.rank }} of {{ state.leaderboard.length }}. Every correct answer adds a point.</p>
    </div>
  </div>
  </div>
</template>

<style scoped>
.name-card {
  background: var(--t-stage2);
  border: 1px solid var(--t-track);
  border-radius: var(--radius);
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  color: var(--t-ink);
}
.name-card label { display: block; font-weight: 700; margin-bottom: var(--space-2); }
.name-card .muted { color: color-mix(in srgb, var(--t-ink) 72%, transparent); font-weight: 500; }
.name-card input { width: 100%; }
.name-card .pill { display: inline-flex; margin-top: var(--space-2); border: 1px solid var(--t-track); color: var(--t-ink); border-radius: var(--radius-pill); font-size: var(--fs-sm); }
.cloud-box {
  margin-top: 18px;
  padding: 18px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  align-items: baseline;
  justify-content: center;
}
.cloud-word {
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.15;
}
.rating-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--space-2);
}
.rating-button {
  padding: 14px 0;
  font-size: var(--fs-md);
  font-weight: 800;
  border-radius: var(--radius-lg);
  border: 2px solid color-mix(in srgb, var(--t-ink) 18%, transparent);
  background: color-mix(in srgb, var(--t-ink) 5%, transparent);
  color: inherit;
  cursor: pointer;
}
.rating-button:disabled {
  opacity: 0.5;
  cursor: default;
}
.leaderboard-card {
  margin-top: 22px;
  text-align: left;
}
.lb-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.lb-count {
  font-size: var(--fs-xs);
  color: color-mix(in srgb, var(--t-ink) 72%, transparent);
  font-variant-numeric: tabular-nums;
}
.leaderboard-list {
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.leaderboard-list li {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 10px 14px;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--t-ink) 5%, transparent);
}
.leaderboard-list li.me {
  outline: 2px solid var(--accent);
}
.lb-rank {
  width: 40px;
  flex: none;
  font-weight: 800;
  font-size: var(--fs-lg);
  font-variant-numeric: tabular-nums;
  color: color-mix(in srgb, var(--t-ink) 72%, transparent);
}
.lb-name {
  font-weight: 700;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}
.lb-name-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.you-chip {
  background: var(--accent);
  color: var(--on-accent);
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 2px var(--space-2);
  border-radius: 99px;
  margin-left: 6px;
  flex-shrink: 0;
}
.lb-score {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--t-accink, var(--accent));
  white-space: nowrap;
}
.lb-score.zero {
  color: color-mix(in srgb, var(--t-ink) 72%, transparent);
}
.rank-badge {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--t-ink) 35%, transparent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-sm);
  font-weight: 800;
  flex-shrink: 0;
  margin-right: 10px;
}
.quiz-mark {
  margin-left: auto;
  font-weight: 900;
  color: var(--t-correct);
}
.quiz-correct {
  border-color: var(--t-correct) !important;
}
.audience-slide.has-image.layout-beside {
  display: flex;
  align-items: center;
  gap: 14px;
}
.slide-image.beside {
  width: 84px;
  height: 84px;
  object-fit: cover;
  border-radius: var(--radius);
  flex-shrink: 0;
}
.slide-image.behind {
  display: none;
}
.audience-slide.has-image.layout-behind {
  position: relative;
  padding: 18px;
  border-radius: 16px;
  overflow: hidden;
  background-image: var(--slide-image);
  background-size: cover;
  background-position: center;
}
</style>
