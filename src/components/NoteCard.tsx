import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Note } from '../types';

interface Props { note: Note; onPress: () => void; }

export default function NoteCard({ note, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityLabel={`Note: ${note.title}, ${note.download_count} downloads`}
      accessibilityRole="button"
    >
      <View style={styles.iconWrap}>
        <Ionicons name="document-text-outline" size={22} color="#66fcf1" />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{note.title}</Text>
        <Text style={styles.sub}>{note.subject_name} · Sem {note.semester}</Text>
      </View>
      <View style={styles.right}>
        <Ionicons name="download-outline" size={14} color="#8a8f98" />
        <Text style={styles.count}>{note.download_count}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111217', borderRadius: 12, padding: 14, marginBottom: 8, gap: 12 },
  pressed: { opacity: 0.7 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#1a3a38', alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
  title: { fontSize: 14, fontWeight: '500', color: '#eaeaea' },
  sub: { fontSize: 12, color: '#8a8f98' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  count: { fontSize: 12, color: '#8a8f98' },
});
