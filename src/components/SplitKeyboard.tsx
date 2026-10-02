import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import AudioEngine from '../../modules/audio-engine';
import { isBlackKey, noteName, PIANO_HIGH, PIANO_LOW } from '../lib/notes';
import type { LayerDef } from '../model/types';
import { colors } from '../theme';

type Props = {
  layers: LayerDef[];
  /** When set, tapping a key calls this instead of playing it (e.g. picking a split point). */
  onPickNote?: (note: number) => void;
  height?: number;
};

const NOTES = Array.from({ length: PIANO_HIGH - PIANO_LOW + 1 }, (_, i) => PIANO_LOW + i);
const WHITES = NOTES.filter((n) => !isBlackKey(n));
const WHITE_W = 100 / WHITES.length;

/** Horizontal position of a key, in % of the keyboard width. */
function keyRect(note: number) {
  const whiteIndex = WHITES.filter((w) => w <= note).length - 1;
  return isBlackKey(note)
    ? { left: (whiteIndex + 0.68) * WHITE_W, width: WHITE_W * 0.64 }
    : { left: whiteIndex * WHITE_W, width: WHITE_W };
}

/** Lights up notes played on the hardware keyboard (or on screen). */
function useHeldNotes() {
  const [held, setHeld] = useState<ReadonlySet<number>>(new Set());
  useEffect(() => {
    const sub = AudioEngine.addListener('onMidiEvent', (e) => {
      if (e.type !== 'noteOn' && e.type !== 'noteOff') return;
      setHeld((prev) => {
        const next = new Set(prev);
        if (e.type === 'noteOn') next.add(e.data1);
        else next.delete(e.data1);
        return next;
      });
    });
    return () => sub.remove();
  }, []);
  return held;
}

/** 88-key keyboard with one colored bar per layer showing its key range. */
export function SplitKeyboard({ layers, onPickNote, height = 120 }: Props) {
  const held = useHeldNotes();
  const anySolo = layers.some((l) => l.solo);

  const bars = useMemo(
    () =>
      layers.map((l) => {
        const low = keyRect(Math.max(l.keyLow, PIANO_LOW));
        const high = keyRect(Math.min(l.keyHigh, PIANO_HIGH));
        const audible = !l.mute && (!anySolo || l.solo);
        return { id: l.id, color: l.color, left: low.left, width: high.left + high.width - low.left, audible };
      }),
    [layers, anySolo],
  );

  const press = (note: number) => (onPickNote ? onPickNote(note) : AudioEngine.noteOn(note, 100, 0));
  const release = (note: number) => !onPickNote && AudioEngine.noteOff(note, 0);

  const renderKey = (note: number) => {
    const black = isBlackKey(note);
    const rect = keyRect(note);
    return (
      <Pressable
        key={note}
        onPressIn={() => press(note)}
        onPressOut={() => release(note)}
        style={({ pressed }) => [
          black ? styles.black : styles.white,
          { left: `${rect.left}%`, width: `${rect.width}%` },
          (pressed || held.has(note)) && styles.pressed,
        ]}
      >
        {note % 12 === 0 && <Text style={styles.label}>{noteName(note)}</Text>}
      </Pressable>
    );
  };

  return (
    <View>
      <View style={styles.bars}>
        {bars.map((b) => (
          <View
            key={b.id}
            style={[
              styles.bar,
              { left: `${b.left}%`, width: `${b.width}%`, backgroundColor: b.color, opacity: b.audible ? 1 : 0.25 },
            ]}
          />
        ))}
      </View>
      <View style={{ height }}>
        {WHITES.map(renderKey)}
        {NOTES.filter(isBlackKey).map(renderKey)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { gap: 3, marginBottom: 6 },
  bar: { height: 6, borderRadius: 3, position: 'relative' },
  white: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#f4f4f4',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#555',
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  black: { position: 'absolute', top: 0, height: '62%', backgroundColor: '#111', borderRadius: 2, zIndex: 1 },
  pressed: { backgroundColor: colors.accent },
  label: { fontSize: 9, color: '#666', marginBottom: 3 },
});
