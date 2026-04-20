import { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { getSubjectById } from '../../src/db/subjects';
import { getRecordsForSubject, upsertRecord } from '../../src/db/attendance';
import { getSettings } from '../../src/db/settings';
import { countFutureSlots } from '../../src/db/timetable';
import { predict } from '../../src/engine/predictionEngine';
import { VerdictChip } from '../../src/components/VerdictChip';
import { AttendanceBar } from '../../src/components/AttendanceBar';
import type { AttendanceRecord } from '../../src/types';

export default function SubjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const todayStr = new Date().toISOString().split('T')[0];

  const subject = getSubjectById(id);
  const settings = getSettings();

  const reload = () => {
    if (!id) return;
    setRecords(getRecordsForSubject(id));
  };

  useFocusEffect(useCallback(() => {
    if (subject) navigation.setOptions({ title: subject.name });
    reload();
  }, [id]));

  if (!subject) return <View style={s.screen}><Text>Subject not found.</Text></View>;

  const futureSlotsCount = settings ? countFutureSlots(id, todayStr, settings.semester_end_date) : 0;
  const prediction = predict(subject, records, futureSlotsCount);

  const handleMark = (date: string, status: 'present' | 'absent') => {
    upsertRecord(id, date, status);
    reload();
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <AttendanceBar pct={prediction.currentPct} threshold={subject.threshold} label={subject.name} />
        <VerdictChip verdict={prediction.verdict} message={prediction.message} />
        <Text style={s.skips}>
          {prediction.safeSkips > 0
            ? `${prediction.safeSkips} safe skip${prediction.safeSkips !== 1 ? 's' : ''} remaining`
            : 'No safe skips left'}
        </Text>
      </View>

      <Text style={s.sectionLabel}>HISTORY</Text>
      <FlatList
        data={records}
        keyExtractor={r => r.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <View style={s.record}>
            <Text style={s.date}>{item.date}</Text>
            <View style={s.recordActions}>
              <TouchableOpacity
                style={[s.statusBtn, item.status === 'present' && s.statusPresent]}
                onPress={() => handleMark(item.date, 'present')}
              >
                <Text style={s.statusText}>P</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.statusBtn, item.status === 'absent' && s.statusAbsent]}
                onPress={() => handleMark(item.date, 'absent')}
              >
                <Text style={s.statusText}>A</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={s.empty}>No records yet. Mark attendance from the home screen.</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  header: { backgroundColor: '#fff', padding: 16, marginBottom: 8 },
  skips: { marginTop: 8, fontSize: 14, color: '#6b7280' },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', letterSpacing: 1, paddingHorizontal: 16, marginBottom: 4 },
  list: { padding: 16 },
  record: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 6 },
  date: { fontSize: 14 },
  recordActions: { flexDirection: 'row', gap: 8 },
  statusBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  statusPresent: { backgroundColor: '#dcfce7' },
  statusAbsent: { backgroundColor: '#fee2e2' },
  statusText: { fontSize: 13, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 24, fontSize: 14 },
});
