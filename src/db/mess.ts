import { supabase } from '../lib/supabase';
import type { Mess, MessMenu } from '../types';

export async function getMesses(): Promise<Mess[]> {
  const { data, error } = await supabase.from('messes').select('*').order('name');
  if (error) throw error;
  return data as Mess[];
}

export async function getMessMenuForDay(messId: string, dayCycle: number): Promise<MessMenu[]> {
  const { data, error } = await supabase
    .from('mess_menus')
    .select('*')
    .eq('mess_id', messId)
    .eq('day_cycle', dayCycle)
    .order('meal');
  if (error) throw error;
  return data as MessMenu[];
}

export function computeDayCycle(cycleStartDate: string, cycleLength: number): number {
  const start = new Date(cycleStartDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return (diffDays % cycleLength) + 1;
}
