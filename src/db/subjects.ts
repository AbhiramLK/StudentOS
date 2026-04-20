import * as Crypto from 'expo-crypto';
import { getDb } from './index';
import type { Subject } from '../types';

export function getAllSubjects(): Subject[] {
  return getDb().getAllSync<Subject>('SELECT * FROM subjects ORDER BY created_at ASC');
}

export function getSubjectById(id: string): Subject | null {
  return getDb().getFirstSync<Subject>('SELECT * FROM subjects WHERE id = ?', id);
}

export function createSubject(name: string, threshold = 75): Subject {
  const id = Crypto.randomUUID();
  const created_at = Date.now();
  getDb().runSync(
    'INSERT INTO subjects (id, name, threshold, created_at) VALUES (?, ?, ?, ?)',
    id, name, threshold, created_at
  );
  return { id, name, threshold, created_at };
}

export function updateSubject(id: string, name: string, threshold: number): void {
  getDb().runSync('UPDATE subjects SET name = ?, threshold = ? WHERE id = ?', name, threshold, id);
}

export function deleteSubject(id: string): void {
  getDb().runSync('DELETE FROM subjects WHERE id = ?', id);
}
