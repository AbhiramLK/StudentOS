import { supabase } from '../lib/supabase';
import type { TimetableSlot, UserTimetableEntry } from '../types';

export async function getAllSlots(): Promise<TimetableSlot[]> {
  const { data } = await supabase
    .from('timetable_slots').select('*')
    .order('day_of_week').order('slot_number');
  return data ?? [];
}

export async function getUserTimetable(userId: string): Promise<UserTimetableEntry[]> {
  const { data } = await supabase
    .from('user_timetable')
    .select('*, slot:timetable_slots(*)')
    .eq('user_id', userId);
  return data ?? [];
}

export async function upsertUserTimetableEntry(
  userId: string, slotId: string, subjectName: string
): Promise<void> {
  const { error } = await supabase
    .from('user_timetable')
    .upsert(
      { user_id: userId, slot_id: slotId, subject_name: subjectName },
      { onConflict: 'user_id,slot_id' }
    );
  if (error) throw error;
}

export async function deleteUserTimetableEntry(
  userId: string, slotId: string
): Promise<void> {
  const { error } = await supabase
    .from('user_timetable')
    .delete().eq('user_id', userId).eq('slot_id', slotId);
  if (error) throw error;
}

export async function getSlotsForEffectiveDay(
  userId: string, dayOfWeek: number
): Promise<UserTimetableEntry[]> {
  const { data } = await supabase
    .from('user_timetable')
    .select('*, slot:timetable_slots(*)')
    .eq('user_id', userId)
    .eq('slot.day_of_week', dayOfWeek);
  return (data ?? []).filter((e) => e.slot !== null);
}
