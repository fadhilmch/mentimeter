<script setup lang="ts">
import { computed, ref } from 'vue'
import { ApiError, imageSrc, uploadImage } from '../api'
import { imageFileProblem, prepareImage } from '../imageUpload'

/** Image for a slide: upload a file (shrunk in the browser first) or paste a link. */
const props = defineProps<{ modelValue: string | undefined; token: string; required?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [string | undefined] }>()

const busy = ref(false)
const problem = ref('')
const input = ref<HTMLInputElement | null>(null)
const uploaded = computed(() => !!props.modelValue?.startsWith('/api/media/'))
const preview = computed(() => imageSrc(props.modelValue))

async function onFile(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return
  problem.value = imageFileProblem(file) ?? ''
  if (problem.value) return
  busy.value = true
  try {
    const url = await uploadImage(props.token, await prepareImage(file))
    emit('update:modelValue', url)
  } catch (err) {
    problem.value = err instanceof ApiError || err instanceof Error ? err.message : 'Could not upload that image.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="iuf">
    <div class="iuf-row">
      <img v-if="preview" class="iuf-thumb" :src="preview" alt="Selected slide image" />
      <div class="iuf-actions">
        <button type="button" class="button ghost" :disabled="busy" :aria-busy="busy" data-testid="upload-image" @click="input?.click()">
          <span v-if="busy" class="spinner" aria-hidden="true"></span>{{ busy ? 'Uploading…' : preview ? 'Replace image' : 'Upload image' }}
        </button>
        <button v-if="preview" type="button" class="button ghost" :disabled="busy" @click="emit('update:modelValue', undefined)">Remove</button>
      </div>
      <input ref="input" class="iuf-file" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose an image file" @change="onFile" />
    </div>
    <label v-if="!uploaded" class="field" style="margin:var(--space-2) 0 0;">
      <span>or paste an image link <span class="muted">(https)</span></span>
      <input :value="modelValue" maxlength="500" placeholder="https://…" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value || undefined)" />
    </label>
    <p v-if="problem" class="slide-error" role="alert">{{ problem }}</p>
    <p v-else-if="required && !preview" class="muted" style="margin:var(--space-2) 0 0;">This slide needs an image.</p>
    <p v-else class="muted" style="margin:var(--space-2) 0 0;">JPEG, PNG or WebP. Large pictures are shrunk to load quickly on phones.</p>
  </div>
</template>

<style scoped>
.slide-error { margin: var(--space-2) 0 0; color: var(--danger-ink); font-size: var(--fs-sm); font-weight: 600; }
.iuf-row { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.iuf-thumb { width: 96px; height: 64px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--line); }
.iuf-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.iuf-file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
</style>
