<script setup lang="ts">
import { computed } from 'vue'
import { readableOn } from '../themes'
import { useAuthStore } from '../stores/auth'
import { STEPS, QUESTION_TYPES, FEATURES } from '../landing/content'
import JoinWithCode from '../components/landing/JoinWithCode.vue'
import SamplePreview from '../components/landing/SamplePreview.vue'
import { vReveal } from '../landing/reveal'

const auth = useAuthStore()
// Signed-in presenters go straight to their dashboard.
const createTarget = computed(() => (auth.isLoggedIn ? { name: 'dashboard' } : { name: 'signup' }))
</script>

<template>
  <div class="landing">
    <section class="hero-grid">
      <div class="copy">
        <p class="eyebrow">Interactive presentations for any room</p>
        <h1>Ask the room. <em>Watch the answers flow in.</em></h1>
        <p class="lead">
          Build a short presentation, share a 6-digit code, and your audience answers from their phones. No sign-up for
          them. Results move on the big screen as people vote.
        </p>
        <div class="cta">
          <RouterLink class="button big block" :to="createTarget">Create a presentation</RouterLink>
          <div><JoinWithCode /></div>
        </div>
      </div>
      <SamplePreview class="visual" />
    </section>

    <section v-reveal class="band" aria-labelledby="steps-title">
      <h2 id="steps-title">From question to results in three steps</h2>
      <p class="band-lead">No installs, no accounts for the audience.</p>
      <ol class="grid three">
        <li v-for="(step, i) in STEPS" :key="step.title" class="card">
          <span class="num" aria-hidden="true">{{ i + 1 }}</span>
          <h3>{{ step.title }}</h3>
          <p>{{ step.text }}</p>
        </li>
      </ol>
    </section>

    <section v-reveal class="band" aria-labelledby="types-title">
      <h2 id="types-title">Six ways to ask</h2>
      <p class="band-lead">Mix question types in one presentation.</p>
      <ul class="grid three">
        <li v-for="t in QUESTION_TYPES" :key="t.name" class="type">
          <span class="tile" :style="{ background: t.color, color: readableOn(t.color) }" aria-hidden="true">{{ t.glyph }}</span>
          <span>
            <b>{{ t.name }}</b>
            <span class="type-text">{{ t.text }}</span>
          </span>
        </li>
      </ul>
    </section>

    <section v-reveal class="band" aria-labelledby="features-title">
      <h2 id="features-title">Made for live rooms</h2>
      <p class="band-lead">Simple for the audience, in control for the presenter.</p>
      <ul class="grid two">
        <li v-for="f in FEATURES" :key="f.title" class="card">
          <h3>{{ f.title }}</h3>
          <p>{{ f.text }}</p>
        </li>
      </ul>
    </section>

    <section v-reveal class="final">
      <h2>Ready to ask your first question?</h2>
      <p>Create a presentation, or join one with a code.</p>
      <div class="final-actions">
        <RouterLink class="button big" :to="createTarget">Create a presentation</RouterLink>
        <RouterLink class="button big ghost-light" :to="{ name: 'join' }">Join with a code</RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.landing { max-width: 1120px; margin: 0 auto; padding: 0 var(--space-5) var(--space-7); }
