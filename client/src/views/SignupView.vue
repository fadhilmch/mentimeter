<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const name = ref('')
const username = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await auth.signup(name.value.trim(), username.value.trim().toLowerCase(), password.value)
    router.push({ name: 'dashboard' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Signup failed.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="page page-narrow">
    <h1>Create your account</h1>
    <p class="sub">Build presentations and run them live in front of any audience.</p>
    <div class="card">
      <form @submit.prevent="submit">
        <label class="field"><span>Name</span><input v-model="name" required autocomplete="name" placeholder="Ada Lovelace" /></label>
        <label class="field"><span>Username</span><input v-model="username" required autocomplete="username" placeholder="ada" /></label>
        <label class="field"><span>Password</span><input v-model="password" type="password" minlength="8" required autocomplete="new-password" /></label>
        <p class="muted">Username: 3-30 characters, lowercase letters, numbers, dots and dashes. Password: at least 8 characters.</p>
        <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
        <button class="button big block" type="submit" :disabled="busy">{{ busy ? 'Creating…' : 'Sign up' }}</button>
      </form>
    </div>
    <p class="muted" style="margin-top: 18px;">Already have an account? <router-link to="/login" style="color: var(--accent); font-weight: 600;">Log in</router-link></p>
  </div>
</template>
