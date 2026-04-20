import { View, Text, StyleSheet } from 'react-native';
import type { Verdict } from '../types';

const COLOR: Record<Verdict, string> = {
  safe: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
};

export function VerdictChip({ verdict, message }: { verdict: Verdict; message: string }) {
  const color = COLOR[verdict];
  return (
    <View style={[styles.chip, { backgroundColor: color + '18', borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start' },
  text: { fontSize: 13, fontWeight: '600' },
});
