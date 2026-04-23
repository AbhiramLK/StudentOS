import {
  computeAttendancePct,
  canSkip,
  classesToRecover,
  verdictForSubject,
} from './predictionEngine';

const BASE = { present: 80, total: 100, target: 75 };

describe('computeAttendancePct', () => {
  it('returns 0 when total is 0', () => {
    expect(computeAttendancePct(0, 0)).toBe(0);
  });
  it('rounds to 1 decimal place', () => {
    expect(computeAttendancePct(2, 3)).toBe(66.7);
  });
  it('returns 100 when all present', () => {
    expect(computeAttendancePct(10, 10)).toBe(100);
  });
});

describe('canSkip', () => {
  it('returns true when skipping keeps pct at or above target', () => {
    expect(canSkip(80, 100, 75)).toBe(true);
  });
  it('returns false when skipping drops below target', () => {
    expect(canSkip(75, 100, 75)).toBe(false);
  });
  it('returns false when already below target', () => {
    expect(canSkip(70, 100, 75)).toBe(false);
  });
});

describe('classesToRecover', () => {
  it('returns 0 when already at or above target', () => {
    expect(classesToRecover(80, 100, 75)).toBe(0);
  });
  it('returns correct number of consecutive classes needed', () => {
    expect(classesToRecover(70, 100, 75)).toBe(20);
  });
  it('caps at 100 to prevent infinite loops', () => {
    expect(classesToRecover(0, 0, 75)).toBeLessThanOrEqual(100);
  });
});

describe('verdictForSubject', () => {
  it('returns safe when well above target', () => {
    expect(verdictForSubject(85, 100, 75)).toBe('safe');
  });
  it('returns warning when within 5% of threshold', () => {
    expect(verdictForSubject(76, 100, 75)).toBe('warning');
  });
  it('returns danger when below target', () => {
    expect(verdictForSubject(70, 100, 75)).toBe('danger');
  });
  it('returns danger when no classes attended yet', () => {
    expect(verdictForSubject(0, 0, 75)).toBe('danger');
  });
  it('returns warning at exactly target pct (can no longer skip)', () => {
    expect(verdictForSubject(75, 100, 75)).toBe('warning');
  });
  it('returns safe at exactly 5% above target', () => {
    expect(verdictForSubject(80, 100, 75)).toBe('safe');
  });
});

describe('classesToRecover edge cases', () => {
  it('returns 0 when already at exact target', () => {
    expect(classesToRecover(75, 100, 75)).toBe(0);
  });
  it('returns 1 when one class restores target from 0/0', () => {
    expect(classesToRecover(0, 0, 75)).toBe(1);
  });
  it('returns correct count when deeply below target', () => {
    // 50/100 = 50%; need to reach 75% with all present
    // (50+n)/(100+n) >= 0.75 → 50+n >= 75+0.75n → 0.25n >= 25 → n >= 100
    expect(classesToRecover(50, 100, 75)).toBe(100);
  });
});

describe('canSkip edge cases', () => {
  it('allows skipping when target is 0', () => {
    expect(canSkip(0, 0, 0)).toBe(true);
  });
  it('disallows skipping when at 100% target', () => {
    expect(canSkip(100, 100, 100)).toBe(false);
  });
});
