import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { buildSaveProfileStats } from '../utils/saveProfileStats';

export type SaveManagerStatsProps = {
  profiles: readonly any[];
  loadedProfileId: string | null;
  onShowFiles: () => void;
  formatModeLabel: (mode: string) => string;
  formatDateTime: (timestamp: number) => string;
  formatDuration: (durationMs: number) => string;
};

const count = (value: number) => value.toLocaleString();

const StatCard = ({ value, label, detail, accent = false }: {
  value: string;
  label: string;
  detail?: string;
  accent?: boolean;
}) => (
  <View style={[styles.statCard, accent && styles.statCardAccent]}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, accent && styles.accentText]}>{value}</Text>
    {detail ? <Text style={styles.muted}>{detail}</Text> : null}
  </View>
);

export function SaveManagerStats({
  profiles,
  loadedProfileId,
  onShowFiles,
  formatModeLabel,
  formatDateTime,
  formatDuration,
}: SaveManagerStatsProps) {
  const [scope, setScope] = useState<'current' | 'all'>('current');
  const currentProfile = profiles.find(profile => profile.id === loadedProfileId);
  const scopedProfiles = useMemo(
    () => scope === 'all' ? profiles : currentProfile ? [currentProfile] : [],
    [scope, profiles, currentProfile],
  );
  const stats = useMemo(() => buildSaveProfileStats(scopedProfiles), [scopedProfiles]);
  const fileStats = useMemo(
    () => scope === 'all'
      ? profiles.map(profile => ({ profile, stats: buildSaveProfileStats([profile]) }))
      : [],
    [scope, profiles],
  );
  const maxSourceCount = Math.max(
    1,
    ...stats.sourceModes.map(source => source.focusItemCount + source.bottleneckItemCount),
  );

  return (
    <View style={styles.page} testID="save-manager-stats">
      <View style={styles.headingRow}>
        <Text style={styles.heading}>Statistics</Text>
        <View style={styles.scopeControl}>
          {([
            { key: 'current', label: 'Current save' },
            { key: 'all', label: 'All Focus files' },
          ] as const).map(option => (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityState={{ selected: scope === option.key }}
              testID={`save-stats-scope-${option.key}`}
              onPress={() => setScope(option.key)}
              style={({ pressed }) => [
                styles.scopeButton,
                scope === option.key && styles.scopeButtonSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.scopeLabel, scope === option.key && styles.scopeLabelSelected]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {scopedProfiles.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {scope === 'current' ? 'Load a file to see its stats.' : 'No Focus files saved yet.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onShowFiles}
            style={({ pressed }) => [styles.filesButton, pressed && styles.pressed]}
          >
            <Text style={styles.filesButtonText}>Go to files</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>
              {scope === 'current' ? currentProfile.name : `${count(stats.profileCount)} Focus files`}
            </Text>
            <View style={styles.metadata}>
              {stats.lastSavedAt ? (
                <Text style={styles.muted}>Last saved {formatDateTime(stats.lastSavedAt)}</Text>
              ) : null}
              {stats.lastPlayedAt ? (
                <Text style={styles.muted}>Last played {formatDateTime(stats.lastPlayedAt)}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.statGrid}>
            <StatCard
              value={count(stats.focusItemCount)}
              label="Focus items"
              detail={scope === 'all' ? `${count(stats.uniqueFocusItemCount)} unique` : undefined}
              accent
            />
            <StatCard
              value={count(stats.bottleneckItemCount)}
              label="Bottleneck items"
              detail={scope === 'all' ? `${count(stats.uniqueBottleneckItemCount)} unique` : undefined}
            />
            <StatCard value={count(stats.recordedRunCount)} label="Saved runs" />
            <StatCard value={formatDuration(stats.recordedTimeMs)} label="Saved run time" />
            <StatCard value={count(stats.sourceModes.length)} label="Datasets" />
            <StatCard
              value={count(stats.noteCharacterCount)}
              label="Note characters"
              detail={`${count(stats.noteFolderCount)} ${stats.noteFolderCount === 1 ? 'folder' : 'folders'}`}
            />
          </View>

          <View style={styles.detailGrid}>
            <View style={styles.panel}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>Content by dataset</Text>
                <View style={styles.legend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, styles.focusFill]} />
                    <Text style={styles.smallMuted}>Focus</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, styles.bottleneckFill]} />
                    <Text style={styles.smallMuted}>Bottleneck</Text>
                  </View>
                </View>
              </View>
              {stats.sourceModes.length === 0 ? (
                <Text style={styles.muted}>No saved items.</Text>
              ) : stats.sourceModes.map(source => (
                <View key={source.sourceMode} style={styles.datasetRow}>
                  <View style={styles.datasetHeading}>
                    <Text style={styles.rowTitle}>{formatModeLabel(source.sourceMode)}</Text>
                    <View style={styles.datasetCounts}>
                      <Text style={styles.focusText}>{count(source.focusItemCount)}</Text>
                      <Text style={styles.smallMuted}>/</Text>
                      <Text style={styles.bottleneckText}>{count(source.bottleneckItemCount)}</Text>
                    </View>
                  </View>
                  <View
                    style={styles.barTrack}
                    accessibilityLabel={`${count(source.focusItemCount)} Focus items, ${count(source.bottleneckItemCount)} Bottleneck items`}
                  >
                    <View style={[styles.barFill, styles.focusFill, {
                      width: `${100 * source.focusItemCount / maxSourceCount}%`,
                    }]} />
                    <View style={[styles.barFill, styles.bottleneckFill, {
                      width: `${100 * source.bottleneckItemCount / maxSourceCount}%`,
                    }]} />
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>Saved runs by mode</Text>
              {stats.recordedRunCount === 0 ? (
                <Text style={styles.muted}>No saved runs.</Text>
              ) : (
                <>
                  <View style={styles.runStatuses}>
                    <View style={styles.runStatus}>
                      <Text style={styles.statusValue}>{count(stats.completedRunCount)}</Text>
                      <Text style={styles.smallMuted}>Finished sets</Text>
                    </View>
                    <View style={styles.runStatus}>
                      <Text style={styles.statusValue}>{count(stats.timedRunCount)}</Text>
                      <Text style={styles.smallMuted}>Time ended</Text>
                    </View>
                    <View style={styles.runStatus}>
                      <Text style={styles.statusValue}>{count(stats.stoppedRunCount)}</Text>
                      <Text style={styles.smallMuted}>Stopped</Text>
                    </View>
                  </View>
                  {stats.modes.map(mode => (
                    <View key={mode.mode} style={styles.modeRow}>
                      <Text style={styles.rowTitle}>{formatModeLabel(mode.mode)}</Text>
                      <View style={styles.modeValues}>
                        <Text style={styles.rowValue}>
                          {count(mode.runCount)} {mode.runCount === 1 ? 'run' : 'runs'}
                        </Text>
                        <Text style={styles.smallMuted}>{formatDuration(mode.recordedTimeMs)}</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </View>
          </View>

          {scope === 'all' ? (
            <View style={styles.comparisonPanel}>
              <Text style={styles.sectionTitle}>File comparison</Text>
              {fileStats.map(({ profile, stats: savedStats }) => (
                <View key={profile.id} style={styles.fileRow}>
                  <View style={styles.fileIdentity}>
                    <View style={styles.fileNameRow}>
                      <Text style={styles.rowTitle}>{profile.name}</Text>
                      {profile.id === loadedProfileId ? (
                        <Text style={styles.currentBadge}>Current</Text>
                      ) : null}
                    </View>
                    {savedStats.lastSavedAt ? (
                      <Text style={styles.smallMuted}>{formatDateTime(savedStats.lastSavedAt)}</Text>
                    ) : null}
                  </View>
                  <View style={styles.fileMetrics}>
                    {[
                      { label: 'Focus', value: savedStats.focusItemCount },
                      { label: 'Bottleneck', value: savedStats.bottleneckItemCount },
                      { label: 'Saved runs', value: savedStats.recordedRunCount },
                      { label: 'Note chars', value: savedStats.noteCharacterCount },
                    ].map(metric => (
                      <View key={metric.label} style={styles.fileMetric}>
                        <Text style={styles.rowValue}>{count(metric.value)}</Text>
                        <Text style={styles.smallMuted}>{metric.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 18, paddingBottom: 8 },
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  heading: { color: '#f8fafc', fontSize: 21, fontWeight: '700' },
  scopeControl: { flexDirection: 'row', flexWrap: 'wrap', padding: 4, gap: 4, backgroundColor: '#0f172a', borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  scopeButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 7 },
  scopeButtonSelected: { backgroundColor: '#1e3a5f' },
  scopeLabel: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  scopeLabelSelected: { color: '#bfdbfe' },
  pressed: { opacity: 0.75 },
  summary: { gap: 7 },
  summaryTitle: { color: '#e2e8f0', fontSize: 17, fontWeight: '600' },
  metadata: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 5 },
  muted: { color: '#94a3b8', fontSize: 12, lineHeight: 18 },
  smallMuted: { color: '#94a3b8', fontSize: 11, lineHeight: 16 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flexGrow: 1, flexShrink: 1, flexBasis: 130, minWidth: 0, gap: 7, padding: 16, borderWidth: 1, borderColor: '#334155', borderRadius: 12, backgroundColor: '#0f172a' },
  statCardAccent: { borderColor: '#294a73', backgroundColor: '#102039' },
  statLabel: { color: '#a8b7cc', fontSize: 12, fontWeight: '600' },
  statValue: { color: '#f8fafc', fontSize: 25, fontWeight: '700' },
  accentText: { color: '#93c5fd' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  panel: { flexGrow: 1, flexShrink: 1, flexBasis: 330, minWidth: 0, gap: 18, padding: 18, borderWidth: 1, borderColor: '#334155', borderRadius: 12, backgroundColor: '#0f172a' },
  sectionHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  sectionTitle: { color: '#e2e8f0', fontSize: 14, fontWeight: '700' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 3 },
  focusFill: { backgroundColor: '#60a5fa' },
  bottleneckFill: { backgroundColor: '#fbbf24' },
  datasetRow: { gap: 8 },
  datasetHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  datasetCounts: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  rowTitle: { flex: 1, color: '#dbe5f2', fontSize: 13, fontWeight: '600', lineHeight: 19 },
  focusText: { color: '#93c5fd', fontSize: 12, fontWeight: '600' },
  bottleneckText: { color: '#fcd34d', fontSize: 12, fontWeight: '600' },
  barTrack: { flexDirection: 'row', height: 6, borderRadius: 3, backgroundColor: '#1e293b', overflow: 'hidden' },
  barFill: { height: 6 },
  runStatuses: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#263449' },
  runStatus: { flex: 1, flexBasis: 70, gap: 3 },
  statusValue: { color: '#e2e8f0', fontSize: 19, fontWeight: '600' },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  modeValues: { alignItems: 'flex-end', gap: 2 },
  rowValue: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  comparisonPanel: { gap: 6, padding: 18, borderWidth: 1, borderColor: '#334155', borderRadius: 12, backgroundColor: '#0f172a' },
  fileRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#263449' },
  fileIdentity: { flexGrow: 1, flexShrink: 1, flexBasis: 220, gap: 5 },
  fileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currentBadge: { color: '#93c5fd', backgroundColor: '#172f4d', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, fontSize: 10, fontWeight: '600' },
  fileMetrics: { flexDirection: 'row', flexWrap: 'wrap', flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0, gap: 10 },
  fileMetric: { flex: 1, flexBasis: 55, gap: 3 },
  emptyState: { alignItems: 'center', gap: 18, paddingVertical: 52, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: '#334155', backgroundColor: '#0f172a' },
  emptyText: { color: '#a8b7cc', fontSize: 14, textAlign: 'center' },
  filesButton: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 8, backgroundColor: '#2563eb' },
  filesButtonText: { color: '#f8fafc', fontSize: 13, fontWeight: '600' },
});
