<script setup lang="ts">
import { effectScreenshots } from '../data/screenshots';
</script>

<template>
  <section id="plugins" class="section wrap plugin-grid">
    <div class="plugin-art" data-reveal>
      <ScreenshotGallery :screenshots="effectScreenshots" label="Captures des effets" />
      <p class="plugin-note">
        Captures des effets Apple disponibles sur ce simulateur. Les plugins AUv3 tiers apparaissent lorsqu’ils sont
        installés sur votre iPad.
      </p>
    </div>
    <div class="plugin-copy" data-reveal>
      <p class="eyebrow">03 / Ouvrir le champ des possibles</p>
      <h2 class="section-title">Vos plugins.<br /><em>Votre signature.</em></h2>
      <p class="body-copy">
        Le son que vous aimez existe déjà sur votre iPad. Faites-lui une place dans votre setup : LiveKeys accueille vos
        instruments AUv3 et leurs effets, directement dans les layers.
      </p>
      <div class="plugin-points">
        <div>
          <span>01</span>
          <p>
            <strong>Instruments & effets</strong>Une banque SoundFont ou un instrument AUv3. Puis une chaîne d’effets
            pour façonner chaque layer.
          </p>
        </div>
        <div>
          <span>02</span>
          <p>
            <strong>Vos réglages, retrouvés</strong>Éditeur du plugin, presets et réglages enregistrés dans le patch.
          </p>
        </div>
        <div>
          <span>03</span>
          <p>
            <strong>Un écosystème ouvert</strong>Choisissez des plugins AUv3 compatibles installés sur votre iPad. Votre
            palette évolue avec vous.
          </p>
        </div>
      </div>
      <span class="plugin-chip"><UiIcon name="plug" :size="14" /> AUv3 · Audio Unit Extensions</span>
    </div>
  </section>
</template>

<style scoped>
.plugin-grid {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 90px;
  align-items: center;
}
.plugin-copy .eyebrow {
  margin-bottom: 25px;
}
.plugin-copy .body-copy {
  margin-top: 25px;
  font-size: 14px;
}
.plugin-art {
  min-width: 0;
  padding: 22px;
  border-radius: 15px;
  background: #e9e6de;
}
.plugin-note {
  margin-top: 18px;
  font-size: 10px;
  line-height: 1.8;
  color: var(--muted);
}
.plugin-points {
  margin-top: 28px;
  display: grid;
  gap: 22px;
}
.plugin-points > div {
  display: flex;
  gap: 17px;
}
.plugin-points > div > span {
  color: var(--accent);
  font-size: 9px;
  padding-top: 2px;
}
.plugin-points p {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.8;
}
.plugin-points strong {
  display: block;
  color: var(--ink);
  font-size: 12px;
  margin-bottom: 4px;
}
.plugin-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 13px;
  border: 1px solid var(--line);
  border-radius: 30px;
  font-size: 9px;
  margin-top: 28px;
}
@media (max-width: 1000px) {
  .plugin-grid {
    gap: 40px;
  }
}
@media (max-width: 720px) {
  .plugin-grid {
    grid-template-columns: 1fr;
    gap: 40px;
  }
  .plugin-copy {
    order: -1;
  }
  .plugin-art {
    padding: 15px;
  }
}
</style>
