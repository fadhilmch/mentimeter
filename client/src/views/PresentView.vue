<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLiveStore } from '../stores/live'
import { getTheme, themeVars } from '../themes'

const route = useRoute()
const router = useRouter()
const live = useLiveStore()
const code = String(route.params.code)
const error = ref('')

onMounted(async () => {
  try {
    await live.join(code)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not start the presentation.'
  }
})

onBeforeUnmount(() => live.leave())

const slide = computed(() => live.currentSlide)
const state = computed(() => live.state)
const theme = computed(() => getTheme(state.value?.theme))
const stageStyle = computed(() => themeVars(theme.value))
const pal = computed(() => theme.value.pal)
const isFirst = computed(() => (state.value?.currentSlide ?? 0) <= 0)
const isLast = computed(() => !!state.value && state.value.currentSlide >= state.value.slides.length - 1)

function go(delta: number) {
  if (!state.value) return
  const next = state.value.currentSlide + delta
  if (next < 0 || next >= state.value.slides.length) return
  live.goToSlide(next)
}

function end() {
  live.leave()
  router.push({ name: 'dashboard' })
}
</script>

<template>
  <div class="stage-page" :style="stageStyle">
    <header class="stage-topbar">
      <span style="font-weight:700;">{{ state?.title ?? 'Presentation' }}</span>
      <span class="code-chip">JOIN {{ code }}</span>
      <button class="button ghost" style="color:#edeef0;" @click="end">End</button>
    </header>

    <div class="stage-body">
      <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
      <p v-else-if="!state" style="color:rgba(255,255,255,0.6);">Connecting…</p>
      <template v-else-if="slide">
        <Transition name="slide-fade" mode="out-in">
        <div :key="state.currentSlide">
        <p style="color:rgba(255,255,255,0.6); font-weight:600; margin:0 0 8px;">
          Slide {{ state.currentSlide + 1 }} of {{ state.slides.length }}
        </p>
        <h1 class="stage-question">{{ slide.question }}</h1>

        <template v-if="slide.questionType === 'multiple-choice' && slide.tally">
          <div aria-live="polite">
          <div v-for="(option, i) in slide.options" :key="i" class="result-row">
            <div class="result-label">
              <span><span class="result-chip" :style="{ background: pal[i % pal.length] }"></span>{{ option }}</span>
              <span>{{ slide.tally.counts[i] }} · {{ slide.tally.percentages[i] }}%</span>
            </div>
            <div class="result-track">
              <div class="result-fill" :style="{ width: `${Math.max(slide.tally.percentages[i], 2)}%`, background: pal[i % pal.length], transitionDelay: `${i * 60}ms` }"></div>
            </div>
          </div>
          <p style="color:rgba(255,255,255,0.6);">{{ slide.tally.total }} vote{{ slide.tally.total === 1 ? '' : 's' }}</p>
          </div>
        </template>

        <template v-else-if="slide.responses">
          <div class="response-list">
            <div v-for="(r, i) in slide.responses" :key="i" class="response-item">
              <span>{{ r.text }}</span>
              <span class="upvote-count">▲ {{ r.upvotes }}</span>
            </div>
          </div>
          <p v-if="!slide.responses.length" style="color:rgba(255,255,255,0.6);">Waiting for answers…</p>
        </template>
        </div>
        </Transition>

        <div class="stage-nav">
          <button class="button" :disabled="isFirst" @click="go(-1)">← Previous</button>
          <button class="button" :disabled="isLast" @click="go(1)">Next →</button>
        </div>
      </template>
      <p v-else style="color:rgba(255,255,255,0.6);">This presentation has no slides yet.</p>
    </div>
  </div>
</template>
