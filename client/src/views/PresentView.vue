<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLiveStore } from '../stores/live'
import { useAuthStore } from '../stores/auth'
import { getTheme, themeVars } from '../themes'
import { api } from '../api'
import type { RankingOption } from '../types'
import logoLight from '../assets/logo-light.svg'
import logoDark from '../assets/logo-dark.svg'
import ColorModeToggle from '../components/ColorModeToggle.vue'
import JoinPanel from '../components/JoinPanel.vue'
import { useColorMode } from '../colorMode'
import { slideStepForKey } from '../presenterKeys'
import ParticipantAvatar from '../components/ParticipantAvatar.vue'

const route = useRoute()
const router = useRouter()
const live = useLiveStore()
const auth = useAuthStore()
const code = String(route.params.code)
const error = ref('')
const busy = ref('')
const confirmingReset = ref(false)
const showFullBoard = ref(false)

onMounted(async () => {
  try {
    await live.join(code)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not start the presentation.'
  }
})

// Arrow keys and Page Up/Down change slides, as in other presentation tools.
function onKey(e: KeyboardEvent) {
  if (showJoin.value) return
  const step = slideStepForKey(e)
  if (step === null) return
  e.preventDefault()
  go(step)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  live.leave()
})

const slide = computed(() => live.currentSlide)
const state = computed(() => live.state)
const theme = computed(() => getTheme(state.value?.theme))
const { mode } = useColorMode()
const showJoin = ref(false)
const stageStyle = computed(() => themeVars(theme.value, mode.value))
const pal = computed(() => theme.value.pal)
const isFirst = computed(() => (state.value?.currentSlide ?? 0) <= 0)
const isLast = computed(() => !!state.value && state.value.currentSlide >= state.value.slides.length - 1)
const votingOpen = computed(() => state.value?.votingOpen !== false)
const accent = computed(() => slide.value?.design?.accent ?? null)
// Medal colours come from the theme palette. On the light stage they are mixed toward the ink so
// the rank number stays readable (the bright palette colours are only 1.4-2.6:1 on white).
const rankColor = (rank: number): string | undefined => {
  if (rank < 1 || rank > 3) return undefined
  const colour = pal.value[rank + 1]
  return mode.value === 'light' ? `color-mix(in srgb, ${colour} 40%, var(--t-ink))` : colour
}

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
  return words.map((w, i) => ({
    ...w,
    size: 1.1 + (w.count / max) * 2.6,
    color: pal.value[i % pal.value.length],
  }))
})

const rankingRows = computed(() => {
  const points = slide.value?.tally?.points
  if (!points) return []
  const max = Math.max(1, ...points)
  return optionsOf()
    .map((o, i) => ({ text: o.text, points: points[i] ?? 0, pct: Math.round(((points[i] ?? 0) / max) * 100), color: pal.value[i % pal.value.length] }))
    .sort((a, b) => b.points - a.points)
})
const resultsVisible = computed(() => state.value?.resultsVisible !== false)

const direction = ref<'next' | 'prev'>('next')
function go(delta: number) {
  if (!state.value) return
  const next = state.value.currentSlide + delta
  if (next < 0 || next >= state.value.slides.length) return
  direction.value = delta > 0 ? 'next' : 'prev'
  confirmingReset.value = false
  // Slide control is presenter-only: it goes through the authenticated route.
  api
    .presenterAction(auth.token, String(state.value.id), { type: 'slide:change', slideIndex: next })
    .catch((err) => {
      error.value = err instanceof Error ? err.message : 'Could not change slide.'
    })
}

async function presenterAction(action: Record<string, unknown>, label: string) {
  if (!state.value || busy.value) return
  busy.value = label
  error.value = ''
  try {
    await api.presenterAction(auth.token, String(state.value.id), action)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'That did not work.'
  } finally {
    busy.value = ''
    confirmingReset.value = false
  }
}

function askReset() {
  if (confirmingReset.value) {
    presenterAction({ type: 'vote:reset', slideIndex: state.value?.currentSlide ?? 0 }, 'reset')
  } else {
    confirmingReset.value = true
  }
}

