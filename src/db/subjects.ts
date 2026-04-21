import { supabase } from '../lib/supabase';
import type { Subject } from '../types';

export async function getSubjects(userId: string): Promise<Subject[]> {
  const { data } = await supabase
    .from('subjects').select('*').eq('user_id', userId).order('name');
  return data ?? [];
}

export async function createSubject(
  userId: string, name: string, targetPct: number
): Promise<Subject> {
  const { data, error } = await supabase
    .from('subjects')
    .insert({ user_id: userId, name, target_pct: targetPct })
    .select().single();
  if (error) throw error;
  return data;
}

export async function deleteSubject(id: string): Promise<void> {
  const { error } = await supabase.from('subjects').delete().eq('id', id);
  if (error) throw error;
}
