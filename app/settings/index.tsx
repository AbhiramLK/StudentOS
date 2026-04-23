import { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/lib/supabase';
import type { Mess } from '../../src/types';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98', danger: '#ff5c5c',
};

export default function SettingsScreen() {
  const { profile, setProfile, signOut } = useAuthStore();

  const [name, setName] = useState(profile?.name ?? '');
  const [rollNumber, setRollNumber] = useState(profile?.roll_number ?? '');
  const [semesterEndDate, setSemesterEndDate] = useState(profile?.semester_end_date ?? '');
  const [messId, setMessId] = useState<string | null>(profile?.mess_id ?? null);
  const [messes, setMesses] = useState<Mess[]>([]);
  const [saving, setSaving] = useState(false);

  const loadMesses = useCallback(async () => {
    const { data } = await supabase.from('messes').select('*').order('name');
    setMesses(data ?? []);
  }, []);

  useFocusEffect(useCallback(() => { loadMesses(); }, [loadMesses]));

  const handleSave = useCallback(async () => {
    if (!profile) return;
    if (!name.trim()) {
      Alert.alert('Invalid input', 'Name is required.');
      return;
    }
    if (semesterEndDate && !/^\d{4}-\d{2}-\d{2}$/.test(semesterEndDate)) {
      Alert.alert('Invalid date', 'Semester end date must be YYYY-MM-DD.');
      return;
    }
    setSaving(true);
    const updates = {
      name: name.trim(),
      roll_number: rollNumber.trim() || null,
      mess_id: messId,
      semester_end_date: semesterEndDate.trim() || null,
    };
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile!.id);
    setSaving(false);
    if (error) {
      Alert.alert('Save failed', error.message);
      return;
    }
    setProfile({ ...profile!, ...updates });
    Alert.alert('Saved', 'Your profile has been updated.');
  }, [profile, name, rollNumber, messId, semesterEndDate, setProfile]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign out?', 'You will need to verify your email again to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/');
        },
      },
    ]);
  }, [signOut]);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <Text style={s.sectionLabel}>Profile</Text>
        <View style={s.group}>
          <View style={s.fieldRow}>
            <Text style={s.fieldLabel}>Name</Text>
            <TextInput
              style={s.fieldInput}
              value={name}
              onChangeText={setName}
              placeholderTextColor={C.muted}
              placeholder="Your name"
              maxLength={80}
              accessibilityLabel="Name"
            />
          </View>
          <View style={s.divider} />
          <View style={s.fieldRow}>
            <Text style={s.fieldLabel}>Roll Number</Text>
            <TextInput
              style={s.fieldInput}
              value={rollNumber}
              onChangeText={setRollNumber}
              placeholderTextColor={C.muted}
              placeholder="e.g. B220001CS"
              autoCapitalize="characters"
              maxLength={20}
              accessibilityLabel="Roll number"
            />
          </View>
        </View>

        <Text style={s.sectionLabel}>Campus</Text>
        <View style={s.group}>
          <Text style={[s.fieldLabel, { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }]}>Mess</Text>
          {messes.map(m => (
            <TouchableOpacity
              key={m.id}
              style={s.messRow}
              onPress={() => setMessId(m.id)}
              accessibilityLabel={`Select ${m.name}`}
            >
              <Text style={[s.messLabel, messId === m.id && { color: C.accent }]}>{m.name}</Text>
              {messId === m.id && <Ionicons name="checkmark" size={18} color={C.accent} />}
            </TouchableOpacity>
          ))}
          {messes.length === 0 && (
            <Text style={[s.messLabel, { paddingHorizontal: 16, paddingBottom: 14 }]}>Loading…</Text>
          )}
        </View>

        <Text style={s.sectionLabel}>Academic Calendar</Text>
        <View style={s.group}>
          <View style={s.fieldRow}>
            <Text style={s.fieldLabel}>Semester End</Text>
            <TextInput
              style={s.fieldInput}
              value={semesterEndDate}
              onChangeText={setSemesterEndDate}
              placeholderTextColor={C.muted}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              accessibilityLabel="Semester end date"
            />
          </View>
          <Text style={s.hint}>Used by AI and attendance engine to compute urgency.</Text>
        </View>

        <TouchableOpacity
          style={[s.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          accessibilityLabel="Save settings"
        >
          {saving
            ? <ActivityIndicator color="#0b0c10" />
            : <Text style={s.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} accessibilityLabel="Sign out">
          <Ionicons name="log-out-outline" size={18} color={C.danger} />
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={s.emailNote}>Signed in as {profile?.email}</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingBottom: 8 },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  scroll: { paddingHorizontal: 16, paddingBottom: 60 },
  sectionLabel: {
    fontSize: 12, color: C.muted, textTransform: 'uppercase',
    letterSpacing: 1, marginTop: 24, marginBottom: 8, marginLeft: 4,
  },
  group: { backgroundColor: C.card, borderRadius: 14, overflow: 'hidden' },
  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 4,
  },
  fieldLabel: { fontSize: 14, color: C.text, flex: 1 },
  fieldInput: {
    flex: 2, textAlign: 'right', color: C.text,
    fontSize: 14, paddingVertical: 14,
  },
  divider: { height: 1, backgroundColor: '#1a1b20', marginHorizontal: 16 },
  messRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: '#1a1b20',
  },
  messLabel: { fontSize: 14, color: C.muted },
  hint: { fontSize: 12, color: C.muted, paddingHorizontal: 16, paddingBottom: 12 },
  saveBtn: {
    backgroundColor: C.accent, borderRadius: 999,
    padding: 14, alignItems: 'center', marginTop: 28,
  },
  saveBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 16, padding: 14,
    backgroundColor: C.card, borderRadius: 999,
  },
  signOutText: { color: C.danger, fontWeight: '600', fontSize: 15 },
  emailNote: { textAlign: 'center', color: C.muted, fontSize: 12, marginTop: 20 },
});
