import { predict } from './predictionEngine';
import type { Subject, AttendanceRecord } from '../types';

const subject: Subject = { id: '1', name: 'Maths', threshold: 75, created_at: 0 };

function rec(status: 'present' | 'absent' | 'cancelled', date: string): AttendanceRecord {
  return { id: date + status, subject_id: '1', date, status };
}

describe('predict', () => {
  it('safe when many skips remain', () => {
    // 10 classes: 8 present, 2 absent = 80%. 20 future slots.
    // maxAbsences = floor(30 * 0.25) = 7, currentAbsences = 2, safeSkips = 5
    const records = [
      ...Array.from({ length: 8 }, (_, i) => rec('present', `2026-04-${String(i + 1).padStart(2, '0')}`)),
      ...Array.from({ length: 2 }, (_, i) => rec('absent', `2026-04-${String(i + 9).padStart(2, '0')}`)),
    ];
    const result = predict(subject, records, 20);
    expect(result.currentPct).toBe(80);
    expect(result.safeSkips).toBe(5);
    expect(result.verdict).toBe('safe');
  });

  it('warning when 1 skip left', () => {
    // 10 classes: 8 present, 2 absent. 2 future slots.
    // maxAbsences = floor(12 * 0.25) = 3, currentAbsences = 2, safeSkips = 1
    const records = [
      ...Array.from({ length: 8 }, (_, i) => rec('present', `2026-04-${String(i + 1).padStart(2, '0')}`)),
      ...Array.from({ length: 2 }, (_, i) => rec('absent', `2026-04-${String(i + 9).padStart(2, '0')}`)),
    ];
    const result = predict(subject, records, 2);
    expect(result.verdict).toBe('warning');
    expect(result.safeSkips).toBe(1);
  });

  it('danger when at skip limit', () => {
    // 10 classes: 7 present, 3 absent = 70%. 4 future slots.
    // maxAbsences = floor(14 * 0.25) = 3, currentAbsences = 3, safeSkips = 0
    const records = [
      ...Array.from({ length: 7 }, (_, i) => rec('present', `2026-04-${String(i + 1).padStart(2, '0')}`)),
      ...Array.from({ length: 3 }, (_, i) => rec('absent', `2026-04-${String(i + 8).padStart(2, '0')}`)),
    ];
    const result = predict(subject, records, 4);
    expect(result.verdict).toBe('danger');
    expect(result.safeSkips).toBe(0);
  });

  it('cancelled records do not count toward total', () => {
    const records = [
      rec('present', '2026-04-01'),
      rec('cancelled', '2026-04-02'),
      rec('absent', '2026-04-03'),
    ];
    const result = predict(subject, records, 10);
    // total = 2 (not 3), attended = 1
    expect(result.currentPct).toBe(50);
  });

  it('returns safe when no classes at all', () => {
    const result = predict(subject, [], 0);
    expect(result.verdict).toBe('safe');
    expect(result.currentPct).toBe(100);
  });

  it('handles no prior records with future slots', () => {
    // total=0, future=10, maxAbsences=floor(10*0.25)=2, safeSkips=2
    const result = predict(subject, [], 10);
    expect(result.safeSkips).toBe(2);
    expect(result.verdict).toBe('safe');
    expect(result.currentPct).toBe(100);
  });
});
