<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLiveStore } from '../stores/live'
import { useAuthStore } from '../stores/auth'
import { getTheme, themeVars } from '../themes'
import { api } from '../api'
import logoMonoUrl from '../assets/logo-mono.svg'

const route = useRoute()
const router = useRouter()
const live = useLiveStore()
const auth = useAuthStore()
const code = String(route.params.code)
const error = ref('')
const busy = ref('')
const confirmingReset = ref(false)

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
const votingOpen = computed(() => state.value?.votingOpen !== false)
const resultsVisible = computed(() => state.value?.resultsVisible !== false)

const direction = ref<'next' | 'prev'>('next')
function go(delta: number) {
  if (!state.value) return
  const next = state.value.currentSlide + delta
  if (next < 0 || next >= state.value.slides.length) return
  direction.value = delta > 0 ? 'next' : 'prev'
  confirmingReset.value = false
  live.goToSlide(next)
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
    if (!tally) { displayed.counts = []; displayed.total = 0; return }
    if (reducedMotion.matches) { displayed.counts = [...tally.counts]; displayed.total = tally.total; return }
    const fromCounts = tally.counts.map((_, i) => displayed.counts[i] ?? 0)
    const fromTotal = displayed.total
    const start = performance.now()
    const dur = 320
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1)
      const e = 1 - Math.pow(1 - t, 3)
      displayed.counts = tally.counts.map((to, i) => Math.round((fromCounts[i] ?? 0) + (to - (fromCounts[i] ?? 0)) * e))
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
      <span class="stage-brand"><img :src="logoMonoUrl" alt="CrowdFlow" />{{ state?.title ?? 'Presentation' }}</span>
      <span class="code-chip">JOIN {{ code }}</span>
      <button class="button ghost" style="color:#edeef0;" @click="end">End</button>
    </header>

    <div class="stage-body">
      <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
      <p v-else-if="!state" class="connecting">Connecting…</p>
      <template v-else-if="slide">
        <div class="stage-controls">
          <button class="button ghost" style="color:#edeef0;" :class="{ 'is-on': !votingOpen }" :disabled="!!busy" @click="presenterAction({ type: 'voting:set', open: !votingOpen }, 'voting')">
            {{ votingOpen ? 'Close voting' : 'Reopen voting' }}
          </button>
          <button class="button ghost" style="color:#edeef0;" :class="{ 'is-on': !resultsVisible }" :disabled="!!busy" @click="presenterAction({ type: 'results:set', visible: !resultsVisible }, 'results')">
            {{ resultsVisible ? 'Hide results' : 'Reveal results' }}
          </button>
          <button class="button ghost" style="color:#edeef0;" :disabled="!!busy" @click="askReset">
            {{ confirmingReset ? 'Tap again to confirm reset' : 'Reset votes' }}
          </button>
        </div>

        <Transition :name="`slide-${direction}`" mode="out-in">
        <div :key="state.currentSlide">
        <p style="color:rgba(255,255,255,0.6); font-weight:600; margin:0 0 8px;">
          Slide {{ state.currentSlide + 1 }} of {{ state.slides.length }}
        </p>
        <h1 class="stage-question">{{ slide.question }}</h1>

        <div v-if="!resultsVisible" class="results-hidden">
          <p style="font-size:1.2rem; font-weight:700; margin:0 0 6px;">Results hidden</p>
          <p style="margin:0;">Reveal them when the room is ready.</p>
        </div>

        <template v-else-if="slide.questionType === 'multiple-choice' && slide.tally">
          <div aria-live="polite">
          <div v-for="(option, i) in slide.options" :key="i" class="result-row">
            <div class="result-label">
              <span><span class="result-chip" :style="{ background: pal[i % pal.length] }"></span>{{ option }}</span>
              <span>{{ displayed.counts[i] ?? 0 }} · {{ slide.tally.percentages[i] }}%</span>
            </div>
            <div class="result-track">
              <div class="result-fill" :style="{ width: `${Math.max(slide.tally.percentages[i], 2)}%`, background: pal[i % pal.length], transitionDelay: `${i * 60}ms` }"></div>
            </div>
          </div>
          <p style="color:rgba(255,255,255,0.6);">{{ displayed.total }} vote{{ displayed.total === 1 ? '' : 's' }}</p>
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
