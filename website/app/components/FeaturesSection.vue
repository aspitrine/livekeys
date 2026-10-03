<script setup lang="ts">
const features = [
  {
    icon: 'midi' as const,
    title: 'Gardez les mains sur le clavier.',
    text: 'MIDI Learn pour le master, les volumes des layers, les patches et les pads. Clavier USB ou Bluetooth MIDI, avec reconnexion des appareils mémorisés.',
    tag: 'CONTRÔLE MIDI',
  },
  {
    icon: 'wave' as const,
    title: 'Laissez les accords s’installer.',
    text: 'Une nappe suit les accords que vous jouez ou tient un accord fixe. Réglez son registre et le fondu entre les harmonies.',
    tag: 'PADS HARMONIQUES',
  },
  {
    icon: 'keys' as const,
    title: 'Une palette, dès le départ.',
    text: 'Piano droit et banque GeneralUser GS intégrés. Pianos et Rhodes supplémentaires à télécharger, rangés par familles d’instruments.',
    tag: 'BANQUES SOUNDFONT',
  },
  {
    icon: 'shield' as const,
    title: 'Un setup qui se prépare.',
    text: 'Préchargement des patches voisins, limiteur, réverbe commune et suivi de la charge audio. Le bouton Panic coupe les notes quand vous en avez besoin.',
    tag: 'OUTILS POUR LE LIVE',
  },
];
</script>

<template>
  <section class="features-section section">
    <div class="wrap">
      <div class="features-heading" data-reveal>
        <p class="eyebrow">Les détails qui font le setup</p>
        <h2 class="section-title">Moins de réglages sur scène.<br /><em>Plus de place pour jouer.</em></h2>
      </div>
      <div class="feature-grid">
        <article v-for="feature in features" :key="feature.tag" class="feature-card" data-reveal>
          <div class="feature-top">
            <UiIcon :name="feature.icon" :size="24" /><span>{{ feature.tag }}</span>
          </div>
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.text }}</p>
        </article>
      </div>
      <div class="feature-bottom">
        <span>Répétition. Concert. Session à la maison.</span><span>Votre setup vous suit.</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.features-section {
  background: #eeece4;
  border-block: 1px solid var(--line);
}
.features-heading {
  margin-bottom: 48px;
}
.features-heading .eyebrow {
  margin-bottom: 25px;
}
.feature-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  border-top: 1px solid var(--line);
}
.feature-card {
  padding: 35px 55px 35px 0;
  border-bottom: 1px solid var(--line);
}
.feature-card:nth-child(even) {
  padding-left: 55px;
  border-left: 1px solid var(--line);
}
.feature-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 30px;
}
.feature-top svg {
  color: var(--accent);
}
.feature-top span {
  font-size: 8px;
  font-weight: 650;
  letter-spacing: 1px;
  color: var(--muted);
}
.feature-card h3 {
  font-size: 23px;
  letter-spacing: -0.8px;
  margin-bottom: 13px;
  max-width: 350px;
}
.feature-card p {
  font-size: 12px;
  line-height: 1.9;
  color: var(--muted);
  max-width: 400px;
}
.feature-bottom {
  display: flex;
  justify-content: space-between;
  margin-top: 26px;
  font-size: 10px;
  color: var(--muted);
}
@media (max-width: 720px) {
  .feature-card {
    padding-right: 24px;
  }
  .feature-card:nth-child(even) {
    padding-left: 24px;
  }
  .feature-card h3 {
    font-size: 20px;
  }
  .feature-top {
    flex-wrap: wrap;
    gap: 15px;
  }
  .feature-top span {
    font-size: 7px;
  }
}
@media (max-width: 480px) {
  .feature-grid {
    grid-template-columns: 1fr;
  }
  .feature-card,
  .feature-card:nth-child(even) {
    padding: 28px 0;
    border-left: 0;
  }
  .feature-top {
    margin-bottom: 19px;
  }
  .feature-bottom {
    gap: 15px;
    font-size: 8px;
  }
}
</style>
