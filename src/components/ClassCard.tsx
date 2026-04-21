import { View, Text, StyleSheet } from 'react-native';
import type { TimetableSlot } from '../types';

interface Props { slot: TimetableSlot; subjectName: string; present: number; total: number; targetPct: number; }

export default function ClassCard({ slot, subjectName, present, total, targetPct }: Props) {
  const pct = total === 0 ? 0 : Math.round((present / total) * 1000) / 10;
  const color = pct >= targetPct ? '#66fcf1' : pct >= targetPct - 5 ? '#ffc857' : '#ff5c5c';
  const time = `${slot.start_time.slice(0, 5)} – ${slot.end_time.slice(0, 5)}`;
  return (
    <View style={styles.row} accessibilityLabel={`${subjectName} at ${time}, attendance ${pct} percent`}>
      <View style={styles.left}>
        <Text style={styles.time}>{time}</Text>
        <Text style={styles.subject} numberOfLines={1}>{subjectName}</Text>
      </View>
      <Text style={[styles.pct, { color }]}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#111217', borderRadius: 10, marginBottom: 8 },
  left: { flex: 1, gap: 2 },
  time: { fontSize: 11, color: '#8a8f98' },
  subject: { fontSize: 15, color: '#eaeaea', fontWeight: '500' },
  pct: { fontSize: 15, fontWeight: '700', marginLeft: 12 },
});
