import { computeDayCycle } from '../utils/cycleUtils';

describe('computeDayCycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Fix "today" to 2026-04-23
    jest.setSystemTime(new Date('2026-04-23T06:00:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns 1 on the cycle start date itself', () => {
    // diff = 0 → (0 % 7) + 1 = 1
    expect(computeDayCycle('2026-04-23', 7)).toBe(1);
  });

  it('advances by one each day after start', () => {
    // today - start = 3 days → day 4
    expect(computeDayCycle('2026-04-20', 7)).toBe(4);
  });

  it('wraps back to day 1 after a full cycle', () => {
    // diff = 7 → (7 % 7) + 1 = 1
    expect(computeDayCycle('2026-04-16', 7)).toBe(1);
  });

  it('returns last day of cycle (cycleLength) just before wrap', () => {
    // diff = 6 → (6 % 7) + 1 = 7
    expect(computeDayCycle('2026-04-17', 7)).toBe(7);
  });

  it('never returns 0 when start date is 1 day in the future', () => {
    // diff = -1 → (-1 % 7) + 1 = 0  ← current bug
    const result = computeDayCycle('2026-04-24', 7);
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(7);
  });

  it('never returns negative when start date is 2 days in the future', () => {
    // diff = -2 → (-2 % 7) + 1 = -1  ← current bug
    const result = computeDayCycle('2026-04-25', 7);
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(7);
  });

  it('wraps correctly for future start with a 4-day cycle', () => {
    // diff = -3 → (-3 % 4) + 1 = -2  ← current bug; expected: (((-3%4)+4)%4)+1 = 2
    const result = computeDayCycle('2026-04-26', 4);
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(4);
  });

  it('result is always in [1, cycleLength] for any non-zero cycleLength', () => {
    const cycleLengths = [3, 5, 7, 10, 14, 30];
    const offsets = [-15, -8, -3, -2, -1, 0, 1, 5, 7, 13, 21];
    for (const len of cycleLengths) {
      for (const offset of offsets) {
        const date = new Date('2026-04-23T06:00:00Z');
        date.setDate(date.getDate() + offset);
        const dateStr = date.toISOString().split('T')[0];
        const result = computeDayCycle(dateStr, len);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(len);
      }
    }
  });
});
