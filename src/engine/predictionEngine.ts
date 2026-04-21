export type Verdict = 'safe' | 'warning' | 'danger';

export function computeAttendancePct(present: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((present / total) * 1000) / 10;
}

export function canSkip(present: number, total: number, targetPct: number): boolean {
  const afterSkip = present / (total + 1);
  return afterSkip * 100 >= targetPct;
}

export function classesToRecover(present: number, total: number, targetPct: number): number {
  const target = targetPct / 100;
  if (present / Math.max(total, 1) >= target) return 0;
  let n = 0;
  while (n < 100) {
    n++;
    if ((present + n) / (total + n) >= target) return n;
  }
  return n;
}

export function verdictForSubject(present: number, total: number, targetPct: number): Verdict {
  const pct = computeAttendancePct(present, total);
  if (pct < targetPct) return 'danger';
  if (!canSkip(present, total, targetPct)) return 'warning';
  if (pct < targetPct + 5) return 'warning';
  return 'safe';
}
