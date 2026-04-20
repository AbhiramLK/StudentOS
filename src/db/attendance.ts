import * as Crypto from 'expo-crypto';
import { getDb } from './index';
import type { AttendanceRecord, AttendanceStatus } from '../types';

export function getRecordsForSubject(subject_id: string): AttendanceRecord[] {
  return getDb().getAllSync<AttendanceRecord>(
    'SELECT * FROM attendance_records WHERE subject_id = ? ORDER BY date DESC',
    subject_id
  );
}

export function getRecordForDate(subject_id: string, date: string): AttendanceRecord | null {
  return getDb().getFirstSync<AttendanceRecord>(
    'SELECT * FROM attendance_records WHERE subject_id = ? AND date = ?',
    subject_id, date
  );
}

export function upsertRecord(
  subject_id: string,
  date: string,
  status: AttendanceStatus
): AttendanceRecord {
  const existing = getRecordForDate(subject_id, date);
  if (existing) {
    getDb().runSync('UPDATE attendance_records SET status = ? WHERE id = ?', status, existing.id);
    return { ...existing, status };
  }
  const id = Crypto.randomUUID();
  getDb().runSync(
    'INSERT INTO attendance_records (id, subject_id, date, status) VALUES (?, ?, ?, ?)',
    id, subject_id, date, status
  );
  return { id, subject_id, date, status };
}
