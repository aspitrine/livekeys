import type { SoundRef } from './types';

const gu = (program: number, name: string, bankNumber = 0): SoundRef => ({
  bank: 'GeneralUser-GS',
  bankNumber,
  program,
  name,
});

/** Handy presets used by the default concert and new layers. Full list comes from the SF2 files. */
export const SOUNDS = {
  upright: { bank: 'UprightPianoKW-small', bankNumber: 0, program: 0, name: 'Upright piano KW' },
  brightUpright: { bank: 'UprightPianoKW-bright', bankNumber: 0, program: 0, name: 'Upright KW brillant' },
  wurlitzer: { bank: 'Wurlitzer-EP200', bankNumber: 0, program: 0, name: 'Wurlitzer EP200' },
  grand: gu(0, 'Grand Piano'),
  tineEP: gu(4, 'Tine Electric Piano'),
  drawbar: gu(16, 'Drawbar Organ'),
  strings: gu(48, 'String Ensemble'),
  warmPad: gu(89, 'Warm Pad'),
  choirPad: gu(91, 'Choir Pad'),
  fingerBass: gu(33, 'Finger Bass'),
} satisfies Record<string, SoundRef>;
