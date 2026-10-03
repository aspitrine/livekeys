<script setup lang="ts">
const open = shallowRef(false);
const links = [
  { href: '#possibilites', label: 'Possibilités' },
  { href: '#plugins', label: 'Plugins AUv3' },
  { href: '#comparaison', label: 'Comparatif' },
];
</script>

<template>
  <header class="site-header wrap">
    <a href="#" aria-label="LiveKeys, accueil"><BrandLogo /></a>
    <nav class="desktop-nav" aria-label="Navigation principale">
      <a v-for="link in links" :key="link.href" :href="link.href">{{ link.label }}</a>
    </nav>
    <a class="header-cta" href="https://github.com/aspitrine/livekeys" target="_blank" rel="noopener noreferrer"
      >Le projet <UiIcon name="arrow-up" :size="16"
    /></a>
    <button class="menu-toggle" aria-controls="mobile-nav" :aria-expanded="open" @click="open = !open">
      {{ open ? 'Fermer' : 'Menu' }} <UiIcon name="plus" :class="{ rotated: open }" />
    </button>
    <nav v-if="open" id="mobile-nav" class="mobile-nav" aria-label="Navigation mobile">
      <a v-for="link in links" :key="link.href" :href="link.href" @click="open = false"
        >{{ link.label }} <UiIcon name="arrow"
      /></a>
    </nav>
  </header>
</template>

<style scoped>
.site-header {
  position: relative;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 30px;
  z-index: 10;
}
.desktop-nav {
  display: flex;
  gap: 34px;
  font-size: 13px;
  font-weight: 650;
}
.desktop-nav a:hover {
  color: var(--accent);
}
.header-cta {
  display: flex;
  align-items: center;
  gap: 22px;
  background: var(--ink);
  color: white;
  padding: 13px 20px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 650;
}
.menu-toggle {
  display: none;
}
.mobile-nav {
  position: absolute;
  top: 78px;
  left: 0;
  right: 0;
  padding: 18px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: 0 15px 25px #24242112;
}
.mobile-nav a {
  display: flex;
  justify-content: space-between;
  padding: 15px 8px;
}
@media (max-width: 720px) {
  .site-header {
    height: 80px;
  }
  .desktop-nav,
  .header-cta {
    display: none;
  }
  .menu-toggle {
    display: flex;
    min-height: 44px;
    align-items: center;
    gap: 12px;
    font-size: 13px;
  }
  .rotated {
    transform: rotate(45deg);
  }
}
</style>
