import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function OnboardingDone() {
  const router = useRouter();
  return (
    <View style={s.container}>
      <Text style={s.emoji}>🎓</Text>
      <Text style={s.title}>You're all set!</Text>
      <Text style={s.sub}>StudentOS will now track your attendance and help you decide when it's safe to skip.</Text>
      <TouchableOpacity style={s.btn} onPress={() => router.replace('/(tabs)')}>
        <Text style={s.btnText}>Go to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#fff' },
  emoji: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 12 },
  sub: { fontSize: 16, color: '#6b7280', textAlign: 'center', marginBottom: 32 },
  btn: { backgroundColor: '#3b82f6', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
