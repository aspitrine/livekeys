# Revue du moteur audio — 2 octobre 2026

Le pic intermittent entendu sur les haut-parleurs de l’iPad n’est pas reproduit de façon fiable. Les défauts ci-dessous
sont identifiés dans le code ; ils ne constituent pas une preuve de la cause de cet incident. La revue couvre le graphe
AVAudioEngine, les samplers, les effets/AUv3, les pads, les routes MIDI, le cycle de vie audio, les mesures DSP et la
synchronisation du concert avec le moteur.

## Corrections

- **Transitions du pad :** une courbe cos/sin pouvait ajouter 3 dB pour deux voix corrélées du même instrument.
  Le fondu utilise désormais une interpolation dont la somme des gains reste bornée. Des accords moins corrélés
  peuvent présenter un léger creux pendant la transition : c’est le compromis choisi pour éviter cette amplification.
- **Fondu annulé :** annuler un timer ne garantit pas qu’un callback déjà lancé s’arrête. Toutes ses mutations sont
  maintenant protégées par le verrou du moteur, après vérification de la génération et de l’identité de la couche.
- **Panic :** les deux voix du pad sont mises à zéro et reçoivent sustain off, all notes off et all sound off.
  Leur volume n’est plus remonté à 1. Côté JS, Panic annule aussi l’accord en attente et efface les touches mémorisées.
- **Synchronisation :** les requêtes périmées ne rejouent plus d’anciens volumes et ne réactivent plus un patch quitté
  pendant le chargement d’une banque. Les pads attendent la dernière synchronisation en file.
- **Chargement et reprise audio :** une couche neuve, en rechargement ou dont le chargement échoue reste silencieuse.
  Le redémarrage est sérialisé avec les modifications du graphe. Les strips sont coupés avant le démarrage, les presets
  et notes encore tenues sont restaurés, puis le mix courant est réappliqué. Une erreur de restauration est journalisée
  et laisse la couche silencieuse ; elle nécessite un chargement réussi ultérieur pour redevenir audible.
- **Remplacement des instruments/effets :** les anciens effets du même identifiant sont détachés. Un instrument AUv3
  remplaçant un sampler de pad ne conserve plus sa seconde voix. Les accès aux références d’instruments et d’effets
  sont protégés lors des mutations et lectures entre threads.
- **Mesures DSP :** des valeurs ordinaires étaient lues/remises à zéro pendant que le callback audio les modifiait.
  Le compteur utilise maintenant des atomiques 64 bits sans mutex ni allocation dans le callback. Somme et nombre
  de cycles sont lus ensemble. La frontière des fenêtres du pic et des dépassements peut différer d’un cycle.
  La résolution du taux mesuré est de 1/1024, avec saturation défensive après une très longue période sans lecture.

## Preuves et limites

Trois tests natifs ont échoué avant les corrections du pad : génération périmée, somme des gains supérieure à 1,
et hausse du gain lors de Panic. Trois tests JS ont également échoué avant les corrections de synchronisation/Panic.
Les tests natifs de récupération utilisent de vrais samplers Apple et vérifient le silence PCM après rechargement,
y compris avec une banque inexistante. Le test concurrent compte 200 000 cycles pendant des lectures simultanées.

`npm run test:native` exécute ces tests avec Thread Sanitizer. La compilation iOS et Maestro complètent cette
vérification, sans prouver les délais de rendu en temps réel ni le comportement des haut-parleurs physiques.
Les changements de route/interruption et le remplacement par des AUv3 tiers restent à vérifier sur iPad.

Les essais hors ligne du pad seul et des cinq instruments vus dans la vidéo, avec et sans les effets Apple configurés,
n’ont pas reproduit de dépassement de pleine échelle. La vidéo est une capture au microphone : elle ne mesure pas
directement le signal numérique. Le vumètre de l’app mesure **avant** le limiteur ; du rouge ne prouve donc pas que
la sortie finale écrête. Un dépassement du temps de rendu est un risque de craquement, pas une mesure d’écrêtage.

Le routage confirme que les pads ignorent les contrôleurs et notes du clavier. Les chemins USB, réseau et Bluetooth
peuvent être simultanément présents, mais aucune déduplication automatique n’a été ajoutée sans preuve d’événements
dupliqués. Voir [AUDIO_DIAGNOSTICS.md](AUDIO_DIAGNOSTICS.md) pour capturer MIDI, niveaux, DSP et route pendant le défaut.

## Vérification de cette version

- `npm run format`, puis `npm run check:all` : succès. 197 tests Jest, 7 tests natifs avec Thread Sanitizer,
  3 parcours Maestro ; couverture de lignes 95,03 % sur les dix fichiers JS/TS critiques configurés.
- `pod install`, puis compilations Xcode Debug du simulateur et de la cible iPad arm64 : succès.
- Smoke test audio/MIDI sur l’iPad physique : **non exécuté**. La commande de disponibilité
  `xcrun devicectl device info lockState --device 00008132-000138920E9A401C` a échoué avec
  `CoreDeviceError 4000 / Connection reset by peer`. Il faut une connexion iPad disponible pour installer
  cette nouvelle build native puis vérifier les haut-parleurs, les notes/MIDI et les interruptions de route.
  La build a été installée et testée sur le simulateur dédié ; elle n’a pas été installée sur l’iPad durant cette revue.

