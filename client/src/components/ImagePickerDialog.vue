<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { ApiError, deleteUpload, imageSrc, listUploads, uploadImage, type UploadedImage } from '../api'
import { deleteBlock, imageFileProblem, prepareImage, uploadQuota } from '../imageUpload'
import ConfirmDialog from './ConfirmDialog.vue'

/** Pick one of your uploads, upload a new image, or paste a link. Deleting a file is a separate, confirmed step. */
const props = defineProps<{ token: string; selected: string | undefined }>()
const emit = defineEmits<{ select: [string]; close: [] }>()

const items = ref<UploadedImage[]>([])
const limit = ref(200)
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const link = ref('')
const file = ref<HTMLInputElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const toDelete = ref<UploadedImage | null>(null)
const deleting = ref(false)

async function load() {
  try {
    const res = await listUploads(props.token)
    items.value = res.items
    limit.value = res.limit
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not load your uploads.'
  } finally {
    loading.value = false
  }
}
onMounted(async () => {
  await load()
  await nextTick()
  closeButton.value?.focus()
})

async function onFile(event: Event) {
  const target = event.target as HTMLInputElement
  const picked = target.files?.[0]
  target.value = ''
  if (!picked) return
  error.value = imageFileProblem(picked) ?? ''
  if (error.value) return
  busy.value = true
  try {
    emit('select', await uploadImage(props.token, await prepareImage(picked)))
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not upload that image.'
    if (err instanceof ApiError && err.body.code === 'upload_limit') await load()
  } finally {
    busy.value = false
  }
}

function useLink() {
  const value = link.value.trim()
  if (!/^https:\/\/\S+$/i.test(value)) {
    error.value = 'Paste a link that starts with https://'
    return
  }
  emit('select', value)
}

