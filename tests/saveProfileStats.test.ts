import { buildSaveProfileStats } from '../mobile/src/utils/saveProfileStats';

const focusItem = (id: string, sourceMode = 'jlpt_n3_2') => ({
  key: `${sourceMode}:${id}`, sourceMode, item: { id },
});
const run = (overrides = {}) => ({
  mode: 'focus:jp_reading', date: 100, timeMs: 15000,
  score: 10, total: 10, finishReason: 'complete', ...overrides,
});

test('summarizes the selected saved file without double-counting legacy notes', () => {
  const stats = buildSaveProfileStats([{
    createdAt: 50,
    updatedAt: 300,
    focusItems: [focusItem('a'), focusItem('b', 'hiragana')],
    bottleneckItems: [focusItem('a')],
    notes: 'hello',
    noteFolders: [{ notes: 'hello' }, { notes: 'world!' }],
    focusLeaderboard: [run(), run({ mode: 'typemaster:focus', date: 200, timeMs: 60000, finishReason: 'time' })],
  }]);

  expect(stats).toMatchObject({
    profileCount: 1, focusItemCount: 2, uniqueFocusItemCount: 2,
    bottleneckItemCount: 1, uniqueBottleneckItemCount: 1,
    noteFolderCount: 2, noteCharacterCount: 11,
    recordedRunCount: 2, recordedTimeMs: 75000,
    completedRunCount: 1, timedRunCount: 1, stoppedRunCount: 0, lastPlayedAt: 200, lastSavedAt: 300,
  });
  expect(stats.sourceModes).toEqual([
    { sourceMode: 'jlpt_n3_2', focusItemCount: 1, bottleneckItemCount: 1 },
    { sourceMode: 'hiragana', focusItemCount: 1, bottleneckItemCount: 0 },
  ]);
});

test('counts saved item copies but deduplicates shared runs and canonical items across files', () => {
  const original = run({ scoreType: 'quiz_points' });
  const stats = buildSaveProfileStats([
    { createdAt: 1000, focusItems: [focusItem('a')], focusLeaderboard: [original] },
    {
      focusItems: [{ ...focusItem('a'), key: 'renamed-key' }, focusItem('b')],
      focusLeaderboard: [
        { ...original, scoreType: 'speedrun_points', timerMinutes: 5 },
        run({ date: 300, timeMs: 3000, finishReason: 'stopped' }),
        run({ date: 300, timeMs: 3000, finishReason: 'stopped' }),
      ],
    },
  ]);
  expect(stats).toMatchObject({
    profileCount: 2, focusItemCount: 3, uniqueFocusItemCount: 2,
    recordedRunCount: 2, recordedTimeMs: 18000,
    completedRunCount: 1, stoppedRunCount: 1, lastPlayedAt: 300, lastSavedAt: 1000,
  });
});

test('keeps distinct game settings and run outcomes without mixing scores or non-Focus history', () => {
  const stats = buildSaveProfileStats([{
    focusLeaderboard: [
      run(), run({ timerMinutes: 10 }), run({ scoreType: 'study_points' }),
      run({ mode: 'choice:eng:focus', finishReason: 'time' }),
      run({ mode: 'typemaster:focus', typemasterQueueMode: 'burst', finishReason: 'stopped' }),
      run({ mode: 'bottleneck' }), run({ mode: 'hiragana' }),
    ],
    // Unrelated legacy leaderboard fields should never contribute to Focus stats.
    ...{ leaderboard: [run({ date: 1000 })], sessionLeaderboard: [run({ date: 2000 })] },
  }]);
  expect(stats.recordedRunCount).toBe(5);
  expect(stats.modes.find(mode => mode.mode === 'focus:jp_reading')).toMatchObject({
    runCount: 3, completedRunCount: 3, recordedTimeMs: 45000,
  });
  expect(stats.completedRunCount).toBe(3);
  expect(stats.timedRunCount).toBe(1);
  expect(stats.stoppedRunCount).toBe(1);
  expect(stats.lastPlayedAt).toBe(100);
});

test('handles empty, legacy, and invalid imported values without invalid totals', () => {
  expect(buildSaveProfileStats([])).toMatchObject({
    profileCount: 0, recordedRunCount: 0, recordedTimeMs: 0,
    noteCharacterCount: 0, lastPlayedAt: null, modes: [], sourceModes: [],
  });
  const stats = buildSaveProfileStats([{
    notes: 'legacy note',
    focusItems: [null, focusItem('a')],
    focusLeaderboard: [
      null, run({ timeMs: -100, date: NaN }),
      run({ timeMs: Infinity, date: -100, finishReason: 'stopped' }),
      run({ timeMs: 0, date: 0, finishReason: undefined }),
    ],
  }]);
  expect(stats).toMatchObject({
    focusItemCount: 1, noteFolderCount: 0, noteCharacterCount: 11,
    recordedRunCount: 3, recordedTimeMs: 0, lastPlayedAt: null,
    completedRunCount: 2, stoppedRunCount: 1,
  });
});
