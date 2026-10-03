<template>
  <section id="setlists" class="setlist-section">
    <div class="wrap setlist-grid">
      <div class="setlist-copy" data-reveal>
        <p class="eyebrow">02 / Garder le fil du concert</p>
        <h2 class="section-title">Le prochain son.<br /><em>Au bon moment.</em></h2>
        <p class="body-copy">
          Du premier morceau au rappel, préparez vos patches dans des sets. Sur scène, une vue épurée garde l’essentiel
          sous les yeux. Passez au son suivant depuis l’écran ou votre contrôleur MIDI.
        </p>
        <div class="setlist-benefits">
          <span><UiIcon name="check" :size="15" /> Un concert → des sets → des patches</span
          ><span><UiIcon name="check" :size="15" /> Mode scène lisible à distance</span
          ><span><UiIcon name="check" :size="15" /> Passage au patch précédent ou suivant</span>
        </div>
        <a class="text-link" href="#possibilites">Découvrez les patches en images <UiIcon name="arrow" :size="17" /></a>
      </div>
      <div class="setlist-art" data-reveal>
        <div class="setlist-back-card back-one" data-parallax="-25" />
        <div class="setlist-back-card back-two" data-parallax="15" />
        <div class="stage-card">
          <AppScreenshot
            file="stage"
            alt="Mode scène de LiveKeys : Piano + Pad, Set 1, boutons précédent et suivant, Quitter et PANIC."
            caption="L’essentiel du concert, en mode scène."
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.setlist-section {
  background: #242822;
  color: var(--paper);
  padding: 115px 0;
  overflow: hidden;
}
.setlist-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 100px;
  align-items: center;
}
.setlist-copy .eyebrow {
  color: #b6bdb0;
  margin-bottom: 25px;
}
.setlist-copy .section-title em {
  color: #f09c73;
}
.setlist-copy .body-copy {
  color: #bdc2b7;
  margin-top: 25px;
  max-width: 410px;
  font-size: 14px;
}
.setlist-benefits {
  display: grid;
  gap: 13px;
  margin-top: 25px;
  font-size: 11px;
  color: #d3d7cc;
}
.setlist-benefits span {
  display: flex;
  gap: 10px;
  align-items: center;
}
.setlist-benefits svg {
  color: #f09c73;
}
.setlist-copy .text-link {
  margin-top: 24px;
  font-size: 10px;
  color: #f3c5ac;
}
.setlist-art {
  position: relative;
  padding-top: 30px;
  perspective: 1000px;
}
.setlist-back-card {
  position: absolute;
  top: 15px;
  left: 0;
  width: 100%;
  height: 80%;
  border: 1px solid #737c6880;
  border-radius: 14px;
  background: #343b30;
  transform: rotate(-7deg);
}
.back-two {
  transform: rotate(5deg);
  top: 9px;
  background: #434a3b;
  border-color: #888e6680;
}
.stage-card {
  position: relative;
  border-radius: 13px;
  background: #131710;
  padding: 8px 8px 18px;
  box-shadow: 0 25px 40px #0003;
  border: 1px solid #61694f;
}
.stage-card :deep(figcaption) {
  padding-inline: 8px;
  color: #d3d7cc;
}
@media (max-width: 1000px) {
  .setlist-grid {
    gap: 45px;
  }
}
@media (max-width: 720px) {
  .setlist-grid {
    grid-template-columns: 1fr;
    gap: 45px;
  }
  .setlist-section {
    padding-block: 75px;
  }
  .setlist-art {
    max-width: 500px;
    width: 100%;
  }
}
</style>
