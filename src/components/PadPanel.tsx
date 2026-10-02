import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePadChord } from '../engine/pads';
import { type ChordQuality, chordName, ROOT_NAMES } from '../lib/chords';
import { selectCurrentPatch, useConcert } from '../store/concert';
import { colors } from '../theme';
import { Button } from './Button';
import { Icon } from './Icon';

/** Compact chord-pad control of the current patch (sidebar, bottom left). */
export function PadPanel() {
  const patch = useConcert(selectCurrentPatch);
  const updateLayer = useConcert((s) => s.updateLayer);
  const addPadLayer = useConcert((s) => s.addPadLayer);
  const detected = usePadChord((s) => s.detected);
  const layer = patch?.layers.find((l) => l.pad);

  if (!patch) return null;
  if (!layer?.pad) {
    return (
      <View style={styles.panel}>
        <Button icon="waveform" label="Ajouter un pad" variant="subtle" onPress={() => addPadLayer(patch.id)} />
      </View>
    );
  }

  const pad = layer.pad;
  const following = pad.mode === 'follow';
  const chord = following ? detected : pad.chord;
  const set = (patch: Partial<typeof pad>) => updateLayer(layer.id, { pad: { ...pad, ...patch } });
  const openSettings = () => router.push({ pathname: '/layer/[id]', params: { id: layer.id } });

  return (
    <View style={[styles.panel, styles.card]}>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: pad.playing ? layer.color : colors.textMuted }]} />
        <Text style={styles.title}>Pad</Text>
        <View style={styles.flex} />
        <Pressable onPress={openSettings} hitSlop={8} accessibilityLabel="Réglages du pad (son, effets, registre)">
          <Icon name="slider.horizontal.3" size={16} color={colors.accent} />
        </Pressable>
      </View>

      <Pressable
        onPress={() => set({ mode: following ? 'fixed' : 'follow' })}
        accessibilityLabel="Suivre les accords joués"
        style={({ pressed }) => [
          styles.follow,
          following && { backgroundColor: colors.accent },
          pressed && styles.pressed,
        ]}
      >
        <Icon
          name={following ? 'checkmark.circle.fill' : 'circle'}
          size={14}
          color={following ? colors.text : colors.textMuted}
        />
        <Text style={[styles.followText, following && styles.followTextOn]}>Suivre les accords</Text>
      </Pressable>

      <View style={styles.main}>
        <Text
          style={[styles.chord, !following && styles.chordSmall, !pad.playing && styles.off]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {chord ? chordName(chord) : '—'}
        </Text>
        <Pressable
          onPress={() => set({ playing: !pad.playing })}
          accessibilityLabel={pad.playing ? 'Arrêter le pad' : 'Lancer le pad'}
          style={({ pressed }) => [
            styles.play,
            pad.playing && { backgroundColor: layer.color },
            pressed && styles.pressed,
          ]}
        >
          <Icon name={pad.playing ? 'stop.fill' : 'play.fill'} size={16} />
        </Pressable>
      </View>

      {!following && (
        <>
          <View style={styles.grid}>
            {ROOT_NAMES.map((name, root) => (
              <ChordButton
                key={name}
                label={name}
                active={pad.chord.root === root}
                color={layer.color}
                onPress={() => set({ chord: { ...pad.chord, root } })}
              />
            ))}
          </View>
          <View style={styles.grid}>
            {PANEL_QUALITIES.map((q) => (
              <ChordButton
                key={q.id}
                label={q.label}
                active={pad.chord.quality === q.id}
                color={layer.color}
                onPress={() => set({ chord: { ...pad.chord, quality: q.id } })}
              />
            ))}
          </View>
        </>
      )}

      <View style={styles.volume}>
        <Icon name="speaker.fill" size={11} color={colors.textMuted} />
        <Slider
          style={styles.flex}
          value={layer.volume}
          onValueChange={(volume) => updateLayer(layer.id, { volume: Math.round(volume * 100) / 100 })}
          minimumTrackTintColor={layer.color}
          maximumTrackTintColor={colors.control}
        />
        <Text style={styles.percent}>{Math.round(layer.volume * 100)}</Text>
      </View>
    </View>
  );
}

/** Chord types offered in the panel (the full list is in the pad settings). */
const PANEL_QUALITIES: { id: ChordQuality; label: string }[] = [
  { id: 'maj', label: 'Maj' },
  { id: 'min', label: 'm' },
  { id: '7', label: '7' },
  { id: 'maj7', label: 'maj7' },
  { id: 'm7', label: 'm7' },
  { id: 'sus2', label: 'sus2' },
  { id: 'sus4', label: 'sus4' },
  { id: 'add9', label: 'add9' },
];

function ChordButton(props: { label: string; active: boolean; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.chip,
        props.active && { backgroundColor: props.color },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, props.active && styles.chipTextActive]} numberOfLines={1}>
        {props.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { marginHorizontal: 12, marginBottom: 12 },
  card: { backgroundColor: colors.panelRaised, borderRadius: 12, padding: 10, gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { color: colors.text, fontWeight: '700', fontSize: 13 },
  follow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.control,
  },
  followText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  followTextOn: { color: colors.text },
  chordSmall: { fontSize: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: {
    width: '23.5%',
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.control,
  },
  chipText: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.text, fontWeight: '800' },
  flex: { flex: 1 },
  main: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chord: { color: colors.text, fontSize: 28, fontWeight: '800' },
  off: { color: colors.textMuted },
  play: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.control,
  },
  pressed: { opacity: 0.7 },
  volume: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 24 },
  percent: { color: colors.textMuted, fontSize: 11, width: 24, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
