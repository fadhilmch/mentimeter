<script setup lang="ts">
import { useAuthStore } from './stores/auth';
import logoLight from './assets/logo-light.svg';
import logoDark from './assets/logo-dark.svg';
import ColorModeToggle from './components/ColorModeToggle.vue';
import { useColorMode } from './colorMode';
import { useRoute, useRouter } from 'vue-router';

const auth = useAuthStore();
const { mode } = useColorMode();
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
        <img class="brand-logo" :src="mode === 'dark' ? logoDark : logoLight" alt="CrowdFlow" />
      </RouterLink>
      <nav class="topnav">
        <!-- Audience surfaces (joining on a shared device) never show account links:
             a presenter's "My presentations"/"Sign out" must not leak to their audience. -->
        <template v-if="!route.meta.audience">
          <RouterLink v-if="auth.isLoggedIn" to="/dashboard">My presentations</RouterLink>
          <button v-if="auth.isLoggedIn" class="link-button" @click="signOut">Sign out</button>
          <template v-else>
            <RouterLink to="/login">Log in</RouterLink>
            <RouterLink v-if="route.name === 'home'" to="/signup" class="button nav-cta">
              <span class="long">Create a presentation</span><span class="short">Create</span>
            </RouterLink>
          </template>
        </template>
        <ColorModeToggle />
      </nav>
    </header>
    <main>
      <RouterView />
    </main>
    <footer v-if="!route.meta.bare" class="site-footer">
      <span>CrowdFlow is open source under the MIT licence.</span>
      <a href="https://github.com/fadhilmch/crowdflow" rel="noopener">GitHub</a>
    </footer>
  </div>
</template>

<style scoped>
.topnav .nav-cta { padding: var(--space-2) var(--space-4); color: var(--on-accent); font-size: var(--fs-base); }
.topnav .nav-cta:hover { color: var(--on-accent); }
.short { display: none; }
@media (max-width: 520px) {
  .long { display: none; }
  .short { display: inline; }
}
</style>
