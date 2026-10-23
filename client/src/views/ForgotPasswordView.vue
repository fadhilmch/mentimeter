<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const email = ref('')
const error = ref('')
const sent = ref(false)
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await auth.sendPasswordReset(email.value.trim())
    sent.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not send the email.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="page page-narrow">
    <h1>Reset your password</h1>
    <p v-if="!auth.usesFirebase" class="sub">Password reset by email is not available on this server.</p>
    <template v-else>
      <p class="sub">Enter your email and we will send you a link to choose a new password.</p>
      <div class="card">
        <p v-if="sent" class="notice" role="status">
          If an account exists for that email, a reset link is on its way. It can take a few minutes, and it may land in your spam folder.
        </p>
        <form v-else @submit.prevent="submit">
          <label class="field"><span>Email</span><input v-model="email" type="email" required autocomplete="email" /></label>
          <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
          <button class="button big block" type="submit" :disabled="busy"><span v-if="busy" class="spinner" aria-hidden="true"></span>{{ busy ? 'Sending…' : 'Send reset link' }}</button>
        </form>
      </div>
    </template>
    <p class="muted" style="margin-top: 18px;"><router-link class="text-link" to="/login">Back to log in</router-link></p>
  </div>
</template>
