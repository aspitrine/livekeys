import type { IconName } from '../components/Icon';
import type { LayerDef, SoundRef } from './types';

export type Subcategory = { id: string; name: string; programs?: number[] };
export type Category = { id: string; name: string; icon: IconName; subcategories: Subcategory[] };

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/**
 * Browser tree. Sounds land in a subcategory by their General MIDI program (0-based),
 * except whole banks listed in BANK_PLACES (dedicated pianos, Rhodes…).
 */
export const CATEGORIES: Category[] = [
  {
    id: 'pianos',
    name: 'Pianos',
    icon: 'pianokeys',
    subcategories: [
      { id: 'grand', name: 'Piano à queue', programs: [0, 1] },
      { id: 'upright', name: 'Piano droit', programs: [3] },
      { id: 'electric', name: 'Piano électrique', programs: [2, 4, 5] },
      { id: 'harpsichord', name: 'Clavecin & Clavinet', programs: [6, 7] },
    ],
  },
  {
    id: 'organs',
    name: 'Orgues',
    icon: 'music.quarternote.3',
    subcategories: [
      { id: 'electric', name: 'Orgue électrique', programs: [16, 17, 18] },
      { id: 'church', name: 'Orgue d’église & harmonium', programs: [19, 20] },
      { id: 'accordion', name: 'Accordéon & harmonica', programs: [21, 22, 23] },
    ],
  },
  {
    id: 'mallets',
    name: 'Percussions mélodiques',
    icon: 'bell',
    subcategories: [
      { id: 'bells', name: 'Célesta, glockenspiel, cloches', programs: [8, 9, 10, 14] },
      { id: 'mallets', name: 'Vibraphone, marimba, xylophone', programs: [11, 12, 13, 15] },
    ],
  },
  {
    id: 'strings',
    name: 'Cordes',
    icon: 'music.note',
    subcategories: [
      { id: 'ensemble', name: 'Ensembles', programs: [44, 48, 49] },
      { id: 'solo', name: 'Solistes', programs: [40, 41, 42, 43] },
      { id: 'pizz', name: 'Pizzicato, harpe, timbales', programs: [45, 46, 47] },
      { id: 'synth', name: 'Cordes synthé', programs: [50, 51] },
    ],
  },
  {
    id: 'choir',
    name: 'Chœurs',
    icon: 'person.3.fill',
    subcategories: [{ id: 'all', name: 'Chœurs & voix', programs: [52, 53, 54, 55] }],
  },
  {
    id: 'winds',
    name: 'Cuivres & vents',
    icon: 'wind',
    subcategories: [
      { id: 'brass', name: 'Cuivres', programs: range(56, 63) },
      { id: 'reeds', name: 'Saxophones & anches', programs: range(64, 71) },
      { id: 'flutes', name: 'Flûtes', programs: range(72, 79) },
    ],
  },
  {
    id: 'guitars',
    name: 'Guitares',
    icon: 'guitars',
    subcategories: [
      { id: 'acoustic', name: 'Acoustiques', programs: [24, 25] },
      { id: 'electric', name: 'Électriques', programs: [26, 27, 28] },
      { id: 'distorted', name: 'Saturées', programs: [29, 30, 31] },
    ],
  },
  {
    id: 'basses',
    name: 'Basses',
    icon: 'guitars.fill',
    subcategories: [
      { id: 'acoustic', name: 'Contrebasse', programs: [32] },
      { id: 'electric', name: 'Basse électrique', programs: [33, 34, 35, 36, 37] },
      { id: 'synth', name: 'Basse synthé', programs: [38, 39] },
    ],
  },
  {
    id: 'synths',
    name: 'Synthés',
    icon: 'waveform',
    subcategories: [
      { id: 'pads', name: 'Pads', programs: range(88, 95) },
      { id: 'leads', name: 'Leads', programs: range(80, 87) },
      { id: 'fx', name: 'Textures & effets', programs: range(96, 103) },
    ],
  },
  {
    id: 'drums',
    name: 'Batteries & percussions',
    icon: 'circle.circle',
    subcategories: [
      { id: 'kits', name: 'Kits de batterie' },
      { id: 'percussion', name: 'Percussions', programs: range(112, 119) },
    ],
  },
  {
    id: 'world',
    name: 'Monde & effets',
    icon: 'globe',
    subcategories: [
      { id: 'ethnic', name: 'Instruments du monde', programs: range(104, 111) },
      { id: 'sfx', name: 'Effets sonores', programs: range(120, 127) },
    ],
  },
];

export type Place = { category: string; subcategory: string };

/** Whole banks dedicated to one instrument: always shown in their own place, first. */
export const BANK_PLACES: Record<string, Place> = {
  'UprightPianoKW-small': { category: 'pianos', subcategory: 'upright' },
  UprightPianoKW: { category: 'pianos', subcategory: 'upright' },
  SplendidGrand: { category: 'pianos', subcategory: 'grand' },
  jRhodes3c: { category: 'pianos', subcategory: 'electric' },
  jRhodes3d: { category: 'pianos', subcategory: 'electric' },
};

export function placeOf(sound: SoundRef): Place | null {
  const bank = BANK_PLACES[sound.bank];
  if (bank) return bank;
  if (sound.bankNumber === 128) return { category: 'drums', subcategory: 'kits' };
  for (const category of CATEGORIES) {
    for (const sub of category.subcategories) {
      if (sub.programs?.includes(sound.program)) return { category: category.id, subcategory: sub.id };
    }
  }
  return null;
}

/** Use the browser's actual sound category, including banks with non-GM program numbers. */
export function instrumentIcon(layer: Pick<LayerDef, 'sound' | 'plugin'>): IconName {
  if (layer.plugin) return 'puzzlepiece.extension.fill';
  const place = placeOf(layer.sound);
  return CATEGORIES.find((category) => category.id === place?.category)?.icon ?? 'music.note';
}

export const placeKey = (p: Place) => `${p.category}/${p.subcategory}`;

/** "Pianos › Piano électrique" */
export function placeLabel(p: Place) {
  const category = CATEGORIES.find((c) => c.id === p.category);
  const sub = category?.subcategories.find((s) => s.id === p.subcategory);
  return [category?.name, sub?.name].filter(Boolean).join(' › ');
}