/* Tweened counts: numbers ease toward the live tally instead of jumping. */
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const displayed = reactive<{ counts: number[]; total: number }>({ counts: [], total: 0 })
let raf = 0
watch(
  () => slide.value?.tally,
  (tally) => {
    cancelAnimationFrame(raf)
    const counts = tally?.counts
    if (!tally || !counts) { displayed.counts = []; displayed.total = 0; return }
    if (reducedMotion.matches) { displayed.counts = [...counts]; displayed.total = tally.total; return }
    const fromCounts = counts.map((_, i) => displayed.counts[i] ?? 0)
    const fromTotal = displayed.total
    const start = performance.now()
    const dur = 320
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1)
      const e = 1 - Math.pow(1 - t, 3)
      displayed.counts = counts.map((to, i) => Math.round((fromCounts[i] ?? 0) + (to - (fromCounts[i] ?? 0)) * e))
      displayed.total = Math.round(fromTotal + (tally.total - fromTotal) * e)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  },
  { deep: true, immediate: true },
)
onBeforeUnmount(() => cancelAnimationFrame(raf))

function end() {
  live.leave()
  router.push({ name: 'dashboard' })
}
</script>

<template>
  <div class="stage-page" :style="stageStyle">
    <header class="stage-topbar">
      <div class="stage-brand">
        <img class="stage-logo" :src="mode === 'dark' ? logoDark : logoLight" alt="CrowdFlow" />
        <span class="stage-title">{{ state?.title ?? 'Presentation' }}</span>
      </div>
      <button type="button" class="code-chip" :aria-label="`JOIN ${code}, show join QR code`" @click="showJoin = true">
        <span>JOIN {{ code }}</span>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v.01M14 21h.01M17.5 21H21v-3.5" /></svg>
      </button>
      <div class="stage-actions">
        <ColorModeToggle />
        <button class="button ghost end-button" @click="end">End</button>
      </div>
    </header>
    <JoinPanel v-if="showJoin" :code="code" @close="showJoin = false" />

    <div class="stage-body">
      <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
      <p v-else-if="!state" class="connecting">Connecting…</p>
      <template v-else-if="slide">
        <div class="stage-controls">
          <button class="button ghost" :class="{ 'is-on': !votingOpen }" :disabled="!!busy" @click="presenterAction({ type: 'voting:set', open: !votingOpen }, 'voting')">
            {{ votingOpen ? 'Close voting' : 'Reopen voting' }}
          </button>
          <button class="button ghost" :class="{ 'is-on': !resultsVisible }" :disabled="!!busy" @click="presenterAction({ type: 'results:set', visible: !resultsVisible }, 'results')">
            {{ resultsVisible ? 'Hide results' : 'Reveal results' }}
          </button>
          <button class="button ghost" :disabled="!!busy" @click="askReset">
            {{ confirmingReset ? 'Tap again to confirm reset' : 'Reset votes' }}
          </button>
        </div>

        <div class="stage-slide-slot">
        <Transition :name="`slide-${direction}`">
        <div :key="state.currentSlide">
        <p style="color:color-mix(in srgb, var(--t-ink) 72%, transparent); font-weight:600; margin:0 0 var(--space-2);">
          Slide {{ state.currentSlide + 1 }} of {{ state.slides.length }}
        </p>
        <div
          class="stage-question-row"
          :class="{ 'has-image': slide.design?.imageUrl, behind: (slide.design?.imageLayout ?? 'beside') === 'behind' }"
          :style="slide.design?.imageUrl && (slide.design?.imageLayout ?? 'beside') === 'behind' ? { backgroundImage: `linear-gradient(rgba(8,8,10,0.62), rgba(8,8,10,0.62)), url(${slide.design.imageUrl})` } : {}"
        >
          <img v-if="slide.design?.imageUrl && (slide.design?.imageLayout ?? 'beside') === 'beside'" :src="slide.design.imageUrl" alt="" class="stage-image" />
          <h1 class="stage-question">{{ slide.question }}</h1>
        </div>

        <div v-if="!resultsVisible" class="results-hidden">
          <p style="font-size:1.2rem; font-weight:700; margin:0 0 6px;">Results hidden</p>
          <p style="margin:0;">Reveal them when the room is ready.</p>
        </div>

        <template v-else-if="(slide.questionType === 'multiple-choice' || slide.questionType === 'quiz') && slide.tally?.counts">
          <div aria-live="polite">
          <div v-for="(option, i) in optionsOf()" :key="i" class="result-row">
            <div class="result-label">
              <span>
                <span class="result-chip" :style="{ background: pal[i % pal.length] }"></span>{{ option.text }}
                <span v-if="slide.questionType === 'quiz' && slide.tally.correctOptionIndex === i" class="quiz-correct-tag">✓ correct</span>
              </span>
              <span>{{ displayed.counts[i] ?? 0 }} · {{ slide.tally.percentages?.[i] ?? 0 }}%</span>
            </div>
            <div class="result-track">
              <div class="result-fill" :style="{ width: `${Math.max(slide.tally.percentages?.[i] ?? 0, 2)}%`, background: pal[i % pal.length], transitionDelay: `${i * 60}ms` }"></div>
            </div>
          </div>
          <p style="color:color-mix(in srgb, var(--t-ink) 72%, transparent);">
            {{ displayed.total }} vote{{ displayed.total === 1 ? '' : 's' }}<template v-if="slide.questionType === 'quiz' && slide.tally.correctCount !== undefined"> · {{ slide.tally.correctCount }} correct</template>


          </p>
          </div>
        </template>

        <template v-else-if="slide.questionType === 'word-cloud'">
          <div v-if="cloudWords.length" class="cloud-stage" aria-live="polite">
            <span v-for="w in cloudWords" :key="w.text" class="cloud-word" :style="{ fontSize: `${w.size}rem`, color: w.color }">{{ w.text }}</span>
          </div>
          <p v-else style="color:color-mix(in srgb, var(--t-ink) 72%, transparent);">Waiting for words…</p>
          <p style="color:color-mix(in srgb, var(--t-ink) 72%, transparent);">{{ slide.tally?.total ?? 0 }} word{{ (slide.tally?.total ?? 0) === 1 ? '' : 's' }}</p>
        </template>

        <template v-else-if="slide.questionType === 'rating' && slide.tally">
          <div class="rating-stage" aria-live="polite">
            <p class="rating-big">{{ slide.tally.average }}</p>
            <p style="color:color-mix(in srgb, var(--t-ink) 72%, transparent); margin-top:0;">average of {{ slide.tally.total }} rating{{ slide.tally.total === 1 ? '' : 's' }}</p>
            <div v-if="slide.tally.buckets" class="bucket-row">
              <div v-for="(count, i) in slide.tally.buckets" :key="i" class="bucket-col">
                <span class="bucket-count" :style="{ visibility: count ? 'visible' : 'hidden' }">{{ count }}</span>
                <div class="bucket-track">
                  <div class="bucket-fill" :style="{ height: `${Math.max((count / Math.max(1, ...slide.tally.buckets)) * 100, count ? 6 : 0)}%`, background: accent ?? pal[0] }"></div>
                </div>
                <span class="bucket-num">{{ i + 1 }}</span>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="slide.questionType === 'ranking' && slide.tally?.points">
          <div aria-live="polite">
          <div v-for="row in rankingRows" :key="row.text" class="result-row">
            <div class="result-label">
              <span><span class="result-chip" :style="{ background: row.color }"></span>{{ row.text }}</span>
              <span>{{ row.points }} pts</span>
            </div>
            <div class="result-track">
              <div class="result-fill" :style="{ width: `${Math.max(row.pct, 2)}%`, background: row.color }"></div>
            </div>
          </div>
          <p style="color:color-mix(in srgb, var(--t-ink) 72%, transparent);">{{ slide.tally.total }} ranking{{ slide.tally.total === 1 ? '' : 's' }}</p>
          </div>
        </template>

        <template v-else-if="slide.responses">
          <div class="response-list">
            <div v-for="(r, i) in slide.responses" :key="i" class="response-item">
              <span>{{ r.text }}</span>
              <span class="upvote-count">▲ {{ r.upvotes }}</span>
            </div>
          </div>
          <p v-if="!slide.responses.length" style="color:color-mix(in srgb, var(--t-ink) 72%, transparent);">Waiting for answers…</p>
        </template>
        </div>
        </Transition>
        </div>

        <div v-if="live.state?.leaderboard?.length" class="leaderboard-stage" aria-live="polite">
          <div class="lb-head">
            <p class="eyebrow" style="margin:0;">Quiz leaderboard</p>
            <span class="lb-count">{{ live.state.leaderboard.length }} player{{ live.state.leaderboard.length === 1 ? '' : 's' }}</span>
          </div>
          <ol class="lb-rows">
            <li v-for="entry in (showFullBoard ? live.state.leaderboard : live.state.leaderboard.slice(0, 5))" :key="entry.name">
              <span class="lb-rank" :style="rankColor(entry.rank) ? { color: rankColor(entry.rank) } : {}">#{{ entry.rank }}</span>
              <ParticipantAvatar :name="entry.name" :size="36" />
              <span class="lb-name">{{ entry.name }}</span>
              <span class="lb-pts" :class="{ zero: entry.score === 0 }">{{ entry.score }} pt{{ entry.score === 1 ? '' : 's' }}</span>
            </li>
          </ol>
          <button v-if="live.state.leaderboard.length > 5" class="button ghost" style="margin-top:10px;" @click="showFullBoard = !showFullBoard">
            {{ showFullBoard ? 'Show top 5' : `Show all ${live.state.leaderboard.length}` }}
          </button>
        </div>

        <div class="stage-nav">
          <button class="button" :disabled="isFirst" @click="go(-1)">← Previous</button>
          <button class="button" :disabled="isLast" @click="go(1)">Next →</button>
        </div>
      </template>
      <p v-else style="color:color-mix(in srgb, var(--t-ink) 72%, transparent);">This presentation has no slides yet.</p>
    </div>
  </div>
