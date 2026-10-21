<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { api, ApiError } from '../api'
import { useAuthStore } from '../stores/auth'
import { THEMES } from '../themes'
import SlidePreview from '../components/SlidePreview.vue'

type SlideType = 'multiple-choice' | 'open-ended' | 'word-cloud' | 'rating' | 'ranking' | 'quiz'

interface EditableOption {
  id?: string
  text: string
}

interface EditableDesign {
  accent?: string
  imageUrl?: string
  imageLayout?: 'beside' | 'behind'
}

interface EditableSlide {
  id?: string
  questionType: SlideType
  question: string
  options: EditableOption[]
  correctOptionId?: string
  design?: EditableDesign
}

interface LoadedSlide {
  id?: string
  questionType: SlideType
  question: string
  options?: { id?: string; text: string }[]
  correctOptionId?: string
  design?: EditableDesign
}

const TYPE_META: { type: SlideType; label: string; hint: string; hasOptions: boolean }[] = [
  { type: 'multiple-choice', label: 'Multiple choice', hint: '', hasOptions: true },
  { type: 'quiz', label: 'Quiz', hint: 'Like multiple choice, but you mark the correct answer. Revealed when results show.', hasOptions: true },
  { type: 'word-cloud', label: 'Word cloud', hint: 'The audience sends single words; repeated words grow bigger.', hasOptions: false },
  { type: 'rating', label: 'Rating', hint: 'The audience rates 1-10; the stage shows the average and spread.', hasOptions: false },
  { type: 'ranking', label: 'Ranking', hint: 'The audience orders your options; points build the final ranking.', hasOptions: true },
  { type: 'open-ended', label: 'Open question', hint: "The audience types free-text answers and upvotes each other's.", hasOptions: false },
]

const typeLabel = (type: SlideType) => TYPE_META.find((t) => t.type === type)?.label ?? type
const typeHint = (type: SlideType) => TYPE_META.find((t) => t.type === type)?.hint ?? ''
const hasOptions = (type: SlideType) => TYPE_META.find((t) => t.type === type)?.hasOptions ?? false

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
const activeSlide = ref(0)
const copied = ref(false)

const titleError = computed(() => (title.value.trim() ? '' : 'Give the presentation a title.'))

function slideError(slide: EditableSlide): string {
  if (!slide.question.trim()) return 'Give this slide a question, or remove it.'
  if (hasOptions(slide.questionType) && slide.options.filter((o) => o.text.trim()).length < 2) {
    return `${typeLabel(slide.questionType)} needs at least 2 options.`
  }
  if (slide.questionType === 'quiz') {
    const keyed = slide.options.some((o) => o.text.trim() && o.id && o.id === slide.correctOptionId)
    if (!keyed) return 'Mark which option is the correct answer.'
  }
  return ''
}

const hasValidationErrors = computed(() => titleError.value !== '' || slides.value.some((s) => slideError(s) !== ''))
const previewSlide = computed(() => slides.value[activeSlide.value] ?? slides.value[0])

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
    correctOptionId: s.correctOptionId,
    design: s.design ? { ...s.design } : {},
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

function addSlide(type: SlideType) {
  slides.value.push({
    questionType: type,
    question: '',
    options: hasOptions(type) ? [{ id: crypto.randomUUID(), text: '' }, { id: crypto.randomUUID(), text: '' }] : [],
    design: {},
  })
  activeSlide.value = slides.value.length - 1
}

function removeSlide(index: number) {
  slides.value.splice(index, 1)
  activeSlide.value = Math.min(activeSlide.value, slides.value.length - 1)
}

function moveSlide(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= slides.value.length) return
  const [moved] = slides.value.splice(index, 1)
  slides.value.splice(target, 0, moved)
  activeSlide.value = target
}

const joinLink = computed(() => (accessCode.value ? `${window.location.origin}/p/${accessCode.value}` : ''))

async function copyJoinLink() {
  const link = joinLink.value
  if (!link) return
  try {
    await navigator.clipboard.writeText(link)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = link
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }
  copied.value = true
  window.setTimeout(() => (copied.value = false), 1500)
}

function addOption(slide: EditableSlide) {
  slide.options.push({ id: crypto.randomUUID(), text: '' })
}

