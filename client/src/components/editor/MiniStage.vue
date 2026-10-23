<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import SlidePreview from '../SlidePreview.vue'
import type { PreviewSlide } from '../SlidePreview.vue'

/** A SlidePreview scaled down to thumbnail size. The stage renders once at a fixed
    width and is transformed to fit, so thumbnails always match the real stage. */
defineProps<{ slide: PreviewSlide; themeId: string }>()

const STAGE_W = 420
const box = ref<HTMLElement | null>(null)
const inner = ref<HTMLElement | null>(null)
const scale = ref(0.3)
let ro: ResizeObserver | null = null

function update() {
  if (!box.value || !inner.value) return
  scale.value = box.value.clientWidth / STAGE_W
  box.value.style.height = `${Math.ceil(inner.value.offsetHeight * scale.value)}px`
}

onMounted(() => {
  update()
  if (typeof ResizeObserver === 'undefined') return
  ro = new ResizeObserver(update)
  if (box.value) ro.observe(box.value)
  if (inner.value) ro.observe(inner.value)
})
onBeforeUnmount(() => ro?.disconnect())
</script>

<template>
  <div ref="box" class="mini-stage" aria-hidden="true">
    <div ref="inner" class="mini-inner" :style="{ width: STAGE_W + 'px', transform: `scale(${scale})` }">
      <SlidePreview :slide="slide" :theme-id="themeId" />
    </div>
  </div>
</template>

<style scoped>
.mini-stage {
  width: 100%;
  min-width: 0;
  overflow: hidden;
  border-radius: var(--radius-md);
  pointer-events: none;
}
.mini-inner {
  transform-origin: top left;
}
</style>
