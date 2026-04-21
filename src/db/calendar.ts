import { supabase } from '../lib/supabase';
import type { AcademicCalendarEntry } from '../types';

export async function getCalendarEntries(): Promise<AcademicCalendarEntry[]> {
  const { data, error } = await supabase
    .from('academic_calendar')
    .select('*')
    .order('date', { ascending: true });
  if (error) throw error;
  return data as AcademicCalendarEntry[];
}

export async function getCalendarEntryForDate(date: string): Promise<AcademicCalendarEntry | null> {
  const { data, error } = await supabase
    .from('academic_calendar')
    .select('*')
    .eq('date', date)
    .maybeSingle();
  if (error) throw error;
  return data as AcademicCalendarEntry | null;
}
