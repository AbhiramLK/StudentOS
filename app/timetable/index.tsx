import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, SectionList, TouchableOpacity,
  Modal, TextInput, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useTimetableStore } from '../../src/stores/timetableStore';
import {
  upsertUserTimetableEntry,
  deleteUserTimetableEntry,
} from '../../src/db/timetable';
import type { TimetableSlot } from '../../src/types';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98',
};

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function TimetableScreen() {
  const { profile } = useAuthStore();
  const { slots, userEntries, loading, fetch } = useTimetableStore();
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (profile) fetch(profile.id);
    }, [profile?.id, fetch]),
  );

  const sections = useMemo(() =>
    DAY_NAMES
      .map((day, i) => ({
        title: day,
        data: slots.filter(slot => slot.day_of_week === i),
      }))
      .filter(s => s.data.length > 0),
    [slots],
  );

  const getSubjectForSlot = useCallback(
    (slotId: string): string | null =>
      userEntries.find(e => e.slot_id === slotId)?.subject_name ?? null,
    [userEntries],
  );

  function openEdit(slot: TimetableSlot) {
    setEditingSlot(slot);
    setInputValue(getSubjectForSlot(slot.id) ?? '');
  }

  const saveEdit = useCallback(async () => {
    if (!editingSlot || !profile) return;
    setSaving(true);
    const val = inputValue.trim();
    if (val) {
      await upsertUserTimetableEntry(profile.id, editingSlot.id, val);
    } else {
      await deleteUserTimetableEntry(profile.id, editingSlot.id);
    }
    await fetch(profile.id);
    setSaving(false);
    setEditingSlot(null);
  }, [editingSlot, profile, inputValue, fetch]);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Timetable</Text>
      </View>

      {loading && slots.length === 0 ? (
        <View style={s.center}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={s.dayHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => {
            const subjectName = getSubjectForSlot(item.id);
            return (
              <TouchableOpacity
                style={s.slotRow}
                onPress={() => openEdit(item)}
                accessibilityLabel={`${item.start_time.slice(0, 5)} to ${item.end_time.slice(0, 5)}, ${subjectName ?? 'empty'}`}
              >
                <Text style={s.slotTime}>
                  {item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)}
                </Text>
                <Text style={subjectName ? s.slotFilled : s.slotEmpty} numberOfLines={1}>
                  {subjectName ?? '+ Add subject'}
                </Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={s.emptyText}>No timetable slots found.</Text>
          }
        />
      )}

      <Modal visible={!!editingSlot} transparent animationType="slide" onRequestClose={() => setEditingSlot(null)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>
              {editingSlot?.start_time.slice(0, 5)} – {editingSlot?.end_time.slice(0, 5)}
            </Text>
            <TextInput
              style={s.input}
              placeholder="Subject name (leave empty to clear)"
              placeholderTextColor={C.muted}
              value={inputValue}
              onChangeText={setInputValue}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveEdit}
              accessibilityLabel="Subject name input"
            />
            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.6 }]}
              onPress={saveEdit}
              disabled={saving}
              accessibilityLabel="Save subject"
            >
              {saving
                ? <ActivityIndicator color="#0b0c10" />
                : <Text style={s.saveBtnText}>Save</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setEditingSlot(null)}
              style={s.cancelBtn}
              accessibilityLabel="Cancel"
            >
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { padding: 20, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 80 },
  emptyText: { textAlign: 'center', color: C.muted, marginTop: 60, fontSize: 14 },
  dayHeader: {
    fontSize: 12, color: C.muted, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 20, marginBottom: 8,
  },
  slotRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', backgroundColor: C.card,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6,
  },
  slotTime: { fontSize: 13, color: C.muted, minWidth: 90 },
  slotFilled: { fontSize: 14, color: C.accent, fontWeight: '500', flex: 1, textAlign: 'right' },
  slotEmpty: { fontSize: 13, color: '#333', flex: 1, textAlign: 'right' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderRadius: 20, padding: 24, margin: 12 },
  sheetTitle: { fontSize: 13, color: C.muted, marginBottom: 16 },
  input: {
    backgroundColor: C.bg, borderRadius: 10,
    padding: 14, color: C.text, fontSize: 15, marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: C.accent, borderRadius: 999,
    padding: 14, alignItems: 'center', marginBottom: 8,
  },
  saveBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
  cancelBtn: { alignItems: 'center', padding: 10 },
  cancelBtnText: { color: C.muted, fontSize: 14 },
});
