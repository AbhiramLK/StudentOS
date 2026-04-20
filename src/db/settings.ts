import { getDb } from './index';
import type { Settings } from '../types';

export function getSettings(): Settings | null {
  return getDb().getFirstSync<Settings>('SELECT * FROM settings LIMIT 1');
}

export function saveSettings(semester_end_date: string): void {
  const existing = getSettings();
  if (existing) {
    getDb().runSync('UPDATE settings SET semester_end_date = ?', semester_end_date);
  } else {
    getDb().runSync('INSERT INTO settings (id, semester_end_date) VALUES (1, ?)', semester_end_date);
  }
}