.hero-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: var(--space-7); align-items: center; padding: 72px 0 64px; }
.eyebrow { margin: 0 0 14px; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--lead); }
h1 { margin: 0 0 18px; font-size: clamp(2.3rem, 5vw, 3.4rem); line-height: 1.05; letter-spacing: -0.03em; font-weight: 800; }
h1 em {
  font-style: normal; color: var(--lead);
  background: linear-gradient(90deg, var(--lead), var(--signal)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.lead { max-width: 520px; margin: 0 0 28px; font-size: var(--fs-lg); line-height: 1.55; color: var(--ink-2); }
.cta { display: flex; flex-direction: column; gap: 14px; max-width: 460px; }
.band { padding: 56px 0; border-top: 1px solid var(--line); }
.band h2 { margin: 0 0 var(--space-2); font-size: clamp(1.6rem, 3vw, 2rem); letter-spacing: -0.02em; }
.band-lead { max-width: 560px; margin: 0 0 var(--space-6); font-size: var(--fs-md); line-height: 1.5; color: var(--ink-2); }
.grid { display: grid; gap: 20px; margin: 0; padding: 0; list-style: none; }
.grid.three { grid-template-columns: repeat(3, 1fr); }
.grid.two { grid-template-columns: repeat(2, 1fr); }
.card h3 { margin: 0 0 6px; font-size: var(--fs-lg); }
.card p { margin: 0; font-size: 0.97rem; line-height: 1.5; color: var(--ink-2); }
.num {
  display: grid; place-items: center; width: 34px; height: 34px; margin-bottom: 14px;
  border-radius: var(--radius-md); background: var(--lead-soft); color: var(--lead); font-weight: 800;
}
.type {
  display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4);
  background: var(--card); border: 1px solid var(--line); border-radius: var(--radius);
}
.tile { display: grid; place-items: center; flex-shrink: 0; width: 38px; height: 38px; border-radius: 11px; color: var(--on-accent); font-weight: 800; }
.type b { display: block; }
.type-text { display: block; font-size: var(--fs-sm); color: var(--ink-2); }
.final {
  margin: var(--space-2) 0 var(--space-5); padding: var(--space-7) var(--space-6); text-align: center;
  background: var(--inverse); color: var(--inverse-ink); border-radius: 24px;
}
.final h2 { margin: 0 0 var(--space-2); font-size: clamp(1.5rem, 3vw, 2rem); }
.final p { margin: 0 0 var(--space-5); color: var(--inverse-muted); }
.final-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-3); }
.ghost-light { background: transparent; color: var(--inverse-ink); border: 1px solid var(--inverse-line); }
.ghost-light:hover { background: rgb(255 255 255 / 0.08); }

/* Hero entrance: headline, subtext, buttons, then the preview. Never delays content
   for reduced-motion users (guarded below). */
.copy > *, .visual { animation: hero-rise 520ms var(--ease) both; }
.copy > *:nth-child(2) { animation-delay: 70ms; }
.copy > *:nth-child(3) { animation-delay: 140ms; }
.copy > *:nth-child(4) { animation-delay: 210ms; }
.visual { animation-delay: 260ms; }
@keyframes hero-rise {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: none; }
}

/* Scroll reveals: sections fade/rise in the first time they enter the viewport.
   The pre-state only exists once the v-reveal directive adds .reveal, so no-JS
   IntersectionObserver keeps everything visible. */
.reveal > h2, .reveal > .band-lead, .reveal .grid > *, .reveal.final > * {
  opacity: 0; transform: translateY(16px);
  transition: opacity 420ms var(--ease), transform 420ms var(--ease);
}
.reveal.revealed > h2, .reveal.revealed > .band-lead, .reveal.revealed .grid > *, .reveal.revealed.final > * {
  opacity: 1; transform: none;
}
.reveal.revealed .grid > *:nth-child(2) { transition-delay: 80ms; }
.reveal.revealed .grid > *:nth-child(3) { transition-delay: 160ms; }
.reveal.revealed .grid > *:nth-child(4) { transition-delay: 240ms; }
.reveal.revealed > .band-lead { transition-delay: 60ms; }

/* Hover lift on the step cards and question-type tiles. */
.grid .card, .type { transition: transform var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease); }
@media (hover: hover) {
  .grid .card:hover, .type:hover { transform: translateY(-3px); box-shadow: 0 6px 18px rgb(28 32 36 / 0.10); }
}

@media (prefers-reduced-motion: reduce) {
  .copy > *, .visual { animation: none; }
  .reveal > h2, .reveal > .band-lead, .reveal .grid > *, .reveal.final > * { opacity: 1; transform: none; transition: none; }
  .grid .card, .type { transition: none; }
  .grid .card:hover, .type:hover { transform: none; }
}

@media (max-width: 760px) {
  .landing { padding: 0 20px var(--space-6); }
  .hero-grid { grid-template-columns: 1fr; gap: var(--space-6); padding: 36px 0 40px; }
  .lead { font-size: 1.02rem; }
  .cta { max-width: none; }
  .band { padding: 40px 0; }
  .grid.three, .grid.two { grid-template-columns: 1fr; }
  .final { padding: 36px 20px; }
}
</style>
