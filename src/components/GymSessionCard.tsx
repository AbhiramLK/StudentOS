import { View, Text, StyleSheet } from 'react-native';
import type { GymSession } from '../types';

interface Props { session: GymSession; }

export default function GymSessionCard({ session }: Props) {
  const start = session.start_time.slice(0, 5);
  const label = `${start} · ${session.duration_min} min`;
  return (
    <View style={styles.card} accessibilityLabel={`Gym session: ${label}${session.notes ? ', ' + session.notes : ''}`}>
      <Text style={styles.time}>{label}</Text>
      {session.notes ? <Text style={styles.notes} numberOfLines={1}>{session.notes}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1a3a38', borderRadius: 8, padding: 8, marginTop: 4 },
  time: { fontSize: 12, color: '#66fcf1', fontWeight: '600' },
  notes: { fontSize: 11, color: '#8a8f98', marginTop: 2 },
});
