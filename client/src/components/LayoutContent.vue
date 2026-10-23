<script setup lang="ts">
import { computed } from 'vue'
import { imageSrc } from '../api'
import type { SlideColumn, SlideDesign } from '../types'

/** Content slides: title, columns and image only. Used by the stage, the phones and the editor preview. */
const props = defineProps<{
  slide: { questionType: string; question: string; body?: string; columns?: SlideColumn[]; design?: SlideDesign }
  variant: 'stage' | 'audience' | 'preview'
  /** Shown in the editor preview when a field is still empty. */
  placeholders?: boolean
}>()

const image = computed(() => imageSrc(props.slide.design?.imageUrl))
const behind = computed(() => !!image.value && (props.slide.design?.imageLayout ?? 'beside') === 'behind')
const columns = computed(() => (props.slide.columns ?? []).filter((c) => props.placeholders || c.title || c.text))
const heading = computed(() => props.slide.question.trim() || (props.placeholders ? 'Your title appears here' : ''))
const accent = computed(() => props.slide.design?.accent)
</script>

<template>
  <section
    class="lc"
    :class="[`lc-${variant}`, `lc-type-${slide.questionType}`, { 'lc-behind': behind }]"
    :style="behind ? { backgroundImage: `linear-gradient(rgba(8,8,10,0.62), rgba(8,8,10,0.62)), url(${image})` } : {}"
    :data-testid="`layout-${slide.questionType}`"
  >
    <template v-if="slide.questionType === 'image'">
      <img v-if="image" class="lc-picture" :src="image" :alt="slide.question" />
      <p v-else-if="placeholders" class="lc-empty">Upload an image in Slide design</p>
      <p v-if="heading" class="lc-caption">{{ heading }}</p>
    </template>

    <template v-else-if="slide.questionType === 'columns'">
      <h1 class="lc-heading" :style="accent ? { borderLeft: `4px solid ${accent}`, paddingLeft: '12px' } : {}">{{ heading }}</h1>
      <div class="lc-columns" :style="{ '--lc-count': Math.max(columns.length, 1) }">
        <article v-for="(column, i) in columns" :key="i" class="lc-column" :style="accent ? { borderTopColor: accent } : {}">
          <h2 v-if="column.title || placeholders" class="lc-column-title" :class="{ 'lc-empty': !column.title }">{{ column.title || `Column ${i + 1}` }}</h2>
          <p v-if="column.text || placeholders" class="lc-column-text" :class="{ 'lc-empty': !column.text }">{{ column.text || 'Text' }}</p>
        </article>
      </div>
    </template>

    <template v-else>
      <img v-if="image && !behind" class="lc-hero-image" :src="image" alt="" />
      <h1 class="lc-heading lc-title" :style="accent ? { borderBottom: `4px solid ${accent}` } : {}">{{ heading }}</h1>
      <p v-if="slide.body" class="lc-subtitle">{{ slide.body }}</p>
      <p v-else-if="placeholders" class="lc-subtitle lc-empty">Subtitle</p>
    </template>
  </section>
</template>

<style scoped>
.lc {
  color: var(--t-ink);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  background-size: cover;
  background-position: center;
  border-radius: var(--radius);
  min-width: 0;
}
.lc-behind {
  color: white;
  padding: var(--space-6) var(--space-5);
}
.lc-heading {
  margin: 0;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.12;
  overflow-wrap: anywhere;
}
.lc-title { text-align: center; align-self: center; padding-bottom: var(--space-3); }
.lc-subtitle { margin: 0; text-align: center; opacity: 0.8; overflow-wrap: anywhere; }
.lc-hero-image { align-self: center; max-width: 100%; max-height: 32vh; object-fit: contain; border-radius: var(--radius-lg); }
.lc-picture { width: 100%; max-height: 70vh; object-fit: contain; border-radius: var(--radius-lg); }
.lc-caption { margin: 0; text-align: center; opacity: 0.8; overflow-wrap: anywhere; }
.lc-empty { opacity: 0.55; margin: 0; }
.lc-type-title .lc-empty, .lc-type-image .lc-empty { text-align: center; }
.lc-columns {
  display: grid;
  grid-template-columns: repeat(var(--lc-count), minmax(0, 1fr));
  gap: var(--space-4);
}
.lc-column {
  border-top: 4px solid var(--t-acc);
  background: color-mix(in srgb, var(--t-ink) 7%, transparent);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  min-width: 0;
}
.lc-column-title { margin: 0 0 var(--space-2); font-weight: 700; overflow-wrap: anywhere; }
.lc-column-text { margin: 0; white-space: pre-line; opacity: 0.88; overflow-wrap: anywhere; }

/* Presenter stage: sized for a room. */
.lc-stage { padding-block: var(--space-5); }
.lc-stage .lc-heading { font-size: clamp(2rem, 5vw, 3.6rem); }
.lc-stage .lc-title { font-size: clamp(2.6rem, 7vw, 5rem); }
.lc-stage .lc-subtitle { font-size: clamp(1.2rem, 2.6vw, 2rem); }
.lc-stage .lc-column-title { font-size: clamp(1.2rem, 2.4vw, 1.8rem); }
.lc-stage .lc-column-text { font-size: clamp(1rem, 2vw, 1.45rem); }
.lc-stage .lc-caption { font-size: clamp(1rem, 2vw, 1.4rem); }

/* Phones: a readable copy of what the room is looking at. */
.lc-audience .lc-heading { font-size: clamp(1.5rem, 6vw, 2.1rem); }
.lc-audience .lc-title { font-size: clamp(1.8rem, 8vw, 2.6rem); }
.lc-audience .lc-subtitle { font-size: var(--fs-lg); }
.lc-audience .lc-columns { grid-template-columns: 1fr; }
.lc-audience .lc-column-text { font-size: var(--fs-md); }

/* Editor preview and thumbnails: rendered at a fixed width and scaled by the caller. */
.lc-preview { gap: var(--space-3); }
.lc-preview .lc-heading { font-size: 1.6rem; }
.lc-preview .lc-title { font-size: 2rem; }
.lc-preview .lc-subtitle { font-size: var(--fs-md); }
.lc-preview .lc-column { padding: var(--space-3); }
.lc-preview .lc-column-title { font-size: var(--fs-md); }
.lc-preview .lc-column-text { font-size: var(--fs-sm); }
.lc-preview .lc-picture { max-height: 220px; }

@media (max-width: 640px) {
  .lc-stage .lc-columns { grid-template-columns: 1fr; }
}
</style>
