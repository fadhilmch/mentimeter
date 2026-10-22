<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { moderationApi, type ModerationAction, type ModerationQueue } from '../api'
import type { PresentationState } from '../types'
import { useLiveStore } from '../stores/live'

const props = defineProps<{ token: string; presentationId: string; slideIndex: number }>()
const live = useLiveStore()
const queue = ref<ModerationQueue | null>(null)
const error = ref('')
const busy = ref(false)
const open = ref(false)
const confirmDelete = ref<string | null>(null)

// Held responses only matter for the question on screen; the rest are one tap away in the count.
const items = computed(() => (queue.value?.items ?? []).filter((item) => item.slideIndex === props.slideIndex))
const elsewhere = computed(() => (queue.value?.items.length ?? 0) - items.value.length)
const pendingCount = computed(() => items.value.filter((i) => i.status === 'pending').length)

async function refresh() {
  try {
    queue.value = (await moderationApi.queue(props.token, props.presentationId)).data
    error.value = ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not load held responses.'
  }
}
onMounted(refresh)
// A new submission changes the live revision: look again so pending items show up without a reload.
watch(() => live.state?.revision, refresh)

async function run(fn: () => Promise<{ data: ModerationQueue; state: unknown }>) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const res = await fn()
    queue.value = res.data
    live.applyState(res.state as PresentationState)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'That did not work.'
  } finally {
    busy.value = false
    confirmDelete.value = null
  }
}
const setMode = (mode: 'off' | 'approve') => run(() => moderationApi.setMode(props.token, props.presentationId, mode))
function act(slideId: string, id: string, action: ModerationAction) {
  if (action === 'delete' && confirmDelete.value !== id) {
    confirmDelete.value = id
    return
  }
  return run(() => moderationApi.act(props.token, props.presentationId, slideId, id, action))
}
</script>

<template>
  <section class="moderation" aria-labelledby="mod-title">
    <button type="button" class="mod-toggle" :aria-expanded="open" aria-controls="mod-body" @click="open = !open">
      <span id="mod-title">Moderation</span>
      <span v-if="pendingCount" class="mod-badge" :aria-label="`${pendingCount} waiting for approval`">{{ pendingCount }}</span>
      <span v-else-if="items.length" class="mod-badge muted" :aria-label="`${items.length} hidden`">{{ items.length }}</span>
    </button>
    <div v-show="open" id="mod-body" class="mod-body">
      <label class="mod-mode">
        <input type="checkbox" :checked="queue?.mode === 'approve'" :disabled="busy || !queue" @change="setMode(($event.target as HTMLInputElement).checked ? 'approve' : 'off')" />
        Hold new responses until I approve them
      </label>
      <p v-if="error" class="mod-error" role="alert">{{ error }}</p>
      <p v-if="!items.length" class="mod-empty">Nothing held on this question.<template v-if="elsewhere"> {{ elsewhere }} on other questions.</template></p>
      <ul v-else class="mod-list">
        <li v-for="item in items" :key="item.id">
          <span class="mod-status">{{ item.status === 'pending' ? 'Waiting' : 'Hidden' }}</span>
          <span class="mod-text">{{ item.text }}</span>
          <span class="mod-actions">
            <button v-if="item.status === 'pending'" type="button" class="button" :disabled="busy" @click="act(item.slideId, item.id, 'approve')">Approve</button>
            <button v-else type="button" class="button" :disabled="busy" @click="act(item.slideId, item.id, 'restore')">Restore</button>
            <button v-if="item.status === 'pending'" type="button" class="button ghost" :disabled="busy" @click="act(item.slideId, item.id, 'hide')">Hide</button>
            <button type="button" class="button ghost danger" :disabled="busy" @click="act(item.slideId, item.id, 'delete')">
              {{ confirmDelete === item.id ? 'Delete for good?' : 'Delete' }}
            </button>
          </span>
        </li>
      </ul>
      <p class="mod-note">Hide can be undone. Delete removes the text for good.</p>
    </div>
  </section>
</template>

<style scoped>
.moderation { margin-top: 18px; text-align: left; background: color-mix(in srgb, var(--t-ink) 6%, transparent); border-radius: 16px; }
.mod-toggle { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 44px; padding: 8px 16px; background: none; border: 0; color: inherit; font: inherit; font-weight: 600; cursor: pointer; border-radius: 16px; }
.mod-badge { background: var(--t-accink); color: var(--t-onaccink); border-radius: 999px; padding: 0 9px; font-size: 0.85rem; }
.mod-badge.muted { background: color-mix(in srgb, var(--t-ink) 40%, transparent); }
.mod-body { padding: 0 16px 14px; }
.mod-mode { display: flex; gap: 10px; align-items: center; min-height: 44px; }
.mod-mode input { width: 22px; height: 22px; flex: none; margin: 0; }
.mod-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.mod-list li { display: grid; gap: 6px; padding: 10px; border-radius: 12px; background: color-mix(in srgb, var(--t-ink) 6%, transparent); }
.mod-status { font-size: 0.8rem; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.04em; }
.mod-text { overflow-wrap: anywhere; }
.mod-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.mod-actions .button { min-height: 44px; }
.mod-empty, .mod-note { margin: 6px 0 0; opacity: 0.75; font-size: 0.9rem; }
.mod-error { color: var(--danger-ink); }
</style>
