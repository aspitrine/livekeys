import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

import type { PluginInfo } from '../../../modules/audio-engine';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { PluginRow } from '../../components/PluginRow';
import { toPluginRef, usePlugins } from '../../engine/plugins';
import { EFFECT_CATEGORIES, EFFECT_PRESETS, type EffectPreset, effectCategoryOf } from '../../model/effectCategories';
import type { PluginRef } from '../../model/types';
import { useConcert } from '../../store/concert';
import { colors } from '../../theme';

export { ScreenError as ErrorBoundary } from '../../components/ScreenError';

type Item = { kind: 'preset'; preset: EffectPreset } | { kind: 'plugin'; plugin: PluginInfo };

/** Effects grouped by type: ready-to-use settings first, then the raw Audio Units. */
export default function EffectBrowser() {
  const { layerId } = useLocalSearchParams<{ layerId: string }>();
  const addEffect = useConcert((s) => s.addEffect);
  const { plugins, refresh } = usePlugins('effect');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(EFFECT_CATEGORIES[0]!.id);

  const add = (plugin: PluginRef) => {
    addEffect(layerId, plugin);
    router.back();
  };

  const byCategory = useMemo(() => {
    const map = new Map<string, PluginInfo[]>();
    for (const p of plugins ?? []) {
      const c = effectCategoryOf(p);
      map.set(c, [...(map.get(c) ?? []), p]);
    }
    return map;
  }, [plugins]);

  const q = query.trim().toLowerCase();
  const matches = (text: string) => !q || text.toLowerCase().includes(q);
  const inScope = (c: string) => q !== '' || c === category;

  const presets = EFFECT_PRESETS.filter((p) => inScope(p.category) && matches(`${p.name} ${p.description}`));
  const raw = [...byCategory.entries()]
    .filter(([c]) => inScope(c))
    .flatMap(([, list]) => list)
    .filter((p) => matches(`${p.name} ${p.manufacturer}`));

  const sections = [
    { title: 'Prêts à l’emploi', data: presets.map((preset): Item => ({ kind: 'preset', preset })) },
    {
      title: category === 'thirdparty' && !q ? 'Plugins installés' : 'Effets bruts',
      data: raw.map((plugin): Item => ({ kind: 'plugin', plugin })),
    },
  ].filter((s) => s.data.length > 0);

  const count = (c: string) => EFFECT_PRESETS.filter((p) => p.category === c).length + (byCategory.get(c)?.length ?? 0);

  return (
    <View style={styles.screen}>
      <View style={styles.row}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher un effet…"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
        <Button icon="arrow.clockwise" variant="subtle" accessibilityLabel="Rafraîchir" onPress={refresh} />
        <Button icon="xmark" label="Annuler" onPress={() => router.back()} />
      </View>

      <View style={styles.columns}>
        <ScrollView style={styles.categories} contentContainerStyle={styles.columnContent}>
          {EFFECT_CATEGORIES.map((c) => {
            const active = !q && c.id === category;
            return (
              <Pressable
                key={c.id}
                onPress={() => {
                  setQuery('');
                  setCategory(c.id);
                }}
                style={[styles.item, active && styles.itemActive]}
              >
                <Icon name={c.icon} size={16} color={active ? colors.text : colors.textDim} />
                <Text style={[styles.itemText, active && styles.itemTextActive]} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={[styles.count, active && styles.countActive]}>{count(c.id)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {!plugins ? (
          <ActivityIndicator color={colors.accent} style={styles.loading} />
        ) : (
          <SectionList
            style={styles.list}
            contentContainerStyle={styles.columnContent}
            sections={sections}
            stickySectionHeadersEnabled={false}
            keyExtractor={(item) => (item.kind === 'preset' ? item.preset.id : item.plugin.id)}
            renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
            renderItem={({ item }) =>
              item.kind === 'preset' ? (
                <Pressable
                  onPress={() => add(item.preset.plugin)}
                  style={({ pressed }) => [styles.preset, pressed && styles.pressed]}
                >
                  <Icon name="sparkles" size={14} color={colors.warning} />
                  <View style={styles.flex}>
                    <Text style={styles.presetName}>{item.preset.name}</Text>
                    <Text style={styles.meta}>{item.preset.description}</Text>
                  </View>
                  <Icon name="plus.circle.fill" size={20} color={colors.accent} />
                </Pressable>
              ) : (
                <PluginRow plugin={item.plugin} onPress={() => add(toPluginRef(item.plugin))} />
              )
            }
            ListEmptyComponent={
              <Text style={styles.empty}>
                {category === 'thirdparty'
                  ? 'Aucun effet AUv3 installé. Installe-en depuis l’App Store (ouvre l’app une fois), puis rafraîchis.'
                  : 'Aucun effet trouvé.'}
              </Text>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 12 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  search: { flex: 1, color: colors.text, fontSize: 17, backgroundColor: colors.control, borderRadius: 10, padding: 10 },
  loading: { flex: 1 },
  flex: { flex: 1 },
  columns: { flex: 1, flexDirection: 'row', gap: 10 },
  columnContent: { padding: 6, gap: 2 },
  categories: { flexGrow: 0, width: 260, backgroundColor: colors.panel, borderRadius: 12 },
  list: { flex: 1, backgroundColor: colors.panel, borderRadius: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 10, borderRadius: 8 },
  itemActive: { backgroundColor: colors.accent },
  itemText: { flex: 1, color: colors.textDim, fontSize: 15 },
  itemTextActive: { color: colors.text, fontWeight: '600' },
  count: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  countActive: { color: 'rgba(255,255,255,0.8)' },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 6,
  },
  preset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  pressed: { backgroundColor: colors.control },
  presetName: { color: colors.text, fontSize: 16, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 13 },
  empty: { color: colors.textMuted, padding: 16 },
});
