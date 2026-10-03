<script setup lang="ts">
import { layerScreenshots } from '../data/screenshots';
</script>

<template>
  <section id="possibilites" class="section wrap">
    <div class="section-heading" data-reveal>
      <div>
        <p class="eyebrow">01 / Construire votre son</p>
        <h2 class="section-title">Une touche.<br /><em>Plusieurs univers.</em></h2>
      </div>
      <p class="body-copy">
        Superposez un piano et une nappe. Gardez une basse sous la main gauche. Faites entrer les cordes quand vous
        jouez plus fort. Chaque layer a sa place, son niveau et sa personnalité.
      </p>
    </div>
    <div class="playground" data-reveal>
      <p class="capture-label">DANS LIVEKEYS · PARCOURIR LES CAPTURES</p>
      <ScreenshotGallery :screenshots="layerScreenshots" label="Captures des patches" />
    </div>
    <div class="layer-details" data-reveal>
      <div>
        <UiIcon name="layers" />
        <h3>Superposez.</h3>
        <p>Plusieurs instruments dans un même patch, avec volume, panoramique et effets par layer.</p>
      </div>
      <div>
        <UiIcon name="keys" />
        <h3>Répartissez.</h3>
        <p>Zones de clavier, plages de vélocité, transposition et canal MIDI pour chaque son.</p>
      </div>
      <div>
        <UiIcon name="wave" />
        <h3>Faites respirer.</h3>
        <p>Un pad qui suit vos accords ou tient un accord fixe, avec fondu entre les harmonies.</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.playground {
  padding: 24px;
  background: #e9e7df;
  border: 1px solid var(--line);
  border-radius: 16px;
}
.capture-label {
  font-size: 9px;
  letter-spacing: 1px;
  margin-bottom: 20px;
  color: var(--muted);
}
.layer-details {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 55px;
  margin-top: 44px;
}
.layer-details svg {
  color: var(--accent);
  margin-bottom: 16px;
}
.layer-details h3 {
  font-size: 17px;
  margin-bottom: 10px;
  letter-spacing: -0.5px;
}
.layer-details p {
  font-size: 12px;
  line-height: 1.85;
  color: var(--muted);
}
@media (max-width: 850px) {
  .layer-details {
    gap: 25px;
  }
}
@media (max-width: 620px) {
  .playground {
    padding: 12px;
    border-radius: 10px;
  }
  .layer-details {
    grid-template-columns: 1fr;
    gap: 27px;
    margin-top: 30px;
  }
  .layer-details div {
    display: grid;
    grid-template-columns: 30px 1fr;
    gap: 6px 12px;
  }
  .layer-details svg {
    grid-row: span 2;
    margin-top: 3px;
  }
  .layer-details h3 {
    margin: 0;
  }
}
</style>
