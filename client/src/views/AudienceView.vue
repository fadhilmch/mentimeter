<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useLiveStore } from '../stores/live'
import { getTheme, themeVars } from '../themes'

const route = useRoute()
const live = useLiveStore()
const code = String(route.params.code)
const error = ref('')
const draft = ref('')
const myVotes = reactive<Record<number, number>>({})
const myUpvotes = reactive<Record<string, boolean>>({})

onMounted(async () => {
  if (!live.connected || live.state?.accessCode !== code) {
    try {
      await live.join(code)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Could not join.'
    }
  }
})

onBeforeUnmount(() => live.leave())

const slide = computed(() => live.currentSlide)
const state = computed(() => live.state)
const theme = computed(() => getTheme(state.value?.theme))
const pageStyle = computed(() => themeVars(theme.value))
const pal = computed(() => theme.value.pal)
const votingOpen = computed(() => state.value?.votingOpen !== false)

async function choose(optionIndex: number) {
  if (!state.value) return
  myVotes[state.value.currentSlide] = optionIndex
  try {
    await live.vote(state.value.currentSlide, optionIndex)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Vote failed.'
  }
}

async function submitResponse() {
  const text = draft.value.trim()
  if (!text || !state.value) return
  try {
    await live.respond(state.value.currentSlide, text)
    draft.value = ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not send.'
  }
}

async function upvote(responseIndex: number) {
  if (!state.value) return
  const key = `${state.value.currentSlide}:${responseIndex}`
  myUpvotes[key] = !myUpvotes[key]
  try {
    await live.upvote(state.value.currentSlide, responseIndex)
  } catch (err) {
    myUpvotes[key] = !myUpvotes[key]
    error.value = err instanceof Error ? err.message : 'Upvote failed.'
  }
}
</script>

<template>
  <div class="audience-themed" :style="pageStyle">
  <div class="audience-page">
    <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
    <p v-if="!state" class="connecting">Connecting…</p>
    <template v-else>
      <p class="audience-title"><span class="live-dot"></span>{{ state.title }}</p>
      <template v-if="slide">
        <h1 class="audience-question">{{ slide.question }}</h1>

        <template v-if="slide.questionType === 'multiple-choice'">
          <button
            v-for="(option, i) in slide.options"
            :key="i"
            class="option-button"
            :class="{ chosen: myVotes[state.currentSlide] === i }"
            :style="myVotes[state.currentSlide] === i ? { borderColor: pal[i % pal.length] } : {}"
            :disabled="!votingOpen"
            @click="choose(i)"
          >
            <span class="option-dot" :style="myVotes[state.currentSlide] === i ? { background: pal[i % pal.length], borderColor: pal[i % pal.length] } : { borderColor: pal[i % pal.length] }"></span>
            {{ option }}
          </button>
          <p v-if="votingOpen && myVotes[state.currentSlide] !== undefined" class="muted">
            Answer locked in - tap another option to change it.
          </p>
          <p v-if="!votingOpen" class="voting-closed">Voting is closed - waiting for the presenter…</p>
        </template>

        <template v-else>
          <div class="card">
            <form @submit.prevent="submitResponse">
              <label class="field" style="margin-bottom:10px;">
                <span>Your answer</span>
                <textarea v-model="draft" rows="2" maxlength="280" placeholder="Type your answer…"></textarea>
              </label>
              <button class="button block" type="submit" :disabled="!draft.trim() || !votingOpen">Send</button>
            </form>
          </div>
          <div v-if="slide.responses?.length" class="response-list" style="margin-top:18px;">
            <div v-for="(r, i) in slide.responses" :key="i" class="response-item">
              <span>{{ r.text }}</span>
              <button class="upvote-button" :class="{ on: myUpvotes[`${state.currentSlide}:${i}`] }" :disabled="!votingOpen" @click="upvote(i)">
                ▲ {{ r.upvotes }}
              </button>
            </div>
          </div>
          <p v-if="!votingOpen" class="voting-closed">Voting is closed - waiting for the presenter…</p>
        </template>
      </template>
      <p v-else class="muted">Waiting for the presenter…</p>
    </template>
  </div>
  </div>
</template>
