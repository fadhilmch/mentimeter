<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const username = ref('')
const oldPassword = ref('')
const email = ref('')
const newPassword = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await auth.claimLegacyAccount(username.value.trim().toLowerCase(), oldPassword.value, email.value.trim(), newPassword.value)
    router.push({ name: 'dashboard' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not move the account.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="page page-narrow">
    <h1>Move your account</h1>
    <p v-if="!auth.usesFirebase" class="sub">Email sign-in is not turned on for this server, so there is nothing to move.</p>
    <template v-else>
      <p class="sub">
        Accounts now sign in with an email address. Enter your old username and password once, then choose an email and a new password.
        Your presentations stay with the account.
      </p>
      <div class="card">
        <form @submit.prevent="submit">
          <label class="field"><span>Old username</span><input v-model="username" required autocomplete="username" /></label>
          <label class="field"><span>Old password</span><input v-model="oldPassword" type="password" required autocomplete="current-password" /></label>
          <label class="field"><span>New email</span><input v-model="email" type="email" required autocomplete="email" /></label>
          <label class="field"><span>New password</span><input v-model="newPassword" type="password" minlength="8" required autocomplete="new-password" /></label>
          <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
          <button class="button big block" type="submit" :disabled="busy"><span v-if="busy" class="spinner" aria-hidden="true"></span>{{ busy ? 'Moving…' : 'Move my account' }}</button>
        </form>
      </div>
    </template>
    <p class="muted" style="margin-top: 18px;"><router-link class="text-link" to="/login">Back to log in</router-link></p>
  </div>
</template>
