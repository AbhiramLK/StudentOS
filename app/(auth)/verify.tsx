import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { getProfile, createProfile } from '../../src/db/profiles';
import { useAuthStore } from '../../src/stores/authStore';

export default function VerifyScreen() {
  const { email, name, roll } = useLocalSearchParams<{
    email: string; name: string; roll: string;
  }>();
  const { setProfile } = useAuthStore();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    if (token.length !== 6) { Alert.alert('Enter the 6-digit code.'); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) { setLoading(false); Alert.alert('Invalid code', error.message); return; }
    const userId = data.user!.id;
    let profile = await getProfile(userId);
    if (!profile) {
      profile = await createProfile({
        id: userId, email, name,
        roll_number: roll || null, mess_id: null, semester_end_date: null,
      });
      setProfile(profile);
      setLoading(false);
      router.replace('/onboarding/subjects');
    } else if (!profile.mess_id) {
      setProfile(profile); setLoading(false);
      router.replace('/onboarding/mess');
    } else {
      setProfile(profile); setLoading(false);
      router.replace('/(tabs)');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.subtitle}>6-digit code sent to {email}</Text>
      <TextInput
        style={styles.input} placeholder="000000"
        placeholderTextColor="#8a8f98" value={token}
        onChangeText={setToken} keyboardType="number-pad" maxLength={6} autoFocus
      />
      <TouchableOpacity
        style={[styles.btn, loading && { opacity: 0.6 }]}
        onPress={handleVerify} disabled={loading}
      >
        <Text style={styles.btnText}>{loading ? 'Verifying…' : 'Verify'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, alignItems: 'center' }}>
        <Text style={{ color: '#8a8f98' }}>← Back</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0c10', padding: 24, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: '#eaeaea', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#8a8f98', marginBottom: 40 },
  input: {
    backgroundColor: '#111217', borderRadius: 12, padding: 14,
    color: '#eaeaea', fontSize: 28, letterSpacing: 14, textAlign: 'center', marginBottom: 12,
  },
  btn: { backgroundColor: '#66fcf1', borderRadius: 999, padding: 15, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
});
