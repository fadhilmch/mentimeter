<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import { STEPS, QUESTION_TYPES, FEATURES } from '../landing/content'
import JoinWithCode from '../components/landing/JoinWithCode.vue'
import SamplePreview from '../components/landing/SamplePreview.vue'

const auth = useAuthStore()
// Signed-in presenters go straight to their dashboard.
const createTarget = computed(() => (auth.isLoggedIn ? { name: 'dashboard' } : { name: 'signup' }))
</script>

<template>
  <div class="landing">
    <section class="hero-grid">
      <div class="copy">
        <p class="eyebrow">Live polling for any room</p>
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

    <section class="band" aria-labelledby="steps-title">
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

    <section class="band" aria-labelledby="types-title">
      <h2 id="types-title">Six ways to ask</h2>
      <p class="band-lead">Mix question types in one presentation.</p>
      <ul class="grid three">
        <li v-for="t in QUESTION_TYPES" :key="t.name" class="type">
          <span class="tile" :style="{ background: t.color }" aria-hidden="true">{{ t.glyph }}</span>
          <span>
            <b>{{ t.name }}</b>
            <span class="type-text">{{ t.text }}</span>
          </span>
        </li>
      </ul>
    </section>

    <section class="band" aria-labelledby="features-title">
      <h2 id="features-title">Made for live rooms</h2>
      <p class="band-lead">Simple for the audience, in control for the presenter.</p>
      <ul class="grid two">
        <li v-for="f in FEATURES" :key="f.title" class="card">
          <h3>{{ f.title }}</h3>
          <p>{{ f.text }}</p>
        </li>
      </ul>
    </section>

    <section class="final">
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
.landing { max-width: 1120px; margin: 0 auto; padding: 0 24px 48px; }
.hero-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 48px; align-items: center; padding: 72px 0 64px; }
.eyebrow { margin: 0 0 14px; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--lead); }
h1 { margin: 0 0 18px; font-size: clamp(2.3rem, 5vw, 3.4rem); line-height: 1.05; letter-spacing: -0.03em; font-weight: 800; }
h1 em {
  font-style: normal; color: var(--lead);
  background: linear-gradient(90deg, var(--lead), var(--signal)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.lead { max-width: 520px; margin: 0 0 28px; font-size: 1.15rem; line-height: 1.55; color: var(--ink-2); }
.cta { display: flex; flex-direction: column; gap: 14px; max-width: 460px; }
.band { padding: 56px 0; border-top: 1px solid var(--line); }
.band h2 { margin: 0 0 8px; font-size: clamp(1.6rem, 3vw, 2rem); letter-spacing: -0.02em; }
.band-lead { max-width: 560px; margin: 0 0 32px; font-size: 1.05rem; line-height: 1.5; color: var(--ink-2); }
.grid { display: grid; gap: 20px; margin: 0; padding: 0; list-style: none; }
.grid.three { grid-template-columns: repeat(3, 1fr); }
.grid.two { grid-template-columns: repeat(2, 1fr); }
.card h3 { margin: 0 0 6px; font-size: 1.15rem; }
.card p { margin: 0; font-size: 0.97rem; line-height: 1.5; color: var(--ink-2); }
.num {
  display: grid; place-items: center; width: 34px; height: 34px; margin-bottom: 14px;
  border-radius: 10px; background: var(--lead-soft); color: var(--lead); font-weight: 800;
}
.type {
  display: flex; align-items: center; gap: 12px; padding: 16px;
  background: var(--card); border: 1px solid var(--line); border-radius: 14px;
}
.tile { display: grid; place-items: center; flex-shrink: 0; width: 38px; height: 38px; border-radius: 11px; color: #fff; font-weight: 800; }
.type b { display: block; }
.type-text { display: block; font-size: 0.85rem; color: var(--ink-2); }
.final {
  margin: 8px 0 24px; padding: 48px 32px; text-align: center;
  background: #111113; color: #fff; border-radius: 24px;
}
.final h2 { margin: 0 0 8px; font-size: clamp(1.5rem, 3vw, 2rem); }
.final p { margin: 0 0 24px; color: #b0b2ba; }
.final-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
.ghost-light { background: transparent; color: #fff; border: 1px solid #4a4a55; }
.ghost-light:hover { background: rgb(255 255 255 / 0.08); }

@media (max-width: 760px) {
  .landing { padding: 0 20px 32px; }
  .hero-grid { grid-template-columns: 1fr; gap: 32px; padding: 36px 0 40px; }
  .lead { font-size: 1.02rem; }
  .cta { max-width: none; }
  .band { padding: 40px 0; }
  .grid.three, .grid.two { grid-template-columns: 1fr; }
  .final { padding: 36px 20px; }
}
</style>
