import type { DurableStore } from './durableStore';

export type LeaderboardState = {
  allTime: any[];
  focusBoards: Record<string, any[]>;
  profiles: any[];
  deletedEntryIds?: Record<string, string[]>;
};

type LeaderboardHelpers = {
  normalizeEntries: (entries: any[]) => any[];
  isFocusModeKey: (mode: string) => boolean;
  isBottleneckModeKey: (mode: string) => boolean;
};

const asArray = (value: unknown): any[] => Array.isArray(value) ? value : [];

/** The effective Focus set includes Bottleneck items, regardless of list order. */
export const getFocusSetKey = (focusItems: readonly any[], bottleneckItems: readonly any[] = []): string =>
  JSON.stringify([...new Set([...asArray(focusItems), ...asArray(bottleneckItems)]
    .map(entry => entry?.key)
    .filter((key): key is string => typeof key === 'string' && key.length > 0))].sort());

/** Stable legacy identity; newly recorded rounds retain their explicit id. */
export const leaderboardEntryIdentity = (entry: any): string => {
  if (entry?.id != null && `${entry.id}`.trim()) return `id:${`${entry.id}`.trim()}`;
  const parsedTimer = Number.parseInt(`${entry?.timerMinutes}`, 10);
  const timer = Number.isNaN(parsedTimer) ? 5 : Math.max(1, Math.min(30, parsedTimer));
  const scoreType = entry?.scoreType === 'study_points' ? 'study_points'
    : entry?.scoreType === 'speedrun_points' || entry?.scoreType === 'quiz_points' ? 'speedrun_points' : 'off';
  return JSON.stringify([
    entry?.mode || '', timer, scoreType, entry?.typemasterQueueMode || '',
    entry?.date || 0, entry?.timeMs || 0, entry?.score || 0, entry?.total || 0,
    entry?.finishReason || 'complete', entry?.correctCount || 0,
    entry?.gamepoints || 0, entry?.testscore || 0, entry?.totalTestscore || 0,
  ]);
};

