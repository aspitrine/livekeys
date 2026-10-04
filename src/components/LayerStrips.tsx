import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { insertionIndex, type Span } from '../lib/reorder';
import type { Patch } from '../model/types';
import { mixerLayers, useConcert } from '../store/concert';
import { colors } from '../theme';
import { Button } from './Button';
import { DragHandle } from './DragHandle';
import { Icon } from './Icon';
import { LayerStrip } from './LayerStrip';

/** Mixer strips of the patch, « Ajouter un layer », and a mode to reorder the strips by drag and drop. */
export function LayerStrips({ patch }: { patch: Patch }) {
  const addLayer = useConcert((s) => s.addLayer);
  const placeLayer = useConcert((s) => s.placeLayer);
  const moveLayer = useConcert((s) => s.moveLayer);
  const [reordering, setReordering] = useState(false);
  const [drag, setDrag] = useState<{ id: string; index: number } | null>(null);
  const dragX = useRef(new Animated.Value(0)).current;
  // Strip positions in the scroll content; updated by layout, read during a drag.
  const spans = useRef(new Map<string, Span>()).current;

  // Like Logic: every strip shows as many FX rows as the busiest one, plus one empty slot.
  // The chord pad lives in the sidebar panel, not among the strips.
  const strips = mixerLayers(patch);
  const fxRows = Math.max(0, ...strips.map((l) => l.effects.length)) + 1;

  const target = (id: string, dx: number) => {
    const span = spans.get(id);
    const ordered = strips.flatMap((l) => spans.get(l.id) ?? []);
    return span ? { id, index: insertionIndex(ordered, span.top + span.height / 2 + dx, id) } : null;
  };
  const others = strips.filter((l) => l.id !== drag?.id);

  const onAddLayer = () => {
    const layerId = addLayer(patch.id);
    router.push({ pathname: '/sound/[layerId]', params: { layerId } });
  };

  return (
    <ScrollView horizontal contentContainerStyle={styles.strips} style={styles.scroll} scrollEnabled={!drag}>
      {strips.map((layer) => {
        const dragged = drag?.id === layer.id;
        return (
          <Animated.View
            key={layer.id}
            testID={`strip-box-${layer.id}`}
            onLayout={(e: LayoutChangeEvent) => {
              const { x, width } = e.nativeEvent.layout;
              spans.set(layer.id, { id: layer.id, top: x, height: width });
            }}
            style={dragged && [styles.dragged, { transform: [{ translateX: dragX }] }]}
          >
            {drag && !dragged && others.indexOf(layer) === drag.index && (
              <View pointerEvents="none" style={[styles.dropLine, styles.dropBefore]} />
            )}
            {drag && !dragged && layer === others.at(-1) && drag.index === others.length && (
              <View pointerEvents="none" style={[styles.dropLine, styles.dropAfter]} />
            )}
            <LayerStrip
              layer={layer}
              fxRows={fxRows}
              handle={
                reordering ? (
                  <DragHandle
                    axis="x"
                    label={`Déplacer le layer ${layer.name}`}
                    style={styles.handle}
                    onStart={() => {
                      dragX.setValue(0);
                      setDrag(target(layer.id, 0));
                    }}
                    onMove={(dx) => {
                      dragX.setValue(dx);
                      const next = target(layer.id, dx);
                      setDrag((current) => (current && next && current.index === next.index ? current : next));
                    }}
                    onEnd={(dx) => {
                      const drop = target(layer.id, dx);
                      if (drop) placeLayer(layer.id, drop.index);
                      dragX.setValue(0);
                      setDrag(null);
                    }}
                    onStep={(delta) => moveLayer(layer.id, delta)}
                  />
                ) : undefined
              }
            />
          </Animated.View>
        );
      })}
      <View style={styles.side}>
        <Pressable style={styles.addLayer} onPress={onAddLayer}>
          <Icon name="plus.circle.fill" size={36} color={colors.accent} />
          <Text style={styles.addLayerText}>Ajouter un layer</Text>
        </Pressable>
        {strips.length > 1 && (
          <Button
            icon={reordering ? 'checkmark' : 'arrow.left.arrow.right'}
            label={reordering ? 'Terminé' : 'Réorganiser'}
            accessibilityLabel={reordering ? 'Terminer la réorganisation des layers' : 'Réorganiser les layers'}
            variant={reordering ? 'primary' : 'subtle'}
            onPress={() => setReordering((on) => !on)}
          />
        )}
        {reordering && <Text style={styles.hint}>Fais glisser la poignée ⇆ en haut d’un layer.</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  strips: { gap: 12, alignItems: 'stretch' },
  side: { width: 132, gap: 8 },
  addLayer: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addLayerText: { color: colors.textMuted, textAlign: 'center' },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  handle: { alignSelf: 'stretch', borderRadius: 6, backgroundColor: colors.control },
  dragged: { zIndex: 10, opacity: 0.85 },
  dropLine: { position: 'absolute', top: 4, bottom: 4, width: 3, borderRadius: 2, backgroundColor: colors.accent },
  dropBefore: { left: -8 },
  dropAfter: { right: -8 },
});
