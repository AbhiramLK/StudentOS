import { View, Text, StyleSheet } from 'react-native';

interface Props { present: number; total: number; targetPct: number; }

export default function AttendanceBar({ present, total, targetPct }: Props) {
  const pct = total === 0 ? 0 : Math.round((present / total) * 1000) / 10;
  const fill = total === 0 ? 0 : Math.min(pct / 100, 1);
  const color = pct >= targetPct ? '#66fcf1' : pct >= targetPct - 5 ? '#ffc857' : '#ff5c5c';
  return (
    <View style={styles.wrapper} accessibilityLabel={`Attendance ${pct} percent`}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fill * 100}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[styles.label, { color }]}>{pct}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, height: 4, backgroundColor: '#1e2028', borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  label: { fontSize: 13, fontWeight: '600', minWidth: 40, textAlign: 'right' },
});
