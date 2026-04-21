import { View, Text, StyleSheet } from 'react-native';

interface Props { meal: string; items: string[]; }

const MEAL_LABELS: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', evening: 'Evening', dinner: 'Dinner' };

export default function MealRow({ meal, items }: Props) {
  return (
    <View style={styles.row} accessibilityLabel={`${meal}: ${items.join(', ')}`}>
      <Text style={styles.label}>{MEAL_LABELS[meal] ?? meal}</Text>
      <Text style={styles.items} numberOfLines={2}>{items.length > 0 ? items.join(', ') : '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1b20', gap: 16, alignItems: 'flex-start' },
  label: { width: 72, fontSize: 13, color: '#8a8f98', fontWeight: '500' },
  items: { flex: 1, fontSize: 13, color: '#eaeaea', lineHeight: 18 },
});
