<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import QRCode from 'qrcode';

const props = defineProps<{ code: string }>();
const emit = defineEmits<{ close: [] }>();

/** Real audience route on whatever origin the presenter is using. */
const joinUrl = computed(() => `${window.location.origin}/p/${props.code}`);
const svg = ref('');
const copied = ref(false);

watchEffect(async () => {
  // Always dark-on-white so phone cameras read it in either color mode.
  svg.value = await QRCode.toString(joinUrl.value, {
    type: 'svg', margin: 1, errorCorrectionLevel: 'M',
    color: { dark: '#111113', light: '#ffffff' },
  });
});

async function copy() {
  await navigator.clipboard?.writeText(joinUrl.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}
</script>

<template>
  <div class="join-overlay" role="dialog" aria-modal="true" aria-label="Join this presentation" @click.self="emit('close')" @keydown.esc="emit('close')">
    <div class="join-sheet">
      <button class="join-close" aria-label="Close" @click="emit('close')">×</button>
      <p class="join-eyebrow">Scan to join</p>
      <div class="join-qr" data-testid="join-qr" v-html="svg" />
      <p class="join-or">or enter the code</p>
      <p class="join-code">{{ code }}</p>
      <button class="join-url" type="button" @click="copy">{{ copied ? 'Copied' : joinUrl }}</button>
    </div>
  </div>
</template>

<style scoped>
.join-overlay { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; background: rgb(0 0 0 / 0.55); padding: 16px; }
.join-sheet {
  position: relative; width: min(380px, 100%); text-align: center; padding: 28px 24px 24px;
  background: var(--t-stage2); color: var(--t-ink); border-radius: 20px; box-shadow: 0 24px 60px rgb(0 0 0 / 0.4);
}
.join-close { position: absolute; top: 8px; right: 10px; border: 0; background: none; color: inherit; font-size: 1.8rem; line-height: 1; cursor: pointer; opacity: 0.7; }
.join-eyebrow { margin: 0 0 14px; font-weight: 700; color: color-mix(in srgb, var(--t-ink) 65%, transparent); }
.join-qr { width: 240px; margin: 0 auto; border-radius: 12px; overflow: hidden; background: #fff; line-height: 0; }
.join-qr :deep(svg) { width: 100%; height: auto; display: block; }
.join-or { margin: 16px 0 2px; color: color-mix(in srgb, var(--t-ink) 60%, transparent); font-size: 0.9rem; }
.join-code { margin: 0; font-size: 2.2rem; font-weight: 800; letter-spacing: 0.22em; color: var(--t-accink); padding-left: 0.22em; }
.join-url { margin-top: 12px; border: 0; background: none; color: color-mix(in srgb, var(--t-ink) 60%, transparent); font: inherit; font-size: 0.8rem; cursor: pointer; word-break: break-all; }
.join-url:hover { color: var(--t-ink); }
</style>
