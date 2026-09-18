import { createDurableStore } from './durableStore';
import { createLeaderboardRepository, getFocusSetKey } from './leaderboardRepository';

export const LEADERBOARD_DATABASE_KEY = 'tensai-note.leaderboard-database.v3';

type Adapter = { read: (key: string) => Promise<string | null>; write: (key: string, value: string) => Promise<void> };

// An unavailable replica is different from an empty replica. Never turn a Chrome
// storage error into an empty leaderboard that can then overwrite good data.
export function extensionLeaderboardAdapter(): Adapter | null {
  const chrome = (globalThis as any).chrome;
  if (!chrome?.storage?.local) return null;
  return {
    read: key => new Promise((resolve, reject) => {
      chrome.storage.local.get([key], (result: any) => {
        const error = chrome.runtime?.lastError;
        if (error) reject(new Error(error.message || 'Could not read extension storage'));
        else resolve(result?.[key] == null ? null : typeof result[key] === 'string' ? result[key] : JSON.stringify(result[key]));
      });
    }),
    write: (key, value) => new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        const error = chrome.runtime?.lastError;
        if (error) reject(new Error(error.message || 'Could not write extension storage'));
        else resolve();
      });
    }),
  };
}

export function createDesktopLeaderboardRepository(options: {
  adapters: Adapter[];
  normalizeEntries: (entries: any[]) => any[];
  normalizeProfiles: (profiles: any[]) => any[];
  normalizeFocusItems?: (items: any[]) => any[];
  convertLegacyProfiles: (payload: any) => any[];
  isFocusModeKey: (mode: string) => boolean;
  isBottleneckModeKey: (mode: string) => boolean;
  withLock?: <R>(task: () => Promise<R>) => Promise<R>;
}) {
  const { adapters, normalizeEntries, normalizeProfiles, isFocusModeKey, isBottleneckModeKey } = options;
  const parse = (raw: string | null): any => {
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch { console.warn('Skipped a malformed legacy leaderboard copy during migration.'); return null; }
  };
  const focusItems = (value: any) => options.normalizeFocusItems ? options.normalizeFocusItems(Array.isArray(value) ? value : []) : Array.isArray(value) ? value : [];
  const readCopies = async (key: string) => Promise.all(adapters.map(adapter => adapter.read(key)));
  const arrays = (copies: (string | null)[]) => copies.flatMap(raw => {
    const value = parse(raw);
    return Array.isArray(value) ? value : Array.isArray(value?.leaderboard) ? value.leaderboard : [];
  });
  const asArray = (value: any): any[] => Array.isArray(value) ? value : [];
  const entryArray = (raw: string | null): any[] | null => {
    const value = parse(raw);
    return Array.isArray(value) ? value : Array.isArray(value?.leaderboard) ? value.leaderboard : null;
  };
  const store = createDurableStore({
    key: LEADERBOARD_DATABASE_KEY,
    adapters,
    withLock: options.withLock,
    migrate: async () => {
      const keys = [
        'quiz-leaderboard.v1', 'quiz-leaderboard-backup.v1',
        'quiz-focus-leaderboard.v1', 'quiz-focus-leaderboard-backup.v1',
        'quiz-save-profiles.v2', 'quiz-leaderboard-snapshots.v1',
        'quiz-focus-snapshots.v1', 'quiz-focus.v1', 'quiz-bottleneck.v1',
      ];
      const copies = await Promise.all(keys.map(key => readCopies(`tensai-note.${key}`)));
      const allLegacy = [...arrays(copies[0]), ...arrays(copies[1])];
      const snapshots = [...arrays(copies[5]), ...arrays(copies[6])];
      const isFocus = (entry: any) => isFocusModeKey(entry.mode) && !isBottleneckModeKey(entry.mode);
      const focusBoards: Record<string, any[]> = {};
      const mergeBoard = (key: string, entries: any[]) => {
        focusBoards[key] = normalizeEntries([...(focusBoards[key] || []), ...entries]).filter(isFocus);
      };
      // Legacy snapshots belong to their own selections, not the current board.
      snapshots.forEach(snapshot => {
        if (Array.isArray(snapshot?.focusItems)) {
          mergeBoard(getFocusSetKey(focusItems(snapshot.focusItems), focusItems(snapshot.bottleneckItems)), asArray(snapshot.focusLeaderboard));
        }
      });
      const rawProfiles = arrays(copies[4]);
      const profilesById = new Map<string, any>();
      const profiles = rawProfiles.length || copies[4].some(raw => raw !== null)
        ? normalizeProfiles(rawProfiles)
        : options.convertLegacyProfiles({ focusSnapshots: arrays(copies[6]), leaderboardSnapshots: arrays(copies[5]) });
      profiles.forEach(profile => {
        const previous = profilesById.get(profile.id);
        const latest = previous && previous.updatedAt > profile.updatedAt ? previous : profile;
        const sameSet = previous && getFocusSetKey(previous.focusItems, previous.bottleneckItems) === getFocusSetKey(profile.focusItems, profile.bottleneckItems);
        profilesById.set(profile.id, sameSet ? {
          ...latest, focusLeaderboard: normalizeEntries([...asArray(previous.focusLeaderboard), ...asArray(profile.focusLeaderboard)]),
        } : latest);
        mergeBoard(getFocusSetKey(profile.focusItems, profile.bottleneckItems), asArray(profile.focusLeaderboard));
      });
      const selections = adapters.map((_, index) => {
        const focusItems = parse(copies[7][index]);
        const bottleneckItems = parse(copies[8][index]);
        return Array.isArray(focusItems) || Array.isArray(bottleneckItems)
          ? getFocusSetKey(options.normalizeFocusItems ? options.normalizeFocusItems(asArray(focusItems)) : asArray(focusItems), options.normalizeFocusItems ? options.normalizeFocusItems(asArray(bottleneckItems)) : asArray(bottleneckItems)) : null;
      });
      // Extension storage historically mirrored scores without selections. Use
      // the first known selection for those mirrors, never a union of sets.
      const fallbackSet = selections.find(set => set !== null) ?? getFocusSetKey([]);
      const currentCopies = adapters.map((_, index) => ({
        setKey: selections[index] ?? fallbackSet,
        primary: entryArray(copies[2][index]),
        backup: entryArray(copies[3][index]),
        legacy: arrays([copies[0][index], copies[1][index]]),
      }));
      const hasCurrentFocusStorage = currentCopies.some(copy => copy.primary !== null || copy.backup !== null);
      const primaryBySet = new Map<string, any[]>();
      currentCopies.forEach(copy => {
        if (copy.primary !== null && !primaryBySet.has(copy.setKey)) primaryBySet.set(copy.setKey, copy.primary);
      });
      currentCopies.forEach(copy => {
        // A valid empty primary is an explicit reset, not missing data. The
        // first adapter with that set takes precedence over stale mirrors.
        const reset = primaryBySet.get(copy.setKey)?.length === 0;
        const entries = reset || copy.primary?.length === 0 ? []
          : hasCurrentFocusStorage ? [...(copy.primary || []), ...(copy.backup || [])] : copy.legacy;
        mergeBoard(copy.setKey, entries);
      });
      return {
        allTime: normalizeEntries([...allLegacy,
          ...snapshots.flatMap(snapshot => [...asArray(snapshot?.leaderboard), ...asArray(snapshot?.sessionLeaderboard)]),
          ...profiles.flatMap(profile => [...asArray(profile.leaderboard), ...asArray(profile.sessionLeaderboard)])])
          .filter(entry => !isFocusModeKey(entry.mode) && !isBottleneckModeKey(entry.mode)),
        focusBoards,
        profiles: [...profilesById.values()],
        deletedEntryIds: {},
      };
    },
  });
  return createLeaderboardRepository(store, { normalizeEntries, isFocusModeKey, isBottleneckModeKey });
}
