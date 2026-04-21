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
});
