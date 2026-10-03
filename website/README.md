# LiveKeys · site de présentation

Site français indépendant de l’application Expo, avec Nuxt 4, Vue 3 et TypeScript.
Le HTML est prérendu : déployer `website/.output/public` sur un hébergement statique suffit.
Les fontes Manrope sont servies localement. Aucun compte, formulaire, tracker ou service externe n’est nécessaire.

## Développement et validation

Depuis ce dossier, avec Node.js 24 :

```bash
npm ci
npm run dev
```

Le serveur de développement écoute sur `http://127.0.0.1:3001`.

```bash
npm exec playwright install chromium
npm run format
npm run check
npm run preview
```

`check` vérifie le formatage, Oxlint, les types Vue/Nuxt, la génération statique et les tests Playwright sur le build
généré. Les tests couvrent les galeries de captures, les liens vers les PNG originaux, leurs dimensions, la navigation mobile,
absence de débordement horizontal, mouvement réduit, HTML sans JavaScript et accessibilité avec axe.
Les contrôles Expo à la racine restent indépendants de ce projet. Les tests du site ne valident pas le moteur audio mobile.
`preview` sert le build statique sur `http://127.0.0.1:4173`.

## Structure et mouvement

- `app/app.vue` compose les sections de la page.
- `app/components/` contient la navigation, les sections éditoriales et les galeries de captures.
- `app/data/screenshots.ts` décrit les véritables écrans de l’application.
- `app/composables/useSiteMotion.ts` charge GSAP et ScrollTrigger côté client, pour les apparitions, la parallaxe et
  l’inclinaison 3D de la capture. Les listeners et animations sont nettoyés au démontage.
- `app/data/comparison.ts` centralise le comparatif et les liens vers les documentations officielles.

Les images sont des captures PNG originales de LiveKeys, prises sur le simulateur iPad Pro 13 pouces (M5), iOS 27,
le 3 octobre 2026 (2752 × 2064 pixels affichés en paysage, orientation EXIF conservée). Elles montrent les patches par défaut Piano + Pad et Basse / EP,
le mode scène, le navigateur d’effets et les paramètres Apple AUReverb2. Aucun plugin AUv3 tiers n’est installé sur
ce simulateur : les légendes distinguent clairement ces effets Apple des plugins tiers.
Les galeries permettent de choisir une capture et d’ouvrir le PNG en grand. Elles ne simulent pas le moteur audio.
Les effets de profondeur au survol et la parallaxe sont réservés aux écrans larges avec pointeur précis.
`prefers-reduced-motion` désactive le mouvement. Le contenu reste visible sans JavaScript.

### Actualiser les captures

Démarrer Metro et utiliser un build LiveKeys actuel sur un simulateur **dédié** (le helper remet ses données à zéro).
Depuis la racine du dépôt, après avoir vérifié l’UDID dans `xcrun simctl list devices booted` :

```bash
JAVA_HOME="$PWD/.tools/java/Contents/Home" \
MAESTRO_APP_URL='livekeys://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081' \
.tools/maestro/bin/maestro --device <UDID_DU_SIMULATEUR> test \
  --test-output-dir /private/tmp/livekeys-site-captures website/scripts/capture-app.yaml
```

Copier les cinq PNG du sous-dossier `capture-app/takeScreenshot/` créé dans le dossier horodaté vers `website/public/screenshots/` et vérifier chaque image.
Ne jamais lancer ce scénario sur un iPad physique. Mettre à jour les dimensions des images/tests si le simulateur change.

## Contenu et publication

La page présente les fonctions implémentées dans le dépôt : layers, splits clavier/vélocité, sets/patches, instruments
et effets AUv3, banques SoundFont, pads d’accords, MIDI Learn, Bluetooth MIDI et réglages audio.
Elle indique que le projet est en développement et ne contient pas de faux lien App Store, prix ou promesse de compatibilité universelle.

Comparatif vérifié le 3 octobre 2026 :

- [AUM · documentation officielle](https://kymatica.com/apps/aum)
- [Camelot · fonctions et plateformes](https://audiomodeling.com/products/camelot)
- [MainStage · guide Apple](https://support.apple.com/guide/mainstage/welcome/mac)

Mettre à jour la date et les données après une évolution de ces outils. L’absence de fonctions avancées dans LiveKeys
(enregistrement, backing tracks, timeline) est explicitée. Ne pas publier de chiffres de latence ou de nombre de layers
sans mesure sur un appareil réel.

Pour publier, lancer `npm run generate` et envoyer le contenu de `.output/public` sur l’hébergement choisi.
Aucun serveur Nuxt n’est nécessaire. Le site utilise actuellement la racine `/` ; pour un sous-dossier (par exemple
GitHub Pages sous `/livekeys/`), générer avec `NUXT_APP_BASE_URL=/livekeys/`.
Le favicon est local ; Nuxt résout les assets en fonction de la base configurée.

## État de l’outillage

Au 3 octobre 2026, `npm audit` signale 11 alertes hautes dans l’arbre de build Nuxt, provenant de deux dépendances
transitives : `braces` 3.0.3 et `node-forge` 1.4.0. Ce sont les dernières versions publiées au moment de la création ;
aucune version corrigée n’est disponible sur cette ligne. Ne pas appliquer `npm audit fix --force`, qui propose
de rétrograder Nuxt vers une ancienne version majeure. Ces paquets ne sont pas livrés dans `.output/public`.
Le serveur de développement et l’aperçu restent sur l’interface locale. Revérifier ces alertes lors des mises à jour.
