<script setup lang="ts">
import { computed, ref } from 'vue'
import { imageSrc } from '../api'
import ImagePickerDialog from './ImagePickerDialog.vue'

/** Image for a slide: one fixed-ratio tile. Opens the picker to choose, upload or paste a link. */
const props = defineProps<{ modelValue: string | undefined; token: string; required?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [string | undefined] }>()

const open = ref(false)
const preview = computed(() => imageSrc(props.modelValue))

function choose(url: string) {
  emit('update:modelValue', url)
  open.value = false
}
</script>

<template>
  <div class="iuf">
    <div class="iuf-frame">
      <button type="button" class="iuf-tile" :class="{ empty: !preview }" :aria-label="preview ? 'Change image' : 'Add image'" data-testid="open-image-picker" @click="open = true">
        <img v-if="preview" :src="preview" alt="Selected slide image" />
        <span v-else class="iuf-empty"><b>+</b> Add image</span>
      </button>
      <button v-if="preview" type="button" class="icon-button iuf-remove" aria-label="Remove from slide" title="Removes the image from this slide. The uploaded file stays in your uploads." data-testid="remove-from-slide" @click="emit('update:modelValue', undefined)">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
      </button>
    </div>
    <p v-if="required && !preview" class="muted iuf-hint">This slide needs an image.</p>
    <p v-else class="muted iuf-hint">JPEG, PNG or WebP. Public to anyone with the link.</p>
    <ImagePickerDialog v-if="open" :token="token" :selected="modelValue" @select="choose" @close="open = false" />
  </div>
</template>

<style scoped>
.iuf-frame { position: relative; max-width: 320px; }
.iuf-tile { display: block; width: 100%; aspect-ratio: 16 / 9; padding: 0; border: 2px solid var(--line); border-radius: var(--radius-md); overflow: hidden; background: var(--bg); cursor: pointer; box-shadow: var(--shadow); }
.iuf-tile:hover { border-color: var(--ink-3); }
.iuf-tile.empty { border-style: dashed; box-shadow: none; }
.iuf-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
.iuf-empty { display: grid; place-content: center; justify-items: center; gap: var(--space-1); height: 100%; color: var(--ink-2); font-weight: 600; }
.iuf-empty b { font-size: 1.4rem; line-height: 1; }
.iuf-remove { position: absolute; top: var(--space-2); right: var(--space-2); background: var(--paper); box-shadow: var(--shadow); border-radius: var(--radius-pill); }
.iuf-hint { margin: var(--space-2) 0 0; font-size: var(--fs-sm); }
</style>
