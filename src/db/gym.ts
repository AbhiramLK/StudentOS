import { supabase } from '../lib/supabase';
import type { GymSession } from '../types';

export async function getGymSessions(userId: string, weekStart: string, weekEnd: string): Promise<GymSession[]> {
  const { data, error } = await supabase
    .from('gym_sessions')
    .select('*')
    .eq('user_id', userId)
    .gte('date', weekStart)
    .lte('date', weekEnd)
    .order('date', { ascending: true });
  if (error) throw error;
  return data as GymSession[];
}

export async function logGymSession(
  userId: string,
  date: string,
  startTime: string,
  durationMin: number,
  notes: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('gym_sessions')
    .insert({ user_id: userId, date, start_time: startTime, duration_min: durationMin, notes });
  if (error) throw error;
}
