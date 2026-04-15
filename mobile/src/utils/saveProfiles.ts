export const SAVE_PROFILES_FILE_EXTENSION = '.tensai-save-profiles.json';
export const SAVE_PROFILES_EXPORT_TYPE = 'tensai-save-profiles';

const asArray = (value: any) => (Array.isArray(value) ? value : []);

export const createSaveProfileId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const normalizeFocusItemsPayload = (
  rawItems: any,
  normalizeStoredFocusItem: (item: any, sourceMode?: string) => any,
) =>
  asArray(rawItems)
    .filter(entry => entry && typeof entry === 'object' && entry.item && entry.sourceMode)
    .map(entry => {
      const sourceMode = `${entry.sourceMode}`;
      const rawItem = entry.item && typeof entry.item === 'object' ? entry.item : {};
      return {
        key: entry.key ? `${entry.key}` : `${sourceMode}:${rawItem.id || rawItem.kana || createSaveProfileId()}`,
        sourceMode,
        item: {
          ...normalizeStoredFocusItem(rawItem, sourceMode),
        },
      };
    });

const normalizeLeaderboardEntriesPayload = (
  rawEntries: any,
  limitLeaderboardPerMode: (entries: any[]) => any[],
  predicate?: (entry: any) => boolean,
) => {
  const filtered = asArray(rawEntries)
    .filter(entry => entry && typeof entry === 'object')
    .filter(entry => (predicate ? predicate(entry) : true));
  return limitLeaderboardPerMode(filtered);
};

export const buildSaveProfilePayload = ({
  id,
  name,
  createdAt,
  updatedAt,
  focusItems,
  focusLeaderboard,
  leaderboard,
  sessionLeaderboard,
}: {
  id?: string;
  name?: string;
  createdAt?: number;
  updatedAt?: number;
  focusItems?: any[];
  focusLeaderboard?: any[];
  leaderboard?: any[];
  sessionLeaderboard?: any[];
}) => ({
  id: id || createSaveProfileId(),
  name: (name || '').trim() || 'Untitled save profile',
  createdAt: Number(createdAt) || Date.now(),
  updatedAt: Number(updatedAt) || Date.now(),
  focusItems: asArray(focusItems),
  focusLeaderboard: asArray(focusLeaderboard),
  leaderboard: asArray(leaderboard),
  sessionLeaderboard: asArray(sessionLeaderboard),
});

export const normalizeSaveProfilesPayload = (
  rawProfiles: any,
  helpers: {
    isFocusModeKey: (modeKey: string) => boolean;
    limitLeaderboardPerMode: (entries: any[]) => any[];
    normalizeStoredFocusItem: (item: any, sourceMode?: string) => any;
  },
) =>
  asArray(rawProfiles)
    .filter(profile => profile && typeof profile === 'object')
    .map(profile => {
      const focusItems = normalizeFocusItemsPayload(profile.focusItems, helpers.normalizeStoredFocusItem);
      const focusLeaderboard = normalizeLeaderboardEntriesPayload(
        profile.focusLeaderboard,
        helpers.limitLeaderboardPerMode,
        entry => helpers.isFocusModeKey(entry?.mode || ''),
      );
      const leaderboard = normalizeLeaderboardEntriesPayload(
        profile.leaderboard,
        helpers.limitLeaderboardPerMode,
        entry => !helpers.isFocusModeKey(entry?.mode || ''),
      );
      const sessionLeaderboard = normalizeLeaderboardEntriesPayload(
        profile.sessionLeaderboard,
        helpers.limitLeaderboardPerMode,
        entry => !helpers.isFocusModeKey(entry?.mode || ''),
      );

      return buildSaveProfilePayload({
        id: profile.id ? `${profile.id}` : createSaveProfileId(),
        name: profile.name ? `${profile.name}` : 'Imported save profile',
        createdAt: Number(profile.createdAt) || Date.now(),
        updatedAt: Number(profile.updatedAt) || Number(profile.createdAt) || Date.now(),
        focusItems,
        focusLeaderboard,
        leaderboard,
        sessionLeaderboard,
      });
    })
    .slice(0, 200);

export const convertLegacySnapshotsToProfiles = (
  payload: any,
  helpers: {
    isFocusModeKey: (modeKey: string) => boolean;
    limitLeaderboardPerMode: (entries: any[]) => any[];
    normalizeStoredFocusItem: (item: any, sourceMode?: string) => any;
  },
) => {
  const focusProfiles = asArray(payload?.focusSnapshots).map(snapshot =>
    buildSaveProfilePayload({
      id: snapshot?.id ? `${snapshot.id}` : createSaveProfileId(),
      name: snapshot?.name ? `Focus: ${snapshot.name}` : 'Migrated Focus save',
      createdAt: Number(snapshot?.createdAt) || Date.now(),
      updatedAt: Number(snapshot?.createdAt) || Date.now(),
      focusItems: normalizeFocusItemsPayload(snapshot?.focusItems, helpers.normalizeStoredFocusItem),
      focusLeaderboard: normalizeLeaderboardEntriesPayload(
        snapshot?.focusLeaderboard,
        helpers.limitLeaderboardPerMode,
        entry => helpers.isFocusModeKey(entry?.mode || ''),
      ),
      leaderboard: [],
      sessionLeaderboard: [],
    }),
  );

  const leaderboardProfiles = asArray(payload?.leaderboardSnapshots).map(snapshot =>
    buildSaveProfilePayload({
      id: snapshot?.id ? `${snapshot.id}` : createSaveProfileId(),
      name: snapshot?.name ? `Leaderboard: ${snapshot.name}` : 'Migrated leaderboard save',
      createdAt: Number(snapshot?.createdAt) || Date.now(),
      updatedAt: Number(snapshot?.createdAt) || Date.now(),
      focusItems: [],
      focusLeaderboard: [],
      leaderboard: normalizeLeaderboardEntriesPayload(
        snapshot?.leaderboard,
        helpers.limitLeaderboardPerMode,
        entry => !helpers.isFocusModeKey(entry?.mode || ''),
      ),
      sessionLeaderboard: normalizeLeaderboardEntriesPayload(
        snapshot?.sessionLeaderboard,
        helpers.limitLeaderboardPerMode,
        entry => !helpers.isFocusModeKey(entry?.mode || ''),
      ),
    }),
  );

  return [...focusProfiles, ...leaderboardProfiles].slice(0, 200);
};

export const extractSaveProfilesFromImport = (
  payload: any,
  helpers: {
    isFocusModeKey: (modeKey: string) => boolean;
    limitLeaderboardPerMode: (entries: any[]) => any[];
    normalizeStoredFocusItem: (item: any, sourceMode?: string) => any;
  },
) => {
  if (Array.isArray(payload?.profiles)) {
    return normalizeSaveProfilesPayload(payload.profiles, helpers);
  }

  if (Array.isArray(payload)) {
    return normalizeSaveProfilesPayload(payload, helpers);
  }

  const legacyProfiles = convertLegacySnapshotsToProfiles(payload, helpers);
  if (legacyProfiles.length > 0) {
    return legacyProfiles;
  }

  return [];
};

export const buildSaveProfilesExportPayload = (profiles: any[]) => ({
  version: 2,
  type: SAVE_PROFILES_EXPORT_TYPE,
  exportedAt: new Date().toISOString(),
  profiles: asArray(profiles),
});
