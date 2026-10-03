<script setup lang="ts">
export type Screenshot = { file: string; label: string; alt: string; caption: string };
const props = defineProps<{ screenshots: readonly [Screenshot, ...Screenshot[]]; label: string }>();
const active = shallowRef(0);
const current = computed(() => props.screenshots[active.value] ?? props.screenshots[0]);
</script>

<template>
  <div class="screenshot-gallery">
    <div v-if="screenshots.length > 1" class="capture-tabs" role="group" :aria-label="label">
      <button
        v-for="(capture, index) in screenshots"
        :key="capture.file"
        :aria-pressed="active === index"
        :aria-label="`Afficher la capture : ${capture.label}`"
        @click="active = index"
      >
        {{ capture.label }}
      </button>
    </div>
    <AppScreenshot :file="current.file" :alt="current.alt" :caption="current.caption" />
  </div>
</template>

<style scoped>
.capture-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}
button {
  padding: 11px 16px;
  border: 1px solid currentColor;
  border-radius: 30px;
  font-size: 11px;
}
button[aria-pressed='true'] {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
</style>
