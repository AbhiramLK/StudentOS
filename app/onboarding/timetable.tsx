import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useSubjectsStore } from '../../src/stores/subjectsStore';
import { useTimetableStore } from '../../src/stores/timetableStore';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function OnboardingTimetable() {
  const router = useRouter();
  const { subjects, load: loadSubjects } = useSubjectsStore();
  const { slots, load: loadSlots, addSlot, removeSlot } = useTimetableStore();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [startTime, setStartTime] = useState(new Date(2000, 0, 1, 9, 0));
  const [endTime, setEndTime] = useState(new Date(2000, 0, 1, 10, 0));

  useEffect(() => { loadSubjects(); loadSlots(); }, []);

  const fmt = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const handleAdd = () => {
    if (!selectedSubject) return;
    addSlot(selectedSubject, selectedDay, fmt(startTime), fmt(endTime));
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.title}>Build Your Timetable</Text>
      <Text style={s.sub}>Add weekly recurring class slots.</Text>

      <Text style={s.label}>Subject</Text>
      <View style={s.chips}>
        {subjects.map(sub => (
          <TouchableOpacity
            key={sub.id}
            style={[s.chip, selectedSubject === sub.id && s.chipActive]}
            onPress={() => setSelectedSubject(sub.id)}
          >
            <Text style={[s.chipText, selectedSubject === sub.id && s.chipTextActive]}>{sub.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>Day</Text>
      <View style={s.chips}>
        {DAYS.map((day, i) => (
          <TouchableOpacity
            key={day}
            style={[s.chip, selectedDay === i && s.chipActive]}
            onPress={() => setSelectedDay(i)}
          >
            <Text style={[s.chipText, selectedDay === i && s.chipTextActive]}>{day}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>Start time</Text>
      <DateTimePicker value={startTime} mode="time" display="default" onChange={(_, d) => d && setStartTime(d)} />

      <Text style={s.label}>End time</Text>
      <DateTimePicker value={endTime} mode="time" display="default" onChange={(_, d) => d && setEndTime(d)} />

      <TouchableOpacity style={[s.addBtn, !selectedSubject && s.addBtnOff]} onPress={handleAdd} disabled={!selectedSubject}>
        <Text style={s.addBtnText}>+ Add Slot</Text>
      </TouchableOpacity>

      <FlatList
        data={slots}
        keyExtractor={slot => slot.id}
        scrollEnabled={false}
        renderItem={({ item }) => {
          const sub = subjects.find(s => s.id === item.subject_id);
          return (
            <View style={s.row}>
              <Text style={s.rowText}>{DAYS[item.day_of_week]}  {sub?.name}  {item.start_time}–{item.end_time}</Text>
              <TouchableOpacity onPress={() => removeSlot(item.id)}>
                <Text style={s.del}>✕</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />

      <TouchableOpacity style={s.btn} onPress={() => router.push('/onboarding/done')}>
        <Text style={s.btnText}>Next →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  sub: { fontSize: 15, color: '#6b7280', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginTop: 16, marginBottom: 8, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  chipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  chipText: { fontSize: 14, color: '#374151' },
  chipTextActive: { color: '#fff' },
  addBtn: { backgroundColor: '#3b82f6', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  addBtnOff: { backgroundColor: '#9ca3af' },
  addBtnText: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  rowText: { fontSize: 14 },
  del: { color: '#ef4444', fontSize: 18, paddingHorizontal: 8 },
  btn: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
