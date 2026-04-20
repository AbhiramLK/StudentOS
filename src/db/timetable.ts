import * as Crypto from 'expo-crypto';
import { getDb } from './index';
import type { TimetableSlot } from '../types';

export function getAllSlots(): TimetableSlot[] {
  return getDb().getAllSync<TimetableSlot>(
    'SELECT * FROM timetable_slots ORDER BY day_of_week, start_time'
  );
}

export function getSlotsForDay(day_of_week: number): TimetableSlot[] {
  return getDb().getAllSync<TimetableSlot>(
    'SELECT * FROM timetable_slots WHERE day_of_week = ? ORDER BY start_time',
    day_of_week
  );
}

export function getSlotsForSubject(subject_id: string): TimetableSlot[] {
  return getDb().getAllSync<TimetableSlot>(
    'SELECT * FROM timetable_slots WHERE subject_id = ? ORDER BY day_of_week, start_time',
    subject_id
  );
}

export function createSlot(
  subject_id: string,
  day_of_week: number,
  start_time: string,
  end_time: string
): TimetableSlot {
  const id = Crypto.randomUUID();
  getDb().runSync(
    'INSERT INTO timetable_slots (id, subject_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)',
    id, subject_id, day_of_week, start_time, end_time
  );
  return { id, subject_id, day_of_week, start_time, end_time };
}

export function deleteSlot(id: string): void {
  getDb().runSync('DELETE FROM timetable_slots WHERE id = ?', id);
}

/** Count how many times this subject's slots recur from fromDate to toDate (inclusive). */
export function countFutureSlots(subject_id: string, fromDate: string, toDate: string): number {
  const slots = getSlotsForSubject(subject_id);
  if (slots.length === 0) return 0;

  const from = new Date(fromDate);
  const to = new Date(toDate);
  let count = 0;
  const cursor = new Date(from);

  while (cursor <= to) {
    // JS getDay(): 0=Sun,1=Mon...6=Sat → convert to 0=Mon...6=Sun
    const dow = (cursor.getDay() + 6) % 7;
    count += slots.filter(s => s.day_of_week === dow).length;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}
