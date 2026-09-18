/** Keep exact elapsed time separate from the whole-second countdown display. */
export function getRoundTimerSnapshot(
  deadlineMs: number | null,
  pausedRemainingMs: number,
  now = Date.now(),
) {
  const remainingMs = Math.max(
    0,
    deadlineMs === null ? pausedRemainingMs : deadlineMs - now,
  );
  return {
    remainingMs,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    expired: remainingMs <= 0,
  };
}
