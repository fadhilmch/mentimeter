<script setup lang="ts">
import { useAuthStore } from './stores/auth';
import logoUrl from './assets/logo.svg';
import { useRoute, useRouter } from 'vue-router';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

function signOut() {
  auth.logout();
  router.push({ name: 'join' });
}
</script>

<template>
  <div class="app-shell">
    <header v-if="!route.meta.bare" class="topbar">
      <RouterLink to="/" class="brand">
        <img class="brand-mark" :src="logoUrl" alt="" aria-hidden="true" />
        CrowdFlow
      </RouterLink>
      <nav class="topnav">
        <RouterLink v-if="auth.isLoggedIn" to="/dashboard">My presentations</RouterLink>
        <button v-if="auth.isLoggedIn" class="link-button" @click="signOut">Sign out</button>
        <RouterLink v-else to="/login">Sign in</RouterLink>
      </nav>
    </header>
    <main>
      <RouterView />
    </main>
  </div>
</template>
