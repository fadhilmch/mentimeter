<script setup lang="ts">
import { computed } from 'vue'
import { getTheme, themeVars } from '../themes'

export interface PreviewSlide {
  question: string
  questionType: 'multiple-choice' | 'open-ended'
  options: { text: string }[]
}

const props = defineProps<{ slide: PreviewSlide; themeId: string }>()

const theme = computed(() => getTheme(props.themeId))
const style = computed(() => themeVars(theme.value))
const pal = computed(() => theme.value.pal)
</script>

<template>
  <div class="sp-stage" :style="style" aria-label="Stage preview">
    <p class="sp-question">{{ slide.question.trim() || 'Your question appears here' }}</p>
    <template v-if="slide.questionType === 'multiple-choice'">
      <div v-for="(option, i) in slide.options" :key="i" class="sp-row">
        <div class="sp-label">
          <span class="sp-opt"><span class="sp-chip" :style="{ background: pal[i % pal.length] }"></span>{{ option.text.trim() || `Option ${i + 1}` }}</span>
          <span class="sp-count">0 · 0%</span>
        </div>
        <div class="sp-track"></div>
      </div>
      <p class="sp-foot">0 votes</p>
    </template>
    <template v-else>
      <p class="sp-foot">The audience types free-text answers here.</p>
    </template>
  </div>
</template>

<style scoped>
.sp-stage {
  background: var(--t-sbg);
  border-radius: 14px;
  padding: 22px 24px;
  color: #edeef0;
}
.sp-question {
  margin: 0 0 16px;
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  word-break: break-word;
}
.sp-row {
  margin-bottom: 12px;
}
.sp-label {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 5px;
}
.sp-opt {
  display: inline-flex;
  align-items: center;
  gap: 8px;
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
  color: rgba(255, 255, 255, 0.6);
  flex-shrink: 0;
}
.sp-track {
  height: 10px;
  border-radius: 999px;
  background: var(--t-track);
}
.sp-foot {
  margin: 12px 0 0;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
}
</style>
