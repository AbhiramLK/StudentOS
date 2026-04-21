import { View, Text, StyleSheet } from 'react-native';
import type { WallEntry } from '../types';

interface Props { entry: WallEntry; }

function timeAgo(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function WallCard({ entry }: Props) {
  return (
    <View style={[styles.card, { borderLeftColor: entry.color, borderLeftWidth: 3 }]} accessibilityLabel={`Wall entry: ${entry.content}`}>
      <Text style={styles.content}>{entry.content}</Text>
      <Text style={styles.time}>{timeAgo(entry.created_at)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#111217', borderRadius: 12, padding: 16, marginBottom: 10 },
  content: { fontSize: 14, color: '#eaeaea', lineHeight: 20, marginBottom: 8 },
  time: { fontSize: 11, color: '#8a8f98' },
});
