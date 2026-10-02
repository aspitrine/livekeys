import { router } from 'expo-router';
import { ActionSheetIOS, Pressable, StyleSheet, Text, View } from 'react-native';

import { instrumentName } from '../model/defaults';
import { instrumentIcon } from '../model/soundCategories';
import type { EffectDef, LayerDef } from '../model/types';
import { useConcert } from '../store/concert';
import { colors } from '../theme';
import { Icon } from './Icon';

export const SLOT_HEIGHT = 22;
const GAP = 2;

/** Height of `rows` slots, so every strip of a patch reserves the same room (faders stay aligned). */
export const slotsHeight = (rows: number) => rows * SLOT_HEIGHT + Math.max(rows - 1, 0) * GAP;

/**
 * Logic-style instrument slot. SoundFont: tap to change the sound.
 * Plugin: tap opens its interface (presets, sound design); long-press to change instrument.
 */
export function InstrumentSlot({ layer }: { layer: LayerDef }) {
  const browse = () => router.push({ pathname: '/sound/[layerId]', params: { layerId: layer.id } });
  const openPlugin = () =>
    router.push({ pathname: '/plugin/[layerId]', params: { layerId: layer.id, slot: 'instrument' } });
  const menu = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: instrumentName(layer),
        options: ['Ouvrir l’interface', 'Changer d’instrument', 'Annuler'],
        cancelButtonIndex: 2,
      },
      (i) => {
        if (i === 0) openPlugin();
        if (i === 1) browse();
      },
    );

  return (
    <Pressable
      onPress={layer.plugin ? openPlugin : browse}
      onLongPress={layer.plugin ? menu : browse}
      accessibilityLabel={`Instrument : ${instrumentName(layer)}`}
      style={({ pressed }) => [styles.slot, styles.instrument, pressed && styles.pressed]}
    >
      <Icon name={instrumentIcon(layer)} size={11} color={layer.color} />
      <Text style={styles.name} numberOfLines={1}>
        {instrumentName(layer)}
      </Text>
    </Pressable>
  );
}

/**
 * Logic-style Audio FX slots: one thin row per effect plus one empty row to add.
 * `rows` is the same for every strip of the patch so faders line up.
 * Tap opens the plugin, the power icon toggles bypass, long-press for more.
 */
export function EffectSlots({ layer, rows }: { layer: LayerDef; rows: number }) {
  const setEffectBypass = useConcert((s) => s.setEffectBypass);
  const removeEffect = useConcert((s) => s.removeEffect);
  const moveEffect = useConcert((s) => s.moveEffect);

  const open = (effect: EffectDef) =>
    router.push({ pathname: '/plugin/[layerId]', params: { layerId: layer.id, slot: effect.id } });

  const menu = (effect: EffectDef) =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: effect.plugin.name,
        message: 'L’ordre compte : le son traverse les effets de haut en bas.',
        options: [
          'Régler',
          effect.bypass ? 'Activer' : 'Désactiver',
          'Monter (avant dans la chaîne)',
          'Descendre (après dans la chaîne)',
          'Retirer',
          'Annuler',
        ],
        disabledButtonIndices: [
          ...(layer.effects[0]?.id === effect.id ? [2] : []),
          ...(layer.effects[layer.effects.length - 1]?.id === effect.id ? [3] : []),
        ],
        destructiveButtonIndex: 4,
        cancelButtonIndex: 5,
      },
      (i) => {
        if (i === 0) open(effect);
        if (i === 1) setEffectBypass(layer.id, effect.id, !effect.bypass);
        if (i === 2) moveEffect(layer.id, effect.id, -1);
        if (i === 3) moveEffect(layer.id, effect.id, 1);
        if (i === 4) removeEffect(layer.id, effect.id);
      },
    );

  return (
    <View style={[styles.slots, { height: slotsHeight(rows) }]}>
      {layer.effects.map((effect) => (
        <Pressable
          key={effect.id}
          onPress={() => open(effect)}
          onLongPress={() => menu(effect)}
          style={({ pressed }) => [
            styles.slot,
            styles.effect,
            effect.bypass && styles.bypassed,
            pressed && styles.pressed,
          ]}
        >
          <Pressable
            hitSlop={8}
            accessibilityLabel={effect.bypass ? 'Activer l’effet' : 'Désactiver l’effet'}
            onPress={() => setEffectBypass(layer.id, effect.id, !effect.bypass)}
          >
            <Icon name="power" size={10} color={effect.bypass ? colors.textMuted : colors.success} weight="bold" />
          </Pressable>
          <Text style={[styles.name, effect.bypass && styles.nameBypassed]} numberOfLines={1}>
            {shortName(effect.plugin.name)}
          </Text>
        </Pressable>
      ))}
      <Pressable
        onPress={() => router.push({ pathname: '/effect/[layerId]', params: { layerId: layer.id } })}
        accessibilityLabel="Ajouter un effet"
        style={({ pressed }) => [styles.slot, styles.empty, pressed && styles.pressed]}
      >
        <Icon name="plus" size={10} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

/** "AUReverb2" → "Reverb2": Apple's prefix only eats space in a narrow slot. */
const shortName = (name: string) => name.replace(/^AU(?=[A-Z])/, '');

const styles = StyleSheet.create({
  slots: { alignSelf: 'stretch', gap: GAP },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: SLOT_HEIGHT,
    paddingHorizontal: 6,
    borderRadius: 5,
    alignSelf: 'stretch',
  },
  instrument: { backgroundColor: colors.panelRaised },
  effect: { backgroundColor: '#1f3a5f' },
  empty: { backgroundColor: colors.panelRaised, justifyContent: 'center', opacity: 0.6 },
  bypassed: { backgroundColor: colors.panelRaised },
  pressed: { opacity: 0.6 },
  name: { flex: 1, color: colors.text, fontSize: 11, fontWeight: '600' },
  nameBypassed: { color: colors.textMuted },
});
