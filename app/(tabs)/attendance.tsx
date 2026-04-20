import { useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSubjectsStore } from '../../src/stores/subjectsStore';
import { AttendanceBar } from '../../src/components/AttendanceBar';
import { getRecordsForSubject } from '../../src/db/attendance';
import { getSettings } from '../../src/db/settings';
import { countFutureSlots } from '../../src/db/timetable';
import { predict } from '../../src/engine/predictionEngine';

export default function AttendanceScreen() {
  const router = useRouter();
  const { subjects, load } = useSubjectsStore();
  const settings = getSettings();
  const todayStr = new Date().toISOString().split('T')[0];

  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <View style={s.screen}>
      <Text style={s.heading}>Attendance</Text>
      <FlatList
        data={subjects}
        keyExtractor={sub => sub.id}
        contentContainerStyle={s.list}
        renderItem={({ item: subject }) => {
          const records = getRecordsForSubject(subject.id);
          const futureSlotsCount = settings
            ? countFutureSlots(subject.id, todayStr, settings.semester_end_date)
            : 0;
          const prediction = predict(subject, records, futureSlotsCount);
          return (
            <TouchableOpacity style={s.card} onPress={() => router.push(`/subject/${subject.id}`)}>
              <AttendanceBar pct={prediction.currentPct} threshold={subject.threshold} label={subject.name} />
              <Text style={s.detail}>
                {prediction.safeSkips > 0
                  ? `${prediction.safeSkips} safe skips left`
                  : 'No more skips — attend all classes'}
              </Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={s.empty}>No subjects yet. Add them in onboarding.</Text>}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb', paddingTop: 56 },
  heading: { fontSize: 28, fontWeight: '700', paddingHorizontal: 16, marginBottom: 16 },
  list: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1 },
  detail: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 48 },
});
