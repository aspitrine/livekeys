import { useEffect, useMemo, useRef, useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';

import AudioEngine from '../../modules/audio-engine';
import { isBlackKey, noteName, PIANO_HIGH, PIANO_LOW } from '../lib/notes';
import type { LayerDef } from '../model/types';
import { colors } from '../theme';

type Props = {
  layers: LayerDef[];
  /** When set, tapping a key calls this instead of playing it (e.g. picking a split point). */
  onPickNote?: (note: number) => void;
  height?: number;
  /** Layer being edited: its range is highlighted in its colour, other layers fade out. */
  focusLayerId?: string;
  /** With `focusLayerId`: shows a draggable range bar to set the focused layer's key range. */
  onRangeChange?: (low: number, high: number) => void;
  /** Called with true while a range handle is dragged (e.g. to freeze the parent ScrollView). */
  onRangeDrag?: (dragging: boolean) => void;
};

const NOTES = Array.from({ length: PIANO_HIGH - PIANO_LOW + 1 }, (_, i) => PIANO_LOW + i);
const WHITES = NOTES.filter((n) => !isBlackKey(n));
const BLACKS = NOTES.filter(isBlackKey);
const WHITE_W = 100 / WHITES.length;
/** Black keys cover the top 62% of the keyboard. */
const BLACK_DEPTH = 0.62;

/** Horizontal position of a key, in % of the keyboard width. */
function keyRect(note: number) {
  const whiteIndex = WHITES.filter((w) => w <= note).length - 1;
  return isBlackKey(note)
    ? { left: (whiteIndex + 0.68) * WHITE_W, width: WHITE_W * 0.64 }
    : { left: whiteIndex * WHITE_W, width: WHITE_W };
}

/** Note under a point of the keyboard (in pt), and a velocity from how low on the key it is. */
function hitTest(x: number, y: number, width: number, height: number): { note: number; velocity: number } | null {
  if (width <= 0 || x < 0 || x > width || y < 0 || y > height) return null;
  const pct = (x / width) * 100;
  const velocityFor = (depth: number) => Math.round(45 + 82 * Math.min(Math.max(depth, 0), 1));

  if (y < height * BLACK_DEPTH) {
    const black = BLACKS.find((n) => {
      const r = keyRect(n);
      return pct >= r.left && pct <= r.left + r.width;
    });
    if (black !== undefined) return { note: black, velocity: velocityFor(y / (height * BLACK_DEPTH)) };
  }
  const white = WHITES[Math.min(Math.floor(pct / WHITE_W), WHITES.length - 1)];
  return { note: white, velocity: velocityFor(y / height) };
}

/** Key whose centre is closest to a horizontal position (in % of the keyboard width). */
function noteAt(percent: number) {
  let best = NOTES[0];
  let bestDistance = Infinity;
  for (const n of NOTES) {
    const r = keyRect(n);
    const distance = Math.abs(r.left + r.width / 2 - percent);
    if (distance < bestDistance) {
      best = n;
      bestDistance = distance;
    }
  }
  return best;
}

type Grab = { kind: 'low' | 'high' | 'move'; startX: number; low: number; high: number };

/**
 * Draggable range: drag the left / right handle to move the low / high note, or the middle to shift
 * the whole zone. Positions snap to keys and follow the keyboard below.
 */
function RangeEditor(props: {
  low: number;
  high: number;
  color: string;
  onChange: (low: number, high: number) => void;
  onDrag?: (dragging: boolean) => void;
}) {
  const width = useRef(1);
  const grab = useRef<Grab | null>(null);
  const latest = useRef(props);
  latest.current = props;

  const lowRect = keyRect(props.low);
  const highRect = keyRect(props.high);
  const left = lowRect.left;
  const right = highRect.left + highRect.width;

  const percentOf = (x: number) => Math.min(Math.max((x / width.current) * 100, 0), 100);

  const onStart = (e: GestureResponderEvent) => {
    const { low, high } = latest.current;
    const x = percentOf(e.nativeEvent.locationX);
    const l = keyRect(low).left;
    const r = keyRect(high).left + keyRect(high).width;
    // Handles are generous: within 2.5 % of an edge grabs it, otherwise the nearest edge or the middle.
    const kind =
      Math.abs(x - l) < 2.5 ? 'low' : Math.abs(x - r) < 2.5 ? 'high' : x > l && x < r ? 'move' : x < l ? 'low' : 'high';
    grab.current = { kind, startX: x, low, high };
    latest.current.onDrag?.(true);
    if (kind !== 'move') onMove(e);
  };

  const end = () => {
    grab.current = null;
    latest.current.onDrag?.(false);
  };

  const onMove = (e: GestureResponderEvent) => {
    const g = grab.current;
    if (!g) return;
    const x = percentOf(e.nativeEvent.locationX);
    const { onChange } = latest.current;
    if (g.kind === 'low') onChange(Math.min(noteAt(x), g.high), g.high);
    else if (g.kind === 'high') onChange(g.low, Math.max(noteAt(x), g.low));
    else {
      // Shift by whole semitones measured at the start position, keeping the zone's size.
      const shift = noteAt(x) - noteAt(g.startX);
      const delta = Math.min(Math.max(shift, PIANO_LOW - g.low), PIANO_HIGH - g.high);
      onChange(g.low + delta, g.high + delta);
    }
  };

  return (
    <View
      style={styles.rangeTrack}
      onLayout={(e) => (width.current = e.nativeEvent.layout.width || 1)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={onStart}
      onResponderMove={onMove}
      onResponderRelease={end}
      onResponderTerminate={end}
    >
      <View
        pointerEvents="none"
        style={[styles.rangeFill, { left: `${left}%`, width: `${right - left}%`, backgroundColor: props.color }]}
      >
        <View style={styles.handle}>
          <View style={styles.grip} />
        </View>
        <Text style={styles.rangeLabel} numberOfLines={1}>
          {noteName(props.low)} – {noteName(props.high)}
        </Text>
        <View style={styles.handle}>
          <View style={styles.grip} />
        </View>
      </View>
    </View>
  );
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
export function SplitKeyboard({ layers, onPickNote, height = 120, focusLayerId, onRangeChange, onRangeDrag }: Props) {
  const focus = focusLayerId ? layers.find((l) => l.id === focusLayerId && !l.pad) : undefined;
  const held = useHeldNotes();
  const anySolo = layers.some((l) => l.solo);

  const bars = useMemo(
    () =>
      layers
        .filter((l) => !l.pad)
        .map((l) => {
          const low = keyRect(Math.max(l.keyLow, PIANO_LOW));
          const high = keyRect(Math.min(l.keyHigh, PIANO_HIGH));
          const audible = !l.mute && (!anySolo || l.solo);
          const focused = l.id === focus?.id;
          return {
            id: l.id,
            color: focus && !focused ? colors.border : l.color,
            height: focus ? (focused ? 10 : 3) : 6,
            left: low.left,
            width: high.left + high.width - low.left,
            audible,
            // Focused layer on top of the others.
            order: focused ? 1 : 0,
          };
        })
        .sort((a, b) => a.order - b.order),
    [layers, anySolo, focus],
  );

  // One touch surface for the whole keyboard: each finger is tracked on its own, so chords and
  // glissandos work (separate Pressables only allow one active touch at a time).
  const size = useRef({ width: 0, height });
  const fingers = useRef(new Map<string, number>()); // touch identifier → note it holds
  const [touched, setTouched] = useState<ReadonlySet<number>>(new Set());

  useEffect(() => {
    const activeFingers = fingers.current;
    return () => {
      // Navigation can remove the touch surface before UIKit sends touchEnd/cancel.
      const notes = new Set(activeFingers.values());
      activeFingers.clear();
      for (const note of notes) AudioEngine.noteOff(note, 0);
    };
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    size.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height };
  };

  const release = (note: number) => {
    // Another finger may still hold the same key.
    // Only playing touches enter the map; the mode may change before they end.
    if (![...fingers.current.values()].includes(note)) AudioEngine.noteOff(note, 0);
  };

  const onTouch = (e: GestureResponderEvent, phase: 'start' | 'move' | 'end') => {
    const { width, height: h } = size.current;
    for (const t of e.nativeEvent.changedTouches) {
      const id = String(t.identifier);
      const previous = fingers.current.get(id);

      if (phase === 'end') {
        fingers.current.delete(id);
        if (previous !== undefined) release(previous);
        continue;
      }
      const hit = hitTest(t.locationX, t.locationY, width, h);
      if (onPickNote) {
        if (phase === 'start' && hit) onPickNote(hit.note);
        continue;
      }
      if (hit?.note === previous) continue;
      fingers.current.delete(id);
      if (previous !== undefined) release(previous);
      if (hit) {
        fingers.current.set(id, hit.note);
        AudioEngine.noteOn(hit.note, hit.velocity, 0);
      }
    }
    setTouched(new Set(fingers.current.values()));
  };

  const renderKey = (note: number) => {
    const rect = keyRect(note);
    return (
      <View
        key={note}
        pointerEvents="none"
        style={[
          isBlackKey(note) ? styles.black : styles.white,
          { left: `${rect.left}%`, width: `${rect.width}%` },
          (touched.has(note) || held.has(note)) && styles.pressed,
        ]}
      >
        {focus && (
          <View
            style={[
              StyleSheet.absoluteFill,
              note >= focus.keyLow && note <= focus.keyHigh
                ? { backgroundColor: focus.color, opacity: isBlackKey(note) ? 0.55 : 0.35 }
                : styles.outOfRange,
            ]}
          />
        )}
        {note % 12 === 0 && <Text style={styles.label}>{noteName(note)}</Text>}
      </View>
    );
  };

  return (
    <View>
      {focus && onRangeChange && (
        <RangeEditor
          low={Math.max(focus.keyLow, PIANO_LOW)}
          high={Math.min(focus.keyHigh, PIANO_HIGH)}
          color={focus.color}
          onChange={onRangeChange}
          onDrag={onRangeDrag}
        />
      )}
      <View style={styles.bars}>
        {bars.map((b) => (
          <View
            key={b.id}
            style={[
              styles.bar,
              {
                left: `${b.left}%`,
                width: `${b.width}%`,
                height: b.height,
                backgroundColor: b.color,
                opacity: b.audible ? 1 : 0.25,
              },
            ]}
          />
        ))}
      </View>
      <View
        style={{ height }}
        testID="split-keyboard"
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onTouchStart={(e) => onTouch(e, 'start')}
        onTouchMove={(e) => onTouch(e, 'move')}
        onTouchEnd={(e) => onTouch(e, 'end')}
        onTouchCancel={(e) => onTouch(e, 'end')}
      >
        {WHITES.map(renderKey)}
        {BLACKS.map(renderKey)}
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
  black: {
    position: 'absolute',
    top: 0,
    height: `${BLACK_DEPTH * 100}%`,
    backgroundColor: '#111',
    borderRadius: 2,
    zIndex: 1,
  },
  pressed: { backgroundColor: colors.accent },
  rangeTrack: { height: 34, marginBottom: 6, borderRadius: 8, backgroundColor: colors.control },
  rangeFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    minWidth: 44,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  handle: { width: 16, height: '100%', alignItems: 'center', justifyContent: 'center' },
  grip: { width: 4, height: 16, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.85)' },
  rangeLabel: { flexShrink: 1, color: colors.text, fontSize: 12, fontWeight: '700' },
  outOfRange: { backgroundColor: '#000', opacity: 0.28 },
  label: { fontSize: 9, color: '#666', marginBottom: 3 },
});
