import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSubjectsStore } from '../../src/stores/subjectsStore';

export default function OnboardingSubjects() {
  const router = useRouter();
  const { subjects, load, add, remove } = useSubjectsStore();
  const [name, setName] = useState('');
  const [threshold, setThreshold] = useState('75');

  useEffect(() => { load(); }, []);

  const handleAdd = () => {
    if (!name.trim()) return;
    add(name.trim(), parseInt(threshold, 10) || 75);
    setName('');
    setThreshold('75');
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>Add Your Subjects</Text>
      <Text style={s.sub}>Add courses you want to track.</Text>
      <TextInput style={s.input} placeholder="Subject name" value={name} onChangeText={setName} />
      <TextInput
        style={s.input}
        placeholder="Min attendance % (default 75)"
        value={threshold}
        onChangeText={setThreshold}
        keyboardType="numeric"
      />
      <TouchableOpacity style={s.addBtn} onPress={handleAdd}>
        <Text style={s.addBtnText}>+ Add Subject</Text>
      </TouchableOpacity>
      <FlatList
        data={subjects}
        keyExtractor={s => s.id}
        style={s.list}
        renderItem={({ item }) => (
          <View style={s.row}>
            <Text style={s.itemText}>{item.name} ({item.threshold}%)</Text>
            <TouchableOpacity onPress={() => remove(item.id)}>
              <Text style={s.del}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      />
      <TouchableOpacity
        style={[s.btn, subjects.length === 0 && s.btnOff]}
        disabled={subjects.length === 0}
        onPress={() => router.push('/onboarding/timetable')}
      >
        <Text style={s.btnText}>Next →</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  sub: { fontSize: 15, color: '#6b7280', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 8 },
  addBtn: { borderWidth: 1, borderColor: '#3b82f6', borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 16 },
  addBtnText: { color: '#3b82f6', fontWeight: '600' },
  list: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  itemText: { fontSize: 15 },
  del: { color: '#ef4444', fontSize: 18, paddingHorizontal: 8 },
  btn: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  btnOff: { backgroundColor: '#9ca3af' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
