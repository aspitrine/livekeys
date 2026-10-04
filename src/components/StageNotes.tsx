import { ScrollView, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

export function StageNotes({ notes }: { notes?: string }) {
  return notes?.trim() ? (
    <ScrollView style={styles.box} contentContainerStyle={styles.content}>
      <Text style={styles.notes}>{notes}</Text>
    </ScrollView>
  ) : null;
}
const styles = StyleSheet.create({
  box: { maxHeight: 180, flexGrow: 0, alignSelf: 'stretch' },
  content: { alignItems: 'center', padding: 12 },
  notes: { color: colors.textDim, fontSize: 24, lineHeight: 32, textAlign: 'center' },
});
