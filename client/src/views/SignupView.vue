<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const name = ref('')
const username = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)
const googleBusy = ref(false)

async function google() {
  error.value = ''
  googleBusy.value = true
  try {
    await auth.loginWithGoogle()
    if (auth.pendingProfile) return router.push({ name: 'finish-setup' })
    router.push({ name: 'dashboard' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not sign in with Google.'
  } finally {
    googleBusy.value = false
  }
}

async function submit() {
  error.value = ''
  busy.value = true
  try {
    if (auth.usesFirebase) await auth.signupWithEmail(name.value.trim(), email.value.trim(), password.value)
    else await auth.signup(name.value.trim(), username.value.trim().toLowerCase(), password.value)
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
      <template v-if="auth.usesFirebase">
        <button class="button secondary big block" type="button" :disabled="busy || googleBusy" @click="google">
          <span v-if="googleBusy" class="spinner" aria-hidden="true"></span>{{ googleBusy ? 'Waiting for Google…' : 'Continue with Google' }}
        </button>
        <p class="auth-divider" role="separator"><span>or with email</span></p>
      </template>
      <form @submit.prevent="submit">
        <label class="field"><span>Name</span><input v-model="name" required autocomplete="name" placeholder="Ada Lovelace" /></label>
        <label v-if="auth.usesFirebase" class="field"><span>Email</span><input v-model="email" type="email" required autocomplete="email" placeholder="ada@example.com" /></label>
        <label v-else class="field"><span>Username</span><input v-model="username" required autocomplete="username" placeholder="ada" /></label>
        <label class="field"><span>Password</span><input v-model="password" type="password" minlength="8" required autocomplete="new-password" /></label>
        <p v-if="auth.usesFirebase" class="muted">We use your email to sign you in and to reset your password. Password: at least 8 characters.</p>
        <p v-else class="muted">Username: 3-30 characters, lowercase letters, numbers, dots and dashes. Password: at least 8 characters.</p>
        <p v-if="error" class="error-banner" role="alert">{{ error }}</p>
        <button class="button big block" type="submit" :disabled="busy"><span v-if="busy" class="spinner" aria-hidden="true"></span>{{ busy ? 'Creating…' : 'Sign up' }}</button>
      </form>
    </div>
    <p class="muted" style="margin-top: 18px;">Already have an account?&nbsp;<router-link class="text-link" to="/login">Log in</router-link></p>
  </div>
</template>

<style scoped>
.auth-divider { display: flex; align-items: center; gap: var(--space-3); margin: var(--space-4) 0; color: color-mix(in srgb, var(--t-ink) 55%, transparent); font-size: 0.85rem; }
.auth-divider::before, .auth-divider::after { content: ''; flex: 1; border-top: 1px solid color-mix(in srgb, var(--t-ink) 18%, transparent); }
</style>
