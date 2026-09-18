import { createDesktopLeaderboardRepository, extensionLeaderboardAdapter, LEADERBOARD_DATABASE_KEY } from '../mobile/src/utils/desktopLeaderboardStorage';
import { getFocusSetKey, leaderboardEntryIdentity } from '../mobile/src/utils/leaderboardRepository';
import { extractSaveProfilesFromImport, normalizeSaveProfilesPayload } from '../mobile/src/utils/saveProfiles';

const legacyKey = (suffix: string) => `tensai-note.${suffix}`;
const run = (id: string, mode = 'hiragana') => ({ id, mode, date: 100, timeMs: 1000, score: 1, total: 1, finishReason: 'complete' });
const focusItem = (key: string) => ({ key, sourceMode: 'hiragana', item: { id: key, kana: key, answers: [key] } });
const setA = [focusItem('a')];
const setB = [focusItem('b')];
const keyA = getFocusSetKey(setA);
const keyB = getFocusSetKey(setB);
const emptySetKey = getFocusSetKey([]);
const ids = (entries: any[] = []) => entries.map(entry => entry.id).sort();
const isFocusModeKey = (mode: string) => mode === 'focus' || mode.startsWith('focus:');
const isBottleneckModeKey = (mode: string) => mode === 'bottleneck';
const normalizeEntries = (entries: any[]) => {
  const seen = new Set<string>();
  return entries.filter(entry => entry && typeof entry.mode === 'string' && Number.isFinite(entry.date)).filter(entry => {
    const identity = leaderboardEntryIdentity(entry);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};
const helpers = { isFocusModeKey, limitLeaderboardPerMode: normalizeEntries, normalizeStoredFocusItem: (item: any) => item };

function memoryAdapter() {
  const values = new Map<string, string>();
  const adapter = {
    read: jest.fn(async (key: string) => values.get(key) ?? null),
    write: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
  };
  return {
    values, adapter,
    put: (suffix: string, value: any) => values.set(legacyKey(suffix), JSON.stringify(value)),
  };
}

function repository(...memories: ReturnType<typeof memoryAdapter>[]) {
  return createDesktopLeaderboardRepository({
    adapters: memories.map(memory => memory.adapter), normalizeEntries,
    normalizeProfiles: profiles => normalizeSaveProfilesPayload(profiles, helpers),
    convertLegacyProfiles: payload => extractSaveProfilesFromImport(payload, helpers),
    isFocusModeKey, isBottleneckModeKey,
  });
}

test('first initialization merges legacy all-time copies and saved snapshot histories once', async () => {
  const local = memoryAdapter();
  const extension = memoryAdapter();
  local.put('quiz-leaderboard.v1', [run('local'), run('duplicate'), run('focus-old', 'focus')]);
  extension.put('quiz-leaderboard.v1', { leaderboard: [run('extension'), run('duplicate')] });
  local.put('quiz-leaderboard-backup.v1', [run('local-backup')]);
  extension.put('quiz-leaderboard-backup.v1', [run('extension-backup'), run('excluded', 'bottleneck')]);
  local.put('quiz-leaderboard-snapshots.v1', [{ leaderboard: [run('snapshot')], sessionLeaderboard: [run('snapshot-session')] }]);
  const board = await repository(local, extension).read();
  expect(board.revision).toBe(1);
  expect(ids(board.data.allTime)).toEqual(['duplicate', 'extension', 'extension-backup', 'local', 'local-backup', 'snapshot', 'snapshot-session']);
  expect(ids(board.data.focusBoards[emptySetKey])).toEqual(['focus-old']);
  expect(local.values.get(LEADERBOARD_DATABASE_KEY)).toBe(extension.values.get(LEADERBOARD_DATABASE_KEY));
  expect(local.values.has(legacyKey('quiz-leaderboard.v1'))).toBe(true);
});

test('Focus snapshots retain their own selections instead of contaminating the current board', async () => {
  const local = memoryAdapter();
  local.put('quiz-focus.v1', setA);
  local.put('quiz-focus-leaderboard.v1', [run('current-a', 'focus')]);
  local.put('quiz-focus-snapshots.v1', [{ id: 'saved-b', name: 'Set B', focusItems: setB, focusLeaderboard: [run('snapshot-b', 'focus')] }]);
  const data = (await repository(local).read()).data;
  expect(ids(data.focusBoards[keyA])).toEqual(['current-a']);
  expect(ids(data.focusBoards[keyB])).toEqual(['snapshot-b']);
  expect(data.profiles.find(profile => profile.id === 'saved-b')?.focusItems).toEqual(setB);
});

test('explicit empty current primary suppresses stale current mirrors/backups and prevents future legacy migration', async () => {
  const local = memoryAdapter();
  const extension = memoryAdapter();
  local.put('quiz-focus.v1', setA);
  local.put('quiz-focus-leaderboard.v1', []);
  local.put('quiz-focus-leaderboard-backup.v1', [run('old-backup', 'focus')]);
  local.put('quiz-leaderboard.v1', [run('old-alltime-focus', 'focus')]);
  extension.put('quiz-focus-leaderboard.v1', [run('stale-mirror', 'focus')]);
  const first = await repository(local, extension).read();
  expect(first.data.focusBoards[keyA]).toEqual([]);
  expect(first.revision).toBe(1);
  const legacyReadsBefore = local.adapter.read.mock.calls.filter(([key]) => key !== LEADERBOARD_DATABASE_KEY && key !== `${LEADERBOARD_DATABASE_KEY}.backup`).length;
  local.put('quiz-focus-leaderboard.v1', [run('changed-legacy', 'focus')]);
  const reopened = await repository(local, extension).read();
  expect(reopened.data.focusBoards[keyA]).toEqual([]);
  const legacyReadsAfter = local.adapter.read.mock.calls.filter(([key]) => key !== LEADERBOARD_DATABASE_KEY && key !== `${LEADERBOARD_DATABASE_KEY}.backup`).length;
  expect(legacyReadsAfter).toBe(legacyReadsBefore);
});

test('deleted migrated entries cannot return from legacy records or canonical backups after reopening', async () => {
  const local = memoryAdapter();
  const record = run('delete-me');
  const focusedRecord = run('delete-focus', 'focus');
  local.put('quiz-leaderboard.v1', [record]);
  local.put('quiz-focus.v1', setA);
  local.put('quiz-focus-leaderboard.v1', [focusedRecord]);
  local.put('quiz-focus-snapshots.v1', [{ id: 'snapshot', focusItems: setA, focusLeaderboard: [focusedRecord] }]);
  const first = repository(local);
  await first.read();
  await first.removeEntry(record, keyA);
  await first.removeEntry(focusedRecord, keyA);
  const reopened = repository(local);
  const data = (await reopened.read()).data;
  expect(data.allTime).toEqual([]);
  expect(data.focusBoards[keyA]).toEqual([]);
  expect(data.profiles[0].focusLeaderboard).toEqual([]);
  expect(local.values.get(legacyKey('quiz-leaderboard.v1'))).toContain('delete-me');
});

test('malformed legacy JSON and malformed snapshot rows cannot block valid current leaderboards', async () => {
  const local = memoryAdapter();
  local.put('quiz-leaderboard.v1', [run('valid')]);
  local.put('quiz-focus.v1', setA);
  local.put('quiz-focus-leaderboard.v1', [run('valid-focus', 'focus')]);
  local.put('quiz-save-profiles.v2', []);
  local.values.set(legacyKey('quiz-leaderboard-snapshots.v1'), '{broken');
  local.put('quiz-focus-snapshots.v1', [null, { focusItems: setB, focusLeaderboard: { invalid: true }, leaderboard: 'invalid' }]);
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const data = (await repository(local).read()).data;
    expect(ids(data.allTime)).toEqual(['valid']);
    expect(ids(data.focusBoards[keyA])).toEqual(['valid-focus']);
    expect(warning).toHaveBeenCalled();
  } finally { warning.mockRestore(); }
});

test('profile-only Focus and non-Focus saved times remain accessible after migration', async () => {
  const local = memoryAdapter();
  local.put('quiz-save-profiles.v2', [{
    id: 'only-profile', name: 'My saved set', focusItems: setB,
    focusLeaderboard: [run('profile-focus', 'focus')],
    leaderboard: [run('profile-alltime')], sessionLeaderboard: [run('profile-session')],
  }]);
  const data = (await repository(local).read()).data;
  expect(ids(data.focusBoards[keyB])).toEqual(['profile-focus']);
  expect(ids(data.profiles[0].focusLeaderboard)).toEqual(['profile-focus']);
  expect(ids(data.allTime)).toEqual(['profile-alltime', 'profile-session']);
  expect(data.focusBoards[emptySetKey]).toEqual([]);
});

test('different adapter selections archive their own current boards without inventing a combined set', async () => {
  const local = memoryAdapter();
  const extension = memoryAdapter();
  local.put('quiz-focus.v1', setA);
  local.put('quiz-focus-leaderboard.v1', [run('local-a', 'focus')]);
  extension.put('quiz-focus.v1', setB);
  extension.put('quiz-focus-leaderboard.v1', [run('extension-b', 'focus')]);
  const data = (await repository(local, extension).read()).data;
  expect(ids(data.focusBoards[keyA])).toEqual(['local-a']);
  expect(ids(data.focusBoards[keyB])).toEqual(['extension-b']);
  expect(data.focusBoards[getFocusSetKey([...setA, ...setB])]).toBeUndefined();
});

test('extension scores without selection keys use the known local set', async () => {
  const local = memoryAdapter();
  const extension = memoryAdapter();
  local.put('quiz-focus.v1', setA);
  local.put('quiz-focus-leaderboard.v1', [run('local', 'focus')]);
  extension.put('quiz-focus-leaderboard.v1', [run('mirror', 'focus')]);
  const data = (await repository(local, extension).read()).data;
  expect(ids(data.focusBoards[keyA])).toEqual(['local', 'mirror']);
  expect(data.focusBoards[emptySetKey]).toBeUndefined();
});

test('invalid current Focus primary recovers the valid legacy Focus backup', async () => {
  const local = memoryAdapter();
  local.put('quiz-focus.v1', setA);
  local.values.set(legacyKey('quiz-focus-leaderboard.v1'), '{broken');
  local.put('quiz-focus-leaderboard-backup.v1', [run('backup', 'focus')]);
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const data = (await repository(local).read()).data;
    expect(ids(data.focusBoards[keyA])).toEqual(['backup']);
  } finally { warning.mockRestore(); }
});

