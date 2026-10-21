<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { api, ApiError } from '../api'
import { useAuthStore } from '../stores/auth'
import { THEMES } from '../themes'

interface EditableOption {
  id?: string
  text: string
}

interface EditableSlide {
  id?: string
  questionType: 'multiple-choice' | 'open-ended'
  question: string
  options: EditableOption[]
}

interface LoadedSlide {
  id?: string
  questionType: 'multiple-choice' | 'open-ended'
  question: string
  options?: { id?: string; text: string }[]
}

interface LoadedPresentation {
  _id: string
  title: string
  location?: string
  accessCode: string
  theme?: string
  structureRevision?: number
  slides: LoadedSlide[]
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const id = String(route.params.id)

const title = ref('')
const location = ref('')
const accessCode = ref('')
const themeId = ref<string>('iris')
const slides = ref<EditableSlide[]>([])
const structureRevision = ref(0)
const loading = ref(true)
const saving = ref(false)
const savedAt = ref('')
const error = ref('')
const conflicted = ref(false)
const showValidation = ref(false)
const dirty = ref(false)
const ready = ref(false)

const titleError = computed(() => (title.value.trim() ? '' : 'Give the presentation a title.'))

function slideError(slide: EditableSlide): string {
  if (!slide.question.trim()) return 'Give this slide a question, or remove it.'
  if (slide.questionType === 'multiple-choice' && slide.options.filter((o) => o.text.trim()).length < 2) {
    return 'Multiple choice needs at least 2 options.'
  }
  return ''
}

const hasValidationErrors = computed(() => titleError.value !== '' || slides.value.some((s) => slideError(s) !== ''))

function applyLoaded(p: LoadedPresentation) {
  title.value = p.title
  location.value = p.location ?? ''
  accessCode.value = p.accessCode
  themeId.value = p.theme ?? 'iris'
  structureRevision.value = p.structureRevision ?? 0
  slides.value = p.slides.map((s) => ({
    id: s.id,
    questionType: s.questionType,
    question: s.question,
    options: (s.options ?? []).map((o) => ({ id: o.id, text: o.text })),
  }))
  if (!slides.value.length) addSlide('multiple-choice')
  dirty.value = false
}

async function reload() {
  const res = await api.getPresentation(auth.token, id)
  applyLoaded(res.data as unknown as LoadedPresentation)
  conflicted.value = false
  showValidation.value = false
}

onMounted(async () => {
  try {
    await reload()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not load presentation.'
  } finally {
    loading.value = false
    ready.value = true
  }
  window.addEventListener('beforeunload', warnUnsaved)
})

onBeforeUnmount(() => window.removeEventListener('beforeunload', warnUnsaved))

watch([title, location, themeId, slides], () => {
  if (ready.value) dirty.value = true
}, { deep: true })

function warnUnsaved(event: BeforeUnloadEvent) {
  if (dirty.value) event.preventDefault()
}

onBeforeRouteLeave(() => {
  if (dirty.value && !window.confirm('You have unsaved changes. Leave without saving?')) return false
})

function addSlide(type: 'multiple-choice' | 'open-ended') {
  slides.value.push({
    questionType: type,
    question: '',
    options: type === 'multiple-choice' ? [{ text: '' }, { text: '' }] : [],
  })
}

function removeSlide(index: number) {
  slides.value.splice(index, 1)
}

function addOption(slide: EditableSlide) {
  slide.options.push({ text: '' })
}

function removeOption(slide: EditableSlide, index: number) {
  slide.options.splice(index, 1)
}

function savePayload(confirmRemove?: { votes: number; responses: number }) {
  return {
    title: title.value.trim(),
    location: location.value.trim() || null,
    theme: themeId.value,
    baseStructureRevision: structureRevision.value,
    confirmRemove,
    slides: slides.value.map((s) => ({
      id: s.id,
      questionType: s.questionType,
      question: s.question.trim(),
      options:
        s.questionType === 'multiple-choice'
          ? s.options.filter((o) => o.text.trim()).map((o) => ({ id: o.id, text: o.text.trim() }))
          : [],
    })),
  }
}

function describeLoss(votes: number, responses: number): string {
  const parts: string[] = []
  if (votes) parts.push(`${votes} vote${votes === 1 ? '' : 's'}`)
  if (responses) parts.push(`${responses} response${responses === 1 ? '' : 's'}`)
  return parts.join(' and ')
}

async function save() {
  error.value = ''
  showValidation.value = true
  if (hasValidationErrors.value) return
  saving.value = true
  try {
    await attemptSave()
  } finally {
    saving.value = false
  }
}

async function attemptSave(alreadyRetried = false) {
  try {
    const res = await api.updatePresentation(auth.token, id, savePayload())
    applyLoaded(res.data as unknown as LoadedPresentation)
    savedAt.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 409) {
      error.value = err instanceof Error ? err.message : 'Could not save.'
      return
    }
    const { code, removedVotes = 0, removedResponses = 0 } = err.body
    if (code === 'requiresConfirmation') {
      const loss = describeLoss(removedVotes, removedResponses)
      if (!window.confirm(`Saving removes slides or options that already have ${loss}. Delete those results?`)) return
      try {
        const res = await api.updatePresentation(auth.token, id, savePayload({ votes: removedVotes, responses: removedResponses }))
        applyLoaded(res.data as unknown as LoadedPresentation)
        savedAt.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      } catch (retryErr) {
        error.value =
          retryErr instanceof ApiError && retryErr.status === 409
            ? 'New votes came in while you were deciding. Review the slides and save again.'
            : retryErr instanceof Error
              ? retryErr.message
              : 'Could not save.'
      }
      return
    }
    if ((code === 'upgraded' || code === 'stale') && !alreadyRetried) {
      // Identities were missing or stale. If the structure has not changed
      // since we loaded, graft the fresh ids on by position and retry once.
      const fresh = (await api.getPresentation(auth.token, id)).data as unknown as LoadedPresentation
      const sameShape =
        (fresh.structureRevision ?? 0) === structureRevision.value &&
        fresh.slides.length === slides.value.length &&
        fresh.slides.every((fs, i) => (fs.options?.length ?? 0) === slides.value[i].options.length)
      if (!sameShape) {
        applyLoaded(fresh)
        error.value = 'This presentation changed since you opened it. Review the reloaded slides, then save again.'
        return
      }
      fresh.slides.forEach((freshSlide, i) => {
        slides.value[i].id = freshSlide.id
        freshSlide.options?.forEach((freshOption, oi) => {
          if (slides.value[i].options[oi]) slides.value[i].options[oi].id = freshOption.id
        })
      })
      structureRevision.value = fresh.structureRevision ?? 0
      await attemptSave(true)
      return
    }
    if (code === 'conflict') {
      conflicted.value = true
      error.value = 'These slides were changed elsewhere. Reload to see the latest version before saving.'
      return
    }
    error.value = err.message
  }
}

