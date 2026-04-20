import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useSubjectsStore } from '../../src/stores/subjectsStore';
import { useTimetableStore } from '../../src/stores/timetableStore';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TimetableScreen() {
  const { subjects, load: loadSubjects } = useSubjectsStore();
  const { slots, load: loadSlots, addSlot, removeSlot } = useTimetableStore();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [startTime, setStartTime] = useState(new Date(2000, 0, 1, 9, 0));
  const [endTime, setEndTime] = useState(new Date(2000, 0, 1, 10, 0));
  const [adding, setAdding] = useState(false);

  useFocusEffect(useCallback(() => { loadSubjects(); loadSlots(); }, []));

  const fmt = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const handleAdd = () => {
    if (!selectedSubject) return;
    addSlot(selectedSubject, selectedDay, fmt(startTime), fmt(endTime));
    setAdding(false);
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Text style={s.heading}>Timetable</Text>

      {DAYS.map((day, dow) => {
        const daySlots = slots
          .filter(sl => sl.day_of_week === dow)
          .sort((a, b) => a.start_time.localeCompare(b.start_time));
        return (
          <View key={day} style={s.daySection}>
            <Text style={s.dayLabel}>{day}</Text>
            {daySlots.length === 0 && <Text style={s.noClass}>No classes</Text>}
            {daySlots.map(slot => {
              const sub = subjects.find(s => s.id === slot.subject_id);
              return (
                <View key={slot.id} style={s.slotRow}>
                  <Text style={s.slotText}>{slot.start_time}–{slot.end_time}  {sub?.name}</Text>
                  <TouchableOpacity onPress={() => removeSlot(slot.id)}>
                    <Text style={s.del}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        );
      })}

      {!adding && (
        <TouchableOpacity style={s.addBtn} onPress={() => setAdding(true)}>
          <Text style={s.addBtnText}>+ Add Slot</Text>
        </TouchableOpacity>
      )}

      {adding && (
        <View style={s.form}>
          <Text style={s.formLabel}>Subject</Text>
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
          <Text style={s.formLabel}>Day</Text>
          <View style={s.chips}>
            {DAYS.map((d, i) => (
              <TouchableOpacity
                key={d}
                style={[s.chip, selectedDay === i && s.chipActive]}
                onPress={() => setSelectedDay(i)}
              >
                <Text style={[s.chipText, selectedDay === i && s.chipTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.formLabel}>Start</Text>
          <DateTimePicker value={startTime} mode="time" display="default" onChange={(_, d) => d && setStartTime(d)} />
          <Text style={s.formLabel}>End</Text>
          <DateTimePicker value={endTime} mode="time" display="default" onChange={(_, d) => d && setEndTime(d)} />
          <View style={s.formActions}>
            <TouchableOpacity style={s.saveBtn} onPress={handleAdd} disabled={!selectedSubject}>
              <Text style={s.saveBtnText}>Save Slot</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setAdding(false)}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  heading: { fontSize: 28, fontWeight: '700', marginBottom: 24 },
  daySection: { marginBottom: 16 },
  dayLabel: { fontSize: 13, fontWeight: '700', color: '#6b7280', marginBottom: 6, textTransform: 'uppercase' },
  noClass: { fontSize: 13, color: '#d1d5db' },
  slotRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 4 },
  slotText: { fontSize: 14 },
  del: { color: '#ef4444', fontSize: 16 },
  addBtn: { borderWidth: 1, borderColor: '#3b82f6', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  addBtnText: { color: '#3b82f6', fontWeight: '600' },
  form: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 16 },
  formLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  chipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  chipText: { fontSize: 13, color: '#374151' },
  chipTextActive: { color: '#fff' },
  formActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  saveBtn: { flex: 1, backgroundColor: '#3b82f6', padding: 12, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  cancelBtn: { flex: 1, backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelBtnText: { color: '#374151', fontWeight: '600' },
});
