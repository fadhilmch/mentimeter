<script setup lang="ts">
import { useColorMode } from '../colorMode';

const { mode, toggle } = useColorMode();
</script>

<template>
  <button
    type="button"
    class="mode-toggle"
    :aria-label="mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
    :title="mode === 'dark' ? 'Light mode' : 'Dark mode'"
    @click="toggle"
  >
    <svg v-if="mode === 'dark'" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
    <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  </button>
</template>

<style scoped>
.mode-toggle {
  display: inline-grid; place-items: center; width: 36px; height: 36px; padding: 0;
  border-radius: 10px; border: 1px solid var(--line); background: transparent;
  color: var(--ink-2); cursor: pointer;
}
.mode-toggle:hover { color: var(--ink); background: var(--lead-soft); }
.mode-toggle:focus-visible { outline: 2px solid var(--lead); outline-offset: 2px; }
</style>
