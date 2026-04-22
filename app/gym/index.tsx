import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Modal,
  StyleSheet, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthStore } from '../../src/stores/authStore';
import {
  getGymSessions, addGymSession, markGymDone, deleteGymSession,
  type GymSession,
} from '../../src/db/gym';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98', danger: '#ff5c5c',
};

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${DAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours(), m = d.getMinutes();
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

export default function GymScreen() {
  const { profile } = useAuthStore();
  const [sessions, setSessions] = useState<GymSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pickerStep, setPickerStep] = useState<'date' | 'time'>('date');
  const [pickedDate, setPickedDate] = useState(new Date());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setSessions(await getGymSessions(profile.id));
    setLoading(false);
  }, [profile]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAdd = useCallback(async () => {
    if (!profile) return;
    setSaving(true);
    await addGymSession(profile.id, pickedDate.toISOString());
    setSaving(false);
    setShowModal(false);
    setPickedDate(new Date());
    setPickerStep('date');
    load();
  }, [profile, pickedDate, load]);

  const handleDone = useCallback(async (session: GymSession) => {
    await markGymDone(session.id);
    setSessions(prev =>
      prev.map(s => s.id === session.id ? { ...s, done: true } : s),
    );
  }, []);

  const handleDelete = useCallback((session: GymSession) => {
    Alert.alert('Remove session?', fmtDate(session.scheduled_at), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await deleteGymSession(session.id);
          setSessions(prev => prev.filter(s => s.id !== session.id));
        },
      },
    ]);
  }, []);

  const { upcoming, past } = useMemo(() => ({
    upcoming: sessions.filter(s => !s.done && new Date(s.scheduled_at) >= new Date()),
    past: sessions.filter(s => s.done || new Date(s.scheduled_at) < new Date()),
  }), [sessions]);

  const allSections = useMemo(() => [
    ...(upcoming.length ? [{ type: 'header' as const, label: 'Upcoming', id: 'hdr-upcoming' }, ...upcoming.map(s => ({ type: 'session' as const, ...s }))] : []),
    ...(past.length ? [{ type: 'header' as const, label: 'Past', id: 'hdr-past' }, ...past.map(s => ({ type: 'session' as const, ...s }))] : []),
  ], [upcoming, past]);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Gym</Text>
      </View>

      <FlatList
        data={allSections}
        keyExtractor={item => item.id}
        contentContainerStyle={s.list}
        refreshing={loading}
        onRefresh={load}
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return <Text style={s.sectionLabel}>{item.label}</Text>;
          }
          const session = item as GymSession;
          const isPast = session.done || new Date(session.scheduled_at) < new Date();
          return (
            <View style={[s.card, isPast && s.cardPast]}>
              <View style={s.cardLeft}>
                <Ionicons name="barbell-outline" size={20} color={session.done ? C.muted : C.accent} />
                <View style={{ marginLeft: 12 }}>
                  <Text style={[s.cardDate, session.done && { color: C.muted }]}>
                    {fmtDate(session.scheduled_at)}
                  </Text>
                  <Text style={s.cardTime}>{fmtTime(session.scheduled_at)}</Text>
                </View>
              </View>
              <View style={s.cardActions}>
                {!session.done && (
                  <TouchableOpacity
                    onPress={() => handleDone(session)}
                    style={s.doneBtn}
                    accessibilityLabel="Mark done"
                  >
                    <Ionicons name="checkmark-circle-outline" size={22} color={C.accent} />
                  </TouchableOpacity>
                )}
                {session.done && (
                  <Ionicons name="checkmark-circle" size={22} color={C.accent} style={{ marginRight: 8 }} />
                )}
                <TouchableOpacity
                  onPress={() => handleDelete(session)}
                  accessibilityLabel="Delete session"
                >
                  <Ionicons name="trash-outline" size={20} color={C.danger} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          loading ? null : (
            <Text style={s.emptyText}>No sessions scheduled. Tap + to add one.</Text>
          )
        }
      />

      <TouchableOpacity
        style={s.fab}
        onPress={() => setShowModal(true)}
        accessibilityLabel="Add gym session"
      >
        <Ionicons name="add" size={28} color="#0b0c10" />
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={s.modalWrap}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>
              {pickerStep === 'date' ? 'Pick a date' : 'Pick a time'}
            </Text>

            <DateTimePicker
              value={pickedDate}
              mode={pickerStep}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={pickerStep === 'date' ? new Date() : undefined}
              onChange={(_e, date) => {
                if (!date) return;
                setPickedDate(date);
              }}
              style={s.picker}
              themeVariant="dark"
            />

            {pickerStep === 'date' ? (
              <TouchableOpacity
                style={s.nextBtn}
                onPress={() => setPickerStep('time')}
                accessibilityLabel="Next: pick time"
              >
                <Text style={s.nextBtnText}>Next: Pick Time</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.nextBtn, saving && { opacity: 0.6 }]}
                onPress={handleAdd}
                disabled={saving}
                accessibilityLabel="Save session"
              >
                {saving
                  ? <ActivityIndicator color="#0b0c10" />
                  : <Text style={s.nextBtnText}>Save Session</Text>}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => { setShowModal(false); setPickerStep('date'); }}
              style={s.cancelBtn}
              accessibilityLabel="Cancel"
            >
              <Text style={s.cancelText}>Cancel</Text>
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
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  sectionLabel: { fontSize: 12, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 20, marginBottom: 8 },
  card: {
    backgroundColor: C.card, borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardPast: { opacity: 0.6 },
  cardLeft: { flexDirection: 'row', alignItems: 'center' },
  cardDate: { fontSize: 15, fontWeight: '600', color: C.text },
  cardTime: { fontSize: 13, color: C.muted, marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneBtn: { marginRight: 4 },
  emptyText: { textAlign: 'center', color: C.muted, marginTop: 48, fontSize: 14 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    elevation: 4,
  },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderRadius: 20, padding: 24, margin: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 16, textAlign: 'center' },
  picker: { alignSelf: 'center', marginBottom: 16 },
  nextBtn: {
    backgroundColor: C.accent, borderRadius: 999,
    padding: 14, alignItems: 'center', marginBottom: 8,
  },
  nextBtnText: { color: '#0b0c10', fontWeight: '700', fontSize: 15 },
  cancelBtn: { alignItems: 'center', padding: 10 },
  cancelText: { color: C.muted, fontSize: 14 },
});
