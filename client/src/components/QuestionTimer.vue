<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { fractionLeft, remainingMs, secondsLeft } from '../quizTimer'

/** Countdown for a timed quiz question. The server enforces the deadline; this only shows it. */
const props = defineProps<{ durationSec: number; endsAt: number | null; offsetMs: number; size?: 'large' | 'small' }>()
const emit = defineEmits<{ expired: [] }>()

const now = ref(Date.now())
let timer = 0
let announced = false

const left = computed(() => remainingMs(props.endsAt, props.offsetMs, now.value))
const running = computed(() => left.value !== null && left.value > 0)
const fraction = computed(() => (left.value === null ? 1 : fractionLeft(left.value, props.durationSec)))
const shown = computed(() => (left.value === null ? props.durationSec : secondsLeft(left.value)))
const urgent = computed(() => running.value && shown.value <= 5)

function tick() {
  now.value = Date.now()
  if (props.endsAt !== null && left.value === 0 && !announced) {
    announced = true
    emit('expired')
  }
}
onMounted(() => { timer = window.setInterval(tick, 200); tick() })
onBeforeUnmount(() => window.clearInterval(timer))
// A restarted timer (new end time) can expire again.
watch(() => props.endsAt, () => { announced = false; tick() })

const label = computed(() =>
  left.value === null ? `Time limit ${props.durationSec} seconds, not started` : running.value ? `${shown.value} seconds left` : 'Time is up',
)
</script>

<template>
  <div class="qt" :class="[`qt-${size ?? 'large'}`, { urgent, over: left === 0, idle: left === null }]" role="timer" :aria-label="label" data-testid="question-timer">
    <span class="qt-num" aria-hidden="true">{{ left === 0 ? '0' : shown }}<small>s</small></span>
    <span class="qt-track" aria-hidden="true"><span class="qt-fill" :style="{ transform: `scaleX(${fraction})` }"></span></span>
    <span class="qt-status" aria-hidden="true">{{ left === null ? 'Time limit' : running ? 'left' : "Time's up" }}</span>
  </div>
</template>

<style scoped>
.qt {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--space-3);
  color: var(--t-ink);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.qt-num { min-width: 3.2ch; text-align: right; font-size: 2rem; line-height: 1; }
.qt-num small { font-size: 0.55em; margin-left: 2px; opacity: 0.7; }
.qt-small .qt-num { font-size: 1.35rem; }
.qt-status { font-size: var(--fs-sm); opacity: 0.75; white-space: nowrap; }
.qt-track { height: 10px; border-radius: var(--radius-pill); background: var(--t-track); overflow: hidden; }
.qt-fill {
  display: block; height: 100%; width: 100%;
  background: var(--t-acc);
  transform-origin: left center;
  transition: transform 200ms linear;
  border-radius: var(--radius-pill);
}
.urgent .qt-fill { background: var(--danger); }
.urgent .qt-num { color: var(--t-ink); animation: qt-pulse 1s ease-in-out infinite; }
.over .qt-fill { transform: scaleX(0) !important; }
.idle .qt-num { opacity: 0.8; }
@keyframes qt-pulse { 50% { transform: scale(1.12); } }
@media (prefers-reduced-motion: reduce) {
  .qt-fill { transition: none; }
  .urgent .qt-num { animation: none; }
}
</style>