async function confirmDelete() {
  const item = toDelete.value
  if (!item) return
  deleting.value = true
  try {
    await deleteUpload(props.token, item.url)
    items.value = items.value.filter((i) => i.url !== item.url)
    toDelete.value = null
    error.value = ''
  } catch (err) {
    toDelete.value = null
    error.value = err instanceof Error ? err.message : 'Could not delete that image.'
    if (err instanceof ApiError && err.status === 409) await load()
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="ipd-overlay" role="dialog" aria-modal="true" aria-label="Choose an image" @click.self="emit('close')" @keydown.esc="emit('close')">
      <div class="ipd-sheet" data-testid="image-picker">
        <header class="ipd-head">
          <div>
            <h2 class="ipd-title">Choose an image</h2>
            <p class="ipd-sub" data-testid="upload-quota">{{ loading ? 'Loading…' : uploadQuota(items.length, limit) }}</p>
          </div>
          <button ref="closeButton" type="button" class="icon-button ipd-x" aria-label="Close" @click="emit('close')">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
          </button>
        </header>

        <p v-if="error" class="ipd-alert" role="alert" data-testid="picker-error">{{ error }}</p>

        <button type="button" class="button ipd-upload" :disabled="busy" :aria-busy="busy" data-testid="upload-image" @click="file?.click()">
          <span v-if="busy" class="spinner" aria-hidden="true"></span>{{ busy ? 'Uploading…' : 'Upload image' }}
        </button>
        <input ref="file" class="ipd-file" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose an image file" @change="onFile" />

        <p v-if="!loading && !items.length" class="ipd-empty">No uploads yet. Upload an image, or paste a link below.</p>
        <ul v-else class="ipd-grid" aria-label="Your uploads">
          <li v-for="item in items" :key="item.url" class="ipd-cell">
            <button type="button" class="ipd-tile" :class="{ current: item.url === selected }" :aria-pressed="item.url === selected" aria-label="Use this image" @click="emit('select', item.url)">
              <img :src="imageSrc(item.url)" alt="" loading="lazy" />
              <span v-if="item.url === selected" class="ipd-badge">On this slide</span>
              <span v-else-if="item.usedIn.length" class="ipd-badge soft">In use</span>
            </button>
            <button
              type="button"
              class="icon-button ipd-trash"
              :disabled="!!deleteBlock(item, selected)"
              :aria-label="deleteBlock(item, selected) ? `Delete file (unavailable): ${deleteBlock(item, selected)}` : 'Delete file'"
              :title="deleteBlock(item, selected) || 'Delete this file'"
              data-testid="delete-upload"
              @click="toDelete = item"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
          </li>
        </ul>

        <details class="ipd-link">
          <summary>Use an image link instead</summary>
          <div class="ipd-link-row">
            <input v-model="link" maxlength="500" placeholder="https://…" aria-label="Image link" @keydown.enter.prevent="useLink" />
            <button type="button" class="button secondary" @click="useLink">Use link</button>
          </div>
        </details>

        <p class="ipd-note">Images are public to anyone who has their link, including your audience. Don't upload private photos.</p>
      </div>
      <ConfirmDialog
        v-if="toDelete"
        title="Delete this file?"
        message="This permanently deletes the uploaded image. No slide uses it. Removing an image from a slide only is a separate step."
        confirm-label="Delete file"
        :busy="deleting"
        @confirm="confirmDelete"
        @cancel="toDelete = null"
      />
    </div>
  </Teleport>
</template>

<style scoped>
.ipd-overlay { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; background: rgb(0 0 0 / 0.55); padding: var(--space-4); }
.ipd-sheet {
  width: min(640px, 100%); max-height: min(720px, 100%); overflow: auto; padding: var(--space-5);
  background: var(--paper); color: var(--ink); border-radius: 20px; box-shadow: 0 24px 60px rgb(0 0 0 / 0.4);
  display: flex; flex-direction: column; gap: var(--space-3);
}
.ipd-head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); }
.ipd-x:hover { color: var(--ink); background: var(--bg); }
.ipd-title { margin: 0; font-size: 1.15rem; }
.ipd-sub { margin: var(--space-1) 0 0; color: var(--ink-3); font-size: var(--fs-sm); }
.ipd-alert { position: sticky; top: 0; z-index: 2; margin: 0; padding: var(--space-3); border-radius: var(--radius-md); background: var(--danger-soft); color: var(--danger-ink); font-weight: 600; font-size: var(--fs-sm); box-shadow: var(--shadow); }
.ipd-upload { align-self: flex-start; }
.ipd-file { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.ipd-empty { margin: 0; padding: var(--space-5) var(--space-3); text-align: center; color: var(--ink-3); border: 2px dashed var(--line); border-radius: var(--radius-lg); }
.ipd-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: var(--space-3); }
.ipd-cell { position: relative; }
.ipd-tile { position: relative; display: block; width: 100%; aspect-ratio: 4 / 3; padding: 0; border: 2px solid var(--line); border-radius: var(--radius-md); overflow: hidden; background: var(--bg); cursor: pointer; box-shadow: var(--shadow); }
.ipd-tile:hover { border-color: var(--ink-3); }
.ipd-tile.current { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent); }
.ipd-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ipd-badge { position: absolute; left: var(--space-1); bottom: var(--space-1); padding: 2px var(--space-2); border-radius: var(--radius-pill); background: var(--accent); color: var(--on-accent); font-size: var(--fs-xs); font-weight: 700; }
.ipd-badge.soft { background: var(--paper); color: var(--ink-2); }
.ipd-trash { position: absolute; top: var(--space-1); right: var(--space-1); background: var(--paper); box-shadow: var(--shadow); border-radius: var(--radius-pill); }
.ipd-trash:disabled { opacity: 0.45; cursor: not-allowed; }
.ipd-link summary { cursor: pointer; font-weight: 600; color: var(--ink-2); }
.ipd-link-row { display: flex; gap: var(--space-2); margin-top: var(--space-2); }
.ipd-link-row input { flex: 1; min-width: 0; }
.ipd-note { margin: 0; color: var(--ink-3); font-size: var(--fs-sm); }
@media (max-width: 560px) {
  .ipd-overlay { place-items: end center; padding: 0; }
  .ipd-sheet { border-radius: 20px 20px 0 0; max-height: 92%; }
  .ipd-grid { grid-template-columns: repeat(2, 1fr); }
  .ipd-upload { align-self: stretch; }
}
</style>
