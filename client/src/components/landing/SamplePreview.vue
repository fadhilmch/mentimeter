<script setup lang="ts">
import { computed } from 'vue'
import { PREVIEW } from '../../landing/content'

const total = computed(() => PREVIEW.options.reduce((sum, o) => sum + o.votes, 0))
const rows = computed(() =>
  PREVIEW.options.map((o) => ({ ...o, pct: Math.round((o.votes / total.value) * 100) })),
)
</script>

<template>
  <div class="preview" role="img" :aria-label="`Sample poll: ${PREVIEW.question}`">
    <div class="stage">
      <div class="top">
        <span class="live"><i></i>Live</span>
        <span class="chip">JOIN {{ PREVIEW.code }}</span>
        <span class="count">{{ total }} voting</span>
      </div>
      <p class="q">{{ PREVIEW.question }}</p>
      <div v-for="(r, i) in rows" :key="r.label" class="bar">
        <div class="bar-label">
          <span>{{ r.label }}</span>
          <span>{{ r.votes }} · {{ r.pct }}%</span>
        </div>
        <div class="track">
          <div class="fill" :style="{ width: r.pct + '%', background: r.color, animationDelay: i * 90 + 'ms' }"></div>
        </div>
      </div>
    </div>
    <div class="phone">
      <span class="live"><i></i>CrowdFlow</span>
      <p class="pq">{{ PREVIEW.question }}</p>
      <div v-for="(r, i) in rows" :key="r.label" class="opt" :class="{ sel: i === 0 }">
        <i></i>{{ r.label }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview { position: relative; height: 430px; }
.stage {
  position: absolute; inset: 0 40px 40px 0; padding: 22px 175px 22px 26px;
  background: #111113; color: #edeef0; border-radius: 20px;
  box-shadow: 0 24px 60px rgb(28 32 36 / 0.25);
}
.top { display: flex; align-items: center; gap: var(--space-2); margin-bottom: 14px; font-size: 0.8rem; color: #9a9ca3; white-space: nowrap; }
.live { display: inline-flex; align-items: center; gap: 6px; font-size: 0.72rem; color: #9a9ca3; }
.live i { width: 8px; height: 8px; border-radius: 50%; background: var(--signal); }
.chip {
  padding: 5px var(--space-3); border-radius: var(--radius-sm); background: #2b2b36; color: #b8baf8;
  font-weight: 800; letter-spacing: 0.14em; white-space: nowrap;
}
.q { margin: 0 0 22px; font-size: 1.5rem; font-weight: 800; letter-spacing: -0.01em; line-height: 1.25; }
.bar { margin-bottom: 14px; }
.bar-label { display: flex; justify-content: space-between; gap: var(--space-2); margin-bottom: 6px; font-size: var(--fs-sm); color: #d6d7db; }
.track { height: 14px; border-radius: 7px; background: rgb(255 255 255 / 0.13); overflow: hidden; }
.fill { height: 100%; border-radius: 7px; transform-origin: left; animation: grow var(--dur-bars) var(--ease) both; }
@keyframes grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.phone {
  position: absolute; right: 0; bottom: 0; width: 190px; height: 340px; padding: 18px 14px;
  background: #1a1a1f; color: #edeef0; border: 6px solid #2a2a31; border-radius: 30px;
  box-shadow: 0 20px 50px rgb(28 32 36 / 0.35);
}
.pq { margin: 10px 0 var(--space-3); font-size: 0.95rem; font-weight: 800; }
.opt {
  display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2); padding: 9px 11px;
  border-radius: var(--radius-md); background: #26262d; font-size: var(--fs-xs);
}
.opt i { width: 10px; height: 10px; border-radius: 50%; border: 2px solid #7878d8; flex-shrink: 0; }
.opt.sel { background: #2b2b44; outline: 1.5px solid var(--lead); }
.opt.sel i { background: var(--lead); }

@media (max-width: 760px) {
  .preview { height: 360px; }
  .stage { inset: 0 30px 50px 0; padding: var(--space-4) 138px var(--space-4) var(--space-4); }
  .chip, .count { display: none; }
  .q { margin-bottom: 14px; font-size: 1.1rem; }
  .phone { width: 128px; height: 250px; padding: 14px 10px; border-radius: 26px; }
  .pq { font-size: 0.72rem; }
  .opt { gap: 5px; padding: 6px 7px; font-size: 0.64rem; }
}
@media (prefers-reduced-motion: reduce) {
  .fill { animation: none; }
}
</style>
