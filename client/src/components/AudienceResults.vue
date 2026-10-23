<script setup lang="ts">
import { computed } from 'vue'
import type { PublicSlide } from '../types'
const props = defineProps<{ slide: PublicSlide; palette: string[] }>()
const rows = computed(() => {
  const tally = props.slide.tally
  if (!tally || !['multiple-choice', 'ranking'].includes(props.slide.questionType)) return []
  const ranking = props.slide.questionType === 'ranking'
  const max = Math.max(1, ...(tally.points ?? []))
  return (props.slide.options ?? []).map((option, i) => ({
    text: typeof option === 'string' ? option : option.text,
    value: ranking ? (tally.points?.[i] ?? 0) : (tally.counts?.[i] ?? 0),
    percent: ranking ? Math.round((tally.points?.[i] ?? 0) / max * 100) : (tally.percentages?.[i] ?? 0),
    color: props.palette[i % props.palette.length],
  })).sort((a, b) => ranking ? b.value - a.value : 0)
})
</script>

<template>
  <section v-if="rows.length" class="card audience-results" aria-label="Room results" aria-live="polite">
    <h2>Room results</h2>
    <div v-for="(row, i) in rows" :key="i" class="result-row">
      <div class="result-label"><span>{{ row.text }}</span><span>{{ row.value }} {{ slide.questionType === 'ranking' ? 'pts' : `· ${row.percent}%` }}</span></div>
      <div class="result-track"><div class="result-fill" :style="{ width: `${row.percent}%`, background: row.color }"></div></div>
    </div>
    <p class="muted">{{ slide.tally?.total ?? 0 }} {{ slide.questionType === 'ranking' ? ((slide.tally?.total ?? 0) === 1 ? 'ranking' : 'rankings') : ((slide.tally?.total ?? 0) === 1 ? 'vote' : 'votes') }}</p>
  </section>
</template>

<style scoped>
.audience-results { margin-top: var(--space-4); }
h2 { font-size: 1.1rem; margin: 0 0 var(--space-4); }
.result-label { gap: var(--space-3); align-items: baseline; }
.result-label span:first-child { min-width: 0; overflow-wrap: anywhere; }
.result-label span:last-child { flex-shrink: 0; font-variant-numeric: tabular-nums; }
</style>
