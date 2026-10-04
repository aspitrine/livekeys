import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import AudioEngine from '../../modules/audio-engine';
import { useEngineStatus } from '../engine/boot';
import { isBankInstalled } from '../engine/catalog';
import { useLayerErrors } from '../engine/sync';
import { checkConcert } from '../lib/concertCheck';
import { useConcert } from '../store/concert';
import { colors } from '../theme';
import { Button } from './Button';
import { Icon } from './Icon';

type Scan = { state: 'running' } | { state: 'done'; plugins: ReadonlySet<string> | null };

/** Pre-show check: missing resources, live connections and the errors the engine reported. */
export function ConcertCheck() {
  const concert = useConcert((s) => s.concert);
  const currentPatchId = useConcert((s) => s.currentPatchId);
  const remembered = useConcert((s) => s.settings.bluetoothDevices);
  const layerErrors = useLayerErrors();
  // Field selectors: the store also changes on every MIDI event (`lastEvent`).
  const info = useEngineStatus((s) => s.info);
  const error = useEngineStatus((s) => s.error);
  const sources = useEngineStatus((s) => s.sources);
  const bluetooth = useEngineStatus((s) => s.bluetooth);
  const [scan, setScan] = useState<Scan>({ state: 'running' });
  /** Only the latest scan may report, and none after unmount. */
  const generation = useRef(0);

  const run = useCallback(() => {
    const request = ++generation.current;
    setScan({ state: 'running' });
    try {
      AudioEngine.refreshMidi();
      useEngineStatus.setState({ sources: AudioEngine.getMidiSources() });
    } catch (e) {
      console.warn('[concert check] MIDI refresh', e);
    }
    AudioEngine.listPlugins('all')
      .then((list) => new Set(list.map((p) => p.id)))
      .catch(() => null)
      .then((plugins) => request === generation.current && setScan({ state: 'done', plugins }));
  }, []);
  useEffect(() => {
    run();
    return () => {
      generation.current += 1;
    };
  }, [run]);

  const issues = useMemo(
    () =>
      scan.state === 'done'
        ? checkConcert(concert, { installedPlugins: scan.plugins, isBankInstalled, layerErrors })
        : [],
    [concert, layerErrors, scan],
  );
  const errors = issues.filter((i) => i.level === 'error').length;
  const warnings = issues.length - errors;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <Text style={[styles.summary, styles.flex]}>
          {scan.state === 'running'
            ? 'Vérification…'
            : issues.length
              ? `${errors} erreur${errors > 1 ? 's' : ''} · ${warnings} avertissement${warnings > 1 ? 's' : ''}`
              : 'Aucun problème détecté'}
        </Text>
        <Button icon="arrow.clockwise" label="Relancer" disabled={scan.state === 'running'} onPress={run} />
      </View>
      <Text style={styles.hint}>
        Cette vérification repère les ressources manquantes et les erreurs connues. Elle ne garantit pas la stabilité
        audio : joue le concert en entier sur l’iPad, avec les plugins et le clavier de la scène.
      </Text>

      <Section title="Ressources et patches">
        {scan.state === 'done' && scan.plugins === null && (
          <Line level="warning" text="Liste des plugins indisponible : les AUv3 manquants ne sont pas vérifiés." />
        )}
        {scan.state === 'done' && !issues.length && <Line level="ok" text="Sons, plugins et contrôles MIDI trouvés." />}
        {issues.map((issue, i) => (
          <View key={i} style={styles.row}>
            <Line level={issue.level} text={issue.message} />
            {issue.patchId && (
              <Button
                label={issue.patchId === currentPatchId ? 'Sélectionné' : 'Sélectionner'}
                size="sm"
                variant="subtle"
                disabled={issue.patchId === currentPatchId}
                onPress={() => useConcert.getState().selectPatch(issue.patchId!)}
              />
            )}
          </View>
        ))}
      </Section>

      <Section title="Connexions">
        <Line
          level={error ? 'error' : info?.running ? 'ok' : 'warning'}
          text={
            error
              ? `Moteur audio arrêté : ${error}`
              : info?.running
                ? `Moteur audio actif · sortie ${info.outputRoute} · ${info.sampleRate / 1000} kHz, ${info.bufferFrames} échantillons`
                : 'Moteur audio non démarré.'
          }
        />
        {sources.length ? (
          sources.map((s) => <Line key={s.id} level="ok" text={`Entrée MIDI : ${s.name}`} />)
        ) : (
          <Line level="warning" text="Aucune entrée MIDI : branche ou connecte le clavier." />
        )}
        {remembered.map((device) => {
          const state = bluetooth.find((d) => d.id === device.id)?.state ?? 'disconnected';
          return (
            <Line
              key={device.id}
              level={state === 'connected' ? 'ok' : 'warning'}
              text={`Bluetooth ${device.name} : ${state === 'connected' ? 'connecté' : state === 'connecting' ? 'connexion…' : 'hors ligne'}`}
            />
          );
        })}
      </Section>
    </ScrollView>
  );
}

const LEVELS = {
  ok: { icon: 'checkmark.circle.fill', color: colors.success, label: 'OK' },
  warning: { icon: 'exclamationmark.triangle.fill', color: colors.warning, label: 'Attention' },
  error: { icon: 'xmark.octagon.fill', color: colors.danger, label: 'Erreur' },
} as const;

function Line({ level, text }: { level: keyof typeof LEVELS; text: string }) {
  const l = LEVELS[level];
  return (
    <View style={[styles.row, styles.flex]} accessible accessibilityLabel={`${l.label} : ${text}`}>
      <Icon name={l.icon} size={16} color={l.color} />
      <Text style={[styles.text, styles.flex]}>{text}</Text>
    </View>
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

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 60 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  summary: { color: colors.text, fontSize: 22, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 13 },
  section: { gap: 8 },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: { backgroundColor: colors.panel, borderRadius: 12, padding: 14, gap: 12 },
  text: { color: colors.textDim, fontSize: 15 },
});
