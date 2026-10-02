import { router } from 'expo-router';
import { ActionSheetIOS, Pressable, StyleSheet, Text, View } from 'react-native';

import { noteName } from '../lib/notes';
import type { LayerDef } from '../model/types';
import { useConcert } from '../store/concert';
import { colors } from '../theme';
import { Button } from './Button';
import { EffectSlots, InstrumentSlot } from './EffectSlots';
import { Fader } from './Fader';

/** Mixer channel strip for one layer: name, sound, range, fader, mute/solo, insert effects. */
/** `fxRows`: Audio FX rows to reserve, same for every strip of the patch. */
export function LayerStrip({ layer, fxRows }: { layer: LayerDef; fxRows: number }) {
  const updateLayer = useConcert((s) => s.updateLayer);
  const update = (patch: Partial<LayerDef>) => updateLayer(layer.id, patch);
  const edit = () => router.push({ pathname: '/layer/[id]', params: { id: layer.id } });
  const moveLayer = useConcert((s) => s.moveLayer);
  const menu = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: layer.name,
        options: ['Éditer', 'Déplacer à gauche', 'Déplacer à droite', 'Annuler'],
        cancelButtonIndex: 3,
      },
      (i) => {
        if (i === 0) edit();
        if (i === 1) moveLayer(layer.id, -1);
        if (i === 2) moveLayer(layer.id, 1);
      },
    );

  return (
    <View style={styles.strip}>
      <View style={[styles.colorBar, { backgroundColor: layer.color }]} />
      <Pressable onPress={edit} onLongPress={menu} style={styles.head}>
        <Text style={styles.name} numberOfLines={1}>
          {layer.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {layer.pad ? 'Pad d’accords' : `${noteName(layer.keyLow)}–${noteName(layer.keyHigh)}`}
          {!layer.pad && layer.transpose !== 0 && `  ${layer.transpose > 0 ? '+' : ''}${layer.transpose}`}
        </Text>
      </Pressable>

      <InstrumentSlot layer={layer} />
      <EffectSlots layer={layer} rows={fxRows} />

      <Fader value={layer.volume} onChange={(volume) => update({ volume })} color={layer.color} />
      <Text style={styles.volume}>{Math.round(layer.volume * 100)}</Text>

      <View style={styles.row}>
        <Button
          label="M"
          active={layer.mute}
          activeColor={colors.danger}
          onPress={() => update({ mute: !layer.mute })}
          style={styles.flex}
        />
        <Button
          label="S"
          active={layer.solo}
          activeColor={colors.warning}
          onPress={() => update({ solo: !layer.solo })}
          style={styles.flex}
        />
      </View>
      <Button icon="slider.horizontal.3" label="Éditer" variant="ghost" size="sm" onPress={edit} />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    width: 132,
    backgroundColor: colors.panel,
    borderRadius: 12,
    padding: 10,
    gap: 8,
    alignItems: 'center',
    overflow: 'hidden',
  },
  colorBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  head: { alignSelf: 'stretch', gap: 2, marginTop: 2 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 12 },
  volume: { color: colors.textDim, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', gap: 6, alignSelf: 'stretch' },
  flex: { flex: 1 },
});
