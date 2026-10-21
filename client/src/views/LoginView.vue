<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const username = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    if (auth.usesFirebase) await auth.loginWithEmail(email.value.trim(), password.value)
    else await auth.login(username.value.trim().toLowerCase(), password.value)
    router.push(typeof route.query.redirect === 'string' ? route.query.redirect : { name: 'dashboard' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Login failed.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="page page-narrow">
    <h1>Welcome back</h1>
    <p v-if="route.query.expired" class="notice" role="status">Your session ended. Log in again to continue.</p>
    <p class="sub">Log in to manage and present your presentations.</p>
    <div class="card">
      <form @submit.prevent="submit">
        <label v-if="auth.usesFirebase" class="field"><span>Email</span><input v-model="email" type="email" required autocomplete="email" /></label>
        <label v-else class="field"><span>Username</span><input v-model="username" required autocomplete="username" /></label>
        <label class="field"><span>Password</span><input v-model="password" type="password" required autocomplete="current-password" /></label>
        <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
        <button class="button big block" type="submit" :disabled="busy">{{ busy ? 'Logging in…' : 'Log in' }}</button>
      </form>
    </div>
    <p v-if="auth.usesFirebase" class="muted" style="margin-top: 18px;">
      <router-link class="text-link" to="/forgot-password">Forgot your password?</router-link><br />
      <router-link class="text-link" to="/move-account">Have an older username account?</router-link>
    </p>
    <p class="muted" style="margin-top: 18px;">New here?&nbsp;<router-link class="text-link" to="/signup">Sign up</router-link></p>
  </div>
</template>