async function remove() {
  if (!window.confirm('Delete this presentation and all its results?')) return
  try {
    await api.deletePresentation(auth.token, id)
    dirty.value = false
    router.push({ name: 'dashboard' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not delete.'
  }
}
</script>

<template>
  <div class="page">
    <div v-if="loading" aria-label="Loading editor" style="margin-top:20px; display:flex; flex-direction:column; gap:14px;">
      <div class="skel" style="height:38px; max-width:280px;"></div>
      <div class="skel skel-card" style="height:180px;"></div>
      <div class="skel skel-card" style="height:120px;"></div>
    </div>
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

      <p v-if="error" class="error-banner" role="alert">
        {{ error }}
        <button v-if="conflicted" class="button ghost" style="margin-left:8px;" @click="reload">Reload</button>
      </p>

      <div class="card" style="margin-top:20px;">
        <label class="field">
          <span>Title</span>
          <input v-model="title" maxlength="120" placeholder="All-hands kickoff" />
        </label>
        <p v-if="showValidation && titleError" class="slide-error" role="alert">{{ titleError }}</p>
        <label class="field" style="margin-bottom:0;"><span>Location <span class="muted">(optional)</span></span><input v-model="location" maxlength="120" placeholder="Stockholm office" /></label>
      </div>

      <div class="card" style="margin-top:20px;">
        <h2 style="margin-bottom:4px;">Theme</h2>
        <p class="muted" style="margin:0 0 10px;">Colors for this presentation's stage and audience screens. The rest of the app keeps the standard CrowdFlow look.</p>
        <div class="theme-picker" role="radiogroup" aria-label="Presentation theme">
          <button
            v-for="t in THEMES"
            :key="t.id"
            type="button"
            role="radio"
            :aria-checked="themeId === t.id"
            class="theme-option"
            :class="{ sel: themeId === t.id }"
            @click="themeId = t.id"
          >
            <span class="theme-mini" :style="{ background: t.sbg }">
              <span class="mq"></span>
              <span class="mb"><i v-for="(c, j) in t.pal.slice(0, 3)" :key="j" :style="{ height: ['46%','82%','60%'][j], background: c }"></i></span>
              <span class="ml" :style="{ background: t.acc }"></span>
            </span>
            <span class="theme-name">{{ t.name }}</span>
          </button>
        </div>
      </div>

      <div class="slide-list">
        <div v-for="(slide, i) in slides" :key="slide.id ?? `new-${i}`" class="slide-item">
          <div class="slide-head">
            <span class="slide-type">{{ i + 1 }} · {{ slide.questionType === 'multiple-choice' ? 'Multiple choice' : 'Open question' }}</span>
            <button class="icon-button" title="Remove slide" :aria-label="`Remove slide ${i + 1}`" @click="removeSlide(i)">✕</button>
          </div>
          <label class="field">
            <span>Question</span>
            <input v-model="slide.question" maxlength="300" placeholder="What should we focus on next quarter?" />
          </label>
          <template v-if="slide.questionType === 'multiple-choice'">
            <div v-for="(option, oi) in slide.options" :key="option.id ?? `new-${oi}`" class="option-row">
              <input v-model="option.text" maxlength="200" :placeholder="`Option ${oi + 1}`" />
              <button class="icon-button" title="Remove option" :aria-label="`Remove option ${oi + 1}`" @click="removeOption(slide, oi)">✕</button>
            </div>
            <button class="button ghost" @click="addOption(slide)">+ Add option</button>
          </template>
          <p v-else class="muted" style="margin:0;">The audience types free-text answers and upvotes each other's.</p>
          <p v-if="showValidation && slideError(slide)" class="slide-error" role="alert">{{ slideError(slide) }}</p>
        </div>
      </div>

      <div style="display:flex; gap:10px;">
        <button class="button secondary" @click="addSlide('multiple-choice')">+ Multiple choice</button>
        <button class="button secondary" @click="addSlide('open-ended')">+ Open question</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.slide-error {
  margin: 6px 0 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: #b42318;
}
</style>
