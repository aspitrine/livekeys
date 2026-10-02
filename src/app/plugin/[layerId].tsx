import Slider from '@react-native-community/slider';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import AudioEngine, { type PluginParameter, PluginEditorView } from '../../../modules/audio-engine';
import { Button } from '../../components/Button';
import { PresetPicker } from '../../components/PresetPicker';
import { capturePluginStates } from '../../engine/sync';
import { selectLayer, useConcert } from '../../store/concert';
import { colors } from '../../theme';

/**
 * Shows an Audio Unit's own interface, or a generic parameter list when it has none.
 * Params: `layerId`, `slot` ("instrument" or an effect id). The plugin state is saved when leaving.
 */
export default function PluginScreen() {
  const { layerId, slot = 'instrument' } = useLocalSearchParams<{ layerId: string; slot?: string }>();
  const layer = useConcert(selectLayer(layerId));
  const [hasView, setHasView] = useState<boolean | null>(null);

  const effect = slot === 'instrument' ? undefined : layer?.effects.find((e) => e.id === slot);
  const plugin = effect ? effect.plugin : layer?.plugin;
  const setEffectBypass = useConcert((s) => s.setEffectBypass);

  // Persist whatever was tweaked, whichever way the screen is closed.
  useEffect(() => () => void capturePluginStates(layerId, selectLayer(layerId)(useConcert.getState())), [layerId]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: plugin ? `${plugin.name} · ${plugin.manufacturer}` : 'Plugin' }} />
      <View style={styles.toolbar}>
        <PresetPicker layerId={layerId} slot={slot} reloadKey={hasView} />
        <Text style={styles.hint}>Les réglages sont sauvegardés dans le patch à la fermeture.</Text>
        {effect && (
          <Button
            icon="power"
            label={effect.bypass ? 'Désactivé' : 'Activé'}
            active={!effect.bypass}
            activeColor={colors.success}
            accessibilityLabel={effect.bypass ? 'Activer l’effet' : 'Désactiver l’effet'}
            onPress={() => setEffectBypass(layerId, effect.id, !effect.bypass)}
          />
        )}
        {effect && (
          <Button
            icon="trash"
            label="Retirer l’effet"
            variant="danger"
            onPress={() => {
              router.back();
              useConcert.getState().removeEffect(layerId, slot);
            }}
          />
        )}
        <Button icon="checkmark" label="Terminé" variant="primary" onPress={() => router.back()} />
      </View>
      <View style={styles.editor}>
        <PluginEditorView
          layerId={layerId}
          slot={slot}
          style={hasView === false ? styles.hidden : styles.fill}
          onLoad={(e) => setHasView(e.nativeEvent.hasView)}
        />
        {hasView === false && <GenericParameters layerId={layerId} slot={slot} />}
      </View>
    </View>
  );
}

/** Slider per writable parameter, for AUs without a custom view (e.g. Apple's built-in effects). */
function GenericParameters({ layerId, slot }: { layerId: string; slot: string }) {
  const [params, setParams] = useState<PluginParameter[]>([]);
  useEffect(() => {
    try {
      setParams(AudioEngine.getPluginParameters(layerId, slot));
    } catch (e) {
      console.warn(e);
    }
  }, [layerId, slot]);

  const set = (address: number, value: number) => {
    AudioEngine.setPluginParameter(layerId, slot, address, value);
    setParams((ps) => ps.map((p) => (p.address === address ? { ...p, value } : p)));
  };

  if (!params.length) return <Text style={styles.hint}>Ce plugin n’a ni interface ni paramètre réglable.</Text>;

  return (
    <ScrollView contentContainerStyle={styles.params}>
      {params.map((p) => (
        <View key={p.address} style={styles.param}>
          <Text style={styles.paramName} numberOfLines={1}>
            {p.name}
          </Text>
          <Slider
            style={styles.flex}
            value={p.value}
            minimumValue={p.min}
            maximumValue={p.max}
            onValueChange={(v) => set(p.address, v)}
            minimumTrackTintColor={colors.accent}
          />
          <Text style={styles.paramValue}>
            {Number.isInteger(p.value) ? p.value : p.value.toFixed(2)} {p.unit}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  editor: { flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.panel },
  fill: { flex: 1 },
  hidden: { width: 0, height: 0 },
  hint: { color: colors.textMuted, fontSize: 13, flex: 1 },
  params: { padding: 16, gap: 14 },
  param: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  paramName: { color: colors.textDim, width: 180 },
  paramValue: { color: colors.text, width: 110, textAlign: 'right', fontVariant: ['tabular-nums'] },
  flex: { flex: 1 },
});