test('duplicate profile replicas preserve each set history and retain the latest metadata', async () => {
  const local = memoryAdapter();
  const extension = memoryAdapter();
  local.put('quiz-save-profiles.v2', [{ id: 'same-id', name: 'Older', updatedAt: 10, focusItems: setA, focusLeaderboard: [run('older-set', 'focus')] }]);
  extension.put('quiz-save-profiles.v2', [{ id: 'same-id', name: 'Newer', updatedAt: 20, focusItems: setB, focusLeaderboard: [run('newer-set', 'focus')] }]);
  const data = (await repository(local, extension).read()).data;
  expect(data.profiles).toHaveLength(1);
  expect(data.profiles[0].name).toBe('Newer');
  expect(ids(data.focusBoards[keyA])).toEqual(['older-set']);
  expect(ids(data.focusBoards[keyB])).toEqual(['newer-set']);
});

test('extension adapter rejects Chrome read and write errors instead of reporting empty or successful copies', async () => {
  const previousChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome');
  Object.defineProperty(globalThis, 'chrome', { configurable: true, value: {
    runtime: { lastError: { message: 'Storage unavailable' } },
    storage: { local: {
      get: (_keys: string[], callback: (result: any) => void) => callback({}),
      set: (_values: any, callback: () => void) => callback(),
    } },
  } });
  try {
    const adapter = extensionLeaderboardAdapter()!;
    await expect(adapter.read('key')).rejects.toThrow('Storage unavailable');
    await expect(adapter.write('key', 'value')).rejects.toThrow('Storage unavailable');
  } finally {
    if (previousChrome) Object.defineProperty(globalThis, 'chrome', previousChrome);
    else delete (globalThis as any).chrome;
  }
});
