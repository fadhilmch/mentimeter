<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useLiveStore } from '../stores/live'

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
  <div class="audience-page">
    <p v-if="error" class="error-text">{{ error }}</p>
    <p v-if="!state" class="muted">Connecting…</p>
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
            @click="choose(i)"
          >
            {{ option }}
          </button>
          <p v-if="myVotes[state.currentSlide] !== undefined" class="muted">
            Answer locked in - tap another option to change it.
          </p>
        </template>

        <template v-else>
          <div class="card">
            <form @submit.prevent="submitResponse">
              <label class="field" style="margin-bottom:10px;">
                <span>Your answer</span>
                <textarea v-model="draft" rows="2" maxlength="280" placeholder="Type your answer…"></textarea>
              </label>
              <button class="button block" type="submit" :disabled="!draft.trim()">Send</button>
            </form>
          </div>
          <div v-if="slide.responses?.length" class="response-list" style="margin-top:18px;">
            <div v-for="(r, i) in slide.responses" :key="i" class="response-item" style="background:var(--card); border:1px solid var(--line); color:var(--ink);">
              <span>{{ r.text }}</span>
              <button class="upvote-button" :class="{ on: myUpvotes[`${state.currentSlide}:${i}`] }" @click="upvote(i)">
                ▲ {{ r.upvotes }}
              </button>
            </div>
          </div>
        </template>
      </template>
      <p v-else class="muted">Waiting for the presenter…</p>
    </template>
  </div>
</template>