</template>

<style scoped>
.leaderboard-stage {
  margin-top: 18px;
  background: color-mix(in srgb, var(--t-ink) 6%, transparent);
  border-radius: 16px;
  padding: var(--space-4) 18px;
  text-align: left;
}
.lb-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}
.lb-count {
  font-size: var(--fs-xs);
  color: color-mix(in srgb, var(--t-ink) 72%, transparent);
  font-variant-numeric: tabular-nums;
}
.lb-rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.lb-rows li {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--fs-md);
  background: color-mix(in srgb, var(--t-ink) 5%, transparent);
  border-radius: var(--radius-lg);
  padding: 10px 14px;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lb-pts {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--t-accink, color-mix(in srgb, var(--t-ink) 85%, transparent));
  white-space: nowrap;
}
.lb-pts.zero {
  color: color-mix(in srgb, var(--t-ink) 72%, transparent);
}
.stage-question-row.has-image:not(.behind) {
  display: flex;
  align-items: center;
  gap: 18px;
}
.stage-question-row.behind {
  padding: 26px;
  border-radius: 18px;
  background-size: cover;
  background-position: center;
  margin-bottom: var(--space-1);
}
.stage-image {
  width: 140px;
  height: 140px;
  object-fit: cover;
  border-radius: 18px;
  flex-shrink: 0;
}
.cloud-stage {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) 22px;
  align-items: baseline;
  justify-content: center;
  padding: 20px 0;
  min-height: 120px;
}
.cloud-word {
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.15;
}
.rating-stage {
  text-align: center;
}
.rating-big {
  font-size: 4.6rem;
  font-weight: 900;
  margin: 0;
  letter-spacing: -0.03em;
}
.bucket-row {
  display: flex;
  gap: var(--space-2);
  justify-content: center;
  margin-top: 18px;
}
.bucket-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.bucket-track {
  height: 110px;
  width: 26px;
  border-radius: var(--radius-sm);
  background: var(--t-track);
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}
.bucket-fill {
  width: 100%;
  transition: height 300ms ease;
}
.bucket-num {
  font-size: 0.8rem;
  color: color-mix(in srgb, var(--t-ink) 72%, transparent);
  font-weight: 700;
}
.bucket-count {
  font-size: var(--fs-sm);
  font-weight: 800;
  color: color-mix(in srgb, var(--t-ink) 90%, transparent);
  min-height: 1.1em;
}
.quiz-correct-tag {
  margin-left: var(--space-2);
  font-size: var(--fs-xs);
  font-weight: 800;
  color: var(--t-correct);
  border: 1px solid var(--t-correct);
  border-radius: var(--radius-pill);
  padding: 1px var(--space-2);
}
@media (prefers-reduced-motion: reduce) {
  .bucket-fill { transition: none; }
}
</style>
