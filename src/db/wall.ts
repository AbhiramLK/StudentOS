import { supabase } from '../lib/supabase';
import type { WallEntry } from '../types';

export async function getWallEntries(): Promise<WallEntry[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('wall_entries')
    .select('*')
    .gt('expires_at', now)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as WallEntry[];
}

export async function createWallEntry(content: string, color: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('wall_entries')
    .insert({ content, color, expires_at: expiresAt });
  if (error) throw error;
}