function setAccent(slide: EditableSlide, color?: string) {
  slide.design = { ...slide.design, accent: color }
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
    slides: slides.value.map((s) => {
      const options = hasOptions(s.questionType)
        ? s.options.filter((o) => o.text.trim()).map((o) => ({ id: o.id, text: o.text.trim() }))
        : []
      const design = s.design && (s.design.accent || s.design.imageUrl?.trim())
        ? {
            ...(s.design.accent ? { accent: s.design.accent } : {}),
            ...(s.design.imageUrl?.trim() ? { imageUrl: s.design.imageUrl.trim(), imageLayout: s.design.imageLayout ?? 'beside' } : {}),
          }
        : undefined
      return {
        id: s.id,
        questionType: s.questionType,
        question: s.question.trim(),
        options,
        ...(s.questionType === 'quiz' && s.correctOptionId ? { correctOptionId: s.correctOptionId } : {}),
        ...(design ? { design } : {}),
      }
    }),
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
          <button v-if="accessCode" class="button ghost" style="margin-left:8px; padding:5px 12px; font-size:0.85rem;" @click="copyJoinLink">{{ copied ? 'Copied ✓' : 'Copy join link' }}</button>
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

      <div class="card" style="margin-top:20px;">
        <h2 style="margin-bottom:10px;">Stage preview</h2>
        <SlidePreview v-if="previewSlide" :slide="previewSlide" :theme-id="themeId" />
        <p v-else class="muted" style="margin:0;">Add a slide to preview it here.</p>
      </div>

      <div class="slide-list">
        <div v-for="(slide, i) in slides" :key="slide.id ?? `new-${i}`" class="slide-item" @focusin="activeSlide = i">
          <div class="slide-head">
            <span class="slide-type">{{ i + 1 }} · {{ typeLabel(slide.questionType) }}</span>
            <span style="display:flex; gap:6px;">
              <button class="icon-button" title="Move slide up" :aria-label="`Move slide ${i + 1} up`" :disabled="i === 0" @click="moveSlide(i, -1)">↑</button>
              <button class="icon-button" title="Move slide down" :aria-label="`Move slide ${i + 1} down`" :disabled="i === slides.length - 1" @click="moveSlide(i, 1)">↓</button>
              <button class="icon-button" title="Remove slide" :aria-label="`Remove slide ${i + 1}`" @click="removeSlide(i)">✕</button>
            </span>
          </div>
          <label class="field">
            <span>Question</span>
            <input v-model="slide.question" maxlength="300" placeholder="What should we focus on next quarter?" />
          </label>
          <template v-if="hasOptions(slide.questionType)">
            <div v-for="(option, oi) in slide.options" :key="option.id ?? `new-${oi}`" class="option-row">
              <label v-if="slide.questionType === 'quiz'" class="correct-toggle" :title="'Mark as correct answer'">
                <input
                  type="radio"
                  :name="`correct-${slide.id ?? i}`"
                  :checked="slide.correctOptionId === option.id"
                  @change="slide.correctOptionId = option.id"
                />
                <span>correct</span>
              </label>
              <input v-model="option.text" maxlength="200" :placeholder="`Option ${oi + 1}`" />
              <button class="icon-button" title="Remove option" :aria-label="`Remove option ${oi + 1}`" @click="removeOption(slide, oi)">✕</button>
            </div>
            <button class="button ghost" @click="addOption(slide)">+ Add option</button>
            <p v-if="slide.questionType === 'quiz'" class="muted" style="margin:6px 0 0;">The correct answer is revealed on stage when results show. Players stay anonymous - the stage shows how many got it right, no named leaderboard.</p>
          </template>
          <p v-if="typeHint(slide.questionType) && slide.questionType !== 'quiz'" class="muted" style="margin:0;">{{ typeHint(slide.questionType) }}</p>

          <details class="design-panel">
            <summary>Slide design <span class="muted">(optional)</span></summary>
            <div class="design-body">
              <span class="field-label">Accent</span>
              <div class="accent-row">
                <button
                  class="accent-swatch none"
                  :class="{ sel: !slide.design?.accent }"
                  title="Theme default"
                  @click="setAccent(slide, undefined)"
                >A</button>
                <button
                  v-for="c in THEMES.find((t) => t.id === themeId)?.pal ?? THEMES[0].pal"
                  :key="c"
                  class="accent-swatch"
                  :class="{ sel: slide.design?.accent === c }"
                  :style="{ background: c }"
                  :title="c"
                  @click="setAccent(slide, c)"
                ></button>
              </div>
              <label class="field" style="margin-top:10px;">
                <span>Image URL <span class="muted">(optional)</span></span>
                <input v-model="slide.design!.imageUrl" maxlength="500" placeholder="https://…" />
              </label>
              <label v-if="slide.design?.imageUrl" class="field" style="margin-bottom:0;">
                <span>Image placement</span>
                <select v-model="slide.design!.imageLayout">
                  <option value="beside">Beside the question</option>
                  <option value="behind">Behind the question</option>
                </select>
              </label>
            </div>
          </details>
          <p v-if="showValidation && slideError(slide)" class="slide-error" role="alert">{{ slideError(slide) }}</p>
        </div>
      </div>

      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button v-for="t in TYPE_META" :key="t.type" class="button secondary" @click="addSlide(t.type)">+ {{ t.label }}</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.correct-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--muted, #6b6f76);
  flex-shrink: 0;
  cursor: pointer;
}
.design-panel {
  margin-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  padding-top: 10px;
}
.design-panel summary {
  cursor: pointer;
  font-weight: 700;
  font-size: 0.9rem;
}
.design-body {
  margin-top: 10px;
}
.field-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 700;
  margin-bottom: 6px;
}
.accent-row {
  display: flex;
  gap: 8px;
}
.accent-swatch {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}
.accent-swatch.none {
  background: #fff;
  border-color: rgba(0, 0, 0, 0.2);
  font-weight: 800;
  color: #555;
}
.accent-swatch.sel {
  outline: 3px solid var(--accent, #5b5bd6);
  outline-offset: 2px;
}
.slide-error {
  margin: 6px 0 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: #b42318;
}
</style>
