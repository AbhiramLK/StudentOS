import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const C = { bg: '#0b0c10', text: '#eaeaea', muted: '#8a8f98' };

export default function SubjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={s.container} accessibilityLabel="Subject detail screen">
      <Ionicons name="book-outline" size={48} color={C.muted} accessibilityElementsHidden />
      <Text style={s.title}>Subject Detail</Text>
      <Text style={s.sub}>{id ?? 'Coming soon'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '600', color: C.text },
  sub: { fontSize: 14, color: C.muted },
});
