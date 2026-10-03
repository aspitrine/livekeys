import type { Screenshot } from '../components/ScreenshotGallery.vue';

export const layerScreenshots = [
  {
    file: 'layers',
    label: 'Piano + Pad',
    alt: 'LiveKeys : patch Piano + Pad, deux layers Grand Piano et Warm Pad, setlist et clavier.',
    caption: 'Deux instruments, un même patch.',
  },
  {
    file: 'split',
    label: 'Basse / EP',
    alt: 'LiveKeys : patch Basse / EP, basse sur la partie grave du clavier et piano électrique sur la partie aiguë.',
    caption: 'Un split pour jouer basse et piano électrique.',
  },
] as const satisfies readonly [Screenshot, ...Screenshot[]];

export const effectScreenshots = [
  {
    file: 'effects',
    label: 'Choisir un effet',
    alt: 'LiveKeys : navigateur des effets, catégories, presets de réverbe et Audio Units Apple disponibles.',
    caption: 'Le navigateur d’effets de LiveKeys.',
  },
  {
    file: 'effect-editor',
    label: 'Régler un effet',
    alt: 'LiveKeys : paramètres de l’Audio Unit Apple AUReverb2 dans l’éditeur d’effets.',
    caption: 'Les réglages d’AUReverb2, un effet Apple.',
  },
] as const satisfies readonly [Screenshot, ...Screenshot[]];
