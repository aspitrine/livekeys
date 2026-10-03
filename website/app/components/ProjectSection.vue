<template>
  <section id="projet" class="project-section">
    <div class="wrap project-inner" data-reveal>
      <span class="eyebrow">La suite s’écrit ensemble</span>
      <h2>Votre prochain setup<br />commence par <span>une idée.</span></h2>
      <p>
        LiveKeys est une application iPad en développement.<br />Le dépôt contient le code et les instructions de build.
      </p>
      <a href="https://github.com/aspitrine/livekeys" target="_blank" rel="noopener noreferrer" class="button"
        >Découvrir le projet sur GitHub <UiIcon name="arrow-up" :size="18" /></a
      ><span class="project-mark" aria-hidden="true">✳</span>
    </div>
  </section>
</template>

<style scoped>
.project-section {
  background: #e8a581;
  padding: 90px 0;
  overflow: hidden;
}
.project-inner {
  position: relative;
}
.project-inner .eyebrow {
  font-size: 9px;
  margin-bottom: 28px;
}
.project-inner .eyebrow::before {
  background: var(--ink);
}
.project-inner h2 {
  position: relative;
  z-index: 1;
  font-size: clamp(38px, 5vw, 70px);
  font-weight: 550;
  letter-spacing: -0.065em;
  line-height: 1.12;
}
.project-inner h2 span {
  color: #7b2d19;
}
.project-inner p {
  margin-top: 24px;
  font-size: 12px;
  line-height: 1.8;
  color: #5a3424;
}
.project-inner .button {
  background: var(--ink);
  margin-top: 28px;
  position: relative;
  z-index: 1;
}
.project-inner .button:hover {
  background: #111a11;
}
.project-mark {
  position: absolute;
  font-size: 420px;
  right: -20px;
  top: -48px;
  font-family: sans-serif;
  font-weight: 100;
  line-height: 1;
  color: #8b3e2024;
  transform: rotate(12deg);
}
@media (max-width: 720px) {
  .project-section {
    padding-block: 65px;
  }
  .project-mark {
    right: -70px;
    top: 45px;
    font-size: 270px;
  }
  .project-inner p {
    position: relative;
    z-index: 1;
  }
}
</style>
