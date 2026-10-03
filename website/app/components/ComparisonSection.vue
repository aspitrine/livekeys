<script setup lang="ts">
import { comparison } from '../data/comparison';
</script>

<template>
  <section id="comparaison" class="section wrap">
    <div class="section-heading" data-reveal>
      <div>
        <p class="eyebrow">Choisir votre façon de jouer</p>
        <h2 class="section-title">La même scène.<br /><em>D’autres approches.</em></h2>
      </div>
      <p class="body-copy">
        Layers, plugins, contrôles MIDI : LiveKeys partage les fondamentaux des setups live. Sa direction : réunir les
        sons, les setlists et les pads autour du clavier, sur iPad.
      </p>
    </div>
    <div
      class="comparison-scroll"
      tabindex="0"
      role="region"
      aria-label="Comparaison avec AUM, Camelot et MainStage, tableau défilant"
      data-reveal
    >
      <table class="comparison-table">
        <caption class="sr-only">
          Positionnement de LiveKeys et de trois solutions de musique live
        </caption>
        <thead>
          <tr>
            <th scope="col">
              <span class="table-label">À CHAQUE SETUP<br />SON OUTIL.</span>
            </th>
            <th
              v-for="(product, i) in comparison.products"
              :key="product"
              scope="col"
              :class="{ highlighted: i === 0 }"
            >
              <span class="product-name">{{ product }}<span v-if="i === 0" class="product-dot">.</span></span
              ><span class="product-subtitle">{{
                ['En développement', 'Kymatica', 'Audio Modeling', 'Apple'][i]
              }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in comparison.rows" :key="row.label">
            <th scope="row">{{ row.label }}</th>
            <td v-for="(value, i) in row.values" :key="value" :class="{ highlighted: i === 0 }">{{ value }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="scroll-hint">Faites glisser le tableau pour comparer les solutions →</p>
    <div class="comparison-footnotes">
      <p>
        Chaque outil a sa spécialité. LiveKeys ne propose actuellement ni enregistrement audio, ni backing tracks, ni
        timeline. Les fonctions avancées de routage ou de pilotage de synthés matériels restent le terrain d’AUM et de
        Camelot.
      </p>
      <p>
        Sources officielles · vérifiées le 3 octobre 2026 :
        <a
          v-for="source in comparison.sources"
          :key="source.label"
          :href="source.href"
          target="_blank"
          rel="noopener noreferrer"
          >{{ source.label }} <UiIcon name="arrow-up" :size="10" /></a
        >. Comparaison des approches, sans classement de performance.
      </p>
    </div>
  </section>
</template>

<style scoped>
.comparison-scroll {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 12px;
}
.comparison-table {
  border-collapse: collapse;
  width: 100%;
  min-width: 870px;
  table-layout: fixed;
  text-align: left;
}
.comparison-table th,
.comparison-table td {
  padding: 25px 21px;
  vertical-align: top;
  border-bottom: 1px solid var(--line);
}
.comparison-table th:first-child {
  width: 21%;
}
.comparison-table thead th {
  padding-block: 30px;
  font-weight: 600;
}
.table-label {
  font-size: 8px;
  letter-spacing: 1.3px;
  line-height: 1.8;
  color: var(--muted);
}
.product-name {
  font-size: 20px;
  letter-spacing: -0.8px;
  display: block;
}
.product-dot {
  color: var(--accent);
}
.product-subtitle {
  font-size: 8px;
  color: var(--muted);
  display: block;
  margin-top: 8px;
}
.comparison-table tbody th {
  font-size: 10px;
  font-weight: 650;
}
.comparison-table td {
  font-size: 10px;
  line-height: 1.8;
  color: var(--muted);
}
.comparison-table .highlighted {
  background: #e8eadd;
  color: #36422d;
}
.comparison-table tbody .highlighted {
  font-weight: 650;
}
.comparison-table tbody tr:last-child > * {
  border-bottom: 0;
}
.comparison-footnotes {
  margin-top: 22px;
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 65px;
  font-size: 9px;
  line-height: 1.8;
  color: var(--muted);
}
.comparison-footnotes a {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  text-decoration: underline;
  text-underline-offset: 3px;
  margin-left: 5px;
}
.scroll-hint {
  display: none;
  font-size: 9px;
  color: var(--muted);
  margin-top: 12px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
@media (max-width: 900px) {
  .scroll-hint {
    display: block;
  }
  .comparison-footnotes {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>
