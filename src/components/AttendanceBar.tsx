import { View, Text, StyleSheet } from 'react-native';

interface Props { pct: number; threshold: number; label: string }

export function AttendanceBar({ pct, threshold, label }: Props) {
  const color = pct >= threshold ? '#16a34a' : pct >= threshold - 5 ? '#d97706' : '#dc2626';
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.pct, { color }]}>{pct}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(pct, 100)}%` as any, backgroundColor: color }]} />
        <View style={[styles.marker, { left: `${threshold}%` as any }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 14, color: '#374151' },
  pct: { fontSize: 14, fontWeight: '700' },
  track: { height: 8, backgroundColor: '#e5e7eb', borderRadius: 4 },
  fill: { height: '100%', borderRadius: 4 },
  marker: { position: 'absolute', top: -2, width: 2, height: 12, backgroundColor: '#9ca3af' },
});
