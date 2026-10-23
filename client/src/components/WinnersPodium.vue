<script setup lang="ts">
import { computed } from 'vue'
import ParticipantAvatar from './ParticipantAvatar.vue'
import { placeLabel, podiumDisplayOrder, podiumPlaces, scoreLabel, scoringHint } from '../podium'
import type { LeaderboardEntry } from '../types'

/** The winners' moment: top three on a podium with a burst of confetti. */
const props = defineProps<{
  leaderboard: LeaderboardEntry[]
  scoring?: 'standard' | 'speed'
  /** Palette used for confetti and the medal colours (the presentation theme's). */
  palette: string[]
  /** The phone's own player key, to show "You". */
  myKey?: string
  variant: 'stage' | 'audience'
}>()

const places = computed(() => podiumDisplayOrder(podiumPlaces(props.leaderboard)))
const winner = computed(() => podiumPlaces(props.leaderboard)[0])
const me = computed(() => props.leaderboard.find((e) => e.key === props.myKey))
const medal = (rank: number) => props.palette[(rank + 1) % props.palette.length]
// Fixed, spread-out pieces: the same every render so the screen never flickers.
const pieces = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 53) % 100) / 100,
  duration: 2.6 + ((i * 29) % 15) / 10,
  rotate: (i * 47) % 360,
}))
const ariaSummary = computed(() =>
  places.value.length ? `Winners: ${podiumPlaces(props.leaderboard).map((p) => `${p.rank}. ${placeLabel(p)}`).join(', ')}` : 'No winners yet',
)
</script>

<template>
  <section class="podium" :class="`podium-${variant}`" data-testid="winners-podium" :aria-label="ariaSummary">
    <div class="confetti" aria-hidden="true">
      <span
        v-for="(p, i) in pieces"
        :key="i"
        class="piece"
        :style="{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`, background: palette[i % palette.length], rotate: `${p.rotate}deg` }"
      ></span>
    </div>
    <p class="podium-eyebrow">Final results</p>
    <h2 class="podium-title">{{ winner ? `${placeLabel(winner)} won!` : 'Final leaderboard' }}</h2>
    <p v-if="winner && winner.entries.length === 1" class="podium-sub">{{ scoreLabel(winner.entries[0].score, scoring) }}</p>

    <ol v-if="places.length" class="podium-steps">
      <li v-for="place in places" :key="place.rank" class="step" :class="`rank-${place.rank}`" :data-rank="place.rank">
        <div class="step-who">
          <ParticipantAvatar :name="place.entries[0].name" :size="variant === 'stage' ? 64 : 48" />
          <span class="step-name">{{ placeLabel(place) }}<span v-if="place.entries.some((e) => e.key === myKey)" class="you-chip">You</span></span>
          <span class="step-score">{{ scoreLabel(place.entries[0].score, scoring) }}</span>
        </div>
        <div class="step-block" :style="{ background: medal(place.rank) }"><span class="step-rank">{{ place.rank }}</span></div>
      </li>
    </ol>
    <p v-else class="podium-sub">Nobody answered a quiz question.</p>

    <p v-if="me && me.rank > 3" class="podium-me">You finished #{{ me.rank }} of {{ leaderboard.length }} with {{ scoreLabel(me.score, scoring) }}.</p>
    <p class="podium-hint">{{ scoringHint(scoring) }}</p>
  </section>
</template>

<style scoped>
.podium {
  position: relative;
  overflow: hidden;
  text-align: center;
  color: var(--t-ink);
  background: var(--t-stage2);
  border-radius: var(--radius);
  padding: var(--space-6) var(--space-5) var(--space-5);
}
.podium-eyebrow { margin: 0 0 var(--space-1); font-size: var(--fs-sm); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.7; }
.podium-title { margin: 0; font-size: clamp(1.6rem, 5vw, 3rem); font-weight: 800; letter-spacing: -0.02em; overflow-wrap: anywhere; }
.podium-sub { margin: var(--space-2) 0 0; font-size: var(--fs-lg); opacity: 0.85; }
.podium-steps {
  list-style: none; margin: var(--space-5) auto var(--space-3); padding: 0;
  display: flex; align-items: flex-end; justify-content: center; gap: var(--space-3);
  max-width: 560px;
}
.step { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: var(--space-2); }
.step-who { display: flex; flex-direction: column; align-items: center; gap: var(--space-1); max-width: 100%; }
.step-name { font-weight: 700; overflow-wrap: anywhere; display: inline-flex; flex-wrap: wrap; gap: var(--space-1); justify-content: center; align-items: center; }
.step-score { font-size: var(--fs-sm); opacity: 0.8; font-variant-numeric: tabular-nums; }
.step-block {
  width: 100%; border-radius: var(--radius-md) var(--radius-md) 0 0;
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: var(--space-2);
  color: var(--t-onaccink);
  transform-origin: bottom;
  animation: rise 700ms var(--ease) both;
}
.rank-1 .step-block { height: 140px; }
.rank-2 .step-block { height: 100px; animation-delay: 150ms; }
.rank-3 .step-block { height: 72px; animation-delay: 300ms; }
.podium-stage .rank-1 .step-block { height: 200px; }
.podium-stage .rank-2 .step-block { height: 140px; }
.podium-stage .rank-3 .step-block { height: 100px; }
.step-rank { font-size: 1.6rem; font-weight: 800; }
.you-chip { font-size: var(--fs-xs); font-weight: 700; padding: 1px var(--space-2); border-radius: var(--radius-pill); background: var(--t-acc); color: var(--t-sbg); }
.podium-me { margin: var(--space-3) 0 0; font-weight: 600; }
.podium-hint { margin: var(--space-2) 0 0; font-size: var(--fs-sm); opacity: 0.7; }

.confetti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.piece {
  position: absolute; top: -12px; width: 9px; height: 15px; border-radius: 2px; opacity: 0;
  animation-name: fall; animation-timing-function: ease-in; animation-iteration-count: 2; animation-fill-mode: both;
}
@keyframes fall {
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(520px) rotate(540deg); opacity: 0; }
}
@keyframes rise { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@media (prefers-reduced-motion: reduce) {
  .confetti { display: none; }
  .step-block { animation: none; }
}
</style>
