import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { createSubject } from '../../src/db/subjects';
import type { Subject } from '../../src/types';

export default function OnboardingSubjects() {
  const { profile } = useAuthStore();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [name, setName] = useState('');
  const [targetPct, setTargetPct] = useState('75');
  const [loading, setLoading] = useState(false);

  async function addSubject() {
    if (!name.trim()) return;
    const pct = parseInt(targetPct, 10);
    if (isNaN(pct) || pct < 1 || pct > 100) {
      Alert.alert('Invalid target', 'Enter a percentage between 1 and 100.');
      return;
    }
    setLoading(true);
    const subject = await createSubject(profile!.id, name.trim(), pct);
    setSubjects((prev) => [...prev, subject]);
    setName(''); setTargetPct('75');
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Subjects</Text>
      <Text style={styles.subtitle}>Add subjects you are enrolled in this semester</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Subject name" placeholderTextColor="#8a8f98"
          value={name} onChangeText={setName}
        />
        <TextInput
          style={[styles.input, { width: 60, marginLeft: 8, textAlign: 'center' }]}
          placeholder="75" placeholderTextColor="#8a8f98"
          value={targetPct} onChangeText={setTargetPct}
          keyboardType="number-pad" maxLength={3}
        />
        <TouchableOpacity style={styles.addBtn} onPress={addSubject} disabled={loading}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={subjects} keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <View style={styles.subjectRow}>
            <Text style={styles.subjectName}>{item.name}</Text>
            <Text style={styles.subjectPct}>{item.target_pct}%</Text>
          </View>
        )}
        style={{ flex: 1, marginTop: 16 }}
      />
      <TouchableOpacity
        style={styles.nextBtn}
        onPress={() => subjects.length === 0
          ? Alert.alert('Add at least one subject.')
          : router.push('/onboarding/timetable')
        }
      >
        <Text style={styles.nextBtnText}>Next →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0c10', padding: 24, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: '700', color: '#eaeaea', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#8a8f98', marginBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { backgroundColor: '#111217', borderRadius: 10, padding: 12, color: '#eaeaea', fontSize: 14 },
  addBtn: {
    backgroundColor: '#66fcf1', borderRadius: 10,
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  addBtnText: { color: '#0b0c10', fontSize: 22, fontWeight: '700' },
  subjectRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#111217', borderRadius: 10, padding: 12, marginBottom: 8,
  },
  subjectName: { color: '#eaeaea', fontSize: 14 },
  subjectPct: { color: '#66fcf1', fontSize: 14 },
  nextBtn: { backgroundColor: '#66fcf1', borderRadius: 999, padding: 15, alignItems: 'center', marginTop: 12 },
  nextBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
});
