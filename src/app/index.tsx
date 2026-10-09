import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LayerStrips } from '../components/LayerStrips';
import { MasterStrip } from '../components/MasterStrip';
import { SetlistSidebar } from '../components/SetlistSidebar';
import { SplitKeyboard } from '../components/SplitKeyboard';
import { TopBar } from '../components/TopBar';
import { selectCurrentPatch, useConcert } from '../store/concert';
import { colors } from '../theme';

export { ScreenError as ErrorBoundary } from '../components/ScreenError';

/** Performance screen: setlist on the left, current patch mixer + split keyboard on the right. */
export default function PerformScreen() {
  const patch = useConcert(selectCurrentPatch);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <SetlistSidebar />
      <View style={styles.main}>
        <TopBar />

        <View style={styles.mixer}>
          {patch ? (
            <LayerStrips patch={patch} />
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
  main: { flex: 1, paddingHorizontal: 16, paddingVertical: 6, gap: 12 },
  mixer: { flex: 1, flexDirection: 'row', gap: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 16 },
});
