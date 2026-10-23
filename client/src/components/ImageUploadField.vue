<script setup lang="ts">
import { computed, ref } from 'vue'
import { ApiError, deleteUpload, imageSrc, listUploads, uploadImage, type UploadedImage } from '../api'
import { deleteBlock, imageFileProblem, prepareImage, uploadQuota } from '../imageUpload'

/** Image for a slide: upload a file (shrunk in the browser first) or paste a link. */
const props = defineProps<{ modelValue: string | undefined; token: string; required?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [string | undefined] }>()

const busy = ref(false)
const problem = ref('')
const input = ref<HTMLInputElement | null>(null)
const uploaded = computed(() => !!props.modelValue?.startsWith('/api/media/'))
const preview = computed(() => imageSrc(props.modelValue))

const managing = ref(false)
const loadingList = ref(false)
const items = ref<UploadedImage[]>([])
const limit = ref(200)
const listProblem = ref('')
const deleting = ref('')
const confirming = ref('')

async function loadUploads() {
  loadingList.value = true
  listProblem.value = ''
  try {
    const res = await listUploads(props.token)
    items.value = res.items
    limit.value = res.limit
  } catch (err) {
    listProblem.value = err instanceof Error ? err.message : 'Could not load your uploads.'
  } finally {
    loadingList.value = false
  }
}
async function toggleManage() {
  managing.value = !managing.value
  confirming.value = ''
  if (managing.value) await loadUploads()
}
async function removeFile(item: UploadedImage) {
  deleting.value = item.url
  listProblem.value = ''
  try {
    await deleteUpload(props.token, item.url)
    items.value = items.value.filter((i) => i.url !== item.url)
    confirming.value = ''
  } catch (err) {
    listProblem.value = err instanceof Error ? err.message : 'Could not delete that image.'
    if (err instanceof ApiError && err.status === 409) await loadUploads()
  } finally {
    deleting.value = ''
  }
}

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
    if (managing.value) await loadUploads()
  } catch (err) {
    problem.value = err instanceof ApiError || err instanceof Error ? err.message : 'Could not upload that image.'
    if (err instanceof ApiError && err.body.code === 'upload_limit' && !managing.value) await toggleManage()
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
        <button v-if="preview" type="button" class="button ghost" :disabled="busy" title="Takes the image off this slide. The uploaded file stays in Your uploads." @click="emit('update:modelValue', undefined)">Remove from slide</button>
      </div>
      <input ref="input" class="iuf-file" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose an image file" @change="onFile" />
    </div>
    <label v-if="!uploaded" class="field" style="margin:var(--space-2) 0 0;">
      <span>or paste an image link <span class="muted">(https)</span></span>
      <input :value="modelValue" maxlength="500" placeholder="https://…" @input="emit('update:modelValue', ($event.target as HTMLInputElement).value || undefined)" />
    </label>
    <button type="button" class="linklike" :aria-expanded="managing" data-testid="manage-uploads" @click="toggleManage">{{ managing ? 'Hide your uploads' : 'Your uploads' }}</button>
    <div v-if="managing" class="iuf-manage" data-testid="uploads-panel">
      <p v-if="loadingList" class="muted">Loading…</p>
      <template v-else>
        <p class="muted iuf-quota" data-testid="upload-quota">{{ uploadQuota(items.length, limit) }}</p>
        <p v-if="listProblem" class="slide-error" role="alert">{{ listProblem }}</p>
        <p v-if="!items.length" class="muted">No uploaded images yet.</p>
        <ul class="iuf-grid">
          <li v-for="item in items" :key="item.url" class="iuf-item" :class="{ current: item.url === modelValue }">
            <img :src="imageSrc(item.url)" alt="Uploaded image" loading="lazy" />
            <div class="iuf-item-actions">
              <button type="button" class="button ghost" :disabled="item.url === modelValue" @click="emit('update:modelValue', item.url)">{{ item.url === modelValue ? 'On this slide' : 'Use' }}</button>
              <template v-if="confirming === item.url">
                <button type="button" class="button danger" :disabled="deleting === item.url" :aria-busy="deleting === item.url" data-testid="confirm-delete-upload" @click="removeFile(item)">{{ deleting === item.url ? 'Deleting…' : 'Delete file for good' }}</button>
                <button type="button" class="button ghost" @click="confirming = ''">Cancel</button>
              </template>
              <button v-else type="button" class="button ghost" :disabled="!!deleteBlock(item, modelValue)" :title="deleteBlock(item, modelValue) || 'Deletes the uploaded file'" data-testid="delete-upload" @click="confirming = item.url">Delete file</button>
            </div>
            <p v-if="deleteBlock(item, modelValue)" class="muted iuf-why">{{ deleteBlock(item, modelValue) }}</p>
          </li>
        </ul>
      </template>
    </div>
    <p class="muted iuf-privacy">Uploaded images are public to anyone who has their link, including your audience. Don't upload private photos.</p>
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
.linklike { background: none; border: 0; padding: 0; margin-top: var(--space-2); color: var(--accent-ink, var(--accent)); font: inherit; font-weight: 600; cursor: pointer; text-decoration: underline; }
.iuf-manage { margin-top: var(--space-2); padding: var(--space-3); border: 1px solid var(--line); border-radius: var(--radius-md); }
.iuf-quota, .iuf-why, .iuf-privacy { margin: var(--space-1) 0 var(--space-2); font-size: var(--fs-sm); }
.iuf-privacy { margin-top: var(--space-2); }
.iuf-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--space-3); max-height: 320px; overflow: auto; }
.iuf-item { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-2); border: 1px solid var(--line); border-radius: var(--radius-sm); }
.iuf-item.current { border-color: var(--accent); }
.iuf-item img { width: 100%; height: 84px; object-fit: cover; border-radius: var(--radius-sm); }
.iuf-item-actions { display: flex; flex-wrap: wrap; gap: var(--space-1); }
.iuf-file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
</style>
