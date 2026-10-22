<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, downloadCsv } from '../api'
import { getTheme } from '../themes'
import logoUrl from '../assets/logo-mark.svg'
import { useAuthStore } from '../stores/auth'

interface PresentationSummary {
  theme?: string
  _id: string
  title: string
  accessCode: string
  location?: string
  slideCount: number
  createdAt: string
}

const router = useRouter()
const auth = useAuthStore()
const presentations = ref<PresentationSummary[]>([])
const total = ref(0)
const nextCursor = ref<string | null>(null)
const loadingMore = ref(false)
const loading = ref(true)
const error = ref('')
const creating = ref(false)
const deleting = ref(false)
const deletePassword = ref('')
const deleteError = ref('')

async function deleteAccount() {
  deleteError.value = ''
  deleting.value = true
  try {
    await auth.deleteAccount(deletePassword.value)
    router.push({ name: 'home' })
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : 'Could not delete the account.'
  } finally {
    deleting.value = false
  }
}

async function loadMore() {
  if (!nextCursor.value || loadingMore.value) return
  loadingMore.value = true
  try {
    const res = await api.myPresentations(auth.token, nextCursor.value)
    presentations.value = [...presentations.value, ...(res.data as PresentationSummary[])]
    total.value = res.total
    nextCursor.value = res.nextCursor
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not load more presentations.'
  } finally {
    loadingMore.value = false
  }
}

async function exportCsv(id: string, kind: 'summary' | 'responses' | 'leaderboard') {
  error.value = ''
  try {
    await downloadCsv(auth.token, id, kind)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not download the file.'
  }
}

onMounted(async () => {
  try {
    const res = await api.myPresentations(auth.token)
    presentations.value = res.data as PresentationSummary[]
    total.value = res.total
    nextCursor.value = res.nextCursor
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not load presentations.'
  } finally {
    loading.value = false
  }
})

const templateList = ref<{ key: string; name: string; description: string; slideCount: number }[]>([])
api.templates(auth.token).then((r) => { templateList.value = r.data }).catch(() => { /* templates are optional */ })

async function useTemplate(key: string) {
  creating.value = true
  error.value = ''
  try {
    const res = await api.createFromTemplate(auth.token, key)
    router.push({ name: 'edit', params: { id: String(res.data._id) } })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not create from template.'
    creating.value = false
  }
}

async function duplicate(id: string) {
  error.value = ''
  try {
    const res = await api.duplicatePresentation(auth.token, id)
    router.push({ name: 'edit', params: { id: String(res.data._id) } })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not duplicate the presentation.'
  }
}

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
    <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:var(--space-4); flex-wrap:wrap;">
      <div>
        <h1>Your presentations</h1>
        <p class="sub" style="margin:0;">Build slides, then present with a live join code.</p>
      </div>
      <button class="button big" :disabled="creating" @click="createPresentation">
        {{ creating ? 'Creating…' : '+ New presentation' }}
      </button>
    </div>

    <section v-if="templateList.length" class="templates" aria-label="Start from a template">
      <h2 class="templates-title">Start from a template</h2>
      <div class="templates-row">
        <button v-for="t in templateList" :key="t.key" class="card template-card" :disabled="creating" @click="useTemplate(t.key)">
          <strong>{{ t.name }}</strong>
          <span class="muted">{{ t.description }}</span>
          <span class="muted">{{ t.slideCount }} slides</span>
        </button>
      </div>
    </section>

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
          {{ p.slideCount }} slide{{ p.slideCount === 1 ? '' : 's' }}<span v-if="p.location"> · {{ p.location }}</span>
        </p>
        <div class="card-actions">
          <router-link class="button secondary" :to="{ name: 'edit', params: { id: p._id } }">Edit</router-link>
          <router-link class="button secondary" :to="{ name: 'present', params: { code: p.accessCode } }">Present</router-link>
          <button class="button secondary" title="Copy the questions into a new presentation. Answers are not copied." @click="duplicate(p._id)">Duplicate</button>
        </div>
        <details class="export-menu">
          <summary class="muted">Download results (CSV)</summary>
          <div class="export-options">
            <button class="button ghost" @click="exportCsv(p._id, 'summary')">Results summary</button>
            <button class="button ghost" @click="exportCsv(p._id, 'responses')">Written responses</button>
            <button class="button ghost" title="Includes the names players chose" @click="exportCsv(p._id, 'leaderboard')">Quiz scores with names</button>
          </div>
        </details>
      </div>
      <button v-if="nextCursor" class="button secondary" style="grid-column:1/-1;justify-self:center;" :disabled="loadingMore" @click="loadMore">
        {{ loadingMore ? 'Loading…' : `Show more (${total - presentations.length} left)` }}
      </button>
    </div>

    <div v-else class="card empty-state" style="margin-top:var(--space-5);">
      <img class="empty-mark" :src="logoUrl" alt="" aria-hidden="true" />
      <h2>No presentations yet</h2>
      <p>Create your first one - add slides, get a 6-digit code, present.</p>
    </div>

    <details class="account-delete">
      <summary>Delete account</summary>
      <p class="muted">
        This permanently deletes your account and all {{ total }} of your presentations,
        with their votes, answers and audience nicknames. It cannot be undone.
      </p>
      <form @submit.prevent="deleteAccount">
        <label class="field">
          <span>Confirm with your password</span>
          <input v-model="deletePassword" type="password" autocomplete="current-password" required />
        </label>
        <p v-if="deleteError" class="error-banner" role="alert">{{ deleteError }}</p>
        <button class="button danger" type="submit" :disabled="deleting || !deletePassword">
          {{ deleting ? 'Deleting…' : 'Delete my account' }}
        </button>
      </form>
    </details>
  </div>
</template>

<style scoped>
.export-menu { margin-top: var(--space-3, 12px); font-size: 0.875rem; }
.export-menu summary { cursor: pointer; }
.export-options { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; margin-top: 8px; }
.templates { margin: var(--space-4, 16px) 0; }
.templates-title { font-size: 1rem; margin: 0 0 8px; }
.templates-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.template-card { display: flex; flex-direction: column; gap: 4px; text-align: left; cursor: pointer; font: inherit; color: inherit; }
.template-card:disabled { opacity: 0.6; cursor: default; }
.account-delete { margin-top: var(--space-6); padding-top: var(--space-4); border-top: 1px solid var(--line); max-width: 420px; }
.account-delete summary { cursor: pointer; color: var(--ink-3); font-size: var(--fs-sm); font-weight: 600; padding: var(--space-2) 0; }
.account-delete form { display: grid; gap: var(--space-3); margin-top: var(--space-3); }
</style>
