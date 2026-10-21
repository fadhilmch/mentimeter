<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api'
import { getTheme } from '../themes'
import logoUrl from '../assets/logo.svg'
import { useAuthStore } from '../stores/auth'

interface PresentationSummary {
  theme?: string
  _id: string
  title: string
  accessCode: string
  location?: string
  slides: unknown[]
  createdAt: string
}

const router = useRouter()
const auth = useAuthStore()
const presentations = ref<PresentationSummary[]>([])
const loading = ref(true)
const error = ref('')
const creating = ref(false)

onMounted(async () => {
  try {
    const res = await api.myPresentations(auth.token)
    presentations.value = res.data as PresentationSummary[]
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not load presentations.'
  } finally {
    loading.value = false
  }
})

async function createPresentation() {
  creating.value = true
  error.value = ''
  try {
    const res = await api.createPresentation(auth.token, { title: 'Untitled presentation' })
    router.push({ name: 'edit', params: { id: String(res.data._id) } })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not create presentation.'
    creating.value = false
  }
}
</script>

<template>
  <div class="page">
    <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap;">
      <div>
        <h1>Your presentations</h1>
        <p class="sub" style="margin:0;">Build slides, then present with a live join code.</p>
      </div>
      <button class="button big" :disabled="creating" @click="createPresentation">
        {{ creating ? 'Creating…' : '+ New presentation' }}
      </button>
    </div>

    <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
    <div v-if="loading" class="presentation-grid" aria-label="Loading presentations">
      <div v-for="i in 3" :key="i" class="skel skel-card"></div>
    </div>

    <div v-else-if="presentations.length" class="presentation-grid">
      <div v-for="p in presentations" :key="p._id" class="card presentation-card">
        <div class="code-row">
          <span class="code-chip">{{ p.accessCode }}</span>
          <span class="theme-dot" :style="{ background: getTheme(p.theme).acc }" :title="getTheme(p.theme).name"></span>
        </div>
        <h2>{{ p.title }}</h2>
        <p class="muted" style="margin:0;">
          {{ p.slides.length }} slide{{ p.slides.length === 1 ? '' : 's' }}<span v-if="p.location"> · {{ p.location }}</span>
        </p>
        <div class="card-actions">
          <router-link class="button secondary" :to="{ name: 'edit', params: { id: p._id } }">Edit</router-link>
          <router-link class="button secondary" :to="{ name: 'present', params: { code: p.accessCode } }">Present</router-link>
        </div>
      </div>
    </div>

    <div v-else class="card empty-state" style="margin-top:24px;">
      <img class="empty-mark" :src="logoUrl" alt="" aria-hidden="true" />
      <h2>No presentations yet</h2>
      <p>Create your first one - add slides, get a 6-digit code, present.</p>
    </div>
  </div>
</template>
