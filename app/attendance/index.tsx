import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useSubjectsStore } from '../../src/stores/subjectsStore';
import { upsertAttendance } from '../../src/db/attendance';
import {
  computeAttendancePct,
  verdictForSubject,
} from '../../src/engine/predictionEngine';
import AttendanceBar from '../../src/components/AttendanceBar';
import VerdictChip from '../../src/components/VerdictChip';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98', danger: '#ff5c5c',
};

export default function AttendanceScreen() {
  const { profile } = useAuthStore();
  const { subjects, records, loading, fetch } = useSubjectsStore();
  const [marking, setMarking] = useState<string | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  useFocusEffect(
    useCallback(() => {
      if (profile) fetch(profile.id);
    }, [profile?.id, fetch]),
  );

  const subjectStats = useMemo(() =>
    subjects.map(subject => {
      const sr = records.filter(r => r.subject_id === subject.id);
      const present = sr.filter(r => r.status === 'present').length;
      const total = sr.length;
      const pct = computeAttendancePct(present, total);
      const verdict = verdictForSubject(present, total, subject.target_pct);
      const todayRecord = sr.find(r => r.date === todayStr);
      return { subject, present, total, pct, verdict, todayStatus: todayRecord?.status ?? null };
    }),
    [subjects, records, todayStr],
  );

  async function mark(subjectId: string, status: 'present' | 'absent') {
    if (!profile) return;
    setMarking(subjectId + status);
    await upsertAttendance(profile.id, subjectId, todayStr, status);
    await fetch(profile.id);
    setMarking(null);
  }

  if (loading && subjects.length === 0) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Attendance</Text>
      </View>
      <FlatList
        data={subjectStats}
        keyExtractor={item => item.subject.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <View style={s.card}>
            <TouchableOpacity
              style={s.cardTop}
              onPress={() => router.push(`/attendance/${item.subject.id}` as any)}
              accessibilityLabel={`${item.subject.name} detail`}
            >
              <View style={s.cardLeft}>
                <Text style={s.subjectName}>{item.subject.name}</Text>
                <Text style={s.subjectStats}>
                  {item.present}/{item.total} classes
                </Text>
              </View>
              <VerdictChip verdict={item.verdict} />
            </TouchableOpacity>

            <AttendanceBar
              present={item.present}
              total={item.total}
              targetPct={item.subject.target_pct}
            />

            <View style={s.markRow}>
              <Text style={s.markLabel}>Today</Text>
              <View style={s.markBtns}>
                <TouchableOpacity
                  style={[
                    s.markBtn,
                    item.todayStatus === 'present' && s.markBtnActiveGood,
                  ]}
                  onPress={() => mark(item.subject.id, 'present')}
                  disabled={marking !== null}
                  accessibilityLabel={`Mark ${item.subject.name} present`}
                >
                  {marking === item.subject.id + 'present' ? (
                    <ActivityIndicator size="small" color={C.accent} />
                  ) : (
                    <Text style={[
                      s.markBtnText,
                      item.todayStatus === 'present' && { color: '#0b0c10' },
                    ]}>P</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    s.markBtn,
                    item.todayStatus === 'absent' && s.markBtnActiveBad,
                  ]}
                  onPress={() => mark(item.subject.id, 'absent')}
                  disabled={marking !== null}
                  accessibilityLabel={`Mark ${item.subject.name} absent`}
                >
                  {marking === item.subject.id + 'absent' ? (
                    <ActivityIndicator size="small" color={C.danger} />
                  ) : (
                    <Text style={[
                      s.markBtnText,
                      item.todayStatus === 'absent' && { color: '#fff' },
                    ]}>A</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={s.emptyText}>No subjects yet. Add them in Settings.</Text>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { padding: 20, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: C.text },
  list: { padding: 16, gap: 12, paddingBottom: 80 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 16, gap: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { gap: 2 },
  subjectName: { fontSize: 16, fontWeight: '600', color: C.text },
  subjectStats: { fontSize: 12, color: C.muted },
  markRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  markLabel: { fontSize: 13, color: C.muted },
  markBtns: { flexDirection: 'row', gap: 8 },
  markBtn: {
    width: 44, height: 36, borderRadius: 8,
    backgroundColor: '#1a1b20', alignItems: 'center', justifyContent: 'center',
  },
  markBtnActiveGood: { backgroundColor: C.accent },
  markBtnActiveBad: { backgroundColor: C.danger },
  markBtnText: { fontSize: 14, fontWeight: '700', color: C.muted },
  emptyText: { textAlign: 'center', color: C.muted, marginTop: 48, fontSize: 14 },
});
