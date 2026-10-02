import { chordName, detectChord, padVoicing, sameChord, type Chord } from '../../src/lib/chords';
import { isBlackKey, noteName, PIANO_HIGH, PIANO_LOW } from '../../src/lib/notes';

describe('chord detection and pad voicing', () => {
  test.each<[number[], Chord]>([
    [[60, 64, 67], { root: 0, quality: 'maj' }],
    [[57, 60, 64], { root: 9, quality: 'min' }],
    [[60, 64, 67, 70], { root: 0, quality: '7' }],
    [[60, 64, 67, 71], { root: 0, quality: 'maj7' }],
    [[60, 63, 67, 70], { root: 0, quality: 'm7' }],
    [[60, 62, 67], { root: 0, quality: 'sus2' }],
    [[60, 65, 67], { root: 0, quality: 'sus4' }],
    [[60, 63, 66], { root: 0, quality: 'dim' }],
    [[60, 64, 68], { root: 0, quality: 'aug' }],
    [[60, 67], { root: 0, quality: '5' }],
  ])('recognizes %j', (notes, expected) => {
    expect(detectChord(notes)).toEqual(expected);
  });

  test.each([[[]], [[60]], [[48, 60, 72]]])('does not infer a chord from %j', (notes) => {
    expect(detectChord(notes)).toBeNull();
  });

  test('octave doubling does not change the chord', () => {
    expect(detectChord([48, 60, 64, 67, 72])).toEqual(detectChord([48, 64, 67]));
  });

  test('voices a major chord without a muddy low third', () => {
    expect(padVoicing({ root: 0, quality: 'maj' }, 48)).toEqual([48, 55, 60, 64]);
  });

  test('keeps B in the same register as C', () => {
    expect(padVoicing({ root: 11, quality: 'min' }, 48)).toEqual([47, 54, 59, 62]);
  });

  test('adds seventh and colour tones without duplicated notes', () => {
    expect(padVoicing({ root: 0, quality: '7' }, 48)).toEqual([48, 55, 60, 64, 70]);
    expect(padVoicing({ root: 0, quality: 'add9' }, 48)).toEqual([48, 55, 60, 62, 64]);
    expect(padVoicing({ root: 0, quality: 'dim' }, 36)).toEqual([36, 48, 51, 54]);
  });

  test('compares chord root and quality, including missing chords', () => {
    expect(sameChord({ root: 0, quality: 'maj' }, { root: 0, quality: 'maj' })).toBe(true);
    expect(sameChord({ root: 0, quality: 'maj' }, { root: 0, quality: 'min' })).toBe(false);
    expect(sameChord({ root: 0, quality: 'maj' }, { root: 2, quality: 'maj' })).toBe(false);
    expect(sameChord(null, null)).toBe(false);
    expect(sameChord({ root: 0, quality: 'maj' }, null)).toBe(false);
    expect(chordName({ root: 9, quality: 'min' })).toBe('Am');
  });
});

test('uses the full piano range and MainStage octave labels', () => {
  expect([PIANO_LOW, PIANO_HIGH]).toEqual([21, 108]);
  expect(noteName(60)).toBe('C3');
  expect(noteName(21)).toBe('A-1');
  expect(isBlackKey(61)).toBe(true);
  expect(isBlackKey(60)).toBe(false);
});
