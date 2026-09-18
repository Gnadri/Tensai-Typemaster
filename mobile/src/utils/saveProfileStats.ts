import { leaderboardEntryIdentity } from './leaderboardRepository';

export type SaveProfileStatsInput = {
  createdAt?: number;
  updatedAt?: number;
  focusItems?: readonly any[];
  bottleneckItems?: readonly any[];
  focusLeaderboard?: readonly any[];
  noteFolders?: readonly any[];
  notes?: string;
};

export type SaveProfileModeStats = {
  mode: string;
  runCount: number;
  completedRunCount: number;
  timedRunCount: number;
  stoppedRunCount: number;
  recordedTimeMs: number;
};

export type SaveProfileStats = {
  profileCount: number;
  focusItemCount: number;
  bottleneckItemCount: number;
  uniqueFocusItemCount: number;
  uniqueBottleneckItemCount: number;
  noteFolderCount: number;
  noteCharacterCount: number;
  recordedRunCount: number;
  completedRunCount: number;
  timedRunCount: number;
  stoppedRunCount: number;
  recordedTimeMs: number;
  lastPlayedAt: number | null;
  lastSavedAt: number | null;
  sourceModes: Array<{ sourceMode: string; focusItemCount: number; bottleneckItemCount: number }>;
  modes: SaveProfileModeStats[];
};

const asObjects = (value: unknown): any[] =>
  Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];

const positiveNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const isFocusMode = (mode: unknown): mode is string => {
  if (typeof mode !== 'string') return false;
  const baseMode = mode.replace(/^(?:(?:typemaster|choice|endless|eng):)+/, '');
  return baseMode === 'focus' || baseMode.startsWith('focus:');
};

// Match the saved leaderboard identity, including the legacy score-type alias.
// The same round can be retained in several saved copies of a Focus file.
const runIdentity = leaderboardEntryIdentity;

/** Summarize saved files only. Item totals count saved copies; runs count once. */
export const buildSaveProfileStats = (profiles: readonly SaveProfileStatsInput[]): SaveProfileStats => {
  const savedProfiles = asObjects(profiles);
  const sourceModes = new Map<string, SaveProfileStats['sourceModes'][number]>();
  const modes = new Map<string, SaveProfileModeStats>();
  const focusItemIds = new Set<string>();
  const bottleneckItemIds = new Set<string>();
  const seenRuns = new Set<string>();
  const stats: SaveProfileStats = {
    profileCount: savedProfiles.length,
    focusItemCount: 0,
    bottleneckItemCount: 0,
    uniqueFocusItemCount: 0,
    uniqueBottleneckItemCount: 0,
    noteFolderCount: 0,
    noteCharacterCount: 0,
    recordedRunCount: 0,
    completedRunCount: 0,
    timedRunCount: 0,
    stoppedRunCount: 0,
    recordedTimeMs: 0,
    lastPlayedAt: null,
    lastSavedAt: null,
    sourceModes: [],
    modes: [],
  };

  savedProfiles.forEach((profile, profileIndex) => {
    const savedAt = positiveNumber(profile.updatedAt) || positiveNumber(profile.createdAt);
    if (savedAt) stats.lastSavedAt = Math.max(stats.lastSavedAt || 0, savedAt);
    const countItems = (items: unknown, field: 'focusItemCount' | 'bottleneckItemCount', ids: Set<string>) => {
      asObjects(items).forEach((entry, itemIndex) => {
        const sourceMode = typeof entry.sourceMode === 'string' && entry.sourceMode ? entry.sourceMode : 'unknown';
        const identity = entry.item?.id ?? entry.key ?? entry.item?.kana ?? `missing:${profileIndex}:${itemIndex}`;
        ids.add(JSON.stringify([sourceMode, `${identity}`]));
        stats[field] += 1;
        const source = sourceModes.get(sourceMode) || { sourceMode, focusItemCount: 0, bottleneckItemCount: 0 };
        source[field] += 1;
        sourceModes.set(sourceMode, source);
      });
    };
    countItems(profile.focusItems, 'focusItemCount', focusItemIds);
    countItems(profile.bottleneckItems, 'bottleneckItemCount', bottleneckItemIds);

    const folders = asObjects(profile.noteFolders);
    stats.noteFolderCount += folders.length;
    // `notes` mirrors the active folder in modern files; do not count it twice.
    stats.noteCharacterCount += folders.length
      ? folders.reduce((total, folder) => total + (typeof folder.notes === 'string' ? folder.notes.length : 0), 0)
      : typeof profile.notes === 'string' ? profile.notes.length : 0;

    asObjects(profile.focusLeaderboard).filter(entry => isFocusMode(entry.mode)).forEach(entry => {
      const identity = runIdentity(entry);
      if (seenRuns.has(identity)) return;
      seenRuns.add(identity);
      const timeMs = positiveNumber(entry.timeMs);
      const date = positiveNumber(entry.date);
      const reason = entry.finishReason || 'complete';
      const mode = modes.get(entry.mode) || {
        mode: entry.mode, runCount: 0, completedRunCount: 0,
        timedRunCount: 0, stoppedRunCount: 0, recordedTimeMs: 0,
      };
      stats.recordedRunCount += 1;
      stats.recordedTimeMs += timeMs;
      if (date) stats.lastPlayedAt = Math.max(stats.lastPlayedAt || 0, date);
      mode.runCount += 1;
      mode.recordedTimeMs += timeMs;
      const outcome = reason === 'complete' ? 'completedRunCount'
        : reason === 'time' ? 'timedRunCount'
          : reason === 'stopped' ? 'stoppedRunCount' : null;
      if (outcome) {
        stats[outcome] += 1;
        mode[outcome] += 1;
      }
      modes.set(entry.mode, mode);
    });
  });

  stats.uniqueFocusItemCount = focusItemIds.size;
  stats.uniqueBottleneckItemCount = bottleneckItemIds.size;
  stats.sourceModes = [...sourceModes.values()].sort((a, b) =>
    (b.focusItemCount + b.bottleneckItemCount) - (a.focusItemCount + a.bottleneckItemCount)
    || a.sourceMode.localeCompare(b.sourceMode));
  stats.modes = [...modes.values()].sort((a, b) => b.runCount - a.runCount || a.mode.localeCompare(b.mode));
  return stats;
};
