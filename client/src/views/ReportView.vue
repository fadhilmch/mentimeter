<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api, downloadCsv } from '../api'
import { useAuthStore } from '../stores/auth'

interface ReportSlide {
  index: number
  questionType: string
  question: string
  options?: { text: string; count: number; percent: number }[]
  total?: number
  correctOptionIndex?: number
  responseCount?: number
  topResponses?: { text: string; upvotes: number }[]
  tally?: Record<string, unknown>
}
interface Report {
  title: string
  generatedAt: string
  scope: string
  slides: ReportSlide[]
}

const route = useRoute()
const auth = useAuthStore()
const report = ref<Report | null>(null)
const error = ref('')
const loading = ref(true)

const sessions = ref<{ id: string; code: string; status: string; startedAt: string; endedAt: string | null }[]>([])

async function load() {
  loading.value = true
  error.value = ''
  sessions.value = []
  try {
    if (typeof route.params.sid === 'string') {
      report.value = (await api.getSessionReport(auth.token, String(route.params.sid))).data as unknown as Report
    } else {
      report.value = (await api.getReport(auth.token, String(route.params.id))).data as unknown as Report
      // Past runs, when sessions are on. Quietly absent otherwise.
      api.listSessions(auth.token, String(route.params.id)).then((r) => { sessions.value = r.data }).catch(() => {})
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not load the report.'
  } finally {
    loading.value = false
  }
}

async function sessionAction(sid: string, action: 'end' | 'archive' | 'delete') {
  if (action === 'delete' && !window.confirm('Delete this session and all its answers for good?')) return
  try {
    if (action === 'delete') await api.deleteSession(auth.token, sid)
    else await api.sessionAction(auth.token, sid, action)
    await load()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not change the session.'
  }
}

async function download(kind: 'summary' | 'responses') {
  try {
    await downloadCsv(auth.token, String(route.params.sid ?? route.params.id), kind)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not download the file.'
  }
}

onMounted(load)
// The same component serves the deck report and a session report, so reload when the route changes.
watch(() => route.fullPath, load)
</script>

<template>
  <div class="page" data-testid="report">
    <p v-if="loading" class="muted">Loading report…</p>
    <p v-else-if="error" class="error-banner" role="alert">{{ error }}</p>
    <template v-else-if="report">
      <h1>{{ report.title }}: report</h1>
      <p class="muted">{{ report.scope }}. Generated {{ new Date(report.generatedAt).toLocaleString() }}.</p>
      <div style="margin-top:var(--space-3); display:flex; gap:var(--space-2); flex-wrap:wrap;" aria-label="Download results">
        <button class="button ghost" @click="download('summary')">Results summary (CSV)</button>
        <button class="button ghost" @click="download('responses')">Written responses (CSV)</button>
      </div>
      <section v-if="sessions.length" class="card" style="margin-top:var(--space-4);" aria-label="Sessions">
        <h2>Sessions</h2>
        <ul>
          <li v-for="s in sessions" :key="s.id">
            <router-link :to="{ name: 'session-report', params: { sid: s.id } }" style="color:var(--accent-strong);">
              {{ new Date(s.startedAt).toLocaleString() }} (code {{ s.code }}, {{ s.status }})
            </router-link>
            <button v-if="s.status === 'active'" class="button ghost" @click="sessionAction(s.id, 'end')">End</button>
            <button v-if="s.status === 'ended'" class="button ghost" @click="sessionAction(s.id, 'archive')">Archive</button>
            <button v-if="s.status !== 'active'" class="button ghost" @click="sessionAction(s.id, 'delete')">Delete</button>
          </li>
        </ul>
      </section>
      <section v-for="s in report.slides" :key="s.index" class="card" style="margin-top:var(--space-4);">
        <h2>{{ s.index + 1 }}. {{ s.question }}</h2>
        <table v-if="s.options">
          <caption class="muted">{{ s.total }} answers</caption>
          <thead><tr><th scope="col">Option</th><th scope="col">Votes</th><th scope="col">Share</th></tr></thead>
          <tbody>
            <tr v-for="(o, k) in s.options" :key="k">
              <td>{{ o.text }}<span v-if="s.correctOptionIndex === k"> (correct)</span></td>
              <td>{{ o.count }}</td>
              <td>{{ o.percent }}%</td>
            </tr>
          </tbody>
        </table>
        <div v-else-if="s.topResponses">
          <p class="muted">{{ s.responseCount }} responses</p>
          <ul><li v-for="(r, k) in s.topResponses" :key="k">{{ r.text }} ({{ r.upvotes }} upvotes)</li></ul>
        </div>
        <div v-else-if="s.questionType === 'rating' && s.tally">
          <p class="muted">{{ s.tally.total }} ratings, average {{ s.tally.average }}</p>
          <table>
            <thead><tr><th scope="col">Rating</th><th scope="col">Count</th></tr></thead>
            <tbody><tr v-for="(c, k) in (s.tally.buckets as number[])" :key="k"><td>{{ k + 1 }}</td><td>{{ c }}</td></tr></tbody>
          </table>
        </div>
        <div v-else-if="s.questionType === 'word-cloud' && s.tally">
          <p class="muted">{{ s.tally.total }} words</p>
          <ul><li v-for="w in (s.tally.words as { word?: string; text?: string; count: number }[])" :key="w.word ?? w.text">{{ w.word ?? w.text }} ({{ w.count }})</li></ul>
        </div>
        <div v-else-if="s.questionType === 'ranking' && s.tally">
          <p class="muted">{{ s.tally.total }} rankings (higher points = ranked higher)</p>
          <ul><li v-for="(p, k) in (s.tally.points as { text?: string; points?: number; optionId?: string }[])" :key="k">{{ p.text ?? p.optionId }}: {{ p.points }}</li></ul>
        </div>
        <pre v-else-if="s.tally" class="muted" style="white-space:pre-wrap;">{{ JSON.stringify(s.tally) }}</pre>
      </section>
      <router-link class="button ghost" :to="{ name: 'dashboard' }" style="margin-top:var(--space-4);">Back</router-link>
    </template>
  </div>
</template>

<style scoped>
table { width: 100%; border-collapse: collapse; margin-top: var(--space-2); }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--line); }
caption { text-align: left; padding-bottom: 4px; }
</style>
