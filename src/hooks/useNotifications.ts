import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { requestNotificationPermission, scheduleDailyReminder } from '../engine/notifications';
import { supabase } from '../lib/supabase';

async function buildReminderContent(userId: string): Promise<{ title: string; body: string }> {
  const todayDow = new Date().getDay(); // 0=Sunday … 6=Saturday

  // Today's classes via user_timetable → timetable_slots join
  const { data: entries } = await supabase
    .from('user_timetable')
    .select('subject_name, timetable_slots(day_of_week, start_time)')
    .eq('user_id', userId);

  const todayClasses = ((entries ?? []) as any[])
    .filter(e => e.timetable_slots?.day_of_week === todayDow)
    .sort((a, b) =>
      (a.timetable_slots?.start_time ?? '').localeCompare(b.timetable_slots?.start_time ?? ''),
    );

  // At-risk subjects using subject_id
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
  for (const sub of (subjects ?? []) as any[]) {
    const subRecords = ((records ?? []) as any[]).filter(r => r.subject_id === sub.id);
    if (subRecords.length > 0) {
      const present = subRecords.filter(r => r.status === 'present').length;
      const pct = present / subRecords.length;
      if (pct < sub.target_pct / 100) {
        atRisk.push(sub.name as string);
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

  useEffect(() => {
    async function refresh() {
      if (!profile) return;
      const granted = await requestNotificationPermission();
      if (!granted) return;
      try {
        const { title, body } = await buildReminderContent(profile.id);
        await scheduleDailyReminder(7, 0, title, body);
      } catch {
        // Notification scheduling is best-effort — never crash the app
      }
    }

    refresh();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [profile?.id]);
}
