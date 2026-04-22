import { supabase } from '../lib/supabase';

export type GymSession = {
  id: string;
  user_id: string;
  scheduled_at: string;
  done: boolean;
  notes: string | null;
  created_at: string;
};

export async function getGymSessions(userId: string): Promise<GymSession[]> {
  const { data } = await supabase
    .from('gym_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('scheduled_at', { ascending: true });
  return data ?? [];
}

export async function addGymSession(
  userId: string,
  scheduledAt: string,
  notes?: string,
): Promise<void> {
  await supabase.from('gym_sessions').insert({
    user_id: userId,
    scheduled_at: scheduledAt,
    notes: notes ?? null,
  });
}

export async function markGymDone(sessionId: string): Promise<void> {
  await supabase
    .from('gym_sessions')
    .update({ done: true })
    .eq('id', sessionId);
}

export async function deleteGymSession(sessionId: string): Promise<void> {
  await supabase.from('gym_sessions').delete().eq('id', sessionId);
}
