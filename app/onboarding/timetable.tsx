import { useEffect, useState } from 'react';
import {
  View, Text, SectionList, TouchableOpacity,
  TextInput, StyleSheet, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { getAllSlots, upsertUserTimetableEntry } from '../../src/db/timetable';
import type { TimetableSlot } from '../../src/types';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function OnboardingTimetable() {
  const { profile } = useAuthStore();
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [filled, setFilled] = useState<Record<string, string>>({});
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => { getAllSlots().then(setSlots); }, []);

  const sections = DAY_NAMES
    .map((day, i) => ({ title: day, data: slots.filter((s) => s.day_of_week === i) }))
    .filter((s) => s.data.length > 0);

  async function saveEdit() {
    if (!editingSlot) return;
    const val = inputValue.trim();
    if (val) {
      await upsertUserTimetableEntry(profile!.id, editingSlot.id, val);
      setFilled((prev) => ({ ...prev, [editingSlot.id]: val }));
    }
    setEditingSlot(null);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Timetable</Text>
      <Text style={styles.subtitle}>Tap a slot to enter your subject</Text>
      <SectionList
        sections={sections} keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <Text style={styles.dayHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.slotRow}
            onPress={() => { setEditingSlot(item); setInputValue(filled[item.id] ?? ''); }}
          >
            <Text style={styles.slotTime}>
              {item.start_time.slice(0, 5)}–{item.end_time.slice(0, 5)}
            </Text>
            <Text style={filled[item.id] ? styles.slotFilled : styles.slotEmpty}>
              {filled[item.id] ?? '+ Add subject'}
            </Text>
          </TouchableOpacity>
        )}
        style={{ flex: 1, marginTop: 8 }}
      />
      <TouchableOpacity style={styles.nextBtn} onPress={() => router.push('/onboarding/mess')}>
        <Text style={styles.nextBtnText}>Next →</Text>
      </TouchableOpacity>
      <Modal visible={!!editingSlot} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingSlot?.start_time.slice(0, 5)}–{editingSlot?.end_time.slice(0, 5)}
            </Text>
            <TextInput
              style={styles.modalInput} placeholder="Subject name"
              placeholderTextColor="#8a8f98" value={inputValue}
              onChangeText={setInputValue} autoFocus
            />
            <TouchableOpacity style={styles.nextBtn} onPress={saveEdit}>
              <Text style={styles.nextBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setEditingSlot(null)}
              style={{ marginTop: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#8a8f98' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0c10', padding: 24, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: '700', color: '#eaeaea', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#8a8f98', marginBottom: 12 },
  dayHeader: { color: '#8a8f98', fontSize: 12, marginTop: 16, marginBottom: 4 },
  slotRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#111217', borderRadius: 10, padding: 12, marginBottom: 6,
  },
  slotTime: { color: '#8a8f98', fontSize: 13 },
  slotFilled: { color: '#66fcf1', fontSize: 13 },
  slotEmpty: { color: '#444', fontSize: 13 },
  nextBtn: { backgroundColor: '#66fcf1', borderRadius: 999, padding: 15, alignItems: 'center', marginTop: 12 },
  nextBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#111217', borderRadius: 20, padding: 24, margin: 16 },
  modalTitle: { color: '#8a8f98', fontSize: 13, marginBottom: 12 },
  modalInput: {
    backgroundColor: '#0b0c10', borderRadius: 10,
    padding: 12, color: '#eaeaea', fontSize: 15, marginBottom: 12,
  },
});
