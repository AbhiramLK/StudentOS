import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const C = { bg: '#0b0c10', text: '#eaeaea', muted: '#8a8f98', accent: '#66fcf1' };

export default function SettingsScreen() {
  return (
    <View style={s.container} accessibilityLabel="Settings screen">
      <Ionicons name="settings-outline" size={48} color={C.muted} accessibilityElementsHidden />
      <Text style={s.title}>Settings</Text>
      <Text style={s.sub}>Coming soon</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '600', color: C.text },
  sub: { fontSize: 14, color: C.muted },
});
