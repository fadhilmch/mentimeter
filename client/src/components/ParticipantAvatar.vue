<script setup lang="ts">
import { computed } from 'vue';
import { avatarFor } from '../avatar';

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 32 });
const spec = computed(() => avatarFor(props.name));
</script>

<template>
  <svg
    class="participant-avatar"
    :width="props.size"
    :height="props.size"
    viewBox="0 0 48 48"
    role="img"
    :aria-label="`Avatar for ${props.name}`"
  >
    <defs>
      <linearGradient :id="spec.gradId" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" :stop-color="spec.from" />
        <stop offset="1" :stop-color="spec.to" />
      </linearGradient>
    </defs>
    <rect width="48" height="48" rx="14" :fill="`url(#${spec.gradId})`" />
    <text
      x="24"
      y="30"
      text-anchor="middle"
      font-size="17"
      font-weight="700"
      fill="#ffffff"
      font-family="inherit"
    >
      {{ spec.initials }}
    </text>
  </svg>
</template>

<style scoped>
.participant-avatar {
  flex: none;
  border-radius: 30%;
  box-shadow: 0 1px 3px rgba(17, 16, 44, 0.25);
}
</style>
