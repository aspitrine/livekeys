import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Animated,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { insertionIndex, spanAt, type Span } from '../lib/reorder';
import type { Patch, SetList } from '../model/types';
import { useConcert } from '../store/concert';
import { colors } from '../theme';
import { Button } from './Button';
import { DragHandle } from './DragHandle';
import { Icon } from './Icon';
import { PadPanel } from './PadPanel';

function prompt(title: string, defaultValue: string, onOk: (value: string) => void) {
  Alert.prompt(title, undefined, (value) => value?.trim() && onOk(value.trim()), 'plain-text', defaultValue);
}

type Drag = { kind: 'set' | 'patch'; id: string; setId: string; index: number };

/** Concert → sets → patches. Tap selects, long-press opens actions, « Réorganiser » enables drag and drop. */
export function SetlistSidebar() {
  const concert = useConcert((s) => s.concert);
  const currentPatchId = useConcert((s) => s.currentPatchId);
  const actions = useConcert();
  const [reordering, setReordering] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  // Layouts: sets relative to the list content, patches relative to their set.
  const setSpans = useRef(new Map<string, Span>()).current;
  const patchSpans = useRef(new Map<string, Span>()).current;

  const absolutePatches = (set: SetList): Span[] => {
    const top = setSpans.get(set.id)?.top ?? 0;
    return set.patches.flatMap((p) => {
      const span = patchSpans.get(p.id);
      return span ? [{ ...span, top: top + span.top }] : [];
    });
  };
  const orderedSets = () => concert.sets.flatMap((set) => setSpans.get(set.id) ?? []);

  /** Where the dragged item would land with its middle moved by `dy`. */
  const target = (kind: Drag['kind'], id: string, dy: number): Drag | null => {
    if (kind === 'set') {
      const span = setSpans.get(id);
      return span
        ? { kind, id, setId: id, index: insertionIndex(orderedSets(), span.top + span.height / 2 + dy, id) }
        : null;
    }
    const source = concert.sets.find((set) => set.patches.some((p) => p.id === id));
    const span = source && absolutePatches(source).find((p) => p.id === id);
    if (!span) return null;
    const y = span.top + span.height / 2 + dy;
    const set = concert.sets.find((candidate) => candidate.id === spanAt(orderedSets(), y)?.id) ?? source;
    return { kind, id, setId: set.id, index: insertionIndex(absolutePatches(set), y, id) };
  };

  const dragHandlers = (kind: Drag['kind'], id: string) => ({
    onStart: () => {
      dragY.setValue(0);
      setDrag(target(kind, id, 0));
    },
    onMove: (dy: number) => {
      dragY.setValue(dy);
      const next = target(kind, id, dy);
      setDrag((current) =>
        current && next && current.setId === next.setId && current.index === next.index ? current : next,
      );
    },
    onEnd: (dy: number) => {
      const drop = target(kind, id, dy);
      if (drop?.kind === 'set') actions.placeSet(id, drop.index);
      if (drop?.kind === 'patch') actions.placePatch(id, drop.setId, drop.index);
      dragY.setValue(0);
      setDrag(null);
    },
  });

  const setMenu = (set: SetList) =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: set.name,
        options: ['Renommer', 'Monter le set', 'Descendre le set', 'Supprimer le set', 'Annuler'],
        destructiveButtonIndex: 3,
        cancelButtonIndex: 4,
        disabledButtonIndices: [
          ...(concert.sets[0]?.id === set.id ? [1] : []),
          ...(concert.sets.at(-1)?.id === set.id ? [2] : []),
        ],
      },
      (i) => {
        if (i === 0) prompt('Renommer le set', set.name, (name) => actions.renameSet(set.id, name));
        if (i === 1) actions.moveSet(set.id, -1);
        if (i === 2) actions.moveSet(set.id, 1);
        if (i === 3)
          Alert.alert(`Supprimer « ${set.name} » ?`, `${set.patches.length} patch(s) seront supprimés.`, [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Supprimer', style: 'destructive', onPress: () => actions.removeSet(set.id) },
          ]);
      },
    );

  const moveToSet = (patch: Patch, source: SetList) => {
    const destinations = concert.sets.filter((s) => s.id !== source.id);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Déplacer dans un set',
        options: [...destinations.map((s) => s.name), 'Annuler'],
        cancelButtonIndex: destinations.length,
      },
      (i) => {
        if (destinations[i]) actions.movePatchToSet(patch.id, destinations[i].id);
      },
    );
  };

  const patchMenu = (patch: Patch, set: SetList) =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: patch.name,
        options: [
          'Renommer',
          'Dupliquer',
          'Monter le patch',
          'Descendre le patch',
          'Déplacer dans un set',
          'Supprimer',
          'Annuler',
        ],
        destructiveButtonIndex: 5,
        cancelButtonIndex: 6,
        disabledButtonIndices: [
          ...(set.patches[0]?.id === patch.id ? [2] : []),
          ...(set.patches.at(-1)?.id === patch.id ? [3] : []),
          ...(concert.sets.length < 2 ? [4] : []),
        ],
      },
      (i) => {
        if (i === 0) prompt('Renommer le patch', patch.name, (name) => actions.renamePatch(patch.id, name));
        if (i === 1) actions.duplicatePatch(patch.id);
        if (i === 2) actions.movePatch(patch.id, -1);
        if (i === 3) actions.movePatch(patch.id, 1);
        if (i === 4) moveToSet(patch, set);
        if (i === 5) actions.removePatch(patch.id);
      },
    );

  // Absolute, so showing the drop position never moves the rows being measured.
  const dropBefore = <View pointerEvents="none" style={[styles.dropLine, styles.dropTop]} />;
  const dropAfter = <View pointerEvents="none" style={[styles.dropLine, styles.dropBottom]} />;

  return (
    <View style={styles.sidebar}>
      <Text style={styles.concert} numberOfLines={1}>
        {concert.name}
      </Text>
      {reordering && <Text style={styles.reorderHint}>Fais glisser les poignées ≡ pour changer l’ordre.</Text>}
      <ScrollView contentContainerStyle={styles.list} scrollEnabled={!drag}>
        {concert.sets.map((set) => {
          const setDragged = drag?.kind === 'set' && drag.id === set.id;
          const otherSets = concert.sets.filter((s) => s.id !== drag?.id);
          const setDropBefore = drag?.kind === 'set' && !setDragged && otherSets.indexOf(set) === drag.index;
          const setDropAfter =
            drag?.kind === 'set' && !setDragged && set === otherSets.at(-1) && drag.index === otherSets.length;
          const patchesWithoutDragged = set.patches.filter((p) => !(drag?.kind === 'patch' && p.id === drag.id));
          const patchTarget = drag?.kind === 'patch' && drag.setId === set.id ? drag.index : -1;
          return (
            <Animated.View
              key={set.id}
              testID={`set-box-${set.id}`}
              onLayout={(e: LayoutChangeEvent) => {
                const { y, height } = e.nativeEvent.layout;
                setSpans.set(set.id, { id: set.id, top: y, height });
              }}
              style={[
                styles.set,
                (setDragged || (drag?.kind === 'patch' && set.patches.some((p) => p.id === drag.id))) && styles.raised,
                setDragged && [styles.dragged, { transform: [{ translateY: dragY }] }],
              ]}
            >
              {setDropBefore && dropBefore}
              {/* Handles sit beside the rows, not inside: an accessible Pressable hides its children from VoiceOver. */}
              <View style={styles.handleRow}>
                {reordering && (
                  <DragHandle
                    label={`Déplacer le set ${set.name}`}
                    {...dragHandlers('set', set.id)}
                    onStep={(delta) => actions.moveSet(set.id, delta)}
                  />
                )}
                <Pressable
                  testID={`set-${set.id}`}
                  onLongPress={() => setMenu(set)}
                  style={[styles.setHeader, styles.flex]}
                >
                  <Text style={[styles.setName, styles.flex]}>{set.name}</Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() =>
                      prompt('Nouveau patch', `Patch ${set.patches.length + 1}`, (name) =>
                        actions.addPatch(set.id, name),
                      )
                    }
                  >
                    <Icon name="plus.circle.fill" size={20} color={colors.accent} />
                  </Pressable>
                </Pressable>
              </View>
              {set.patches.map((patch, index) => {
                const selected = patch.id === currentPatchId;
                const dragged = drag?.kind === 'patch' && drag.id === patch.id;
                return (
                  <Animated.View
                    key={patch.id}
                    testID={`patch-box-${patch.id}`}
                    onLayout={(e: LayoutChangeEvent) => {
                      const { y, height } = e.nativeEvent.layout;
                      patchSpans.set(patch.id, { id: patch.id, top: y, height });
                    }}
                    style={dragged && [styles.dragged, { transform: [{ translateY: dragY }] }]}
                  >
                    {!dragged && patchesWithoutDragged.indexOf(patch) === patchTarget && dropBefore}
                    <View style={[styles.handleRow, styles.patchRow, selected && styles.patchSelected]}>
                      {reordering && (
                        <DragHandle
                          label={`Déplacer le patch ${patch.name}`}
                          {...dragHandlers('patch', patch.id)}
                          onStep={(delta) => actions.movePatch(patch.id, delta)}
                        />
                      )}
                      <Pressable
                        testID={`patch-${patch.id}`}
                        onPress={() => actions.selectPatch(patch.id)}
                        onLongPress={() => patchMenu(patch, set)}
                        style={[styles.patch, styles.flex]}
                      >
                        <Text style={[styles.patchIndex, selected && styles.patchIndexSelected]}>{index + 1}</Text>
                        <Text style={[styles.patchName, selected && styles.patchNameSelected]} numberOfLines={1}>
                          {patch.name}
                        </Text>
                      </Pressable>
                    </View>
                  </Animated.View>
                );
              })}
              {(setDropAfter || patchTarget === patchesWithoutDragged.length) && dropAfter}
            </Animated.View>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          icon="plus"
          label="Set"
          onPress={() => prompt('Nouveau set', `Set ${concert.sets.length + 1}`, actions.addSet)}
          style={styles.flex}
        />
        <Button
          icon={reordering ? 'checkmark' : 'arrow.up.arrow.down'}
          label={reordering ? 'Terminé' : undefined}
          accessibilityLabel={reordering ? 'Terminer la réorganisation' : 'Réorganiser les sets et patches'}
          variant={reordering ? 'primary' : 'subtle'}
          onPress={() => setReordering((on) => !on)}
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
  reorderHint: { color: colors.textMuted, fontSize: 12, paddingHorizontal: 16, paddingBottom: 6 },
  dropLine: { position: 'absolute', left: 4, right: 4, height: 3, borderRadius: 2, backgroundColor: colors.accent },
  dropTop: { top: -2 },
  dropBottom: { bottom: -2 },
  raised: { zIndex: 10 },
  dragged: { zIndex: 10, opacity: 0.85, backgroundColor: colors.panelRaised, borderRadius: 8 },
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
  handleRow: { flexDirection: 'row', alignItems: 'center' },
  patchRow: { borderRadius: 8 },
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
