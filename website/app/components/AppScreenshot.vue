<script setup lang="ts">
const props = defineProps<{ file: string; alt: string; caption: string; priority?: boolean }>();
const baseURL = useRuntimeConfig().app.baseURL;
const source = computed(() => `${baseURL}screenshots/${props.file}.png`);
</script>

<template>
  <figure class="app-screenshot">
    <a :href="source" target="_blank" rel="noopener" :aria-label="`Voir en grand : ${caption} (nouvel onglet)`">
      <img
        :src="source"
        :alt="alt"
        width="2752"
        height="2064"
        :loading="priority ? 'eager' : 'lazy'"
        :fetchpriority="priority ? 'high' : 'auto'"
        decoding="async"
      />
      <span class="enlarge"><UiIcon name="arrow-up" :size="15" /> Voir en grand</span>
    </a>
    <figcaption>{{ caption }} <span>Capture réelle · simulateur iPad</span></figcaption>
  </figure>
</template>

<style scoped>
.app-screenshot {
  margin: 0;
}
a {
  display: block;
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: #101114;
  box-shadow: 0 18px 38px #171b1920;
}
img {
  display: block;
  width: 100%;
  height: auto;
}
.enlarge {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 12px;
  border-radius: 6px;
  background: #f5f3ed;
  color: #252821;
  font-size: 10px;
  box-shadow: 0 2px 12px #0004;
}
figcaption {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
  font-size: 10px;
  line-height: 1.6;
}
figcaption span {
  opacity: 0.8;
}
@media (max-width: 620px) {
  .enlarge {
    bottom: 8px;
    right: 8px;
    font-size: 9px;
    padding: 6px 8px;
  }
}
</style>
