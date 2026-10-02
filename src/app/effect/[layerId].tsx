import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../../components/Button';
import { PluginRow } from '../../components/PluginRow';
import { toPluginRef, usePlugins } from '../../engine/plugins';
import { useConcert } from '../../store/concert';
import { colors } from '../../theme';

/** Picks an Audio Unit effect and appends it to the layer's chain. */
export default function EffectBrowser() {
  const { layerId } = useLocalSearchParams<{ layerId: string }>();
  const addEffect = useConcert((s) => s.addEffect);
  const plugins = usePlugins('effect');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const results = (plugins ?? []).filter(
    (p) => !q || p.name.toLowerCase().includes(q) || p.manufacturer.toLowerCase().includes(q),
  );

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
        <Button label="Annuler" onPress={() => router.back()} />
      </View>
      {!plugins ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <PluginRow
              plugin={item}
              onPress={() => {
                addEffect(layerId, toPluginRef(item));
                router.back();
              }}
            />
          )}
          ListEmptyComponent={<Text style={styles.meta}>Aucun effet trouvé.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 12 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  search: { flex: 1, color: colors.text, fontSize: 17, backgroundColor: colors.control, borderRadius: 10, padding: 10 },
  loading: { marginTop: 40 },
  meta: { color: colors.textMuted, fontSize: 13 },
});
