import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LayerStrip } from '../components/LayerStrip';
import { MasterStrip } from '../components/MasterStrip';
import { SetlistSidebar } from '../components/SetlistSidebar';
import { SplitKeyboard } from '../components/SplitKeyboard';
import { TopBar } from '../components/TopBar';
import { selectCurrentPatch, useConcert } from '../store/concert';
import { colors } from '../theme';

/** Performance screen: setlist on the left, current patch mixer + split keyboard on the right. */
export default function PerformScreen() {
  const patch = useConcert(selectCurrentPatch);
  const addLayer = useConcert((s) => s.addLayer);

  const onAddLayer = () => {
    if (!patch) return;
    const layerId = addLayer(patch.id);
    router.push({ pathname: '/sound/[layerId]', params: { layerId } });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <SetlistSidebar />
      <View style={styles.main}>
        <TopBar />

        <View style={styles.mixer}>
          {patch ? (
            <ScrollView horizontal contentContainerStyle={styles.strips} style={styles.stripsScroll}>
              {patch.layers.map((layer) => (
                <LayerStrip key={layer.id} layer={layer} />
              ))}
              <Pressable style={styles.addLayer} onPress={onAddLayer}>
                <Text style={styles.addLayerPlus}>＋</Text>
                <Text style={styles.addLayerText}>Ajouter un layer</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Aucun patch. Crée-en un avec ＋ dans la setlist.</Text>
            </View>
          )}
          <MasterStrip />
        </View>

        <SplitKeyboard layers={patch?.layers ?? []} height={170} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg },
  main: { flex: 1, padding: 16, gap: 16 },
  mixer: { flex: 1, flexDirection: 'row', gap: 12 },
  stripsScroll: { flex: 1 },
  strips: { gap: 12, alignItems: 'stretch' },
  addLayer: {
    width: 132,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addLayerPlus: { color: colors.accent, fontSize: 32 },
  addLayerText: { color: colors.textMuted, textAlign: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 16 },
});
