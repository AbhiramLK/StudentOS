import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { updateProfile } from '../../src/db/profiles';
import { useAuthStore } from '../../src/stores/authStore';
import type { Mess } from '../../src/types';

export default function OnboardingMess() {
  const { profile, setProfile } = useAuthStore();
  const [messes, setMesses] = useState<Mess[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('messes').select('*').order('name').then(({ data }) => setMesses(data ?? []));
  }, []);

  async function handleNext() {
    if (!selected) { Alert.alert('Select your mess first.'); return; }
    setLoading(true);
    await updateProfile(profile!.id, { mess_id: selected });
    setProfile({ ...profile!, mess_id: selected });
    setLoading(false);
    router.replace('/onboarding/done');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Mess</Text>
      <Text style={styles.subtitle}>Select the mess you are registered at</Text>
      <FlatList
        data={messes} keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.messRow, selected === item.id && styles.messRowSelected]}
            onPress={() => setSelected(item.id)}
          >
            <Text style={styles.messName}>{item.name}</Text>
            {selected === item.id && <Text style={styles.check}>✓</Text>}
          </TouchableOpacity>
        )}
        style={{ flex: 1, marginTop: 12 }}
      />
      <TouchableOpacity
        style={[styles.nextBtn, loading && { opacity: 0.6 }]}
        onPress={handleNext} disabled={loading}
      >
        <Text style={styles.nextBtnText}>{loading ? 'Saving…' : 'Done →'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0c10', padding: 24, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: '700', color: '#eaeaea', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#8a8f98', marginBottom: 12 },
  messRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#111217', borderRadius: 12, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: 'transparent',
  },
  messRowSelected: { borderColor: '#66fcf1' },
  messName: { color: '#eaeaea', fontSize: 15 },
  check: { color: '#66fcf1', fontSize: 16, fontWeight: '700' },
  nextBtn: { backgroundColor: '#66fcf1', borderRadius: 999, padding: 15, alignItems: 'center', marginTop: 12 },
  nextBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
});