Références consultées : [chargement des samplers Apple](<https://developer.apple.com/documentation/avfaudio/avaudiounitsampler/loadsoundbankinstrument(at:program:bankmsb:banklsb:)>)
(lecture de fichier/allocation, hors thread temps réel), [démarrage AVAudioEngine](<https://developer.apple.com/documentation/avfaudio/avaudioengine/start()>),
et [atomiques Clang](https://clang.llvm.org/docs/LanguageExtensions.html#c11-atomic-builtins).

## Deuxième passe : scénarios d’utilisation

Cette passe ajoute des régressions qui ont échoué avant les corrections, en utilisant le code de production.
`PadVoices` est partagé entre le moteur iOS et SwiftPM : ses commandes MIDI, ses notes et ses gains sont exécutés
sur deux samplers réels. Les ticks du fondu sont avancés explicitement pour rendre les interruptions déterministes.

| Scénario                                                   | Défaut reproduit                                                        | Correction                                                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Arrêter puis relancer le même accord avant la fin du fondu | La reprise était ignorée et le pad finissait par s’éteindre             | Comparer la demande avec la cible du fondu, plutôt qu’avec les notes encore audibles              |
| Arrêter pendant un changement d’accord                     | L’ancienne voix restait en jeu ; pic PCM mesuré à 0,06785 après l’arrêt | Faire décroître et libérer les deux voix ; après correction, PCM inférieur à 0,00001 dans le test |
| Désactiver le sustain pédale enfoncée                      | Des notes relâchées continuaient indéfiniment                           | Envoyer sustain off avant de désactiver le routage                                                |
| Changer de canal MIDI pédale enfoncée                      | Le relâchement sur l’ancien canal ne libérait plus le sampler           | Libérer le sustain de l’ancienne configuration                                                    |
| Deux pédales sur deux canaux d’une couche omni             | Le premier relâchement coupait le sustain de l’autre canal              | Conserver les valeurs de chaque canal et agréger les pédales encore enfoncées                     |
| Charger un nouveau patch pédale enfoncée                   | La nouvelle couche ignorait la pédale jusqu’à son prochain mouvement    | Mémoriser la position d’entrée et la transférer aux couches nouvelles/reconfigurées               |
| Échec du deuxième effet après chargement du premier        | Une nouvelle tentative réinstallait aussi le premier effet réussi       | Enregistrer chaque opération native réussie immédiatement                                         |
| MIDI CC120/123, avec la valeur normale zéro                | Le moteur s’arrêtait mais le pad JS restait actif et pouvait repartir   | Arrêter aussi l’état du pad et annuler son accord en attente, indépendamment des mappings         |
| Quitter une vue de clavier pendant un appui                | Aucun note-off n’était envoyé si touchEnd/cancel n’arrivait pas         | Libérer les notes tactiles au démontage de la vue                                                 |
| Passer du jeu au choix d’une note avant le relâchement     | Le nouveau mode empêchait le note-off de l’appui commencé en mode jeu   | Libérer toute note effectivement enregistrée comme jouée                                          |

Le suivi du sustain conserve également un relâchement reçu pendant un rechargement silencieux, restaure la valeur
de pédale après rechargement, respecte le canal choisi lors d’une réactivation et est effacé par Panic.
Une voix de pad recyclée reçoit all-sound-off avant le nouvel accord pour éviter de réintroduire sa queue de release.

La validation physique reste distincte de ces résultats : `xcrun devicectl --timeout 10 device info lockState
--device 00008132-000138920E9A401C` indique maintenant `passcodeRequired: true`. L’iPad est joignable mais verrouillé.
Il faut le déverrouiller pour la vérification audio/MIDI de la build actuelle. Les changements de route/interruption,
les AUv3 tiers et plusieurs appareils MIDI partageant le même canal restent des scénarios à vérifier sur matériel.

Vérification finale de la deuxième passe : `npm run format`, puis `npm run check:all` réussissent : **202 tests Jest,
16 tests natifs sous Thread Sanitizer, 3 parcours Maestro**. Les compilations iOS Debug du simulateur et de la cible
arm64 iPad réussissent. La couverture atteint 95,34 % des lignes des dix fichiers JS/TS critiques configurés,
sans prétendre mesurer toute l’application ni le code natif. Les tests du clavier tactile exercent le composant
React Native réel avec les seuls appels audio natifs remplacés.

La première tentative E2E avec un serveur loopback IPv6 a révélé un crash dans
`DevLauncherNetworkInterceptor.createNetworkInspectorUrl(bundleUrl:)`, avant le chargement du code applicatif.
La relance avec `NODE_OPTIONS='--dns-result-order=ipv4first'`, Expo `--localhost` et l’URL `127.0.0.1` réussit.
Le serveur a été vérifié comme lié uniquement à `127.0.0.1:8082`. La configuration est documentée dans
[TESTING.md](TESTING.md). Le contrôle d’approbation avait refusé le mode LAN ; aucun serveur LAN nouveau n’a été lancé.
