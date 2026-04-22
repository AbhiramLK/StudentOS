import { useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useSubjectsStore } from '../../src/stores/subjectsStore';
import { upsertAttendance } from '../../src/db/attendance';
import {
  computeAttendancePct,
  canSkip,
  classesToRecover,
  verdictForSubject,
} from '../../src/engine/predictionEngine';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98', danger: '#ff5c5c', warning: '#ffc857',
};

export default function SubjectDetailScreen() {
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const { profile } = useAuthStore();
  const { subjects, records, fetch } = useSubjectsStore();

  const subject = useMemo(
    () => subjects.find(s => s.id === subjectId),
    [subjects, subjectId],
  );

  const subjectRecords = useMemo(
    () => records
      .filter(r => r.subject_id === subjectId)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [records, subjectId],
  );

  useFocusEffect(
    useCallback(() => {
      if (profile) fetch(profile.id);
    }, [profile?.id, fetch]),
  );

  const stats = useMemo(() => {
    if (!subject) return null;
    const present = subjectRecords.filter(r => r.status === 'present').length;
    const total = subjectRecords.length;
    const pct = computeAttendancePct(present, total);
    const verdict = verdictForSubject(present, total, subject.target_pct);
    const skipsLeft = (() => {
      let n = 0;
      while (canSkip(present, total + n, subject.target_pct)) n++;
      return n;
    })();
    const needed = classesToRecover(present, total, subject.target_pct);
    const verdictColor =
      verdict === 'safe' ? C.accent : verdict === 'warning' ? C.warning : C.danger;
    return { present, total, pct, verdict, skipsLeft, needed, verdictColor };
  }, [subject, subjectRecords]);

  if (!subject || !stats) return null;

  async function toggleRecord(date: string, currentStatus: 'present' | 'absent') {
    if (!profile) return;
    const next = currentStatus === 'present' ? 'absent' : 'present';
    await upsertAttendance(profile.id, subject!.id, date, next);
    await fetch(profile.id);
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back" style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{subject.name}</Text>
      </View>

      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={[s.statValue, { color: stats.verdictColor }]}>{stats.pct}%</Text>
          <Text style={s.statLabel}>Attendance</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statValue}>{stats.present}/{stats.total}</Text>
          <Text style={s.statLabel}>Present/Total</Text>
        </View>
        {stats.verdict === 'danger' ? (
          <View style={s.statBox}>
            <Text style={[s.statValue, { color: C.danger }]}>{stats.needed}</Text>
            <Text style={s.statLabel}>Classes needed</Text>
          </View>
        ) : (
          <View style={s.statBox}>
            <Text style={[s.statValue, { color: C.accent }]}>{stats.skipsLeft}</Text>
            <Text style={s.statLabel}>Safe skips</Text>
          </View>
        )}
      </View>

      <FlatList
        data={subjectRecords}
        keyExtractor={r => r.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.record}
            onPress={() => toggleRecord(item.date, item.status)}
            accessibilityLabel={`${item.date} ${item.status}, tap to toggle`}
          >
            <Text style={s.recordDate}>{item.date}</Text>
            <View style={[
              s.badge,
              item.status === 'present' ? s.badgePresent : s.badgeAbsent,
            ]}>
              <Text style={[
                s.badgeText,
                item.status === 'present' ? { color: C.accent } : { color: C.danger },
              ]}>
                {item.status === 'present' ? 'Present' : 'Absent'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={s.emptyText}>No records yet. Mark attendance from the main screen.</Text>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 20, paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: '700', color: C.text, flex: 1 },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: C.card, marginHorizontal: 16,
    borderRadius: 14, padding: 16, marginBottom: 16,
  },
  statBox: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: 22, fontWeight: '700', color: C.text },
  statLabel: { fontSize: 11, color: C.muted },
  list: { paddingHorizontal: 16, gap: 8, paddingBottom: 80 },
  record: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', backgroundColor: C.card,
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12,
  },
  recordDate: { fontSize: 14, color: C.text },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgePresent: { backgroundColor: '#1a3a38' },
  badgeAbsent: { backgroundColor: '#3a1010' },
  badgeText: { fontSize: 12, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: C.muted, marginTop: 48, fontSize: 14 },
});
