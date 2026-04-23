/**
 * Computes which day of a repeating meal cycle "today" falls on.
 * Returns a value in [1, cycleLength] for any start date — past or future.
 */
export function computeDayCycle(cycleStartDate: string, cycleLength: number): number {
  const start = new Date(cycleStartDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return (((diff % cycleLength) + cycleLength) % cycleLength) + 1;
}
