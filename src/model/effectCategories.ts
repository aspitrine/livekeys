import type { PluginInfo } from '../../modules/audio-engine';
import type { IconName } from '../components/Icon';
import type { PluginRef } from './types';

export type EffectCategory = { id: string; name: string; icon: IconName };

export const EFFECT_CATEGORIES: EffectCategory[] = [
  { id: 'reverb', name: 'Réverbes', icon: 'building.columns' },
  { id: 'delay', name: 'Délais & échos', icon: 'repeat' },
  { id: 'eq', name: 'Égaliseurs & filtres', icon: 'slider.vertical.3' },
  { id: 'dynamics', name: 'Dynamique', icon: 'gauge.with.dots.needle.33percent' },
  { id: 'distortion', name: 'Distorsion & lo-fi', icon: 'bolt.fill' },
  { id: 'pitch', name: 'Hauteur', icon: 'arrow.up.arrow.down' },
  { id: 'utility', name: 'Utilitaires', icon: 'wrench.and.screwdriver' },
  { id: 'thirdparty', name: 'Plugins tiers', icon: 'puzzlepiece.extension.fill' },
];

/** Apple effect subtype (second four-char code of the component id) → category. */
const APPLE_SUBTYPES: Record<string, string> = {
  rvb2: 'reverb',
  dely: 'delay',
  sdly: 'delay',
  bpas: 'eq',
  hpas: 'eq',
  lpas: 'eq',
  hshf: 'eq',
  lshf: 'eq',
  nbeq: 'eq',
  pmeq: 'eq',
  ipeq: 'eq',
  dcmp: 'dynamics',
  lmtr: 'dynamics',
  dist: 'distortion',
  tmpt: 'pitch',
  nutp: 'pitch',
};

export function effectCategoryOf(plugin: PluginInfo): string {
  const [, subtype, manufacturer] = plugin.id.split(':');
  if (manufacturer !== 'appl') return 'thirdparty';
  return APPLE_SUBTYPES[subtype] ?? 'utility';
}

/** A ready-to-use effect: an Apple Audio Unit with a factory preset and/or parameter values. */
export type EffectPreset = {
  id: string;
  category: string;
  name: string;
  description: string;
  plugin: PluginRef;
};

const REVERB = 'aufx:rvb2:appl';
const DELAY = 'aufx:dely:appl';
const DYNAMICS = 'aufx:dcmp:appl';
const DISTORTION = 'aufx:dist:appl';

const preset = (
  id: string,
  category: string,
  name: string,
  description: string,
  componentId: string,
  setup: { preset?: string; params?: Record<string, number> },
): EffectPreset => ({
  id,
  category,
  name,
  description,
  plugin: { componentId, name, manufacturer: 'Apple · réglage LiveKeys', ...setup },
});

// Parameter addresses checked against the Apple units (see scripts in the repo history):
// AUReverb2 0 = dry/wet %, AUDelay 0 = wet %, 1 = time s, 2 = feedback %, 3 = low-pass Hz,
// shelf / pass filters 0 = frequency Hz, 1 = gain dB (resonance for pass filters).
export const EFFECT_PRESETS: EffectPreset[] = [
  preset('rv-small', 'reverb', 'Petite pièce', 'Ambiance courte et discrète', REVERB, {
    preset: 'Small Room',
    params: { 0: 25 },
  }),
  preset('rv-room', 'reverb', 'Pièce moyenne', 'Un peu d’air autour du son', REVERB, {
    preset: 'Medium Room',
    params: { 0: 30 },
  }),
  preset('rv-chamber', 'reverb', 'Chambre', 'Douce et dense, idéale pour les pianos', REVERB, {
    preset: 'Medium Chamber',
    params: { 0: 30 },
  }),
  preset('rv-hall', 'reverb', 'Salle de concert', 'La réverbe polyvalente', REVERB, {
    preset: 'Medium Hall',
    params: { 0: 30 },
  }),
  preset('rv-large-hall', 'reverb', 'Grande salle', 'Longue et ample, pour pads et cordes', REVERB, {
    preset: 'Large Hall',
    params: { 0: 35 },
  }),
  preset('rv-plate', 'reverb', 'Plate', 'Brillante, classique sur les Rhodes et les voix', REVERB, {
    preset: 'Plate',
    params: { 0: 30 },
  }),
  preset('rv-cathedral', 'reverb', 'Cathédrale', 'Très longue, pour orgue et ambiances', REVERB, {
    preset: 'Cathedral',
    params: { 0: 40 },
  }),

  preset('dl-slap', 'delay', 'Slapback', 'Écho unique très court (110 ms)', DELAY, {
    params: { 0: 25, 1: 0.11, 2: 0, 3: 8000 },
  }),
  preset('dl-short', 'delay', 'Écho court', '250 ms, quelques répétitions', DELAY, {
    params: { 0: 25, 1: 0.25, 2: 30, 3: 6000 },
  }),
  preset('dl-medium', 'delay', 'Écho moyen', '500 ms, répétitions adoucies', DELAY, {
    params: { 0: 25, 1: 0.5, 2: 35, 3: 5000 },
  }),
  preset('dl-ambient', 'delay', 'Écho ambient', '750 ms, longues répétitions sombres', DELAY, {
    params: { 0: 30, 1: 0.75, 2: 55, 3: 3500 },
  }),

  preset('eq-bright', 'eq', 'Brillance', '+4 dB dans les aigus', 'aufx:hshf:appl', { params: { 0: 10000, 1: 4 } }),
  preset('eq-warm', 'eq', 'Chaleur', '+4 dB dans le grave', 'aufx:lshf:appl', { params: { 0: 120, 1: 4 } }),
  preset('eq-lowcut', 'eq', 'Coupe-bas', 'Retire le grave sous 120 Hz (nettoie les pads)', 'aufx:hpas:appl', {
    params: { 0: 120, 1: 0 },
  }),
  preset('eq-highcut', 'eq', 'Coupe-haut', 'Adoucit au-dessus de 6 kHz', 'aufx:lpas:appl', {
    params: { 0: 6000, 1: 0 },
  }),
  preset('eq-telephone', 'eq', 'Filtre lo-fi', 'Son étouffé et résonant', 'aufx:lpas:appl', {
    params: { 0: 2500, 1: 6 },
  }),

  preset('dy-light', 'dynamics', 'Compresseur léger', 'Égalise un peu les nuances', DYNAMICS, { preset: 'Light' }),
  preset('dy-smooth', 'dynamics', 'Compresseur', 'Rapide et transparent', DYNAMICS, { preset: 'Fast and Smooth' }),
  preset('dy-hard', 'dynamics', 'Compresseur fort', 'Son très tenu, nuances écrasées', DYNAMICS, { preset: 'Hard' }),

  preset('ds-overdrive', 'distortion', 'Overdrive', 'Saturation funky, pour orgue et Rhodes', DISTORTION, {
    preset: 'Multi- Distorted Funk',
  }),
  preset('ds-lofi', 'distortion', 'Lo-fi', 'Son dégradé façon vieille bande', DISTORTION, { preset: 'Drums- Lo-Fi' }),
  preset('ds-speaker', 'distortion', 'Haut-parleur cassé', 'Effet radical', DISTORTION, {
    preset: 'Multi- Broken Speaker',
  }),
  preset('ds-radio', 'distortion', 'Radio', 'Son de vieux poste', DISTORTION, { preset: 'Speech- Radio Tower' }),
];
