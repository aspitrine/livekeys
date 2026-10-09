import type { IconName } from './icons';
import type { LayerDef, SoundRef } from './types';

export type Subcategory = { id: string; name: string; programs?: number[] };
export type Category = { id: string; name: string; icon: IconName; subcategories: Subcategory[] };

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/**
 * Browser tree. Sounds land in a subcategory by their General MIDI program (0-based),
 * except dedicated banks and the GeneralUser GS variations listed below.
 */
export const CATEGORIES: Category[] = [
  {
    id: 'pianos',
    name: 'Pianos',
    icon: 'pianokeys',
    subcategories: [
      { id: 'grand', name: 'Piano à queue', programs: [0, 1] },
      { id: 'upright', name: 'Piano droit' },
      { id: 'honky-tonk', name: 'Honky-tonk', programs: [3] },
      { id: 'electric', name: 'Piano électrique', programs: [2, 4, 5] },
      { id: 'hybrid', name: 'Pianos & textures' },
      { id: 'harpsichord', name: 'Clavecin', programs: [6] },
      { id: 'clavinet', name: 'Clavinet', programs: [7] },
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
      { id: 'bells', name: 'Célesta, glockenspiel, cloches', programs: [8, 9, 10, 14, 112] },
      { id: 'mallets', name: 'Vibraphone, marimba, xylophone', programs: [11, 12, 13] },
      { id: 'other', name: 'Dulcimer, kalimba & steel drums', programs: [15, 108, 114] },
    ],
  },
  {
    id: 'strings',
    name: 'Cordes',
    icon: 'music.note',
    subcategories: [
      { id: 'ensemble', name: 'Cordes & orchestre', programs: [44, 48, 49] },
      { id: 'solo', name: 'Solistes', programs: [40, 41, 42, 43] },
      { id: 'pizz', name: 'Pizzicato & harpe', programs: [45, 46] },
      { id: 'synth', name: 'Cordes synthé', programs: [50, 51] },
    ],
  },
  {
    id: 'choir',
    name: 'Chœurs',
    icon: 'person.3.fill',
    subcategories: [{ id: 'all', name: 'Chœurs & voix', programs: [52, 53, 54] }],
  },
  {
    id: 'winds',
    name: 'Cuivres & vents',
    icon: 'wind',
    subcategories: [
      { id: 'brass', name: 'Cuivres', programs: range(56, 61) },
      { id: 'synth', name: 'Cuivres synthé', programs: [62, 63] },
      { id: 'reeds', name: 'Saxophones & bois', programs: range(64, 71) },
      { id: 'flutes', name: 'Flûtes', programs: range(72, 79) },
    ],
  },
  {
    id: 'guitars',
    name: 'Guitares',
    icon: 'guitars',
    subcategories: [
      { id: 'acoustic', name: 'Acoustiques', programs: [24, 25] },
      { id: 'electric', name: 'Électriques & harmoniques', programs: [26, 27, 28, 31] },
      { id: 'distorted', name: 'Saturées', programs: [29, 30] },
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
      { id: 'fx', name: 'Textures & effets', programs: [55, ...range(96, 103)] },
    ],
  },
  {
    id: 'drums',
    name: 'Batteries & percussions',
    icon: 'circle.circle',
    subcategories: [
      { id: 'kits', name: 'Kits de batterie' },
      { id: 'percussion', name: 'Timbales & percussions', programs: [47, 113, ...range(115, 119)] },
    ],
  },
  {
    id: 'world',
    name: 'Monde & effets',
    icon: 'globe',
    subcategories: [
      { id: 'ethnic', name: 'Instruments du monde', programs: [104, 105, 106, 107, 109, 110, 111] },
      { id: 'sfx', name: 'Effets sonores', programs: range(120, 127) },
    ],
  },
];

export type Place = { category: string; subcategory: string };

/** Whole banks dedicated to one instrument: always shown in their own place, first. */
export const BANK_PLACES: Record<string, Place> = {
  'UprightPianoKW-small': { category: 'pianos', subcategory: 'upright' },
  'UprightPianoKW-bright': { category: 'pianos', subcategory: 'upright' },
  UprightPianoKW: { category: 'pianos', subcategory: 'upright' },
  'VCSL-UprightYamaha': { category: 'pianos', subcategory: 'upright' },
  'VCSL-UprightKnight': { category: 'pianos', subcategory: 'upright' },
  SplendidGrand: { category: 'pianos', subcategory: 'grand' },
  SalamanderGrand: { category: 'pianos', subcategory: 'grand' },
  'VCSL-GrandKawai': { category: 'pianos', subcategory: 'grand' },
  YDPGrand: { category: 'pianos', subcategory: 'grand' },
  'Wurlitzer-EP200': { category: 'pianos', subcategory: 'electric' },
  jRhodes3c: { category: 'pianos', subcategory: 'electric' },
  jRhodes3d: { category: 'pianos', subcategory: 'electric' },
  'Yamaha-CP80': { category: 'pianos', subcategory: 'electric' },
  'Hohner-PianetT': { category: 'pianos', subcategory: 'electric' },
};

/**
 * Actual bundled GeneralUser GS presets whose timbre differs from their GM slot.
 * Keys are SF2 bank/program, not names: renamed layers keep the same classification.
 */
const GENERAL_USER_PLACES: Record<string, Place> = {
  '8/31': { category: 'guitars', subcategory: 'distorted' }, // Guitar Feedback
  '8/48': { category: 'synths', subcategory: 'pads' }, // Orchestra Pad
  '11/0': { category: 'pianos', subcategory: 'hybrid' }, // Piano & Str.-Fade
  '11/1': { category: 'pianos', subcategory: 'hybrid' }, // Piano & Str.-Sus
  '12/0': { category: 'pianos', subcategory: 'hybrid' }, // Bell Piano
  '13/48': { category: 'winds', subcategory: 'reeds' }, // Woodwind Choir
  '1/98': { category: 'mallets', subcategory: 'mallets' }, // Synth Mallet
  '11/96': { category: 'synths', subcategory: 'pads' }, // Mystery Pad
  '11/98': { category: 'mallets', subcategory: 'bells' }, // Synth Chime
  '11/100': { category: 'synths', subcategory: 'leads' }, // Bright Saw Stack
};

export function placeOf(sound: SoundRef): Place | null {
  const bank = BANK_PLACES[sound.bank];
  if (bank) return bank;
  if (sound.bankNumber === 128) return { category: 'drums', subcategory: 'kits' };
  if (sound.bank === 'GeneralUser-GS') {
    // GeneralUser also exposes its drum kits in melodic bank 120 for compatibility.
    if (sound.bankNumber === 120) return { category: 'drums', subcategory: 'kits' };
    const variation = GENERAL_USER_PLACES[`${sound.bankNumber}/${sound.program}`];
    if (variation) return variation;
  }
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
