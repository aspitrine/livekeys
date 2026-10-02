import { router } from 'expo-router';
import { ActionSheetIOS, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Patch, SetList } from '../model/types';
import { useConcert } from '../store/concert';
import { colors } from '../theme';
import { Button } from './Button';
import { Icon } from './Icon';
import { PadPanel } from './PadPanel';

function prompt(title: string, defaultValue: string, onOk: (value: string) => void) {
  Alert.prompt(title, undefined, (value) => value?.trim() && onOk(value.trim()), 'plain-text', defaultValue);
}

/** Concert → sets → patches. Tap selects, long-press opens actions. */
export function SetlistSidebar() {
  const concert = useConcert((s) => s.concert);
  const currentPatchId = useConcert((s) => s.currentPatchId);
  const actions = useConcert();

  const setMenu = (set: SetList) =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: set.name,
        options: ['Renommer', 'Supprimer le set', 'Annuler'],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
      },
      (i) => {
        if (i === 0) prompt('Renommer le set', set.name, (name) => actions.renameSet(set.id, name));
        if (i === 1)
          Alert.alert(`Supprimer « ${set.name} » ?`, `${set.patches.length} patch(s) seront supprimés.`, [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Supprimer', style: 'destructive', onPress: () => actions.removeSet(set.id) },
          ]);
      },
    );

  const patchMenu = (patch: Patch) =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: patch.name,
        options: ['Renommer', 'Dupliquer', 'Supprimer', 'Annuler'],
        destructiveButtonIndex: 2,
        cancelButtonIndex: 3,
      },
      (i) => {
        if (i === 0) prompt('Renommer le patch', patch.name, (name) => actions.renamePatch(patch.id, name));
        if (i === 1) actions.duplicatePatch(patch.id);
        if (i === 2) actions.removePatch(patch.id);
      },
    );

  return (
    <View style={styles.sidebar}>
      <Text style={styles.concert}>{concert.name}</Text>
      <ScrollView contentContainerStyle={styles.list}>
        {concert.sets.map((set) => (
          <View key={set.id} style={styles.set}>
            <Pressable onLongPress={() => setMenu(set)} style={styles.setHeader}>
              <Text style={styles.setName}>{set.name}</Text>
              <Pressable
                hitSlop={8}
                onPress={() =>
                  prompt('Nouveau patch', `Patch ${set.patches.length + 1}`, (name) => actions.addPatch(set.id, name))
                }
              >
                <Icon name="plus.circle.fill" size={20} color={colors.accent} />
              </Pressable>
            </Pressable>
            {set.patches.map((patch, index) => {
              const selected = patch.id === currentPatchId;
              return (
                <Pressable
                  key={patch.id}
                  onPress={() => actions.selectPatch(patch.id)}
                  onLongPress={() => patchMenu(patch)}
                  style={[styles.patch, selected && styles.patchSelected]}
                >
                  <Text style={[styles.patchIndex, selected && styles.patchIndexSelected]}>{index + 1}</Text>
                  <Text style={[styles.patchName, selected && styles.patchNameSelected]} numberOfLines={1}>
                    {patch.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          icon="plus"
          label="Set"
          onPress={() => prompt('Nouveau set', `Set ${concert.sets.length + 1}`, actions.addSet)}
          style={styles.flex}
        />
        <Button
          icon="info.circle"
          variant="ghost"
          accessibilityLabel="Crédits"
          onPress={() => router.push('/credits')}
        />
      </View>
      <PadPanel />
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 250,
    backgroundColor: colors.panel,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  concert: { color: colors.text, fontSize: 20, fontWeight: '700', padding: 16, paddingBottom: 8 },
  list: { paddingHorizontal: 8, paddingBottom: 16, gap: 12 },
  set: { gap: 2 },
  setHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  setName: { color: colors.textMuted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  add: { color: colors.accent, fontSize: 18 },
  patch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
  },
  patchSelected: { backgroundColor: colors.accent },
  patchIndex: { color: colors.textMuted, width: 20, textAlign: 'right', fontVariant: ['tabular-nums'] },
  patchIndexSelected: { color: 'rgba(255,255,255,0.75)' },
  patchName: { color: colors.textDim, fontSize: 16, flex: 1 },
  patchNameSelected: { color: colors.text, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  flex: { flex: 1 },
});
