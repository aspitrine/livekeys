import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BANK_LABELS, loadCatalog, soundKey } from '../engine/catalog';
import { downloadBank, useLibrary } from '../engine/library';
import { formatSize, LIBRARY, type LibraryBank } from '../model/library';
import { BANK_PLACES, CATEGORIES, type Place, placeKey, placeLabel, placeOf } from '../model/soundCategories';
import type { SoundRef } from '../model/types';
import { colors } from '../theme';
import { Button } from './Button';
import { Icon } from './Icon';

type Props = {
  /** Sound currently on the layer (null when the layer plays a plugin). */
  selected: SoundRef | null;
  query: string;
  onChoose: (sound: SoundRef) => void;
};

type Row = { kind: 'sound'; sound: SoundRef; reference: boolean } | { kind: 'download'; bank: LibraryBank };

const isReference = (s: SoundRef) => s.bank in BANK_PLACES;

/** Three columns like Logic's library: category → subcategory → sounds. Search flattens the tree. */
export function SoundBrowser({ selected, query, onChoose }: Props) {
  const library = useLibrary();
  const [catalog, setCatalog] = useState<SoundRef[] | null>(null);

  // Reload when a bank is downloaded or deleted.
  useEffect(() => {
    loadCatalog().then(setCatalog).catch(console.warn);
  }, [library]);

  const initial = (selected && placeOf(selected)) ?? { category: 'pianos', subcategory: 'grand' };
  const [place, setPlace] = useState<Place>(initial);

  /** Sounds grouped by "category/subcategory", reference banks first. */
  const grouped = useMemo(() => {
    const map = new Map<string, SoundRef[]>();
    for (const sound of catalog ?? []) {
      const p = placeOf(sound);
      if (!p) continue;
      const key = placeKey(p);
      map.set(key, [...(map.get(key) ?? []), sound]);
    }
    for (const list of map.values()) list.sort((a, b) => Number(isReference(b)) - Number(isReference(a)));
    return map;
  }, [catalog]);

  if (!catalog) return <ActivityIndicator color={colors.accent} style={styles.loading} />;

  const selectedKey = selected ? soundKey(selected) : null;
  const q = query.trim().toLowerCase();

  if (q) {
    const results = catalog.filter(
      (s) => s.name.toLowerCase().includes(q) || (BANK_LABELS[s.bank] ?? '').toLowerCase().includes(q),
    );
    return (
      <FlatList
        style={styles.flex}
        data={results}
        keyExtractor={soundKey}
        renderItem={({ item }) => (
          <SoundRow
            sound={item}
            reference={isReference(item)}
            active={soundKey(item) === selectedKey}
            subtitle={placeOf(item) ? placeLabel(placeOf(item)!) : ''}
            onPress={() => onChoose(item)}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucun son trouvé.</Text>}
      />
    );
  }

  const category = CATEGORIES.find((c) => c.id === place.category) ?? CATEGORIES[0];
  const count = (categoryId: string, subId?: string) =>
    [...grouped.entries()]
      .filter(([key]) => (subId ? key === `${categoryId}/${subId}` : key.startsWith(`${categoryId}/`)))
      .reduce((n, [, list]) => n + list.length, 0);

  // Reference banks for this subcategory that are not downloaded yet.
  const toDownload = LIBRARY.filter((b) => {
    const p = BANK_PLACES[b.id];
    return p && placeKey(p) === placeKey(place) && library[b.id]?.state !== 'installed';
  });
  const rows: Row[] = [
    ...(grouped.get(placeKey(place)) ?? []).map((sound): Row => ({
      kind: 'sound',
      sound,
      reference: isReference(sound),
    })),
    ...toDownload.map((bank): Row => ({ kind: 'download', bank })),
  ];
  const selectedPlace = selected ? placeOf(selected) : null;

  return (
    <View style={styles.columns}>
      <ScrollView style={styles.categories} contentContainerStyle={styles.columnContent}>
        {CATEGORIES.map((c) => {
          const active = c.id === category.id;
          const holdsSelection = selectedPlace?.category === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setPlace({ category: c.id, subcategory: c.subcategories[0].id })}
              style={[styles.item, active && styles.itemActive]}
            >
              <Icon name={c.icon} size={16} color={active ? colors.text : colors.textDim} />
              <Text style={[styles.itemText, active && styles.itemTextActive]} numberOfLines={1}>
                {c.name}
              </Text>
              {holdsSelection && <View style={styles.dot} />}
              <Text style={[styles.count, active && styles.countActive]}>{count(c.id)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView style={styles.subcategories} contentContainerStyle={styles.columnContent}>
        <Text style={styles.columnTitle}>{category.name}</Text>
        {category.subcategories.map((s) => {
          const active = s.id === place.subcategory;
          const holdsSelection = selectedPlace && placeKey(selectedPlace) === `${category.id}/${s.id}`;
          return (
            <Pressable
              key={s.id}
              onPress={() => setPlace({ category: category.id, subcategory: s.id })}
              style={[styles.item, active && styles.itemActive]}
            >
              <Text style={[styles.itemText, active && styles.itemTextActive]} numberOfLines={2}>
                {s.name}
              </Text>
              {holdsSelection && <View style={styles.dot} />}
              <Text style={[styles.count, active && styles.countActive]}>{count(category.id, s.id)}</Text>
              <Icon name="chevron.right" size={11} color={active ? colors.text : colors.textMuted} />
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        style={styles.sounds}
        contentContainerStyle={styles.columnContent}
        data={rows}
        keyExtractor={(r) => (r.kind === 'sound' ? soundKey(r.sound) : `dl-${r.bank.id}`)}
        renderItem={({ item }) =>
          item.kind === 'sound' ? (
            <SoundRow
              sound={item.sound}
              reference={item.reference}
              active={soundKey(item.sound) === selectedKey}
              subtitle={
                item.reference
                  ? BANK_LABELS[item.sound.bank]
                  : `GeneralUser GS${item.sound.bankNumber > 0 && item.sound.bankNumber < 128 ? ` · variation ${item.sound.bankNumber}` : ''}`
              }
              onPress={() => onChoose(item.sound)}
            />
          ) : (
            <DownloadRow bank={item.bank} status={library[item.bank.id]} />
          )
        }
        ListEmptyComponent={<Text style={styles.empty}>Aucun son dans cette catégorie.</Text>}
      />
    </View>
  );
}

function SoundRow(props: {
  sound: SoundRef;
  reference: boolean;
  active: boolean;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={props.onPress} style={[styles.sound, props.active && styles.itemActive]}>
      <View style={styles.flex}>
        <Text style={[styles.soundName, props.active && styles.itemTextActive]} numberOfLines={1}>
          {props.sound.name}
        </Text>
        <Text style={[styles.meta, props.active && styles.metaActive]} numberOfLines={1}>
          {props.subtitle}
        </Text>
      </View>
      {props.reference && (
        <View style={[styles.badge, props.active && styles.badgeActive]}>
          <Icon name="star.fill" size={9} color={props.active ? colors.text : colors.warning} />
          <Text style={[styles.badgeText, props.active && styles.itemTextActive]}>Référence</Text>
        </View>
      )}
      {props.active && <Icon name="speaker.wave.2.fill" size={14} />}
    </Pressable>
  );
}

function DownloadRow({ bank, status }: { bank: LibraryBank; status: ReturnType<typeof useLibrary.getState>[string] }) {
  const downloading = status?.state === 'downloading';
  return (
    <View style={[styles.sound, styles.download]}>
      <View style={styles.flex}>
        <Text style={styles.soundName} numberOfLines={1}>
          {bank.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {downloading
            ? `Téléchargement… ${Math.round(status.progress * 100)} %`
            : `À télécharger · ${formatSize(bank.size)}`}
        </Text>
      </View>
      {downloading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <Button
          icon="arrow.down.circle.fill"
          label={status?.state === 'error' ? 'Réessayer' : 'Télécharger'}
          size="sm"
          variant="primary"
          onPress={() => downloadBank(bank)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { marginTop: 40 },
  columns: { flex: 1, flexDirection: 'row', gap: 10 },
  columnContent: { padding: 6, gap: 2 },
  categories: { flexGrow: 0, width: 250, backgroundColor: colors.panel, borderRadius: 12 },
  subcategories: { flexGrow: 0, width: 270, backgroundColor: colors.panel, borderRadius: 12 },
  sounds: { flex: 1, backgroundColor: colors.panel, borderRadius: 12 },
  columnTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  itemActive: { backgroundColor: colors.accent },
  itemText: { flex: 1, color: colors.textDim, fontSize: 15 },
  itemTextActive: { color: colors.text, fontWeight: '600' },
  count: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  countActive: { color: 'rgba(255,255,255,0.8)' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  sound: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 12, borderRadius: 8 },
  soundName: { color: colors.textDim, fontSize: 16 },
  meta: { color: colors.textMuted, fontSize: 12 },
  metaActive: { color: 'rgba(255,255,255,0.8)' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(245,165,36,0.15)',
  },
  badgeActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  badgeText: { color: colors.warning, fontSize: 11, fontWeight: '700' },
  download: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, marginTop: 4 },
  empty: { color: colors.textMuted, padding: 16 },
});
