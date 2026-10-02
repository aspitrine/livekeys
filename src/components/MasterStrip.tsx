import { StyleSheet, Text, View } from 'react-native';

import { useConcert } from '../store/concert';
import { colors } from '../theme';
import { Icon } from './Icon';
import { Fader } from './Fader';

export function MasterStrip() {
  const volume = useConcert((s) => s.masterVolume);
  const limiter = useConcert((s) => s.settings.limiter);
  const setMasterVolume = useConcert((s) => s.setMasterVolume);

  return (
    <View style={styles.strip}>
      <View style={styles.head}>
        <Icon name="speaker.wave.2.fill" size={14} color={colors.textDim} />
        <Text style={styles.name}>Master</Text>
      </View>
      <Text style={styles.meta}>{limiter ? 'Limiteur actif' : 'Sans limiteur'}</Text>
      <Fader value={volume} onChange={setMasterVolume} color={colors.text} />
      <Text style={styles.volume}>{Math.round(volume * 100)}</Text>
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
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'stretch' },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 12, alignSelf: 'stretch' },
  volume: { color: colors.textDim, fontVariant: ['tabular-nums'] },
});
