import { type ErrorBoundaryProps, router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import { Button } from './Button';
import { Icon } from './Icon';

/**
 * Shown instead of a screen that crashed while rendering. Exported as `ErrorBoundary` by every route, so a bug
 * in one modal leaves the rest of the app usable; the native engine keeps playing either way.
 */
export function ScreenError({ error, retry }: ErrorBoundaryProps) {
  const canClose = canGoBack();
  useEffect(() => {
    console.error('[screen]', error);
  }, [error]);

  return (
    <View style={styles.container} accessibilityRole="alert">
      <Icon name="exclamationmark.triangle.fill" size={36} color={colors.warning} />
      <Text style={styles.title}>Cet écran a rencontré un problème</Text>
      <Text style={styles.hint}>Le son continue. Réessaie, ou ferme l’écran pour revenir au concert.</Text>
      <Text style={styles.detail} numberOfLines={3}>
        {error.message}
      </Text>
      <View style={styles.actions}>
        <Button icon="arrow.clockwise" label="Réessayer" variant="primary" onPress={retry} />
        {canClose && <Button icon="xmark" label="Fermer" onPress={() => router.back()} />}
      </View>
    </View>
  );
}

/** The root boundary renders outside the navigator, where there is nothing to go back to. */
function canGoBack() {
  try {
    return router.canGoBack();
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: colors.bg,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  hint: { color: colors.textDim, fontSize: 15, textAlign: 'center' },
  detail: { color: colors.textMuted, fontSize: 13, fontFamily: 'Menlo', textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
});
