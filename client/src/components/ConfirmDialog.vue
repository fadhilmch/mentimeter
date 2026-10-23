<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    message: string
    confirmLabel?: string
    busy?: boolean
  }>(),
  { confirmLabel: 'Delete', busy: false },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const cancelButton = ref<HTMLButtonElement | null>(null)
onMounted(async () => {
  // Focus starts on Cancel: the destructive choice is never the default.
  await nextTick()
  cancelButton.value?.focus()
})

function cancel() {
  if (!props.busy) emit('cancel')
}
</script>

<template>
  <div class="confirm-overlay" role="dialog" aria-modal="true" :aria-label="title" @click.self="cancel" @keydown.esc="cancel">
    <div class="confirm-sheet">
      <h2 class="confirm-title">{{ title }}</h2>
      <p class="confirm-message">{{ message }}</p>
      <div class="confirm-actions">
        <button ref="cancelButton" class="button ghost" type="button" :disabled="busy" @click="cancel">Cancel</button>
        <button class="button danger" type="button" :disabled="busy" @click="emit('confirm')">
          <span v-if="busy" class="spinner" aria-hidden="true"></span>{{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; background: rgb(0 0 0 / 0.55); padding: var(--space-4); }
.confirm-sheet {
  width: min(400px, 100%); padding: var(--space-5);
  background: var(--paper); color: var(--ink); border-radius: 20px; box-shadow: 0 24px 60px rgb(0 0 0 / 0.4);
}
.confirm-title { margin: 0 0 var(--space-2); font-size: 1.15rem; }
.confirm-message { margin: 0 0 var(--space-4); color: var(--ink-3); }
.confirm-actions { display: flex; justify-content: flex-end; gap: var(--space-3); }
</style>
