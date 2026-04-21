import { supabase } from '../lib/supabase';
import type { AttendanceRecord, AttendanceStatus } from '../types';

export async function getAttendanceRecords(userId: string, subjectId: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('user_id', userId)
    .eq('subject_id', subjectId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data as AttendanceRecord[];
}

export async function getAllAttendanceRecords(userId: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data as AttendanceRecord[];
}

export async function upsertAttendance(
  userId: string,
  subjectId: string,
  date: string,
  status: AttendanceStatus,
): Promise<void> {
  const { error } = await supabase.from('attendance_records').upsert(
    { user_id: userId, subject_id: subjectId, date, status },
    { onConflict: 'user_id,subject_id,date' },
  );
  if (error) throw error;
}
