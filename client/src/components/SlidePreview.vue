<script setup lang="ts">
import { computed } from 'vue'
import { getTheme, themeVars } from '../themes'
import { useColorMode } from '../colorMode'

export interface PreviewSlide {
  question: string
  questionType: 'multiple-choice' | 'open-ended' | 'word-cloud' | 'rating' | 'ranking' | 'quiz'
  options: { text: string }[]
  correctOptionId?: string
  design?: { accent?: string; imageUrl?: string; imageLayout?: 'beside' | 'behind' }
}

const props = defineProps<{ slide: PreviewSlide; themeId: string }>()

const theme = computed(() => getTheme(props.themeId))
const { mode } = useColorMode()
const style = computed(() => themeVars(theme.value, mode.value))
const pal = computed(() => theme.value.pal)
const accent = computed(() => props.slide.design?.accent ?? themeVars(theme.value, mode.value)['--t-acc'])
const hasOptions = computed(() => ['multiple-choice', 'quiz', 'ranking'].includes(props.slide.questionType))
</script>

<template>
  <div class="sp-stage" :style="style" aria-label="Stage preview">
    <div
      class="sp-head"
      :class="{ 'has-image': slide.design?.imageUrl, behind: (slide.design?.imageLayout ?? 'beside') === 'behind' }"
      :style="slide.design?.imageUrl && (slide.design?.imageLayout ?? 'beside') === 'behind' ? { backgroundImage: `linear-gradient(rgba(8,8,10,0.62), rgba(8,8,10,0.62)), url(${slide.design.imageUrl})` } : {}"
    >
      <img v-if="slide.design?.imageUrl && (slide.design?.imageLayout ?? 'beside') === 'beside'" :src="slide.design.imageUrl" alt="" class="sp-image" />
      <p class="sp-question" :style="slide.design?.accent ? { borderLeft: `4px solid ${slide.design.accent}`, paddingLeft: '12px' } : {}">{{ slide.question.trim() || 'Your question appears here' }}</p>
    </div>
    <template v-if="hasOptions">
      <div v-for="(option, i) in slide.options" :key="i" class="sp-row">
        <div class="sp-label">
          <span class="sp-opt"><span class="sp-chip" :style="{ background: pal[i % pal.length] }"></span>{{ option.text.trim() || `Option ${i + 1}` }}</span>
          <span class="sp-count">{{ slide.questionType === 'ranking' ? '0 pts' : '0 · 0%' }}</span>
        </div>
        <div class="sp-track"></div>
      </div>
      <p class="sp-foot">{{ slide.questionType === 'quiz' ? 'Correct answer revealed when results show' : slide.questionType === 'ranking' ? 'The audience orders these best-first' : '0 votes' }}</p>
    </template>
    <template v-else-if="slide.questionType === 'word-cloud'">
      <p class="sp-cloud"><span :style="{ color: pal[0], fontSize: '1.7rem' }">words</span> <span :style="{ color: pal[1], fontSize: '1.15rem' }">grow</span> <span :style="{ color: pal[2], fontSize: '1.4rem' }">with</span> <span :style="{ color: pal[3], fontSize: '1.05rem' }">each</span> <span :style="{ color: pal[4], fontSize: '1.55rem' }">answer</span></p>
      <p class="sp-foot">Single words, sized by how many people said them</p>
    </template>
    <template v-else-if="slide.questionType === 'rating'">
      <p class="sp-big" :style="{ color: accent }">0.0</p>
      <p class="sp-foot">Average of 0 ratings, on a 1-10 scale</p>
    </template>
    <template v-else>
      <p class="sp-foot">The audience types free-text answers here.</p>
    </template>
  </div>
</template>

<style scoped>
.sp-stage {
  background: var(--t-sbg);
  border-radius: var(--radius);
  padding: 22px var(--space-5);
  color: var(--t-ink);
}
.sp-question {
  margin: 0 0 var(--space-4);
  font-size: var(--fs-lg);
  font-weight: 800;
  letter-spacing: -0.01em;
  word-break: break-word;
}
.sp-row {
  margin-bottom: var(--space-3);
}
.sp-label {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  font-size: var(--fs-sm);
  font-weight: 600;
  margin-bottom: 5px;
}
.sp-opt {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  word-break: break-word;
}
.sp-chip {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}
.sp-count {
  color: color-mix(in srgb, var(--t-ink) 72%, transparent);
  flex-shrink: 0;
}
.sp-track {
  height: 10px;
  border-radius: var(--radius-pill);
  background: var(--t-track);
}
.sp-foot {
  margin: var(--space-3) 0 0;
  color: color-mix(in srgb, var(--t-ink) 72%, transparent);
  font-size: var(--fs-sm);
}
.sp-head.has-image:not(.behind) {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: var(--space-4);
}
.sp-head.behind {
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background-size: cover;
  background-position: center;
  margin-bottom: var(--space-4);
}
.sp-head:not(.has-image) {
  margin-bottom: 0;
}
.sp-head.has-image .sp-question, .sp-head.behind .sp-question {
  margin: 0;
}
.sp-image {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: var(--radius-lg);
  flex-shrink: 0;
}
.sp-cloud {
  margin: var(--space-2) 0 0;
  font-weight: 800;
  display: flex;
  gap: 10px;
  align-items: baseline;
  flex-wrap: wrap;
}
.sp-big {
  margin: var(--space-1) 0 0;
  font-size: 3rem;
  font-weight: 900;
  letter-spacing: -0.03em;
}
</style>
