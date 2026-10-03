<script setup lang="ts">
type Name =
  | 'arrow'
  | 'arrow-up'
  | 'layers'
  | 'keys'
  | 'plug'
  | 'list'
  | 'midi'
  | 'check'
  | 'plus'
  | 'wave'
  | 'chevron'
  | 'code'
  | 'shield';
defineProps<{ name: Name; size?: number }>();
const paths: Record<Name, string> = {
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  'arrow-up': 'M6 18 18 6M6 6h12v12',
  layers: 'm12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5',
  keys: 'M3 4h18v16H3V4Zm6 0v16m6-16v16M6 4v8m6-8v8m6-8v8',
  plug: 'M8 2v6m8-6v6M6 8h12v4a6 6 0 0 1-6 6v4m0-4a6 6 0 0 1-6-6V8Z',
  list: 'M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1',
  midi: 'M5 6h14v14H5V6ZM8 3h8M9 10v6m3-6v6m3-6v6',
  check: 'm5 12 4 4L19 6',
  plus: 'M12 5v14M5 12h14',
  wave: 'M3 10v4m4-8v12m5-15v18m5-15v12m4-8v4',
  chevron: 'm9 5 7 7-7 7',
  code: 'm8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18',
  shield: 'm12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Zm-4 10 3 3 5-6',
};
</script>

<template>
  <svg
    :width="size ?? 20"
    :height="size ?? 20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name]" />
  </svg>
</template>
