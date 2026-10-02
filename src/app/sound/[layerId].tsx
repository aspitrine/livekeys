import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../../components/Button';
import { PluginRow } from '../../components/PluginRow';
import { SoundBrowser } from '../../components/SoundBrowser';
import { toPluginRef, usePlugins } from '../../engine/plugins';
import { instrumentName } from '../../model/defaults';
import type { LayerDef } from '../../model/types';
import { selectLayer, useConcert } from '../../store/concert';
import { colors } from '../../theme';

type Tab = 'sounds' | 'plugins';

/** Instrument browser: bundled SoundFont presets or AUv3 instruments. Picking loads immediately for audition. */
export default function SoundBrowserScreen() {
  const { layerId } = useLocalSearchParams<{ layerId: string }>();
  const layer = useConcert(selectLayer(layerId));
  const updateLayer = useConcert((s) => s.updateLayer);
  const [tab, setTab] = useState<Tab>(layer?.plugin ? 'plugins' : 'sounds');
  const [query, setQuery] = useState('');

  if (!layer) return null;

  /** Keep a custom layer name; follow the instrument name otherwise. */
  const choose = (patch: Partial<LayerDef>, name: string) => {
    const followName = layer.name === instrumentName(layer);
    updateLayer(layerId, { ...patch, ...(followName && { name }) });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.row}>
        <Button icon="pianokeys" label="Sons" active={tab === 'sounds'} onPress={() => setTab('sounds')} />
        <Button
          icon="puzzlepiece.extension.fill"
          label="Plugins AUv3"
          active={tab === 'plugins'}
          onPress={() => setTab('plugins')}
        />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher…"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
        <Button
          icon="arrow.down.circle"
          label="Plus de sons"
          variant="subtle"
          onPress={() => router.push('/library')}
        />
        <Button icon="checkmark" label="Terminé" variant="primary" onPress={() => router.back()} />
      </View>
      {tab === 'sounds' ? (
        <SoundBrowser
          selected={layer.plugin ? null : layer.sound}
          query={query}
          onChoose={(sound) => choose({ sound, plugin: undefined }, sound.name)}
        />
      ) : (
        <InstrumentPluginList layer={layer} query={query} onChoose={(plugin) => choose({ plugin }, plugin.name)} />
      )}
    </View>
  );
}

function InstrumentPluginList(props: {
  layer: LayerDef;
  query: string;
  onChoose: (p: ReturnType<typeof toPluginRef>) => void;
}) {
  const { plugins, refresh } = usePlugins('instrument');
  const q = props.query.trim().toLowerCase();
  const results = (plugins ?? []).filter(
    (p) => !q || p.name.toLowerCase().includes(q) || p.manufacturer.toLowerCase().includes(q),
  );

  if (!plugins) return <ActivityIndicator color={colors.accent} style={styles.loading} />;
  return (
    <FlatList
      data={results}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => (
        <PluginRow
          plugin={item}
          active={props.layer.plugin?.componentId === item.id}
          onPress={() => props.onChoose(toPluginRef(item))}
        />
      )}
      ListHeaderComponent={
        <View style={styles.pluginHeader}>
          <Text style={[styles.hint, styles.flex]}>
            Instruments Audio Unit installés sur cet iPad. Un plugin qui vient d’être installé n’apparaît qu’après avoir
            ouvert une fois son app (KORG Module, Moog…) puis rafraîchi cette liste.
          </Text>
          <Button icon="arrow.clockwise" label="Rafraîchir" variant="subtle" onPress={refresh} />
        </View>
      }
      ListEmptyComponent={<Text style={styles.meta}>Aucun instrument Audio Unit trouvé.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 12 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  search: { flex: 1, color: colors.text, fontSize: 17, backgroundColor: colors.control, borderRadius: 10, padding: 10 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  loading: { marginTop: 40 },
  item: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemActive: { backgroundColor: colors.accent },
  name: { color: colors.textDim, fontSize: 16 },
  nameActive: { color: colors.text, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 13 },
  metaActive: { color: 'rgba(255,255,255,0.8)' },
  hint: { color: colors.textMuted, fontSize: 13 },
  pluginHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  flex: { flex: 1 },
});
