<script setup lang="ts">
const page = useTemplateRef<HTMLElement>('page');
useSiteMotion(page);
</script>

<template>
  <div ref="page">
    <a class="skip-link" href="#contenu">Aller au contenu</a>
    <SiteHeader />
    <main id="contenu">
      <HeroSection />
      <LayerPlayground />
      <SetlistSection />
      <PluginSection />
      <FeaturesSection />
      <ComparisonSection />
      <FaqSection />
      <ProjectSection />
    </main>
    <SiteFooter />
  </div>
</template>
