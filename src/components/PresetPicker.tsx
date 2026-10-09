import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { PluginPreset } from '../../modules/audio-engine';
import { pluginPresets, selectPluginPreset } from '../engine/plugins';
import { colors } from '../theme';
import { Button } from './Button';
import { Icon } from './Icon';

/** Factory presets of a loaded Audio Unit. Hidden when the AU declares none. */
export function PresetPicker({ layerId, slot, reloadKey }: { layerId: string; slot: string; reloadKey?: unknown }) {
  const [presets, setPresets] = useState<PluginPreset[]>([]);
  const [current, setCurrent] = useState(-1);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const result = pluginPresets(layerId, slot);
      setPresets(result.presets);
      setCurrent(result.current);
    } catch {
      setPresets([]); // AU not loaded yet
    }
  }, [layerId, slot, reloadKey]);

  if (!presets.length) return null;

  const choose = (preset: PluginPreset) => {
    selectPluginPreset(layerId, slot, preset.number);
    setCurrent(preset.number);
    setOpen(false);
  };
  const currentName = presets.find((p) => p.number === current)?.name ?? 'Preset personnalisé';

  return (
    <>
      <Button icon="list.bullet" label={currentName} variant="subtle" onPress={() => setOpen(true)} />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.panel}>
            <View style={styles.header}>
              <Text style={styles.title}>Presets ({presets.length})</Text>
              <Button icon="xmark" variant="subtle" accessibilityLabel="Fermer" onPress={() => setOpen(false)} />
            </View>
            <FlatList
              data={presets}
              keyExtractor={(p) => String(p.number)}
              initialScrollIndex={Math.max(
                0,
                presets.findIndex((p) => p.number === current),
              )}
              getItemLayout={(_, index) => ({ length: ROW, offset: ROW * index, index })}
              renderItem={({ item }) => {
                const active = item.number === current;
                return (
                  <Pressable onPress={() => choose(item)} style={[styles.row, active && styles.rowActive]}>
                    <Text style={[styles.name, active && styles.nameActive]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {active && <Icon name="checkmark" size={14} />}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const ROW = 44;

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  panel: { width: 420, maxHeight: '75%', backgroundColor: colors.panel, borderRadius: 16, padding: 12, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 6 },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
  row: {
    height: ROW,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  rowActive: { backgroundColor: colors.accent },
  name: { color: colors.textDim, fontSize: 15, flex: 1 },
  nameActive: { color: colors.text, fontWeight: '600' },
});
