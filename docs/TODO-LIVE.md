# LiveKeys — améliorations pour la scène

Suivi commencé le 3 octobre 2026. Les cases sont cochées après implémentation et validation ; les limites de validation restent indiquées.

## Avancement

- [x] 1. Réorganiser les setlists — **terminé** : monter/descendre les sets et patches, déplacer un patch dans un autre set, conserver la sélection et les réglages. Tests du store, de l’interface et parcours Maestro.
- [x] 2. Niveau global par patch — **terminé** : réglage en dB indépendant du mélange des layers, sauvegarde et duplication, validation audio.
- [x] 3. Rattrapage des faders MIDI — **terminé, validation iPad à compléter** : option pickup pour les volumes, réarmement lors des changements de patch, indication du sens de rattrapage.
- [x] 4. Notes par patch — **terminé** : édition d’un texte court et affichage lisible en mode scène.
- [x] 5. Activation des layers par MIDI — **terminé, validation iPad à compléter** : MIDI Learn « Layer N on / off » sur le patch courant, déclenché à l’appui ; le CC du bouton n’est plus transmis aux instruments.
- [x] 6. Vérifier le concert — **terminé** : banques et AUv3 manquants, échecs de chargement, patches muets, sets vides, CC partagés ; état du moteur audio, entrées MIDI et claviers Bluetooth. L’écran rappelle qu’il ne garantit pas la stabilité audio.
- [x] 7. Tempo par patch et Tap Tempo — **terminé, validation iPad à compléter** : tempo 20–300 BPM par patch, Tap dans l’éditeur, en scène et par MIDI ; tempo, position et mesure 4/4 transmis aux AUv3 via le contexte musical de l’hôte (sans transport).

## Validation

Pour chaque étape : tests pertinents, `npm run format`, puis `npm run check:all`. Les changements natifs nécessitent aussi un build et une vérification audio/MIDI. Une vérification sur iPad physique avec des AUv3 tiers sera signalée séparément si elle ne peut pas être réalisée ici.

## Journal

- 3 octobre 2026 : inventaire du code existant effectué. Préchargement, notes tenues, Program Change et duplication déjà présents. Les changements préexistants du site et des accords sont conservés.

- Étape 1 validée : formatage, lint, types, 243 tests JS, 30 tests natifs et les 4 parcours existants passent. Nouveau parcours Maestro de réorganisation validé séparément (ordre des patches, déplacement inter-set, ordre des sets et navigation).

- Étape 2 validée : réglage de −24 à 0 dB, duplication et préchargement inclus. 246 tests JS, 30 tests natifs et 6/6 parcours Maestro passent. Les layers conservent leurs volumes enregistrés.
- Étape 3 : protection native des CC appartenant aux volumes du mixer, pour empêcher les plugins de contourner le pickup. Build iOS requis avant les prochains parcours.

- Étape 3 : 249 tests JS et 32 tests natifs passent, build iOS réussi et installé. Les 6 parcours antérieurs passent et le nouveau parcours MIDI passe après correction de ses libellés accessibles. Le contrôle sur clavier physique et AUv3 tiers reste à réaliser sur iPad.

- Étape 4 validée : notes limitées à 400 caractères, copiées avec le patch et visibles en scène. Tests JS/natifs passent et le parcours iOS est validé après adaptation au libellé natif du champ.

- Étape 5 validée : les CC des boutons de mute rejoignent les CC réservés au mixer (non transmis aux plugins, y compris pendant l’apprentissage). Test sur clavier physique à réaliser sur iPad.
- Étape 6 validée : vérification accessible depuis Réglages › Concert. Les erreurs de chargement natives sont mémorisées par layer et effacées au chargement suivant réussi.
- Étape 7 : horloge musicale C++ sans verrou (tempo atomique, position avancée par le rendu de la sortie), installée sur chaque instrument et effet AUv3 avant son attachement. Tests natifs sous Thread Sanitizer.
- Étapes 5 à 7 : 267 tests JS, 35 tests natifs, build iOS simulateur réussi et 10/10 parcours Maestro (dont « Vérifier le concert » et « Tempo »). Restent à vérifier sur iPad : bouton de mute sur clavier réel, synchronisation d’un AUv3 tiers (délai/arpégiateur) au tempo du patch.
