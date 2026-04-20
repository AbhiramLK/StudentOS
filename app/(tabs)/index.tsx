import { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSubjectsStore } from '../../src/stores/subjectsStore';
import { useTimetableStore } from '../../src/stores/timetableStore';
import { ClassCard } from '../../src/components/ClassCard';
import { AttendanceBar } from '../../src/components/AttendanceBar';
import { getRecordsForSubject, upsertRecord } from '../../src/db/attendance';
import { getSettings } from '../../src/db/settings';
import { countFutureSlots } from '../../src/db/timetable';
import { predict } from '../../src/engine/predictionEngine';

export default function HomeScreen() {
  const { subjects, load: loadSubjects } = useSubjectsStore();
  const { slots, load: loadSlots } = useTimetableStore();
  const [refreshKey, setRefreshKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadSubjects();
      loadSlots();
    }, [])
  );

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayDow = (today.getDay() + 6) % 7;
  const settings = getSettings();

  const todaySlots = useMemo(
    () => slots.filter(s => s.day_of_week === todayDow).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [slots, todayDow]
  );

  const predictions = useMemo(() => {
    return subjects.map(subject => {
      const records = getRecordsForSubject(subject.id);
      const futureSlotsCount = settings
        ? countFutureSlots(subject.id, todayStr, settings.semester_end_date)
        : 0;
      return { subject, prediction: predict(subject, records, futureSlotsCount), records };
    });
  }, [subjects, slots, refreshKey]);

  const worstSubject = useMemo(() => {
    if (predictions.length === 0) return null;
    return predictions.reduce((worst, curr) =>
      curr.prediction.currentPct < worst.prediction.currentPct ? curr : worst
    );
  }, [predictions]);

  const handleMark = (subjectId: string, status: 'present' | 'absent') => {
    upsertRecord(subjectId, todayStr, status);
    setRefreshKey(k => k + 1);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Today</Text>
      <Text style={styles.date}>{today.toDateString()}</Text>

      {worstSubject && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ATTENDANCE HEALTH</Text>
          <AttendanceBar
            pct={worstSubject.prediction.currentPct}
            threshold={worstSubject.subject.threshold}
            label={worstSubject.subject.name}
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>TODAY'S CLASSES</Text>
        {todaySlots.length === 0 && (
          <Text style={styles.empty}>No classes today 🎉</Text>
        )}
        {todaySlots.map(slot => {
          const entry = predictions.find(p => p.subject.id === slot.subject_id);
          if (!entry) return null;
          const todayRecord = entry.records.find(r => r.date === todayStr);
          return (
            <ClassCard
              key={slot.id}
              slot={slot}
              subject={entry.subject}
              prediction={entry.prediction}
              markedStatus={todayRecord?.status === 'cancelled' ? null : (todayRecord?.status ?? null)}
              onMarkPresent={() => handleMark(entry.subject.id, 'present')}
              onMarkAbsent={() => handleMark(entry.subject.id, 'absent')}
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingTop: 56 },
  heading: { fontSize: 28, fontWeight: '700', color: '#111827' },
  date: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', letterSpacing: 1, marginBottom: 8 },
  empty: { fontSize: 15, color: '#6b7280', textAlign: 'center', paddingVertical: 24 },
});
