import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FeedPost } from '../types';

interface Props { post: FeedPost; }

function timeRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h left` : `${m}m left`;
}

export default function FeedCard({ post }: Props) {
  return (
    <View style={styles.card} accessibilityLabel={`Feed post: ${post.title}`}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>{post.title}</Text>
        <View style={styles.badge}><Text style={styles.badgeText}>{timeRemaining(post.expires_at)}</Text></View>
      </View>
      <Text style={styles.body} numberOfLines={4}>{post.body}</Text>
      <View style={styles.footer}>
        {post.location ? (
          <View style={styles.meta}>
            <Ionicons name="location-outline" size={12} color="#8a8f98" />
            <Text style={styles.metaText}>{post.location}</Text>
          </View>
        ) : null}
        <Text style={styles.author}>{(post as any).profiles?.name ?? ''}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#111217', borderRadius: 12, padding: 16, marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '600', color: '#eaeaea' },
  badge: { backgroundColor: '#1e2028', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, color: '#8a8f98' },
  body: { fontSize: 13, color: '#8a8f98', lineHeight: 19, marginBottom: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#8a8f98' },
  author: { fontSize: 12, color: '#66fcf1' },
});
