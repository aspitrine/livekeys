import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PluginInfo } from '../../modules/audio-engine';
import { colors } from '../theme';

export function PluginRow({ plugin, active, onPress }: { plugin: PluginInfo; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.item, active && styles.itemActive]}>
      <View style={styles.flex}>
        <Text style={[styles.name, active && styles.nameActive]}>{plugin.name}</Text>
        <Text style={[styles.meta, active && styles.metaActive]}>{plugin.manufacturer}</Text>
      </View>
      {plugin.isAUv3 && <Text style={[styles.badge, active && styles.badgeActive]}>AUv3</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemActive: { backgroundColor: colors.accent },
  flex: { flex: 1 },
  name: { color: colors.textDim, fontSize: 16 },
  nameActive: { color: colors.text, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 13 },
  metaActive: { color: 'rgba(255,255,255,0.8)' },
  badgeActive: { color: colors.text, borderColor: 'rgba(255,255,255,0.6)' },
  badge: {
    color: colors.textMuted,
    fontSize: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
});
