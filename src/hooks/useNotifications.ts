import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { requestNotificationPermission, scheduleDailyReminder } from '../engine/notifications';
import { supabase } from '../lib/supabase';

async function buildReminderContent(userId: string): Promise<{ title: string; body: string }> {
  const todayDow = new Date().getDay();

  type TimetableRow = {
    subject_name: string;
    timetable_slots: { day_of_week: number; start_time: string } | null;
  };
  type AttendanceRow = { subject_id: string; status: string };
  type SubjectRow = { id: string; name: string; target_pct: number };

  const { data: entries } = await supabase
    .from('user_timetable')
    .select('subject_name, timetable_slots(day_of_week, start_time)')
    .eq('user_id', userId);

  const todayClasses = ((entries ?? []) as unknown as TimetableRow[])
    .filter(e => e.timetable_slots?.day_of_week === todayDow)
    .sort((a, b) =>
      (a.timetable_slots?.start_time ?? '').localeCompare(b.timetable_slots?.start_time ?? ''),
    );

  const { data: subjects } = await supabase
    .from('subjects')
    .select('id, name, target_pct')
    .eq('user_id', userId);

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: records } = await supabase
    .from('attendance_records')
    .select('subject_id, status')
    .eq('user_id', userId)
    .gte('date', since);

  const atRisk: string[] = [];
  for (const sub of (subjects ?? []) as SubjectRow[]) {
    const subRecords = ((records ?? []) as AttendanceRow[]).filter(r => r.subject_id === sub.id);
    if (subRecords.length > 0) {
      const present = subRecords.filter(r => r.status === 'present').length;
      const pct = present / subRecords.length;
      if (pct < sub.target_pct / 100) {
        atRisk.push(sub.name);
      }
    }
  }

  let body: string;
  if (todayClasses.length > 0) {
    const first = todayClasses[0];
    body = `First class: ${first.subject_name} at ${first.timetable_slots?.start_time ?? ''}`;
  } else {
    body = 'No classes today. Good time to catch up!';
  }

  if (atRisk.length > 0) {
    body += `\n⚠️ ${atRisk[0]} attendance below target`;
  }

  return { title: 'Good morning! 👋', body };
}

export function useNotifications() {
  const { profile } = useAuthStore();
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useEffect(() => {
    async function refresh() {
      if (!profileRef.current) return;
      const granted = await requestNotificationPermission();
      if (!granted) return;
      try {
        const { title, body } = await buildReminderContent(profileRef.current.id);
        await scheduleDailyReminder(7, 0, title, body);
      } catch {
        // best-effort
      }
    }
    refresh();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [profile?.id]);
}
