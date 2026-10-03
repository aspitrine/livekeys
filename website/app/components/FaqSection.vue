<script setup lang="ts">
const questions = [
  {
    question: 'Est-ce que LiveKeys est déjà disponible sur l’App Store ?',
    answer:
      'LiveKeys est un projet en développement. Le dépôt GitHub permet de suivre son évolution et contient les instructions de build. Cette page présente les fonctions implémentées, sans annoncer de date de sortie ni de tarif.',
  },
  {
    question: 'Ai-je besoin de plugins pour commencer ?',
    answer:
      'Non. Le piano droit et la banque GeneralUser GS sont intégrés. Vous pouvez ensuite télécharger les banques proposées dans la bibliothèque et ajouter des instruments ou effets AUv3 compatibles, installés séparément sur votre iPad.',
  },
  {
    question: 'Puis-je utiliser mon clavier MIDI et mes pédales ?',
    answer:
      'Oui, via une connexion MIDI USB adaptée à votre iPad ou en Bluetooth MIDI. MIDI Learn permet d’affecter les volumes, le passage entre les patches, les pads et Panic à des contrôles matériels. Les connexions Bluetooth mémorisées peuvent être rétablies automatiquement.',
  },
  {
    question: 'Tous mes plugins AUv3 fonctionneront-ils ?',
    answer:
      'LiveKeys héberge les instruments et effets Audio Units compatibles. Les plugins doivent être installés sur l’iPad. Cette page montre les effets Apple présents sur le simulateur.',
  },
];
</script>

<template>
  <section id="questions" class="faq-section wrap rule">
    <div class="faq-heading" data-reveal>
      <p class="eyebrow">Avant la première note</p>
      <h2 class="section-title">Quelques <em class="faq-title-accent">repères.</em></h2>
    </div>
    <div class="faq-list">
      <details v-for="item in questions" :key="item.question" class="faq-item">
        <summary>{{ item.question }}<UiIcon name="plus" :size="18" /></summary>
        <p>{{ item.answer }}</p>
      </details>
    </div>
  </section>
</template>

<style scoped>
.faq-section {
  display: grid;
  grid-template-columns: 0.75fr 1.3fr;
  gap: 90px;
  padding-block: 80px 110px;
}
.faq-heading .eyebrow {
  margin-bottom: 25px;
}
.faq-title-accent {
  display: block;
}
.faq-item {
  border-bottom: 1px solid var(--line);
}
.faq-item summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding: 24px 0;
  cursor: pointer;
  font-size: 12px;
  font-weight: 650;
  list-style: none;
}
.faq-item summary::-webkit-details-marker {
  display: none;
}
.faq-item summary svg {
  color: var(--muted);
  transition: transform 0.2s;
}
.faq-item[open] summary svg {
  transform: rotate(45deg);
  color: var(--accent);
}
.faq-item p {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.9;
  padding: 0 25px 24px 0;
}
@media (max-width: 720px) {
  .faq-section {
    grid-template-columns: 1fr;
    gap: 30px;
    padding-block: 60px 75px;
  }
  .faq-title-accent {
    display: inline;
  }
}
</style>
