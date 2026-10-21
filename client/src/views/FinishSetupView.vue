<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const name = ref('')
const error = ref('')
const busy = ref(false)
const deletePassword = ref('')
const deleteError = ref('')

onMounted(async () => {
  await auth.init()
  if (!auth.pendingProfile) router.replace({ name: auth.isLoggedIn ? 'dashboard' : 'login' })
})

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await auth.finishProfile(name.value.trim())
    router.push({ name: 'dashboard' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not finish setting up.'
  } finally {
    busy.value = false
  }
}

async function removeLogin() {
  deleteError.value = ''
  try {
    await auth.deleteAccount(deletePassword.value)
    router.push({ name: 'home' })
  } catch (err) {
    deleteError.value = err instanceof Error ? err.message : 'Could not delete this login.'
  }
}

async function signOut() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="page page-narrow">
    <h1>Finish setting up</h1>
    <p class="sub">You are signed in, but your account setup did not finish. Add your name to continue.</p>
    <div class="card">
      <form @submit.prevent="submit">
        <label class="field"><span>Name</span><input v-model="name" required autocomplete="name" placeholder="Ada Lovelace" /></label>
        <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
        <button class="button big block" type="submit" :disabled="busy">{{ busy ? 'Saving…' : 'Continue' }}</button>
      </form>
    </div>
    <details class="account-delete">
      <summary>Delete this login instead</summary>
      <p class="muted">This removes the login and anything attached to it. It cannot be undone.</p>
      <form @submit.prevent="removeLogin">
        <label class="field"><span>Confirm with your password</span><input v-model="deletePassword" type="password" autocomplete="current-password" required /></label>
        <p v-if="deleteError" class="error-banner" role="alert">{{ deleteError }}</p>
        <button class="button danger" type="submit" :disabled="!deletePassword">Delete this login</button>
      </form>
    </details>
    <p class="muted" style="margin-top: 18px;"><button class="link-button" type="button" @click="signOut">Not you? Sign out</button></p>
  </div>
</template>
