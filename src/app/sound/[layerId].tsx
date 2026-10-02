import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../../components/Button';
import { PluginRow } from '../../components/PluginRow';
import { BANK_LABELS, loadCatalog, soundKey } from '../../engine/catalog';
import { toPluginRef, usePlugins } from '../../engine/plugins';
import { instrumentName } from '../../model/defaults';
import type { LayerDef, SoundRef } from '../../model/types';
import { selectLayer, useConcert } from '../../store/concert';
import { colors } from '../../theme';

type Filter = { label: string; test: (s: SoundRef) => boolean };

const FILTERS: Filter[] = [
  { label: 'Tous', test: () => true },
  { label: 'Pianos', test: (s) => s.bankNumber !== 128 && s.program <= 7 },
  { label: 'Orgues', test: (s) => s.bankNumber !== 128 && s.program >= 16 && s.program <= 23 },
  { label: 'Cordes', test: (s) => s.bankNumber !== 128 && s.program >= 40 && s.program <= 55 },
  { label: 'Basses', test: (s) => s.bankNumber !== 128 && s.program >= 32 && s.program <= 39 },
  { label: 'Synthés', test: (s) => s.bankNumber !== 128 && s.program >= 80 && s.program <= 103 },
  { label: 'Batteries', test: (s) => s.bankNumber === 128 },
];

type Tab = 'sounds' | 'plugins';

/** Instrument browser: bundled SoundFont presets or AUv3 instruments. Picking loads immediately for audition. */
export default function SoundBrowser() {
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
        <Button label="Sons intégrés" active={tab === 'sounds'} onPress={() => setTab('sounds')} />
        <Button label="Plugins AUv3" active={tab === 'plugins'} onPress={() => setTab('plugins')} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher…"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
        <Button label="Terminé" variant="primary" onPress={() => router.back()} />
      </View>
      {tab === 'sounds' ? (
        <SoundList layer={layer} query={query} onChoose={(sound) => choose({ sound, plugin: undefined }, sound.name)} />
      ) : (
        <InstrumentPluginList layer={layer} query={query} onChoose={(plugin) => choose({ plugin }, plugin.name)} />
      )}
    </View>
  );
}

function SoundList({ layer, query, onChoose }: { layer: LayerDef; query: string; onChoose: (s: SoundRef) => void }) {
  const [catalog, setCatalog] = useState<SoundRef[] | null>(null);
  const [filter, setFilter] = useState(FILTERS[0]);

  useEffect(() => {
    loadCatalog().then(setCatalog).catch(console.warn);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (catalog ?? []).filter((s) => filter.test(s) && (!q || s.name.toLowerCase().includes(q)));
  }, [catalog, query, filter]);

  const selected = layer.plugin ? null : soundKey(layer.sound);

  return (
    <>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Button key={f.label} label={f.label} active={f.label === filter.label} onPress={() => setFilter(f)} />
        ))}
      </View>
      {!catalog ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={soundKey}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const active = soundKey(item) === selected;
            return (
              <Pressable onPress={() => onChoose(item)} style={[styles.item, active && styles.itemActive]}>
                <Text style={[styles.name, active && styles.nameActive]}>{item.name}</Text>
                <Text style={styles.meta}>
                  {BANK_LABELS[item.bank] ?? item.bank}
                  {item.bankNumber === 128
                    ? ' · batterie'
                    : item.bankNumber > 0
                      ? ` · variation ${item.bankNumber}`
                      : ''}{' '}
                  · {item.program + 1}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={styles.meta}>Aucun son trouvé.</Text>}
        />
      )}
    </>
  );
}

function InstrumentPluginList(props: {
  layer: LayerDef;
  query: string;
  onChoose: (p: ReturnType<typeof toPluginRef>) => void;
}) {
  const plugins = usePlugins('instrument');
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
        <Text style={styles.hint}>
          Instruments Audio Unit installés sur cet appareil. Installe des apps AUv3 (Korg, Moog, Arturia…) depuis l’App
          Store pour les voir ici.
        </Text>
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
  hint: { color: colors.textMuted, fontSize: 13, marginBottom: 8 },
});
