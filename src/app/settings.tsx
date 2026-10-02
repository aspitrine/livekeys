import { router } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import AudioEngine from '../../modules/audio-engine';
import { Button } from '../components/Button';
import { MAPPABLE_TARGETS, cancelLearn, sameTarget, startLearn, targetLabel, useMidiLearn } from '../engine/controls';
import { useEngineStatus } from '../engine/boot';
import { exportConcert, pickConcert } from '../lib/concertFile';
import { useConcert } from '../store/concert';
import { colors } from '../theme';

export default function SettingsScreen() {
  const concert = useConcert((s) => s.concert);
  const settings = useConcert((s) => s.settings);
  const { setSetting, removeMapping, loadConcert, renameConcert } = useConcert.getState();
  const learning = useMidiLearn((s) => s.learning);
  const bluetooth = useEngineStatus((s) => s.bluetooth);

  const importConcert = async () => {
    try {
      const imported = await pickConcert();
      if (!imported) return;
      Alert.alert(`Importer « ${imported.name} » ?`, 'Le concert actuel sera remplacé. Exporte-le avant si besoin.', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Remplacer', style: 'destructive', onPress: () => loadConcert(imported) },
      ]);
    } catch (e) {
      Alert.alert('Import impossible', String(e instanceof Error ? e.message : e));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Section title="Contrôles MIDI">
        <Text style={styles.hint}>
          Touche « Apprendre » puis bouge un fader, un potard, une pédale d’expression ou appuie sur un bouton de ton
          clavier. Les volumes de layer suivent la position du layer dans le patch courant.
        </Text>
        {MAPPABLE_TARGETS.map((target) => {
          const mapping = concert.mappings.find((m) => sameTarget(m.target, target));
          const isLearning = !!learning && sameTarget(learning, target);
          return (
            <View key={targetLabel(target)} style={styles.row}>
              <Text style={[styles.label, styles.flex]}>{targetLabel(target)}</Text>
              <Text style={styles.value}>
                {mapping ? `CC ${mapping.cc} · ${mapping.channel < 0 ? 'omni' : `canal ${mapping.channel + 1}`}` : '—'}
              </Text>
              <Button
                icon="dot.radiowaves.left.and.right"
                label={isLearning ? 'Bouge un contrôle…' : 'Apprendre'}
                active={isLearning}
                activeColor={colors.warning}
                onPress={() => (isLearning ? cancelLearn() : startLearn(target))}
              />
              {mapping && (
                <Button
                  icon="trash"
                  variant="danger"
                  accessibilityLabel="Retirer"
                  onPress={() => removeMapping(mapping.id)}
                />
              )}
            </View>
          );
        })}
      </Section>

      <Section title="Performance">
        <Toggle
          label="Précharger les patches voisins"
          hint="Le patch précédent et le suivant sont chargés à l’avance : changement instantané, plus de mémoire utilisée."
          value={settings.preloadNeighbors}
          onChange={(v) => setSetting('preloadNeighbors', v)}
        />
        <Toggle
          label="Limiteur sur la sortie"
          hint="Évite la saturation quand plusieurs layers jouent fort."
          value={settings.limiter}
          onChange={(v) => setSetting('limiter', v)}
        />
      </Section>

      <Section title="Sons">
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.label}>Bibliothèque de sons</Text>
            <Text style={styles.hint}>Pianos à queue, piano droit complet, Rhodes… à télécharger.</Text>
          </View>
          <Button icon="arrow.down.circle" label="Ouvrir" onPress={() => router.push('/library')} />
        </View>
      </Section>

      <Section title="Clavier Bluetooth MIDI">
        <Text style={styles.hint}>
          Allume le Bluetooth de ton clavier puis « Connecter… ». Une fois connecté, il est mémorisé et l’app s’y
          reconnecte toute seule au lancement ou après une coupure.
        </Text>
        <View style={styles.row}>
          <Text style={[styles.label, styles.flex]}>Connecter un nouveau clavier</Text>
          <Button
            icon="antenna.radiowaves.left.and.right"
            label="Connecter…"
            onPress={() =>
              AudioEngine.showBluetoothMidi().catch((e) => Alert.alert('Bluetooth MIDI', String(e?.message ?? e)))
            }
          />
        </View>
        <Toggle
          label="Reconnexion automatique"
          hint="Reconnecte les claviers mémorisés dès qu’ils sont allumés et à portée."
          value={settings.bluetoothAutoReconnect}
          onChange={(v) => setSetting('bluetoothAutoReconnect', v)}
        />
        {settings.bluetoothDevices.map((device) => {
          const state = bluetooth.find((d) => d.id === device.id)?.state;
          return (
            <View key={device.id} style={styles.row}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      state === 'connected' ? colors.success : state === 'connecting' ? colors.warning : colors.control,
                  },
                ]}
              />
              <Text style={[styles.label, styles.flex]}>{device.name}</Text>
              <Text style={styles.hint}>
                {state === 'connected' ? 'Connecté' : state === 'connecting' ? 'Connexion…' : 'Hors ligne'}
              </Text>
              <Button
                icon="trash"
                label="Oublier"
                variant="danger"
                onPress={() =>
                  setSetting(
                    'bluetoothDevices',
                    settings.bluetoothDevices.filter((d) => d.id !== device.id),
                  )
                }
              />
            </View>
          );
        })}
      </Section>

      <Section title="Concert">
        <View style={styles.row}>
          <Text style={styles.label}>Nom</Text>
          <TextInput
            value={concert.name}
            onChangeText={renameConcert}
            style={[styles.input, styles.flex]}
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <Text style={styles.hint}>
          L’export contient les patches, les layers, les réglages des plugins et les contrôles MIDI. Les plugins AUv3
          doivent être installés sur l’appareil qui importe.
        </Text>
        <View style={styles.row}>
          <Button
            icon="square.and.arrow.up"
            label="Exporter…"
            variant="primary"
            onPress={() => exportConcert(concert).catch(console.warn)}
          />
          <Button icon="square.and.arrow.down" label="Importer…" onPress={importConcert} />
        </View>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Toggle(props: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text style={styles.label}>{props.label}</Text>
        <Text style={styles.hint}>{props.hint}</Text>
      </View>
      <Switch value={props.value} onValueChange={props.onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 20, paddingBottom: 60 },
  section: { gap: 8 },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: { backgroundColor: colors.panel, borderRadius: 12, padding: 14, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  label: { color: colors.textDim, fontSize: 15 },
  value: { color: colors.text, fontVariant: ['tabular-nums'], minWidth: 130, textAlign: 'right' },
  hint: { color: colors.textMuted, fontSize: 13 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  input: { color: colors.text, fontSize: 16, backgroundColor: colors.control, borderRadius: 8, padding: 10 },
});
