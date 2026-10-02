import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { useEngineStatus } from '../engine/boot';
import { LOAD_COLORS, loadLevel, usePerformance } from '../engine/performance';
import { instrumentName } from '../model/defaults';
import { selectCurrentPatch, useConcert } from '../store/concert';
import { colors } from '../theme';

const colorFor = (percent: number) => LOAD_COLORS[loadLevel(percent)];

/** Live load of the audio engine: whole graph, per layer of the current patch, CPU and memory. */
export default function PerformanceScreen() {
  const { current, history, overloads, resetOverloads } = usePerformance();
  const info = useEngineStatus((s) => s.info);
  const patch = useConcert(selectCurrentPatch);

  const load = current?.load ?? 0;
  const peak = current?.peak ?? 0;
  const layerLoad = new Map(current?.layers.map((l) => [l.id, l]) ?? []);
  const usedMB = current?.memoryMB ?? 0;
  const availableMB = current?.availableMemoryMB ?? 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.cards}>
        <Card title="Charge audio (DSP)" icon="cpu">
          <Text style={[styles.big, { color: colorFor(load) }]}>{Math.round(load)} %</Text>
          <Text style={styles.hint}>
            Pic : <Text style={{ color: colorFor(peak) }}>{Math.round(peak)} %</Text> · au-delà de 100 % le son craque
          </Text>
          <Bar percent={load} color={colorFor(load)} marker={peak} />
        </Card>

        <Card title="Craquements" icon="exclamationmark.triangle.fill">
          <Text style={[styles.big, { color: overloads ? colors.danger : colors.success }]}>{overloads}</Text>
          <Text style={styles.hint}>Cycles audio trop lents depuis le lancement.</Text>
          <Button
            icon="arrow.counterclockwise"
            label="Remettre à zéro"
            size="sm"
            variant="subtle"
            onPress={resetOverloads}
          />
        </Card>

        <Card title="Mémoire" icon="memorychip">
          <Text style={styles.big}>{Math.round(usedMB)} Mo</Text>
          {availableMB > 0 ? (
            <>
              <Text style={styles.hint}>Encore {formatMB(availableMB)} disponibles avant qu’iOS ne ferme l’app.</Text>
              <Bar
                percent={(usedMB / (usedMB + availableMB)) * 100}
                color={colorFor((usedMB / (usedMB + availableMB)) * 100)}
              />
            </>
          ) : (
            <Text style={styles.hint}>Limite non mesurable ici (simulateur).</Text>
          )}
        </Card>
      </View>

      <Card title="Dernière minute" icon="chart.xyaxis.line">
        <View style={styles.graph}>
          {Array.from({ length: 60 }, (_, i) => history[history.length - 60 + i]).map((value, i) => (
            <View key={i} style={styles.graphSlot}>
              {value !== undefined && (
                <View
                  style={[
                    styles.graphBar,
                    { height: `${Math.min(Math.max(value, 2), 100)}%`, backgroundColor: colorFor(value) },
                  ]}
                />
              )}
            </View>
          ))}
        </View>
        <Text style={styles.hint}>
          Ajoute un effet ou un plugin et regarde la courbe : si elle dépasse régulièrement 75 %, allège le patch.
        </Text>
      </Card>

      <Card title={`Layers du patch « ${patch?.name ?? '—'} »`} icon="square.stack.3d.up.fill">
        {(patch?.layers ?? []).map((layer) => {
          const l = layerLoad.get(layer.id);
          const value = l?.load ?? 0;
          return (
            <View key={layer.id} style={styles.layerRow}>
              <View style={[styles.swatch, { backgroundColor: layer.color }]} />
              <View style={styles.layerName}>
                <Text style={styles.name} numberOfLines={1}>
                  {layer.name}
                </Text>
                <Text style={styles.hint} numberOfLines={1}>
                  {instrumentName(layer)}
                  {layer.effects.length > 0 && ` + ${layer.effects.length} effet${layer.effects.length > 1 ? 's' : ''}`}
                </Text>
              </View>
              <View style={styles.flex}>
                <Bar percent={value} color={colorFor(value)} marker={l?.peak} />
              </View>
              <Text style={[styles.percent, { color: colorFor(value) }]}>{l ? `${value.toFixed(1)} %` : '—'}</Text>
            </View>
          );
        })}
        <Text style={styles.hint}>
          Part du temps audio prise par chaque layer (instrument + ses effets). Les plugins AUv3 et les réverbes sont
          souvent les plus gourmands.
        </Text>
      </Card>

      <Card title="Système" icon="ipad">
        <Row label="CPU de l’app" value={`${Math.round(current?.cpu ?? 0)} % de l’iPad`} />
        <Row
          label="Buffer audio"
          value={
            info
              ? `${info.bufferFrames} échantillons · ${info.ioBufferMs.toFixed(1)} ms à ${info.sampleRate / 1000} kHz`
              : '—'
          }
        />
        <Row label="Sortie" value={info?.outputRoute ?? '—'} />
      </Card>
    </ScrollView>
  );
}

const formatMB = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} Go` : `${Math.round(mb)} Mo`);

function Card(props: { title: string; icon: Parameters<typeof Icon>[0]['name']; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTitle}>
        <Icon name={props.icon} size={14} color={colors.textMuted} />
        <Text style={styles.cardTitleText}>{props.title}</Text>
      </View>
      {props.children}
    </View>
  );
}

function Bar({ percent, color, marker }: { percent: number; color: string; marker?: number }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.min(percent, 100)}%`, backgroundColor: color }]} />
      {marker !== undefined && marker > percent && (
        <View style={[styles.marker, { left: `${Math.min(marker, 100)}%`, backgroundColor: color }]} />
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 60 },
  cards: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  card: { flex: 1, minWidth: 260, backgroundColor: colors.panel, borderRadius: 14, padding: 16, gap: 10 },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitleText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  big: { color: colors.text, fontSize: 40, fontWeight: '800', fontVariant: ['tabular-nums'] },
  hint: { color: colors.textMuted, fontSize: 13 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.control, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  marker: { position: 'absolute', top: 0, bottom: 0, width: 3, marginLeft: -1.5, opacity: 0.8 },
  graph: { height: 110, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  graphSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  graphBar: { borderRadius: 2 },
  layerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  swatch: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  layerName: { width: 220 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  flex: { flex: 1 },
  percent: { width: 70, textAlign: 'right', fontVariant: ['tabular-nums'], fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { color: colors.textDim },
  rowValue: { color: colors.text, fontVariant: ['tabular-nums'] },
});
