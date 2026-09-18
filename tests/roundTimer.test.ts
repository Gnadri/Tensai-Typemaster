import { getRoundTimerSnapshot } from '../mobile/src/utils/roundTimer';

test('keeps the last partial second playable until the actual deadline', () => {
  expect(getRoundTimerSnapshot(60_000, 60_000, 59_001)).toEqual({
    remainingMs: 999, remainingSeconds: 1, expired: false,
  });
  expect(getRoundTimerSnapshot(60_000, 60_000, 59_999).expired).toBe(false);
  expect(getRoundTimerSnapshot(60_000, 60_000, 60_000)).toEqual({
    remainingMs: 0, remainingSeconds: 0, expired: true,
  });
  expect(getRoundTimerSnapshot(60_000, 60_000, 60_100).remainingMs).toBe(0);
});

test('repeated pauses preserve milliseconds and exclude all paused wall time', () => {
  const firstPause = getRoundTimerSnapshot(60_000, 60_000, 10_125);
  expect(firstPause.remainingMs).toBe(49_875);
  expect(getRoundTimerSnapshot(null, firstPause.remainingMs, 100_000)).toEqual(firstPause);

  const resumedDeadline = 100_000 + firstPause.remainingMs;
  const secondPause = getRoundTimerSnapshot(resumedDeadline, firstPause.remainingMs, 101_250);
  const nextDeadline = 200_000 + secondPause.remainingMs;
  const stopped = getRoundTimerSnapshot(nextDeadline, secondPause.remainingMs, 203_333);
  expect(60_000 - stopped.remainingMs).toBe(10_125 + 1_250 + 3_333);
  expect(getRoundTimerSnapshot(null, secondPause.remainingMs, 999_999).remainingMs).toBe(48_625);
});

test('a stopped paused round retains its fractional elapsed time and cannot regain time at zero', () => {
  const paused = getRoundTimerSnapshot(60_000, 60_000, 3_456);
  const stopped = getRoundTimerSnapshot(null, paused.remainingMs, 600_000);
  expect(60_000 - stopped.remainingMs).toBe(3_456);
  expect(getRoundTimerSnapshot(600_000 + 0, 0, 600_000).expired).toBe(true);
});
