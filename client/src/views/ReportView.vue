<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api'
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
      <section v-if="sessions.length" class="card" style="margin-top:var(--space-4);" aria-label="Sessions">
        <h2>Sessions</h2>
        <ul>
          <li v-for="s in sessions" :key="s.id">
            <router-link :to="{ name: 'session-report', params: { sid: s.id } }" style="color:var(--accent-strong);">
              {{ new Date(s.startedAt).toLocaleString() }} (code {{ s.code }}, {{ s.status }})
            </router-link>
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
