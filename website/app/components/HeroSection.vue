<script setup lang="ts">
const baseURL = useRuntimeConfig().app.baseURL;
</script>

<template>
  <section class="hero">
    <div class="hero-grid wrap">
      <div class="hero-copy">
        <p class="eyebrow hero-intro">Le setup des claviéristes · sur iPad</p>
        <h1 class="hero-title">
          Votre clavier.<br />Toutes vos<br /><span>scènes.</span
          ><svg class="title-spark" viewBox="0 0 80 80" fill="none" aria-hidden="true">
            <path d="M40 2v76M2 40h76M13 13l54 54M13 67l54-54" stroke="currentColor" stroke-width="4" />
          </svg>
        </h1>
        <p class="hero-description">
          Un piano, des nappes, vos plugins préférés.<br />Tout votre univers live, au bout des doigts.
        </p>
        <div class="hero-actions">
          <a class="button" href="#possibilites">Explorer LiveKeys <UiIcon name="arrow" :size="18" /></a
          ><a class="text-link" href="#comparaison">Trouver sa place <UiIcon name="arrow-up" :size="16" /></a>
        </div>
        <p class="development"><span /> Application iPad · en développement</p>
      </div>
      <div class="hero-scene" aria-hidden="true">
        <div class="scene-orbit orbit-one" />
        <div class="scene-orbit orbit-two" />
        <div class="orange-disc" data-parallax="-40">
          <span>PLAY<br />YOUR<br />WAY.</span>
        </div>
        <div class="device-float" data-parallax="45">
          <div class="device" data-tilt>
            <span class="device-camera" /><img
              :src="`${baseURL}screenshots/layers.png`"
              alt=""
              width="2752"
              height="2064"
              fetchpriority="high"
              decoding="async"
            />
          </div>
        </div>
        <div class="scene-tag tag-midi" data-parallax="-20">
          <span class="tag-icon"><UiIcon name="midi" :size="17" /></span>
          <div><strong>LiveKeys, sur iPad.</strong><span>Capture réelle de l’application.</span></div>
          <span class="connection-light" />
        </div>
        <div class="scene-tag tag-layer" data-parallax="30">
          <UiIcon name="layers" :size="17" /><span>Un patch. Plusieurs dimensions.</span>
        </div>
        <span class="scene-coordinate" hidden>48.000 Hz / UNE INFINITÉ D’IDÉES</span>
      </div>
    </div>
    <div class="hero-bottom wrap">
      <span>De la première note au dernier rappel.</span><a href="#possibilites">Faites défiler <span>↓</span></a>
    </div>
    <div class="feature-ribbon">
      <div class="wrap ribbon-inner">
        <span><UiIcon name="layers" /> Layers & splits</span><i /><span><UiIcon name="list" /> Setlists & patches</span
        ><i /><span><UiIcon name="plug" /> Instruments & effets AUv3</span><i /><span
          ><UiIcon name="midi" /> Contrôle MIDI</span
        >
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  overflow: hidden;
}
.hero-grid {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1.12fr;
  align-items: center;
  min-height: 660px;
  padding-top: 32px;
  padding-bottom: 42px;
}
.hero-copy {
  position: relative;
  z-index: 2;
}
.hero-intro {
  margin-bottom: 32px;
}
.hero-title {
  font-size: clamp(60px, 6.9vw, 100px);
  line-height: 1.035;
  letter-spacing: -0.078em;
  font-weight: 600;
  position: relative;
}
.hero-title span {
  color: var(--accent);
}
.title-spark {
  width: 54px;
  height: 54px;
  color: var(--accent);
  margin-left: 17px;
  margin-bottom: 16px;
}
.hero-description {
  color: var(--muted);
  margin-top: 28px;
  font-size: 15px;
  line-height: 1.85;
}
.hero-actions {
  display: flex;
  gap: 27px;
  align-items: center;
  margin-top: 29px;
}
.development {
  font-size: 10px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 20px;
}
.development > span {
  width: 4px;
  height: 4px;
  background: #697c57;
  border-radius: 50%;
}
.hero-scene {
  position: relative;
  height: 590px;
  perspective: 1300px;
  margin-right: -100px;
}
.orange-disc {
  position: absolute;
  top: 36px;
  left: 110px;
  width: 435px;
  height: 435px;
  border-radius: 50%;
  background: linear-gradient(145deg, #f79663 0%, #f2724f 33%, #ea5a32 68%, #a7492a 100%);
  box-shadow: inset -15px -20px 40px #8c2f251c;
}
.orange-disc::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' opacity='.13' filter='url(%23n)'/%3E%3C/svg%3E");
  mix-blend-mode: multiply;
}
.orange-disc span {
  position: absolute;
  top: 35px;
  right: 85px;
  font-size: 11px;
  font-weight: 750;
  line-height: 1.5;
  letter-spacing: 2px;
  color: #762b19;
  transform: rotate(16deg);
}
.scene-orbit {
  position: absolute;
  width: 670px;
  height: 670px;
  border: 1px solid #25282112;
  border-radius: 50%;
  left: 30px;
  top: -77px;
}
.orbit-two {
  width: 530px;
  height: 530px;
  left: 100px;
  top: -7px;
}
.device-float {
  position: absolute;
  top: 110px;
  left: -30px;
  width: 640px;
}
.device {
  position: relative;
  transform: perspective(1400px) rotateX(10deg) rotateY(-15deg) rotateZ(-8deg);
  background: linear-gradient(120deg, #414443, #111514);
  padding: 16px;
  border-radius: 25px;
  box-shadow:
    -2px 3px 0 #606660,
    -5px 7px 0 #282d27,
    0 35px 50px #28251b35;
  will-change: transform;
}
.device img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 10px;
}
.device-camera {
  position: absolute;
  left: 6px;
  top: 50%;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #313b3c;
}
.scene-tag {
  position: absolute;
  z-index: 3;
  background: #faf9f4f5;
  backdrop-filter: blur(10px);
  border: 1px solid #fff;
  border-radius: 9px;
  box-shadow: 0 10px 30px #25282110;
  display: flex;
  align-items: center;
}
.tag-midi {
  left: 32px;
  top: 95px;
  gap: 12px;
  padding: 14px 18px;
  transform: rotate(-4deg);
}
.tag-midi strong {
  display: block;
  font-size: 10px;
}
.tag-midi div span {
  display: block;
  color: var(--muted);
  font-size: 8px;
  margin-top: 4px;
}
.tag-icon {
  background: #eeeae0;
  width: 33px;
  height: 33px;
  border-radius: 7px;
  display: grid;
  place-items: center;
}
.connection-light {
  width: 5px;
  height: 5px;
  margin-left: 10px;
  background: #739855;
  border-radius: 50%;
}
.tag-layer {
  bottom: 25px;
  right: 130px;
  gap: 12px;
  padding: 16px 19px;
  transform: rotate(5deg);
  font-size: 10px;
}
.tag-layer svg {
  color: var(--accent);
}
.scene-coordinate {
  position: absolute;
  bottom: 25px;
  left: 4px;
  font-size: 7px;
  letter-spacing: 1.5px;
  color: var(--muted);
}
.hero-bottom {
  padding-top: 75px;
  display: flex;
  justify-content: space-between;
  padding-bottom: 32px;
  color: var(--muted);
  font-size: 10px;
}
.hero-bottom a {
  display: flex;
  gap: 32px;
}
.hero-bottom a span {
  color: var(--ink);
  font-size: 17px;
}
.feature-ribbon {
  border-block: 1px solid var(--line);
}
.ribbon-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  padding-block: 29px;
}
.ribbon-inner span {
  display: flex;
  align-items: center;
  gap: 11px;
  font-size: 11px;
  font-weight: 600;
}
.ribbon-inner svg {
  width: 17px;
  color: var(--muted);
}
.ribbon-inner i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #25282140;
}
@media (min-width: 1500px) {
  .hero-scene {
    margin-right: 0;
  }
}
@media (max-width: 1100px) {
  .hero-grid {
    grid-template-columns: 1fr 1fr;
    min-height: 620px;
  }
  .hero-scene {
    transform: scale(0.82);
    transform-origin: left center;
    margin-right: -170px;
  }
  .hero-actions {
    gap: 16px;
    flex-wrap: wrap;
  }
  .hero-title {
    font-size: 75px;
  }
  .hero-description {
    font-size: 14px;
  }
}
@media (max-width: 760px) {
  .hero-grid {
    grid-template-columns: 1fr;
    padding-top: 36px;
    padding-bottom: 12px;
  }
  .hero-title {
    font-size: clamp(65px, 12vw, 88px);
  }
  .hero-scene {
    height: 470px;
    width: 680px;
    transform: scale(0.82);
    margin-top: 10px;
    margin-bottom: -65px;
    transform-origin: left top;
    margin-right: 0;
  }
  .hero-copy {
    max-width: 570px;
  }
  .ribbon-inner {
    flex-wrap: wrap;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 25px 15px;
  }
  .ribbon-inner i {
    display: none;
  }
  .hero-bottom {
    padding-top: 0;
    font-size: 9px;
  }
}
@media (max-width: 480px) {
  .hero-title {
    font-size: 61px;
  }
  .title-spark {
    width: 35px;
    height: 35px;
    margin-left: 14px;
    margin-bottom: 10px;
  }
  .hero-intro {
    font-size: 8px;
    margin-bottom: 26px;
  }
  .hero-scene {
    width: 680px;
    transform: scale(0.55);
    height: 530px;
    margin-bottom: -180px;
    margin-left: -10px;
  }
  .device-float {
    left: 0;
    top: 140px;
    width: 610px;
  }
  .tag-layer {
    right: 95px;
    bottom: 0;
  }
  .scene-coordinate {
    display: none;
  }
  .hero-actions {
    gap: 10px;
  }
  .hero-description {
    font-size: 13px;
  }
  .hero-actions .text-link {
    font-size: 11px;
  }
  .ribbon-inner span {
    font-size: 9px;
    gap: 8px;
  }
  .hero-bottom {
    margin-top: 30px;
  }
  .hero-bottom > span {
    max-width: 170px;
  }
}
</style>
