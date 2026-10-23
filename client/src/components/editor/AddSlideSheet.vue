<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import MiniStage from './MiniStage.vue'
import { SLIDE_TYPES, type SlideType } from '../../editor/slideTypes'

const props = defineProps<{ open: boolean; themeId: string }>()
const emit = defineEmits<{ pick: [SlideType]; close: [] }>()

const sheet = ref<HTMLElement | null>(null)
watch(
  () => props.open,
  async (open) => {
    if (open) {
      await nextTick()
      sheet.value?.focus()
    }
  },
)

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

/** Empty slides render the stage's own placeholder content, which is exactly the
    generic look the type cards need. */
const sampleOptions = (has: boolean) => (has ? [{ text: '' }, { text: '' }, { text: '' }] : [])
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="sheet-overlay" @click.self="emit('close')" @keydown="onKeydown">
      <aside ref="sheet" class="sheet" role="dialog" aria-modal="true" aria-label="Add a slide" tabindex="-1">
        <button type="button" class="sheet-close" aria-label="Close" @click="emit('close')">×</button>
        <h2 class="sheet-title">Add a slide</h2>
        <p class="sheet-sub">Pick how the room answers. You can mix types in one presentation.</p>
        <div class="type-list">
          <button
            v-for="t in SLIDE_TYPES"
            :key="t.type"
            type="button"
            class="type-card"
            @click="emit('pick', t.type)"
          >
            <span class="type-thumb">
              <MiniStage :slide="{ questionType: t.type, question: '', options: sampleOptions(t.hasOptions) }" :theme-id="themeId" />
            </span>
            <span class="type-meta">
              <b>{{ t.label }}</b>
              <span class="type-hint">{{ t.hint }}</span>
            </span>
          </button>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgb(0 0 0 / 0.55);
  display: flex;
  justify-content: flex-end;
}
.sheet {
  width: min(430px, 100%);
  height: 100%;
  overflow-y: auto;
  background: var(--paper);
  padding: var(--space-5);
  outline: none;
  animation: sheet-in 220ms var(--ease);
}
@keyframes sheet-in {
  from { transform: translateX(30px); opacity: 0; }
  to { transform: none; opacity: 1; }
}
.sheet-close {
  position: absolute;
  top: 14px;
  right: 16px;
  border: 1px solid var(--line);
  background: var(--card);
  color: var(--ink-2);
  width: 34px;
  height: 34px;
  border-radius: var(--radius-md);
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
}
.sheet-close:hover { color: var(--ink); }
.sheet-title {
  margin: 0;
  font-size: 1.4rem;
  letter-spacing: -0.02em;
}
.sheet-sub {
  margin: 6px 0 var(--space-5);
  color: var(--ink-2);
  font-size: var(--fs-base);
  line-height: 1.5;
}
.type-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.type-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--card);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease);
}
.type-card:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}
.type-thumb {
  /* min-width: 0: the stage inside renders at a fixed 420px and scales down;
     without this the card grows to the unscaled stage and hides the meta. */
  flex: 0 0 128px;
  width: 128px;
  min-width: 0;
  pointer-events: none;
}
.type-meta {
  flex: 1 1 auto;
  min-width: 0;
}
.type-meta b {
  display: block;
  font-size: var(--fs-md);
}
.type-hint {
  display: block;
  margin-top: 3px;
  color: var(--ink-2);
  font-size: var(--fs-sm);
  line-height: 1.45;
}
@media (prefers-reduced-motion: reduce) {
  .sheet { animation: none; }
  .type-card { transition: none; }
  .type-card:hover { transform: none; }
}
</style>
