import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';

export default function OnboardingDone() {
  useEffect(() => {
    const t = setTimeout(() => router.replace('/(tabs)'), 1800);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>✓</Text>
      <Text style={styles.title}>You are all set</Text>
      <Text style={styles.subtitle}>Taking you to your dashboard…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0c10', alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 56, color: '#66fcf1', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#eaeaea', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#8a8f98' },
});
