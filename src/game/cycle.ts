export const CYCLE_MS = 12 * 60 * 1000;
/** 0 by day, 1 at deepest night; shared by every client through the wall clock. */
export function darkness(now = Date.now()) {
  const t = (now % CYCLE_MS) / CYCLE_MS;
  if (t < 0.5) return 0;
  if (t < 0.6) return (t - 0.5) / 0.1;
  if (t < 0.88) return 1;
  return 1 - (t - 0.88) / 0.12;
}
