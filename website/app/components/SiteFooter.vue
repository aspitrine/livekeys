<template>
  <footer class="wrap site-footer">
    <div class="footer-top">
      <a href="#" aria-label="LiveKeys, retour à l’accueil"><BrandLogo /></a
      ><span>Votre clavier. Toutes vos scènes.</span>
      <nav aria-label="Navigation de pied de page">
        <a href="https://github.com/aspitrine/livekeys" target="_blank" rel="noopener noreferrer"
          >GitHub <UiIcon name="arrow-up" :size="12" /></a
        ><a href="https://github.com/aspitrine/livekeys/issues" target="_blank" rel="noopener noreferrer"
          >Partager une idée <UiIcon name="arrow-up" :size="12" /></a
        ><a href="#questions">Questions</a>
      </nav>
    </div>
    <div class="footer-bottom">
      <span>LiveKeys · Projet indépendant en développement.</span
      ><span>AUv3, iPad et les autres noms de produits appartiennent à leurs propriétaires respectifs.</span
      ><a href="#">Retour en haut ↑</a>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  padding-block: 43px 25px;
}
.footer-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 25px;
  padding-bottom: 36px;
}
.footer-top > span {
  font-size: 10px;
  color: var(--muted);
}
.footer-top nav {
  display: flex;
  gap: 25px;
  font-size: 10px;
  font-weight: 650;
}
.footer-top nav a {
  display: flex;
  align-items: center;
  gap: 5px;
}
.footer-bottom {
  padding-top: 21px;
  border-top: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  gap: 24px;
  font-size: 8px;
  line-height: 1.7;
  color: var(--muted);
}
@media (max-width: 720px) {
  .footer-top {
    flex-wrap: wrap;
    gap: 20px;
  }
  .footer-top > span {
    display: none;
  }
  .footer-bottom {
    flex-wrap: wrap;
    gap: 12px;
  }
  .footer-bottom > span:nth-child(2) {
    order: 3;
    width: 100%;
  }
}
</style>
