import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

const C = { bg: '#0b0c10', card: '#111217', text: '#eaeaea', muted: '#8a8f98', accent: '#66fcf1' };

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

const FEATURES: { icon: IoniconsName; label: string; route: string }[] = [
  { icon: 'calendar-outline',         label: 'Timetable',  route: '/timetable' },
  { icon: 'flash-outline',            label: 'Feed',       route: '/feed' },
  { icon: 'checkmark-circle-outline', label: 'Attendance', route: '/attendance' },
  { icon: 'document-text-outline',    label: 'Notes',      route: '/notes' },
  { icon: 'restaurant-outline',       label: 'Mess',       route: '/mess' },
  { icon: 'barbell-outline',          label: 'Gym',        route: '/gym' },
  { icon: 'grid-outline',             label: 'Wall',       route: '/wall' },
  { icon: 'sparkles-outline',         label: 'AI',         route: '/ai' },
  { icon: 'chatbubble-outline',       label: 'Messages',   route: '/messages' },
];

export default function AllScreen() {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>All Features</Text>
        <View style={styles.grid}>
          {FEATURES.map(f => (
            <TouchableOpacity
              key={f.label}
              style={styles.cell}
              onPress={() => router.push(f.route as any)}
              accessibilityLabel={f.label}
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={f.icon} size={26} color={C.accent} />
              </View>
              <Text style={styles.label}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 80 },
  title: { fontSize: 22, fontWeight: '600', color: C.text, marginBottom: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  cell: { width: '28%', alignItems: 'center', gap: 8, minHeight: 72 },
  iconWrap: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
  },
  label: { fontSize: 13, color: C.muted, textAlign: 'center' },
});
