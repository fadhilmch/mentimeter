<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useLiveStore } from '../stores/live'

const props = defineProps<{ role: 'audience' | 'presenter' }>()
const live = useLiveStore()
const status = computed(() => live.connectionStatus)
const text = computed(() => {
  if (status.value === 'connected') return ''
  const wait = status.value === 'offline' ? 'No connection.' : 'Reconnecting…'
  return props.role === 'audience' ? `${wait} Answers can't be sent until you are back online.` : `${wait} Audience screens may be behind until it recovers.`
})
const up = () => live.setBrowserOnline(true)
const down = () => live.setBrowserOnline(false)
onMounted(() => { window.addEventListener('online', up); window.addEventListener('offline', down) })
onBeforeUnmount(() => { window.removeEventListener('online', up); window.removeEventListener('offline', down) })
</script>

<template>
  <p v-if="text" class="connection-banner" :class="status" role="status" aria-live="polite">{{ text }}</p>
</template>

<style scoped>
.connection-banner { margin: 0 0 12px; padding: 10px 14px; border-radius: 12px; font-weight: 600; background: var(--danger-soft); color: var(--danger-ink); }
.connection-banner.reconnecting { background: color-mix(in srgb, var(--t-ink) 8%, transparent); color: inherit; }
</style>
