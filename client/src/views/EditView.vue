<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import { useAuthStore } from '../stores/auth'

interface EditableSlide {
  questionType: 'multiple-choice' | 'open-ended'
  question: string
  options: string[]
}

interface LoadedPresentation {
  _id: string
  title: string
  location?: string
  accessCode: string
  slides: { questionType: 'multiple-choice' | 'open-ended'; question: string; options?: { text: string }[] }[]
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const id = String(route.params.id)

const title = ref('')
const location = ref('')
const accessCode = ref('')
const slides = ref<EditableSlide[]>([])
const loading = ref(true)
const saving = ref(false)
const savedAt = ref('')
const error = ref('')

onMounted(async () => {
  try {
    const res = await api.getPresentation(auth.token, id)
    const p = res.data as unknown as LoadedPresentation
    title.value = p.title
    location.value = p.location ?? ''
    accessCode.value = p.accessCode
    slides.value = p.slides.map((s) => ({
      questionType: s.questionType,
      question: s.question,
      options: (s.options ?? []).map((o) => o.text),
    }))
    if (!slides.value.length) addSlide('multiple-choice')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not load presentation.'
  } finally {
    loading.value = false
  }
})

function addSlide(type: 'multiple-choice' | 'open-ended') {
  slides.value.push({ questionType: type, question: '', options: type === 'multiple-choice' ? ['', ''] : [] })
}

function removeSlide(index: number) {
  slides.value.splice(index, 1)
}

function addOption(slide: EditableSlide) {
  slide.options.push('')
}

function removeOption(slide: EditableSlide, index: number) {
  slide.options.splice(index, 1)
}

async function save() {
  error.value = ''
  saving.value = true
  try {
    const payload = {
      title: title.value.trim() || 'Untitled presentation',
      location: location.value.trim() || null,
      slides: slides.value
        .filter((s) => s.question.trim())
        .map((s) => ({
          questionType: s.questionType,
          question: s.question.trim(),
          options: s.questionType === 'multiple-choice' ? s.options.map((o) => o.trim()).filter(Boolean) : [],
        })),
    }
    await api.updatePresentation(auth.token, id, payload)
    savedAt.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not save.'
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!window.confirm('Delete this presentation and all its results?')) return
  try {
    await api.deletePresentation(auth.token, id)
    router.push({ name: 'dashboard' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not delete.'
  }
}
</script>

<template>
  <div class="page">
    <p v-if="loading" class="muted">Loading…</p>
    <template v-else>
      <div style="display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap;">
        <div>
          <span v-if="accessCode" class="code-chip" style="font-weight:800; letter-spacing:0.18em; background:var(--accent-soft); color:var(--accent-strong); padding:5px 12px; border-radius:8px;">{{ accessCode }}</span>
          <h1 style="margin-top:10px;">Edit presentation</h1>
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
          <span v-if="savedAt" class="muted">Saved {{ savedAt }}</span>
          <router-link class="button ghost" :to="{ name: 'present', params: { code: accessCode } }">Present</router-link>
          <button class="button danger" @click="remove">Delete</button>
          <button class="button big" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Save' }}</button>
        </div>
      </div>

      <p v-if="error" class="error-text">{{ error }}</p>

      <div class="card" style="margin-top:20px;">
        <label class="field"><span>Title</span><input v-model="title" maxlength="120" placeholder="All-hands kickoff" /></label>
        <label class="field" style="margin-bottom:0;"><span>Location <span class="muted">(optional)</span></span><input v-model="location" maxlength="120" placeholder="Stockholm office" /></label>
      </div>

      <div class="slide-list">
        <div v-for="(slide, i) in slides" :key="i" class="slide-item">
          <div class="slide-head">
            <span class="slide-type">{{ i + 1 }} · {{ slide.questionType === 'multiple-choice' ? 'Multiple choice' : 'Open question' }}</span>
            <button class="icon-button" title="Remove slide" :aria-label="`Remove slide ${i + 1}`" @click="removeSlide(i)">✕</button>
          </div>
          <label class="field">
            <span>Question</span>
            <input v-model="slide.question" maxlength="300" placeholder="What should we focus on next quarter?" />
          </label>
          <template v-if="slide.questionType === 'multiple-choice'">
            <div v-for="(_, oi) in slide.options" :key="oi" class="option-row">
              <input v-model="slide.options[oi]" maxlength="200" :placeholder="`Option ${oi + 1}`" />
              <button class="icon-button" title="Remove option" :aria-label="`Remove option ${oi + 1}`" @click="removeOption(slide, oi)">✕</button>
            </div>
            <button class="button ghost" @click="addOption(slide)">+ Add option</button>
          </template>
          <p v-else class="muted" style="margin:0;">The audience types free-text answers and upvotes each other's.</p>
        </div>
      </div>

      <div style="display:flex; gap:10px;">
        <button class="button secondary" @click="addSlide('multiple-choice')">+ Multiple choice</button>
        <button class="button secondary" @click="addSlide('open-ended')">+ Open question</button>
      </div>
    </template>
  </div>
</template>