export function createLeaderboardRepository(
  store: DurableStore<LeaderboardState>,
  helpers: LeaderboardHelpers,
) {
  const isFocus = (entry: any) => helpers.isFocusModeKey(`${entry?.mode || ''}`)
    && !helpers.isBottleneckModeKey(`${entry?.mode || ''}`);
  const isAllTime = (entry: any) => !helpers.isFocusModeKey(`${entry?.mode || ''}`)
    && !helpers.isBottleneckModeKey(`${entry?.mode || ''}`);
  const profileSetKey = (profile: any) => getFocusSetKey(profile?.focusItems, profile?.bottleneckItems);
  const stateFields = (state: LeaderboardState): LeaderboardState => {
    const isRecord = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value);
    if (!isRecord(state) || !Array.isArray(state.allTime) || !Array.isArray(state.profiles)
      || !isRecord(state.focusBoards) || Object.values(state.focusBoards).some(board => !Array.isArray(board))
      || state.profiles.some(profile => !isRecord(profile))
      || (state.deletedEntryIds != null && (!isRecord(state.deletedEntryIds)
        || Object.values(state.deletedEntryIds).some(identities => !Array.isArray(identities)
          || identities.some(identity => typeof identity !== 'string'))))) {
      throw new Error('The saved leaderboard database is malformed. Nothing was replaced.');
    }
    return { ...state, deletedEntryIds: state.deletedEntryIds || {} };
  };
  const mergeEntries = (state: LeaderboardState, scope: string, entries: any[]) => {
    const deleted = new Set(state.deletedEntryIds?.[scope] || []);
    return helpers.normalizeEntries(entries.filter(entry => entry && typeof entry === 'object'))
      .filter(entry => !deleted.has(leaderboardEntryIdentity(entry)));
  };
  const mergeFocusEntries = (state: LeaderboardState, setKey: string, entries: any[]) =>
    mergeEntries(state, setKey, entries.filter(isFocus)
      .filter(entry => typeof entry.focusSetKey !== 'string' || entry.focusSetKey === setKey)
      .map(entry => ({ ...entry, focusSetKey: setKey })));
  const mergeAllTimeEntries = (state: LeaderboardState, entries: any[]) =>
    mergeEntries(state, 'allTime', entries.filter(isAllTime));

  const saveProfileInto = (rawState: LeaderboardState, incoming: any, overwrite: boolean): LeaderboardState => {
    const state = stateFields(rawState);
    if (!incoming || typeof incoming !== 'object' || !`${incoming.id ?? ''}`.trim()) return state;
    const id = `${incoming.id}`;
    const existing = state.profiles.find(profile => `${profile.id}` === id);
    if (overwrite && !existing) throw new Error('The Focus profile no longer exists. It was not recreated.');
    const incomingProfile = { ...existing, ...incoming, id };
    const incomingSet = profileSetKey(incomingProfile);
    const previousSet = existing ? profileSetKey(existing) : null;
    const focusBoards = { ...state.focusBoards };

    // Archive the previous set before replacing profile metadata or membership.
    if (existing && previousSet !== null) {
      focusBoards[previousSet] = mergeFocusEntries(state, previousSet, [
        ...asArray(focusBoards[previousSet]), ...asArray(existing.focusLeaderboard),
      ]);
    }
    focusBoards[incomingSet] = mergeFocusEntries(state, incomingSet, [
      ...asArray(focusBoards[incomingSet]), ...asArray(incoming.focusLeaderboard),
    ]);

    const incomingIsNewer = Number(incoming.updatedAt || 0) >= Number(existing?.updatedAt || 0);
    const profile = existing && !overwrite && !incomingIsNewer
      ? { ...incomingProfile, ...existing }
      : incomingProfile;
    const selectedSet = profileSetKey(profile);
    const nextProfile = {
      ...profile,
      focusLeaderboard: mergeFocusEntries(state, selectedSet, asArray(focusBoards[selectedSet])),
      leaderboard: mergeAllTimeEntries(state, [
        ...asArray(existing?.leaderboard), ...asArray(incoming.leaderboard),
      ]),
      sessionLeaderboard: mergeAllTimeEntries(state, [
        ...asArray(existing?.sessionLeaderboard), ...asArray(incoming.sessionLeaderboard),
      ]),
    };
    return {
      ...state,
      focusBoards,
      profiles: existing
        ? state.profiles.map(profileEntry => `${profileEntry.id}` === id ? nextProfile : profileEntry)
        : [nextProfile, ...state.profiles],
    };
  };

  return {
    read: async () => {
      const snapshot = await store.read();
      stateFields(snapshot.data);
      return snapshot;
    },

    append: (entry: any, { focusSetKey, profileId }: { focusSetKey: string; profileId?: string | null }) =>
      store.update(rawState => {
        const state = stateFields(rawState);
        if (helpers.isBottleneckModeKey(`${entry?.mode || ''}`)) return state;
        if (!isFocus(entry)) {
          return { ...state, allTime: mergeAllTimeEntries(state, [...state.allTime, entry]) };
        }
        const board = mergeFocusEntries(state, focusSetKey, [
          ...asArray(state.focusBoards[focusSetKey]), { ...entry, focusSetKey },
        ]);
        return {
          ...state,
          focusBoards: { ...state.focusBoards, [focusSetKey]: board },
          profiles: state.profiles.map(profile => {
            if (profileId == null || `${profile.id}` !== `${profileId}` || profileSetKey(profile) !== focusSetKey) return profile;
            const focusLeaderboard = mergeFocusEntries(state, focusSetKey, [
              ...asArray(profile.focusLeaderboard), ...board,
            ]);
            return JSON.stringify(focusLeaderboard) === JSON.stringify(asArray(profile.focusLeaderboard))
              ? profile
              : { ...profile, focusLeaderboard, updatedAt: Math.max(Number(profile.updatedAt) || 0, Date.now()) };
          }),
        };
      }),

    mergeAllTime: (entries: any[]) => store.update(rawState => {
      const state = stateFields(rawState);
      return { ...state, allTime: mergeAllTimeEntries(state, [...state.allTime, ...asArray(entries)]) };
    }),

    mergeFocus: (setKey: string, entries: any[]) => store.update(rawState => {
      const state = stateFields(rawState);
      return {
        ...state,
        focusBoards: {
          ...state.focusBoards,
          [setKey]: mergeFocusEntries(state, setKey, [...asArray(state.focusBoards[setKey]), ...asArray(entries)]),
        },
      };
    }),

    removeEntry: (entry: any, setKey: string) => store.update(rawState => {
      const state = stateFields(rawState);
      if (helpers.isBottleneckModeKey(`${entry?.mode || ''}`)) return state;
      const scope = isFocus(entry) ? setKey : 'allTime';
      const normalizedEntry = helpers.normalizeEntries([entry])[0] || entry;
      const identity = leaderboardEntryIdentity(normalizedEntry);
      const nextState = {
        ...state,
        deletedEntryIds: {
          ...state.deletedEntryIds,
          [scope]: [...new Set([...(state.deletedEntryIds?.[scope] || []), identity])],
        },
      };
      if (scope === 'allTime') {
        return {
          ...nextState,
          allTime: mergeAllTimeEntries(nextState, state.allTime),
          profiles: state.profiles.map(profile => ({
            ...profile,
            leaderboard: mergeAllTimeEntries(nextState, asArray(profile.leaderboard)),
            sessionLeaderboard: mergeAllTimeEntries(nextState, asArray(profile.sessionLeaderboard)),
          })),
        };
      }
      return {
        ...nextState,
        focusBoards: {
          ...state.focusBoards,
          [scope]: mergeFocusEntries(nextState, scope, asArray(state.focusBoards[scope])),
        },
        profiles: state.profiles.map(profile => profileSetKey(profile) === scope
          ? { ...profile, focusLeaderboard: mergeFocusEntries(nextState, scope, asArray(profile.focusLeaderboard)) }
          : profile),
      };
    }),

    saveProfile: (profile: any, { overwrite = false }: { overwrite?: boolean } = {}) =>
      store.update(state => saveProfileInto(state, profile, overwrite)),

    updateProfileNotes: (id: string, notes: string, noteFolders: any[], { focusSetKey }: { focusSetKey?: string } = {}) => store.update(rawState => {
      const state = stateFields(rawState);
      const target = state.profiles.find(profile => `${profile.id}` === `${id}`);
      if (!target) {
        throw new Error('The Focus profile no longer exists. Notes were not saved.');
      }
      if (focusSetKey !== undefined && profileSetKey(target) !== focusSetKey) {
        throw new Error('The Focus profile selection changed. Reload the profile before saving notes.');
      }
      return {
        ...state,
        profiles: state.profiles.map(profile => {
          if (`${profile.id}` !== `${id}` || (profile.notes === notes
            && JSON.stringify(profile.noteFolders) === JSON.stringify(noteFolders))) return profile;
          return { ...profile, notes, noteFolders, updatedAt: Math.max(Number(profile.updatedAt) || 0, Date.now()) };
        }),
      };
    }),

    deleteProfile: (id: string) => store.update(rawState => {
      const state = stateFields(rawState);
      return { ...state, profiles: state.profiles.filter(profile => `${profile.id}` !== `${id}`) };
    }),

    importProfiles: (profiles: any[]) => store.update(state => asArray(profiles)
      .reduce((latest, profile) => saveProfileInto(latest, profile, false), stateFields(state))),
  };
}
