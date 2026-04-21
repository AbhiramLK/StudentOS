import { View, Text, StyleSheet } from 'react-native';
import type { Verdict } from '../engine/predictionEngine';

const COLORS: Record<Verdict, { bg: string; text: string }> = {
  safe: { bg: '#1a3a38', text: '#66fcf1' },
  warning: { bg: '#3a2e10', text: '#ffc857' },
  danger: { bg: '#3a1010', text: '#ff5c5c' },
};

interface Props { verdict: Verdict; }

export default function VerdictChip({ verdict }: Props) {
  const c = COLORS[verdict];
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]}>
      <Text style={[styles.label, { color: c.text }]}>{verdict}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
});
