export const SAVE_PROFILES_FILE_EXTENSION = '.tensai-save-profiles.json';
export const SAVE_PROFILES_EXPORT_TYPE = 'tensai-save-profiles';

const asArray = (value: any) => (Array.isArray(value) ? value : []);
const normalizeProfileNotesPayload = (value: any) => (typeof value === 'string' ? value.slice(0, 50000) : '');

export const createSaveProfileId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const createFocusNoteFolderId = () => `folder-${createSaveProfileId()}`;

export const buildFocusNoteFolderPayload = ({
  id,
  title,
  notes,
  createdAt,
  updatedAt,
}: {
  id?: string;
  title?: string;
  notes?: string;
  createdAt?: number;
  updatedAt?: number;
}) => {
  const now = Date.now();
  return {
    id: id ? `${id}` : createFocusNoteFolderId(),
    title: (title || '').trim().slice(0, 80) || 'General',
    notes: normalizeProfileNotesPayload(notes),
    createdAt: Number(createdAt) || now,
    updatedAt: Number(updatedAt) || Number(createdAt) || now,
  };
};

export const normalizeFocusNoteFoldersPayload = (rawFolders: any, legacyNotes?: any) => {
  const folders = asArray(rawFolders)
    .filter(folder => folder && typeof folder === 'object')
    .map(folder =>
      buildFocusNoteFolderPayload({
        id: folder.id,
        title: folder.title || folder.name,
        notes: folder.notes,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      }),
    )
    .slice(0, 60);

  if (folders.length > 0) {
    return folders;
  }

  return [
    buildFocusNoteFolderPayload({
      title: 'General',
      notes: legacyNotes,
    }),
  ];
};

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
  bottleneckItems,
  focusLeaderboard,
  leaderboard,
  sessionLeaderboard,
  notes,
  noteFolders,
}: {
  id?: string;
  name?: string;
  createdAt?: number;
  updatedAt?: number;
  focusItems?: any[];
  bottleneckItems?: any[];
  focusLeaderboard?: any[];
  leaderboard?: any[];
  sessionLeaderboard?: any[];
  notes?: string;
  noteFolders?: any[];
}) => {
  const normalizedNoteFolders = normalizeFocusNoteFoldersPayload(noteFolders, notes);
  const legacyNotes = typeof notes === 'string' ? notes : normalizedNoteFolders[0]?.notes;

  return {
    id: id || createSaveProfileId(),
    name: (name || '').trim() || 'Untitled save profile',
    createdAt: Number(createdAt) || Date.now(),
    updatedAt: Number(updatedAt) || Date.now(),
    focusItems: asArray(focusItems),
    bottleneckItems: asArray(bottleneckItems),
    focusLeaderboard: asArray(focusLeaderboard),
    leaderboard: asArray(leaderboard),
    sessionLeaderboard: asArray(sessionLeaderboard),
    notes: normalizeProfileNotesPayload(legacyNotes),
    noteFolders: normalizedNoteFolders,
  };
};

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
      const bottleneckItems = normalizeFocusItemsPayload(profile.bottleneckItems, helpers.normalizeStoredFocusItem);
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
        bottleneckItems,
        focusLeaderboard,
        leaderboard,
        sessionLeaderboard,
        notes: profile.notes,
        noteFolders: profile.noteFolders,
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
      bottleneckItems: normalizeFocusItemsPayload(snapshot?.bottleneckItems, helpers.normalizeStoredFocusItem),
      focusLeaderboard: normalizeLeaderboardEntriesPayload(
        snapshot?.focusLeaderboard,
        helpers.limitLeaderboardPerMode,
        entry => helpers.isFocusModeKey(entry?.mode || ''),
      ),
      leaderboard: [],
      sessionLeaderboard: [],
      notes: '',
      noteFolders: [],
    }),
  );

  return focusProfiles.slice(0, 200);
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
  version: 3,
  type: SAVE_PROFILES_EXPORT_TYPE,
  exportedAt: new Date().toISOString(),
  profiles: asArray(profiles).map(profile =>
    buildSaveProfilePayload({
      id: profile?.id,
      name: profile?.name,
      createdAt: profile?.createdAt,
      updatedAt: profile?.updatedAt,
      focusItems: profile?.focusItems,
      bottleneckItems: profile?.bottleneckItems,
      focusLeaderboard: profile?.focusLeaderboard,
      leaderboard: [],
      sessionLeaderboard: [],
      notes: profile?.notes,
      noteFolders: profile?.noteFolders,
    }),
  ),
});
