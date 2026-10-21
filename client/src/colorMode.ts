import { ref, watchEffect } from 'vue';
import type { ColorMode } from './themes';

const KEY = 'crowdflow.colorMode';

function initial(): ColorMode {
  const saved = localStorage.getItem(KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Shared light/dark choice. Persisted per browser, defaults to the system setting. */
const mode = ref<ColorMode>(initial());

watchEffect(() => {
  document.documentElement.dataset.theme = mode.value;
  document.documentElement.style.colorScheme = mode.value;
});

export function useColorMode() {
  function toggle() {
    mode.value = mode.value === 'dark' ? 'light' : 'dark';
    localStorage.setItem(KEY, mode.value);
  }
  return { mode, toggle };
}
