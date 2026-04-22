import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useSubjectsStore } from '../../src/stores/subjectsStore';
import { useTimetableStore } from '../../src/stores/timetableStore';
import { computeAttendancePct } from '../../src/engine/predictionEngine';
import { getMessMenuForDay, computeDayCycle } from '../../src/db/mess';
import { supabase } from '../../src/lib/supabase';
import MealRow from '../../src/components/MealRow';
import type { MessMenu } from '../../src/types';

const C = {
  bg: '#0b0c10', card: '#111217', accent: '#66fcf1',
  text: '#eaeaea', muted: '#8a8f98', danger: '#ff5c5c', warning: '#ffc857',
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning,';
  if (h < 17) return 'Good Afternoon,';
  return 'Good Evening,';
}

export default function HomeScreen() {
  const { profile } = useAuthStore();
  const { subjects, records, fetch: fetchSubjects } = useSubjectsStore();
  const { userEntries, calendarEntries, fetch: fetchTimetable } = useTimetableStore();
  const [messMenus, setMessMenus] = useState<MessMenu[]>([]);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayDow = (today.getDay() + 6) % 7; // 0=Mon

  const calendarEntry = useMemo(
    () => calendarEntries.find(e => e.date === todayStr) ?? null,
    [calendarEntries, todayStr],
  );

  const isHoliday = calendarEntry?.type === 'holiday';
  const effectiveDow =
    calendarEntry?.type === 'day_change'
      ? (calendarEntry.substitute_day ?? todayDow)
      : todayDow;

  useFocusEffect(
    useCallback(() => {
      if (profile) {
        fetchSubjects(profile.id);
        fetchTimetable(profile.id);
      }
    }, [profile?.id]),
  );

  useEffect(() => {
    if (!profile?.mess_id) return;
    supabase
      .from('messes')
      .select('*')
      .eq('id', profile.mess_id)
      .single()
      .then(({ data: mess }) => {
        if (!mess) return;
        const dayCycle = computeDayCycle(
          (mess as any).cycle_start_date,
          (mess as any).cycle_length,
        );
        getMessMenuForDay(mess.id, dayCycle).then(setMessMenus);
      });
  }, [profile?.mess_id]);

  const todayEntries = useMemo(
    () =>
      isHoliday
        ? []
        : userEntries
            .filter(e => e.slot?.day_of_week === effectiveDow)
            .sort((a, b) =>
              (a.slot?.start_time ?? '').localeCompare(b.slot?.start_time ?? ''),
            ),
    [userEntries, effectiveDow, isHoliday],
  );

  const todayEvents = useMemo(
    () => calendarEntries.filter(e => e.date === todayStr && e.type === 'event'),
    [calendarEntries, todayStr],
  );

  const meals = useMemo(() => {
    const order = ['breakfast', 'lunch', 'evening', 'dinner'] as const;
    return order.map(meal => ({
      meal,
      items: messMenus.find(m => m.meal === meal)?.items ?? [],
    }));
  }, [messMenus]);

  function getAttPct(subjectName: string): number {
    const subject = subjects.find(s => s.name === subjectName);
    if (!subject) return 0;
    const sr = records.filter(r => r.subject_id === subject.id);
    return computeAttendancePct(
      sr.filter(r => r.status === 'present').length,
      sr.length,
    );
  }

  function pctColor(pct: number, target: number): string {
    if (pct < target) return C.danger;
    if (pct < target + 5) return C.warning;
    return C.accent;
  }

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{getGreeting()}</Text>
            <Text style={s.name}>{profile?.name ?? ''}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            accessibilityLabel="Settings"
            style={s.iconBtn}
          >
            <Ionicons name="settings-outline" size={22} color={C.muted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={s.updatesBtn}
          onPress={() => router.push('/feed')}
          accessibilityLabel="Open feed"
        >
          <Ionicons name="flash-outline" size={15} color={C.text} />
          <Text style={s.updatesBtnText}>Stored Updates</Text>
          <View style={s.dot} />
        </TouchableOpacity>

        <View style={s.section}>
          <Text style={s.sectionTitle}>
            {isHoliday
              ? `Today — ${calendarEntry?.description ?? 'Holiday'}`
              : 'Today'}
          </Text>
          {isHoliday ? (
            <Text style={s.emptyText}>No classes today</Text>
          ) : todayEntries.length === 0 ? (
            <Text style={s.emptyText}>No classes scheduled</Text>
          ) : (
            todayEntries.map(entry => {
              const subject = subjects.find(sub => sub.name === entry.subject_name);
              const pct = getAttPct(entry.subject_name);
              const color = pctColor(pct, subject?.target_pct ?? 75);
              return (
                <View key={entry.id} style={s.classRow}>
                  <Text style={s.classLabel}>
                    {entry.slot?.start_time.slice(0, 5)} — {entry.subject_name}
                  </Text>
                  <Text style={[s.classPct, { color }]}>{pct}%</Text>
                </View>
              );
            })
          )}
        </View>

        {todayEvents.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Suggested</Text>
            {todayEvents.map(ev => (
              <Text key={ev.id} style={s.suggestedItem}>{ev.description}</Text>
            ))}
          </View>
        )}

        <View style={s.section}>
          <Text style={s.sectionTitle}>Food Today</Text>
          {meals.map(({ meal, items }) => (
            <MealRow key={meal} meal={meal} items={items} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 20, paddingBottom: 80 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 20,
  },
  greeting: { fontSize: 16, color: C.muted },
  name: { fontSize: 22, fontWeight: '600', color: C.text },
  iconBtn: { padding: 8 },
  updatesBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.card, borderRadius: 999,
    paddingVertical: 10, paddingHorizontal: 16,
    marginBottom: 28, alignSelf: 'flex-start', position: 'relative',
  },
  updatesBtnText: { fontSize: 14, color: C.text },
  dot: {
    width: 8, height: 8, backgroundColor: C.accent,
    borderRadius: 4, position: 'absolute', top: 6, right: 6,
  },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 12, color: C.muted, marginBottom: 10,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  classRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  classLabel: { fontSize: 14, color: C.text },
  classPct: { fontSize: 14, fontWeight: '700' },
  emptyText: { fontSize: 14, color: C.muted },
  suggestedItem: { fontSize: 14, color: C.text, marginBottom: 6 },
});
