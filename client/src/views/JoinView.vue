<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLiveStore } from '../stores/live'
import logoUrl from '../assets/logo.svg'

const router = useRouter()
const live = useLiveStore()
const code = ref('')
const nickname = ref(localStorage.getItem('livepoll.nickname') ?? '')
const error = ref('')
const busy = ref(false)

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
    <div class="join-lockup">
      <img :src="logoUrl" width="40" height="40" alt="" aria-hidden="true" />
      <span class="join-wordmark">CrowdFlow</span>
    </div>
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
          <input
            v-model="nickname"
            maxlength="24"
            placeholder="e.g. Fika Fan"
            autocomplete="off"
          />
        </label>
        <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
        <button class="button big block" type="submit" :disabled="busy">
          {{ busy ? 'Joining…' : 'Join presentation' }}
        </button>
      </form>
    </div>
    <p class="muted" style="text-align:center; margin-top: 28px;">
      Presenting? <router-link to="/login" style="color: var(--accent); font-weight: 600;">Log in</router-link>
      or <router-link to="/signup" style="color: var(--accent); font-weight: 600;">create an account</router-link>
    </p>
  </div>
</template>
