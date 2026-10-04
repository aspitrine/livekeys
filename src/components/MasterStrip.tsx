import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import AudioEngine from '../../modules/audio-engine';

import { type EffectDef, MASTER_ID } from '../model/types';
import { useConcert } from '../store/concert';
import { colors } from '../theme';
import { EffectSlots } from './EffectSlots';
import { Icon } from './Icon';
import { Fader } from './Fader';
import { MidiPickupHint } from './MidiPickupHint';
import { reductionColor } from './LevelMeter';

const EMPTY: EffectDef[] = [];

export function MasterStrip() {
  const volume = useConcert((s) => s.masterVolume);
  const limiter = useConcert((s) => s.settings.limiter);
  const setMasterVolume = useConcert((s) => s.setMasterVolume);
  const effects = useConcert((s) => s.concert.masterEffects ?? EMPTY);

  return (
    <View style={styles.strip}>
      <View style={styles.head}>
        <Icon name="speaker.wave.2.fill" size={14} color={colors.textDim} />
        <Text style={styles.name}>Master</Text>
      </View>
      <LimiterStatus enabled={limiter} />
      {/* Inserts on the whole mix, before the limiter (a shared reverb, an EQ…). Same for every patch. */}
      <EffectSlots hostId={MASTER_ID} effects={effects} rows={effects.length + 1} />
      <Fader value={volume} onChange={setMasterVolume} color={colors.text} />
      <Text style={styles.volume}>{Math.round(volume * 100)}</Text>
      <MidiPickupHint target={{ kind: 'masterVolume' }} />
    </View>
  );
}

/** "Limiteur −4 dB" while it squashes peaks (held ~1 s so it can be read), coloured like the meter. */
function LimiterStatus({ enabled }: { enabled: boolean }) {
  const [reduction, setReduction] = useState(0);
  const heldUntil = useRef(0);
  useEffect(() => {
    const sub = AudioEngine.addListener('onLevel', (e) => {
      const now = Date.now();
      if (e.reductionDb >= reduction || now > heldUntil.current) {
        heldUntil.current = now + 1000;
        setReduction(e.reductionDb);
      }
    });
    return () => sub.remove();
  }, [reduction]);

  if (!enabled) return <Text style={styles.meta}>Sans limiteur</Text>;
  const working = reduction > 0.5;
  return (
    <Text style={[styles.meta, working && { color: reductionColor(reduction), fontWeight: '700' }]}>
      {working ? `Limiteur −${reduction.toFixed(0)} dB` : 'Limiteur actif'}
    </Text>
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
