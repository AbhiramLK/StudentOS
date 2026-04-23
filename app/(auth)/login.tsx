import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [roll, setRoll] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    if (!email.toLowerCase().endsWith('@nitc.ac.in')) {
      Alert.alert('Invalid email', 'Use your @nitc.ac.in college email.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Name required', 'Enter your full name.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: { emailRedirectTo: 'studentos://login-callback' },
    });
    setLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    router.push({
      pathname: '/(auth)/verify',
      params: { email: email.toLowerCase(), name: name.trim(), roll: roll.trim() },
    });
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Student OS</Text>
      <Text style={styles.subtitle}>Sign in with your NITC email</Text>
      <TextInput
        style={styles.input} placeholder="name@nitc.ac.in"
        placeholderTextColor="#8a8f98" value={email}
        onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
      />
      <TextInput
        style={styles.input} placeholder="Full name"
        placeholderTextColor="#8a8f98" value={name}
        onChangeText={setName} autoCapitalize="words"
      />
      <TextInput
        style={styles.input} placeholder="Roll number (optional)"
        placeholderTextColor="#8a8f98" value={roll}
        onChangeText={setRoll} autoCapitalize="characters"
      />
      <TouchableOpacity
        style={[styles.btn, loading && { opacity: 0.6 }]}
        onPress={handleContinue} disabled={loading}
      >
        <Text style={styles.btnText}>{loading ? 'Sending…' : 'Continue'}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0c10', padding: 24, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '700', color: '#eaeaea', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#8a8f98', marginBottom: 40 },
  input: {
    backgroundColor: '#111217', borderRadius: 12,
    padding: 14, color: '#eaeaea', fontSize: 15, marginBottom: 12,
  },
  btn: { backgroundColor: '#66fcf1', borderRadius: 999, padding: 15, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
});
