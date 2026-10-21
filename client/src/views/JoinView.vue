<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLiveStore } from '../stores/live'
import { participantId } from '../participant'
import { aliasFor } from '../alias'
import ParticipantAvatar from '../components/ParticipantAvatar.vue'

const router = useRouter()
const route = useRoute()
const live = useLiveStore()
// A code can arrive from the landing page (?code=123456); keep digits only.
const code = ref(String(route.query.code ?? '').replace(/\D/g, '').slice(0, 6))
const nickname = ref(localStorage.getItem('livepoll.nickname') ?? '')
const error = ref('')
const busy = ref(false)

// Preview the avatar that will sit next to the player's name: the typed
// nickname, or the automatic alias they will get when they leave it blank.
const previewName = computed(() => nickname.value.trim() || aliasFor(participantId()))

async function join() {
  error.value = ''
  const accessCode = code.value.replace(/\D/g, '')
  if (accessCode.length !== 6) {
    error.value = 'Enter the 6-digit code from your presenter.'
    return
  }
  busy.value = true
  try {
    await live.join(accessCode)
    if (nickname.value.trim()) {
      try {
        await live.identify(nickname.value)
      } catch {
        // A missed nickname never blocks joining; the alias is the fallback.
      }
    }
    router.push({ name: 'audience', params: { code: accessCode } })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not join. Check the code and try again.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="page page-narrow">
    <p class="eyebrow">Live polling</p>
    <h1>Join a presentation</h1>
    <p class="sub">Enter the 6-digit code shown on the presenter's screen. No account needed.</p>
    <div class="card join-card">
      <form @submit.prevent="join">
        <label class="field">
          <span>Join code</span>
          <input
            v-model="code"
            class="code-input"
            inputmode="numeric"
            maxlength="6"
            placeholder="123456"
            autocomplete="off"
          />
        </label>
        <label class="field">
          <span>Name for the quiz leaderboard <span class="muted">(optional)</span></span>
          <span class="nickname-row">
            <ParticipantAvatar :name="previewName" :size="36" />
            <input
              v-model="nickname"
              maxlength="24"
              placeholder="e.g. Fika Fan"
              autocomplete="off"
            />
          </span>
        </label>
        <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
        <button class="button big block" type="submit" :disabled="busy">
          {{ busy ? 'Joining…' : 'Join presentation' }}
        </button>
      </form>
    </div>
    <p class="muted" style="text-align:center; margin-top: 28px;">
      Presenting? <router-link class="text-link" to="/login">Log in</router-link>
      or <router-link class="text-link" to="/signup">sign up</router-link>
    </p>
  </div>
</template>

<style scoped>
.nickname-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.nickname-row input {
  flex: 1;
}
</style>
