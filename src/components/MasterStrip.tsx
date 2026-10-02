import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useConcert } from '../store/concert';
import { colors } from '../theme';
import { Button } from './Button';
import { Fader } from './Fader';

export function MasterStrip() {
  const volume = useConcert((s) => s.masterVolume);
  const limiter = useConcert((s) => s.settings.limiter);
  const setMasterVolume = useConcert((s) => s.setMasterVolume);

  return (
    <View style={styles.strip}>
      <Text style={styles.name}>Master</Text>
      <Text style={styles.meta}>{limiter ? 'Limiteur actif' : 'Sans limiteur'}</Text>
      <Fader value={volume} onChange={setMasterVolume} color={colors.text} />
      <Text style={styles.volume}>{Math.round(volume * 100)}</Text>
      <Button label="Réglages" variant="ghost" onPress={() => router.push('/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    width: 120,
    backgroundColor: colors.panelRaised,
    borderRadius: 12,
    padding: 10,
    gap: 8,
    alignItems: 'center',
  },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', alignSelf: 'stretch' },
  meta: { color: colors.textMuted, fontSize: 12, alignSelf: 'stretch' },
  volume: { color: colors.textDim, fontVariant: ['tabular-nums'] },
});
