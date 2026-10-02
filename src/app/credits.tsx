import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LIBRARY } from '../model/library';
import { colors } from '../theme';

const CREDITS = [
  {
    name: 'GeneralUser GS',
    author: 'S. Christian Collins',
    license: 'GeneralUser GS License v2.0 — libre d’utilisation, y compris dans des logiciels',
    url: 'https://www.schristiancollins.com/generaluser.php',
  },
  {
    name: 'Upright Piano KW',
    author: 'FreePats project (Gonzalo & Roberto)',
    license: 'CC0 1.0 — domaine public',
    url: 'https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html',
  },
  // Downloadable banks (bibliothèque de sons), converted to SF2 and hosted on github.com/aspitrine/livekeys-sounds.
  ...LIBRARY.map((b) => ({ name: b.name, author: b.author, license: b.license, url: b.source })),
];

export default function CreditsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.intro}>LiveKeys utilise ces banques de sons libres. Merci à leurs auteurs.</Text>
      {CREDITS.map((c) => (
        <View key={c.name} style={styles.card}>
          <Text style={styles.name}>{c.name}</Text>
          <Text style={styles.text}>{c.author}</Text>
          <Text style={styles.text}>{c.license}</Text>
          <Text style={styles.link} onPress={() => Linking.openURL(c.url)}>
            {c.url}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16 },
  intro: { color: colors.textDim, fontSize: 15 },
  card: { backgroundColor: colors.panel, borderRadius: 12, padding: 16, gap: 4 },
  name: { color: colors.text, fontSize: 18, fontWeight: '600' },
  text: { color: colors.textDim },
  link: { color: colors.accent },
});
