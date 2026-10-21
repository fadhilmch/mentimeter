<script setup lang="ts">
import { useAuthStore } from './stores/auth';
import logoUrl from './assets/logo-light.svg';
import { useRoute, useRouter } from 'vue-router';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

function signOut() {
  auth.logout();
  router.push({ name: 'home' });
}
</script>

<template>
  <div class="app-shell">
    <header v-if="!route.meta.bare" class="topbar">
      <RouterLink to="/" class="brand">
        <img class="brand-logo" :src="logoUrl" alt="CrowdFlow" />
      </RouterLink>
      <nav class="topnav">
        <RouterLink v-if="auth.isLoggedIn" to="/dashboard">My presentations</RouterLink>
        <button v-if="auth.isLoggedIn" class="link-button" @click="signOut">Sign out</button>
        <template v-else>
          <RouterLink to="/login">Sign in</RouterLink>
          <RouterLink v-if="route.name === 'home'" to="/signup" class="button nav-cta">
            <span class="long">Create a presentation</span><span class="short">Create</span>
          </RouterLink>
        </template>
      </nav>
    </header>
    <main>
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.topnav .nav-cta { padding: 8px 16px; color: #fff; font-size: 0.9rem; }
.topnav .nav-cta:hover { color: #fff; }
.short { display: none; }
@media (max-width: 520px) {
  .long { display: none; }
  .short { display: inline; }
}
</style>
