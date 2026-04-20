import type { Subject, AttendanceRecord, PredictionResult, Verdict } from '../types';

export function predict(
  subject: Subject,
  records: AttendanceRecord[],
  futureSlotsCount: number
): PredictionResult {
  const countable = records.filter(r => r.status !== 'cancelled');
  const attended = countable.filter(r => r.status === 'present').length;
  const total = countable.length;

  if (total + futureSlotsCount === 0) {
    return { currentPct: 100, safeSkips: 0, verdict: 'safe', message: '✅ No classes scheduled' };
  }

  const currentPct = total === 0 ? 100 : Math.round((attended / total) * 100);
  const maxAbsences = Math.floor((total + futureSlotsCount) * (1 - subject.threshold / 100));
  const currentAbsences = total - attended;
  const safeSkips = maxAbsences - currentAbsences;

  const verdict: Verdict = safeSkips >= 2 ? 'safe' : safeSkips === 1 ? 'warning' : 'danger';

  const messages: Record<Verdict, string> = {
    safe: '✅ Safe to skip',
    warning: '⚠️ Skip carefully — 1 skip left',
    danger: "🚫 Don't skip — attendance at risk",
  };

  return { currentPct, safeSkips, verdict, message: messages[verdict] };
}
