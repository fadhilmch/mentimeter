<script setup lang="ts">
import { ref } from 'vue'
import MiniStage from './MiniStage.vue'
import { typeLabel, typeShort, type SlideType } from '../../editor/slideTypes'

export interface SorterSlide {
  id?: string
  questionType: SlideType
  question: string
  options: { id?: string; text: string }[]
  design?: { accent?: string; imageUrl?: string; imageLayout?: 'beside' | 'behind' }
}

defineProps<{ slides: SorterSlide[]; active: number; themeId: string }>()
const emit = defineEmits<{ select: [number]; reorder: [number, number]; add: [] }>()

const dragFrom = ref<number | null>(null)
const dropAt = ref<number | null>(null)

function onDragStart(index: number, event: DragEvent) {
  dragFrom.value = index
  event.dataTransfer?.setData('text/plain', String(index))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function onDragOver(index: number, event: DragEvent) {
  if (dragFrom.value === null) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dropAt.value = index
}
function onDrop(index: number, event: DragEvent) {
  event.preventDefault()
  if (dragFrom.value !== null && dragFrom.value !== index) emit('reorder', dragFrom.value, index)
  onDragEnd()
}
function onDragEnd() {
  dragFrom.value = null
  dropAt.value = null
}
</script>

<template>
  <div class="sorter">
    <p class="sorter-title">Slides <span class="sorter-count">{{ slides.length }}</span></p>
    <div class="sorter-body">
    <ol class="sorter-list" aria-label="Slides, in order">
      <li v-for="(slide, i) in slides" :key="slide.id ?? `new-${i}`">
        <button
          type="button"
          class="sorter-item"
          :class="{ active: i === active, 'drop-target': dropAt === i && dragFrom !== null && dragFrom !== i, dragging: dragFrom === i }"
          :aria-current="i === active ? 'true' : undefined"
          data-testid="sorter-item"
          draggable="true"
          @click="emit('select', i)"
          @dragstart="onDragStart(i, $event)"
          @dragover="onDragOver(i, $event)"
          @drop="onDrop(i, $event)"
          @dragend="onDragEnd"
        >
          <span class="thumb"><MiniStage :slide="slide" :theme-id="themeId" /></span>
          <span class="meta">
            <span class="name">{{ i + 1 }} · <span class="lbl-full">{{ typeLabel(slide.questionType) }}</span><span class="lbl-short">{{ typeShort(slide.questionType) }}</span></span>
            <span v-if="i === active" class="editing-badge">Editing</span>
            <span class="visually-hidden">Drag to reorder.</span>
          </span>
        </button>
      </li>
    </ol>
    <button type="button" class="add-slide" @click="emit('add')">+ Add slide</button>
    </div>
  </div>
</template>

<style scoped>
.sorter-title {
  margin: 0 0 var(--space-2);
  font-size: var(--fs-base);
  font-weight: 800;
}
.sorter-count {
  color: var(--ink-3);
  font-weight: 700;
}
.sorter-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sorter-item {
  display: block;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 2px solid var(--line);
  border-radius: var(--radius);
  background: var(--card);
  cursor: pointer;
  font: inherit;
  text-align: left;
  overflow: hidden;
  transition: border-color var(--dur-fast) var(--ease);
}
.sorter-item:hover { border-color: var(--accent); }
.sorter-item.active { border-color: var(--accent); }
.sorter-item.dragging { opacity: 0.5; }
.sorter-item.drop-target { border-style: dashed; border-color: var(--accent); }
.thumb {
  display: block;
  padding: 6px 6px 0;
}
.meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 6px 10px 8px;
}
.name {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--ink-2);
  white-space: nowrap;
}
.sorter-item.active .name { color: var(--accent-strong); }
.editing-badge {
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--on-accent);
  background: var(--accent);
  border-radius: var(--radius-pill);
  padding: 2px var(--space-2);
}
.lbl-short { display: none; }
.add-slide {
  width: 100%;
  margin-top: 10px;
  padding: var(--space-3);
  border: 1.5px dashed var(--line);
  border-radius: var(--radius);
  background: none;
  color: var(--ink-2);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.add-slide:hover { border-color: var(--accent); color: var(--accent-strong); }

/* Phone: the sorter becomes a horizontal thumbnail strip. */
@media (max-width: 1023px) {
  .sorter-body {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 6px;
    scroll-snap-type: x mandatory;
  }
  .sorter-list {
    flex-direction: row;
    gap: 10px;
  }
  .sorter-list > li {
    flex: 0 0 150px;
    min-width: 0;
    scroll-snap-align: start;
  }
  .sorter-item { height: 100%; }
  .lbl-full { display: none; }
  .lbl-short { display: inline; }
  .editing-badge { padding: 2px 6px; }
  .name { font-size: var(--fs-xs); }
  .add-slide {
    flex: 0 0 110px;
    margin-top: 0;
    align-self: stretch;
    scroll-snap-align: start;
  }
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
