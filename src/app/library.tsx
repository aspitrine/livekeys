import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { cancelDownload, deleteBank, downloadBank, useLibrary } from '../engine/library';
import { formatSize, LIBRARY, type LibraryBank } from '../model/library';
import { colors } from '../theme';

/** Downloadable reference sounds: heavy banks stay out of the app until the user wants them. */
export default function LibraryScreen() {
  const status = useLibrary();
  const categories = [...new Set(LIBRARY.map((b) => b.category))];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Sons de référence à télécharger. Ils sont stockés sur l’iPad et apparaissent ensuite dans le choix des sons de
        chaque layer. Les sons lourds utilisent plus de mémoire : évite d’en empiler beaucoup dans un même patch.
      </Text>
      {categories.map((category) => (
        <View key={category} style={styles.section}>
          <Text style={styles.sectionTitle}>{category}</Text>
          {LIBRARY.filter((b) => b.category === category).map((bank) => (
            <BankCard key={bank.id} bank={bank} status={status[bank.id]} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function BankCard({ bank, status }: { bank: LibraryBank; status: ReturnType<typeof useLibrary.getState>[string] }) {
  const confirmDelete = () =>
    Alert.alert(
      `Supprimer « ${bank.name} » ?`,
      'Les layers qui l’utilisent resteront muets jusqu’au prochain téléchargement.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => deleteBank(bank.id) },
      ],
    );

  return (
    <View style={styles.card}>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{bank.name}</Text>
          {status.state === 'installed' && <Icon name="checkmark.circle.fill" size={16} color={colors.success} />}
        </View>
        <Text style={styles.description}>{bank.description}</Text>
        <Text style={styles.meta} onPress={() => Linking.openURL(bank.source)}>
          {formatSize(bank.size)} · {bank.author} · {bank.license}
        </Text>
        {status.state === 'downloading' && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(status.progress * 100)}%` }]} />
          </View>
        )}
        {status.state === 'error' && <Text style={styles.error}>{status.message}</Text>}
      </View>

      {status.state === 'installed' ? (
        <Button icon="trash" label="Supprimer" variant="subtle" onPress={confirmDelete} />
      ) : status.state === 'downloading' ? (
        <View style={styles.downloading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.percent}>{Math.round(status.progress * 100)} %</Text>
          <Button icon="xmark" variant="subtle" accessibilityLabel="Annuler" onPress={() => cancelDownload(bank.id)} />
        </View>
      ) : (
        <Button
          icon="arrow.down.circle.fill"
          label={status.state === 'error' ? 'Réessayer' : 'Télécharger'}
          variant="primary"
          onPress={() => downloadBank(bank)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 20, paddingBottom: 60 },
  intro: { color: colors.textDim, fontSize: 15 },
  section: { gap: 8 },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.panel,
    borderRadius: 12,
    padding: 16,
  },
  info: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: colors.text, fontSize: 17, fontWeight: '600' },
  description: { color: colors.textDim },
  meta: { color: colors.textMuted, fontSize: 13 },
  error: { color: colors.danger, fontSize: 13 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.control, overflow: 'hidden', marginTop: 6 },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  downloading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  percent: { color: colors.textDim, fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'right' },
});
