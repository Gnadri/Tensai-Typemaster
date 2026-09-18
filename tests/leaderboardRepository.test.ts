import { createDurableStore, DurableStorageAdapter } from '../mobile/src/utils/durableStore';
import {
  createLeaderboardRepository, getFocusSetKey, leaderboardEntryIdentity, LeaderboardState,
} from '../mobile/src/utils/leaderboardRepository';
import { convertLegacySnapshotsToProfiles, normalizeSaveProfilesPayload } from '../mobile/src/utils/saveProfiles';

const item = (key: string) => ({ key, sourceMode: 'hiragana', item: { id: key, kana: key } });
const run = (id: string, extra = {}) => ({
  id, mode: 'focus:jp_reading', date: 100, timeMs: 12000, score: 5, total: 5,
  finishReason: 'complete', ...extra,
});
const normalizeEntries = (entries: any[]) => {
  const seen = new Set<string>();
  return entries.filter(entry => {
    if (!entry || typeof entry.mode !== 'string') return false;
    const identity = leaderboardEntryIdentity(entry);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};
const helpers = {
  normalizeEntries,
  isFocusModeKey: (mode: string) => /^(?:(?:typemaster|choice|endless|eng):)*focus(?::|$)/.test(mode),
  isBottleneckModeKey: (mode: string) => /^(?:(?:typemaster|choice|endless|eng):)*bottleneck(?::|$)/.test(mode),
};
const keyA = getFocusSetKey([item('a')]);
const keyB = getFocusSetKey([item('b')]);
const profile = (id: string, keys = ['a'], entries: any[] = [], extra = {}) => ({
  id, name: id, createdAt: 10, updatedAt: 20,
  focusItems: keys.map(item), bottleneckItems: [], focusLeaderboard: entries,
  notes: 'Original note', noteFolders: [{ id: 'folder', notes: 'Original note' }], ...extra,
});
const ids = (entries: any[]) => entries.map(entry => entry.id).sort();
let nextKey = 0;
function harness(initial: LeaderboardState = { allTime: [], focusBoards: {}, profiles: [] }) {
  const memory = new Map<string, string>();
  const adapter: DurableStorageAdapter = {
    read: async key => memory.get(key) ?? null,
    write: async (key, value) => { memory.set(key, value); },
  };
  const key = `leaderboard-test-${++nextKey}`;
  const reopen = () => createLeaderboardRepository(createDurableStore({
    key, adapters: [adapter], migrate: async () => initial,
  }), helpers);
  return { repository: reopen(), reopen };
}

test('Focus set identity uses the sorted unique union of actual item keys', () => {
  expect(getFocusSetKey([item('b'), item('a'), item('a')], [item('c'), item('b')]))
    .toBe('["a","b","c"]');
  expect(getFocusSetKey([item('a'), item('b')]))
    .toBe(getFocusSetKey([item('b')], [item('a'), item('b')]));
  expect(getFocusSetKey([null, {}, { key: '' }])).toBe('[]');
});

test('run identities preserve ids and distinguish all legacy time, mode, and score metrics', () => {
  expect(leaderboardEntryIdentity(run('round-1')))
    .toBe(leaderboardEntryIdentity(run('round-1', { timeMs: 30000 })));
  const legacy = { ...run(''), timerMinutes: 5 };
  const changes = {
    mode: 'choice:focus', timerMinutes: 10, scoreType: 'study_points',
    typemasterQueueMode: 'burst', date: 101, timeMs: 12001, score: 6,
    total: 6, finishReason: 'time', correctCount: 4, gamepoints: 7,
    testscore: 8, totalTestscore: 9,
  };
  for (const [field, value] of Object.entries(changes)) {
    expect(leaderboardEntryIdentity({ ...legacy, [field]: value }))
      .not.toBe(leaderboardEntryIdentity(legacy));
  }
  expect(leaderboardEntryIdentity({ ...legacy, scoreType: 'quiz_points' }))
    .toBe(leaderboardEntryIdentity({ ...legacy, scoreType: 'speedrun_points' }));
  expect(leaderboardEntryIdentity({ ...legacy, focusSetKey: keyA }))
    .toBe(leaderboardEntryIdentity({ ...legacy, focusSetKey: keyB }));
});

test('concurrent stale profile saves preserve newer rounds and other saved files', async () => {
  const { repository, reopen } = harness();
  await repository.saveProfile(profile('first', ['a'], [run('old')]));
  const stale = (await repository.read()).data.profiles[0];
  const otherWindow = reopen();
  await Promise.all([
    repository.append(run('new'), { focusSetKey: keyA, profileId: 'first' }),
    otherWindow.saveProfile({ ...stale, name: 'Renamed' }, { overwrite: true }),
    repository.saveProfile(profile('second', ['a'], [run('second-only')])),
    otherWindow.saveProfile(stale),
  ]);
  const fresh = await reopen().read();
  expect(fresh.data.profiles.map(saved => saved.id).sort()).toEqual(['first', 'second']);
  expect(ids(fresh.data.focusBoards[keyA])).toEqual(['new', 'old', 'second-only']);
  expect(ids(fresh.data.profiles.find(saved => saved.id === 'first').focusLeaderboard))
    .toEqual(['new', 'old', 'second-only']);
  expect(fresh.revision).toBe(6);
});

test('a loaded matching profile automatically retains new rounds across reloads', async () => {
  const { repository, reopen } = harness();
  await repository.saveProfile(profile('loaded'));
  await repository.append(run('played'), { focusSetKey: keyA, profileId: 'loaded' });
  await repository.append(run('other-set'), { focusSetKey: keyB, profileId: 'loaded' });
  const saved = (await reopen().read()).data.profiles[0];
  expect(ids(saved.focusLeaderboard)).toEqual(['played']);
  await repository.append(run('newer'), { focusSetKey: keyA, profileId: 'loaded' });
  await repository.mergeFocus(keyA, saved.focusLeaderboard);
  const fresh = (await reopen().read()).data;
  expect(ids(fresh.focusBoards[keyA])).toEqual(['newer', 'played']);
  expect(ids(fresh.profiles[0].focusLeaderboard)).toEqual(['newer', 'played']);
  expect(ids(fresh.focusBoards[keyB])).toEqual(['other-set']);
});

test('equivalent unions retain history and overwriting a profile with a different set archives its old board', async () => {
  const { repository } = harness();
  const union = getFocusSetKey([item('a'), item('b')]);
  await repository.mergeAllTime([run('global', { mode: 'hiragana' })]);
  await repository.saveProfile(profile('saved', ['a', 'b'], [run('union-round')]));
  await repository.saveProfile(profile('saved', ['b'], [], { bottleneckItems: [item('a')] }), { overwrite: true });
  expect(ids((await repository.read()).data.profiles[0].focusLeaderboard)).toEqual(['union-round']);
  await repository.saveProfile(profile('saved', ['b'], [run('b-round')]), { overwrite: true });
  const state = (await repository.read()).data;
  expect(ids(state.focusBoards[union])).toEqual(['union-round']);
  expect(ids(state.focusBoards[keyB])).toEqual(['b-round']);
  expect(ids(state.profiles[0].focusLeaderboard)).toEqual(['b-round']);
  expect(ids(state.allTime)).toEqual(['global']);
});

test('Focus deletion is scoped and tombstones prevent stale snapshots, imports, merges, or append from restoring it', async () => {
  const { repository, reopen } = harness();
  const removed = run('shared-id');
  await repository.mergeAllTime([run('shared-id', { mode: 'hiragana' })]);
  await repository.saveProfile(profile('a1', ['a'], [removed, run('keep')]));
  await repository.saveProfile(profile('a2', ['a'], [removed]));
  await repository.saveProfile(profile('b', ['b'], [removed]));
  const staleProfiles = (await repository.read()).data.profiles;
  await repository.removeEntry(removed, keyA);
  await reopen().saveProfile(staleProfiles.find(saved => saved.id === 'a1'), { overwrite: true });
  await repository.importProfiles(staleProfiles);
  await repository.mergeFocus(keyA, [removed]);
  await repository.append(removed, { focusSetKey: keyA, profileId: 'a1' });
  const state = (await reopen().read()).data;
  expect(ids(state.focusBoards[keyA])).toEqual(['keep']);
  for (const saved of state.profiles.filter(saved => saved.id.startsWith('a'))) {
    expect(ids(saved.focusLeaderboard)).not.toContain('shared-id');
  }
  expect(ids(state.focusBoards[keyB])).toEqual(['shared-id']);
  expect(ids(state.allTime)).toEqual(['shared-id']);
  expect(state.deletedEntryIds?.[keyA]).toContain(leaderboardEntryIdentity(removed));
});

test('all-time deletion does not affect Focus and cannot be undone by stale all-time merges', async () => {
  const { repository } = harness();
  const global = run('global', { mode: 'hiragana' });
  await repository.mergeAllTime([global, run('keep-global', { mode: 'katakana' })]);
  await repository.append(run('global'), { focusSetKey: keyA });
  await repository.removeEntry(global, keyA);
  await repository.mergeAllTime([global, run('focus-rejected'), run('bottleneck-rejected', { mode: 'bottleneck' })]);
  await repository.append(global, { focusSetKey: keyA });
  const state = (await repository.read()).data;
  expect(ids(state.allTime)).toEqual(['keep-global']);
  expect(ids(state.focusBoards[keyA])).toEqual(['global']);
});

test('imports merge by id, preserve newer metadata and histories, and keep unrelated profiles', async () => {
  const { repository } = harness();
  await repository.saveProfile(profile('existing', ['a'], [run('newer')], { updatedAt: 200, name: 'Latest name' }));
  await repository.saveProfile(profile('unrelated', ['b'], [run('separate')]));
  await repository.importProfiles([
    profile('existing', ['a'], [run('older')], { updatedAt: 100, name: 'Stale name' }),
    profile('imported', ['b'], [run('imported-round')]),
  ]);
  const state = (await repository.read()).data;
  expect(state.profiles).toHaveLength(3);
  const existing = state.profiles.find(saved => saved.id === 'existing');
  expect(existing.name).toBe('Latest name');
  expect(ids(existing.focusLeaderboard)).toEqual(['newer', 'older']);
  expect(ids(state.profiles.find(saved => saved.id === 'unrelated').focusLeaderboard)).toEqual(['separate']);
});

test('notes updates use the latest profile without erasing concurrently saved rounds or membership', async () => {
  const { repository, reopen } = harness();
  await repository.saveProfile(profile('saved', ['a'], [run('first')]));
  const staleWindow = reopen();
  await Promise.all([
    repository.append(run('second'), { focusSetKey: keyA, profileId: 'saved' }),
    staleWindow.updateProfileNotes('saved', 'New note', [{ id: 'new-folder', notes: 'New note' }]),
  ]);
  const saved = (await reopen().read()).data.profiles[0];
  expect(ids(saved.focusLeaderboard)).toEqual(['first', 'second']);
  expect(saved.focusItems).toEqual([item('a')]);
  expect(saved.notes).toBe('New note');
  expect(saved.noteFolders).toEqual([{ id: 'new-folder', notes: 'New note' }]);
});

test('deleting one profile retains its archived board and all other profiles and history', async () => {
  const { repository } = harness();
  await repository.saveProfile(profile('delete', ['a'], [run('archived')]));
  await repository.saveProfile(profile('keep', ['b'], [run('other')]));
  await repository.deleteProfile('delete');
  const state = (await repository.read()).data;
  expect(state.profiles.map(saved => saved.id)).toEqual(['keep']);
  expect(ids(state.focusBoards[keyA])).toEqual(['archived']);
  expect(ids(state.focusBoards[keyB])).toEqual(['other']);
});

test('normalization, legacy conversion, and repository imports preserve more than 200 profiles and all rounds', async () => {
  const payload = Array.from({ length: 215 }, (_, index) => profile(`profile-${index}`, ['a'], [run(`round-${index}`)]));
  const profileHelpers = {
    isFocusModeKey: helpers.isFocusModeKey,
    limitLeaderboardPerMode: normalizeEntries,
    normalizeStoredFocusItem: (value: any) => value,
  };
  expect(normalizeSaveProfilesPayload(payload, profileHelpers)).toHaveLength(215);
  expect(convertLegacySnapshotsToProfiles({ focusSnapshots: payload }, profileHelpers)).toHaveLength(215);
  const { repository } = harness();
  const imported = await repository.importProfiles(payload);
  expect(imported.data.profiles).toHaveLength(215);
  expect(imported.data.focusBoards[keyA]).toHaveLength(215);
});

test('malformed saved board data is rejected instead of replaced by empty history', async () => {
  const { repository } = harness({ allTime: [], focusBoards: { [keyA]: null }, profiles: [] });
  await expect(repository.read()).rejects.toThrow('database is malformed');
  await expect(repository.append(run('new'), { focusSetKey: keyA })).rejects.toThrow('Nothing was replaced');
});

test('automatic round and note saves advance profile timestamps only when content changes', async () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(500);
  try {
    const { repository } = harness();
    await repository.saveProfile(profile('saved'));
    const append = () => repository.append(run('round'), { focusSetKey: keyA, profileId: 'saved' });
    expect((await append()).data.profiles[0].updatedAt).toBe(500);
    now.mockReturnValue(700);
    expect((await append()).data.profiles[0].updatedAt).toBe(500);
    const folders = [{ id: 'notes', notes: 'Revised' }];
    expect((await repository.updateProfileNotes('saved', 'Revised', folders)).data.profiles[0].updatedAt).toBe(700);
    now.mockReturnValue(900);
    expect((await repository.updateProfileNotes('saved', 'Revised', folders)).data.profiles[0].updatedAt).toBe(700);
  } finally {
    now.mockRestore();
  }
});

test('notes and overwrite operations reject concurrently deleted profiles without recreating them', async () => {
  const { repository, reopen } = harness();
  await repository.saveProfile(profile('deleted', ['a'], [run('archived')]));
  const stale = (await repository.read()).data.profiles[0];
  await reopen().deleteProfile('deleted');
  await expect(repository.updateProfileNotes('deleted', 'Unsaved', [])).rejects.toThrow('no longer exists');
  await expect(repository.saveProfile(stale, { overwrite: true })).rejects.toThrow('not recreated');
  const state = (await repository.read()).data;
  expect(state.profiles).toHaveLength(0);
  expect(ids(state.focusBoards[keyA])).toEqual(['archived']);
});

test('notes reject a profile that another window overwrote with a different Focus set', async () => {
  const { repository, reopen } = harness();
  await repository.saveProfile(profile('saved', ['a'], [run('a-round')]));
  await reopen().saveProfile(profile('saved', ['b'], [run('b-round')], {
    notes: 'Notes for B', noteFolders: [{ id: 'b-folder', notes: 'Notes for B' }],
  }), { overwrite: true });
  await expect(repository.updateProfileNotes('saved', 'Stale notes for A', [], { focusSetKey: keyA }))
    .rejects.toThrow('selection changed');
  let saved = (await repository.read()).data.profiles[0];
  expect(saved.notes).toBe('Notes for B');
  expect(ids(saved.focusLeaderboard)).toEqual(['b-round']);
  await repository.updateProfileNotes('saved', 'Updated B notes', [], { focusSetKey: keyB });
  saved = (await repository.read()).data.profiles[0];
  expect(saved.notes).toBe('Updated B notes');
});
