<script setup lang="ts">
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
</script>

<template>
  <div class="page page-narrow">
    <p class="eyebrow">404</p>
    <h1>Page not found</h1>
    <p class="sub">That address doesn't lead anywhere. Check the link, or start from one of these.</p>
    <div class="not-found-actions">
      <RouterLink class="button" :to="{ name: 'home' }">Back to the home page</RouterLink>
      <RouterLink class="button ghost" :to="{ name: 'join' }">Join with a code</RouterLink>
      <RouterLink v-if="auth.isLoggedIn" class="button ghost" :to="{ name: 'dashboard' }">My presentations</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.not-found-actions { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-top: var(--space-5); }
</style>
