import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SaveManagerStats } from './SaveManagerStats';
import { PasteFocusButton } from './PasteFocusButton';

type SaveFile = {
  id: string;
  name: string;
  updatedAt: number;
};

type SaveManagerProps = {
  visible: boolean;
  profiles: SaveFile[];
  loadedProfileId: string | null;
  name: string;
  onNameChange: (name: string) => void;
  onClose: () => void;
  onCreate: () => void;
  onLoad: (profile: SaveFile) => void;
  onOverwrite: (id: string) => void;
  onDelete: (id: string) => void;
  hasFocusItems: boolean;
  hasBottleneckItems: boolean;
  onClearFocus: () => void;
  onClearBottleneck: () => void;
  onPasteFocus: (text: string) => Promise<string>;
  focusImportDisabled: boolean;
  onExportFocus: () => void;
  onImportFocus: () => void;
  onExportLeaderboard: () => void;
  onImportLeaderboard: () => void;
  formatDateTime: (timestamp: number) => string;
  formatModeLabel: (mode: string) => string;
  formatDuration: (durationMs: number) => string;
};

export function SaveManager({
  visible, profiles, loadedProfileId, name, onNameChange, onClose, onCreate,
  onLoad, onOverwrite, onDelete, onExportFocus, onImportFocus,
  hasFocusItems, hasBottleneckItems, onClearFocus, onClearBottleneck,
  onPasteFocus, focusImportDisabled,
  onExportLeaderboard, onImportLeaderboard, formatDateTime, formatModeLabel, formatDuration,
}: SaveManagerProps) {
  const [page, setPage] = useState<'files' | 'stats'>('files');
  const [search, setSearch] = useState('');
  const { width } = useWindowDimensions();
  const compact = width < 640;
  const canCreate = Boolean(name.trim());
  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return profiles.filter(profile => profile.name.toLocaleLowerCase().includes(query));
  }, [profiles, search]);

  useEffect(() => {
    if (visible) {
      setPage('files');
      setSearch('');
    }
  }, [visible]);

  const action = (label: string, onPress: () => void, accessibilityLabel: string, primary = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [s.button, primary && s.primaryButton, pressed && s.pressed]}
    >
      <Text style={[s.buttonLabel, primary && s.primaryLabel]}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal animationType="none" transparent visible={visible} onRequestClose={onClose}>
      <View style={[s.overlay, compact && s.overlayCompact]}>
        <View style={[s.panel, compact && s.panelCompact]} testID="save-manager">
          <View style={s.header}>
            <Text accessibilityRole="header" style={s.title}>Save Manager</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close Save Manager" onPress={onClose} style={s.closeButton}>
              <Text style={s.closeLabel}>×</Text>
            </Pressable>
          </View>
          <View style={s.navigation}>
            {(['files', 'stats'] as const).map(value => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: page === value }}
                onPress={() => setPage(value)}
                style={[s.navButton, page === value && s.navButtonActive]}
              >
                <Text style={[s.navLabel, page === value && s.navLabelActive]}>{value === 'files' ? 'Files' : 'Stats'}</Text>
              </Pressable>
            ))}
          </View>
          <ScrollView key={page} style={s.scroll} contentContainerStyle={[s.content, compact && s.contentCompact]} keyboardShouldPersistTaps="handled">
            {page === 'files' ? (
              <View style={s.filesPage} testID="save-manager-files">
                <View style={s.createRow}>
                  <TextInput
                    accessibilityLabel="New save file name"
                    style={s.nameInput}
                    value={name}
                    onChangeText={onNameChange}
                    placeholder="New file name"
                    placeholderTextColor="#7f91aa"
                    returnKeyType="done"
                    onSubmitEditing={() => { if (canCreate) onCreate(); }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canCreate }}
                    disabled={!canCreate}
                    onPress={onCreate}
                    style={({ pressed }) => [s.button, s.primaryButton, s.createButton, !canCreate && s.disabled, pressed && s.pressed]}
                  >
                    <Text style={s.primaryLabel}>Save as new</Text>
                  </Pressable>
                </View>

                <View style={s.selectionRow}>
                  <Text style={s.sectionTitle}>Current selections</Text>
                  <View style={[s.fileActions, compact && s.fileActionsCompact]}>
                    <PasteFocusButton disabled={focusImportDisabled} onImport={onPasteFocus} />
                    {[
                      { label: 'Clear all Focus', enabled: hasFocusItems, onPress: onClearFocus },
                      { label: 'Clear all Bottleneck', enabled: hasBottleneckItems, onPress: onClearBottleneck },
                    ].map(control => (
                      <Pressable
                        key={control.label}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !control.enabled }}
                        disabled={!control.enabled}
                        onPress={control.onPress}
                        style={({ pressed }) => [s.button, !control.enabled && s.disabled, pressed && s.pressed]}
                      >
                        <Text style={s.buttonLabel}>{control.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={s.listSection}>
                  <View style={s.sectionHeader}>
                    <Text accessibilityRole="header" style={s.sectionTitle}>Focus files</Text>
                    {profiles.length > 0 ? (
                      <TextInput
                        accessibilityLabel="Search Focus files"
                        style={[s.searchInput, compact && s.searchInputCompact]}
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search files"
                        placeholderTextColor="#7f91aa"
                      />
                    ) : null}
                  </View>
                  <View style={s.fileList}>
                    {filteredProfiles.length === 0 ? (
                      <View style={s.emptyState}>
                        <Text style={s.emptyTitle}>{profiles.length ? 'No matching files' : 'No saved files yet'}</Text>
                        {profiles.length ? (
                          action('Clear search', () => setSearch(''), 'Clear file search')
                        ) : (
                          <Text style={s.meta}>Name your current setup to save it.</Text>
                        )}
                      </View>
                    ) : filteredProfiles.map(profile => {
                      const loaded = loadedProfileId === profile.id;
                      return (
                        <View key={profile.id} style={[s.fileRow, loaded && s.fileRowLoaded]}>
                          <View style={s.fileInfo}>
                            <View style={s.fileTitleRow}>
                              <Text style={s.fileName}>{profile.name}</Text>
                              {loaded ? <Text style={s.loadedBadge}>Loaded</Text> : null}
                            </View>
                            <Text style={s.meta}>Updated {formatDateTime(profile.updatedAt)}</Text>
                          </View>
                          <View style={[s.fileActions, compact && s.fileActionsCompact]}>
                            {action('Load', () => onLoad(profile), `Load ${profile.name}`, !loaded)}
                            {action('Overwrite', () => onOverwrite(profile.id), `Overwrite ${profile.name}`)}
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Delete ${profile.name}`}
                              onPress={() => onDelete(profile.id)}
                              style={({ pressed }) => [s.button, s.deleteButton, pressed && s.pressed]}
                            >
                              <Text style={s.deleteLabel}>Delete</Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>

                <View style={s.backupsSection}>
                  <Text accessibilityRole="header" style={s.sectionTitle}>Backups</Text>
                  <View style={s.backupGrid}>
                    <View style={s.backupRow}>
                      <Text style={s.backupLabel}>Focus files</Text>
                      <View style={s.backupActions}>
                        {action('Export', onExportFocus, 'Export Focus files')}
                        {action('Import', onImportFocus, 'Import Focus files')}
                      </View>
                    </View>
                    <View style={s.backupRow}>
                      <Text style={s.backupLabel}>Leaderboard</Text>
                      <View style={s.backupActions}>
                        {action('Export', onExportLeaderboard, 'Export leaderboard')}
                        {action('Import', onImportLeaderboard, 'Import leaderboard')}
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              <SaveManagerStats
                profiles={profiles}
                loadedProfileId={loadedProfileId}
                onShowFiles={() => setPage('files')}
                formatModeLabel={formatModeLabel}
                formatDateTime={formatDateTime}
                formatDuration={formatDuration}
              />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.8)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  overlayCompact: { padding: 10 },
  panel: { width: '100%', maxWidth: 1120, height: '88%', maxHeight: 900, backgroundColor: '#101b2d', borderWidth: 1, borderColor: '#334155', borderRadius: 18, overflow: 'hidden' },
  panelCompact: { height: '96%', borderRadius: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 24, paddingRight: 16, paddingTop: 16, paddingBottom: 10 },
  title: { fontSize: 21, fontWeight: '700', color: '#f8fafc' },
  closeButton: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  closeLabel: { color: '#94a3b8', fontSize: 28, lineHeight: 30 },
  navigation: { flexDirection: 'row', gap: 20, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: '#26364d' },
  navButton: { paddingHorizontal: 4, paddingTop: 6, paddingBottom: 14, minWidth: 54, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  navButtonActive: { borderBottomColor: '#60a5fa' },
  navLabel: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  navLabelActive: { color: '#bfdbfe' },
  scroll: { flex: 1, minHeight: 0 },
  content: { padding: 24, flexGrow: 1 },
  contentCompact: { padding: 14 },
  filesPage: { gap: 24, flexGrow: 1 },
  createRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  nameInput: { flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 0, minHeight: 44, borderWidth: 1, borderColor: '#3b4e69', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#f8fafc', backgroundColor: '#0c1526' },
  createButton: { minHeight: 44, paddingHorizontal: 20 },
  button: { minHeight: 36, paddingHorizontal: 13, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: '#3b4b62', backgroundColor: '#1c2a3f' },
  buttonLabel: { fontSize: 12, fontWeight: '600', color: '#dbe5f3' },
  primaryButton: { backgroundColor: '#244eb5', borderColor: '#4d7ee2' },
  primaryLabel: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  listSection: { gap: 12 },
  selectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#dbe5f3' },
  searchInput: { minHeight: 36, width: 230, maxWidth: '100%', borderRadius: 7, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, color: '#e2e8f0', backgroundColor: '#0c1526' },
  searchInputCompact: { width: '100%' },
  fileList: { gap: 8 },
  fileRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14, padding: 14, borderWidth: 1, borderColor: '#283a53', borderRadius: 10, backgroundColor: '#0e1829' },
  fileRowLoaded: { borderColor: '#4978b8', backgroundColor: '#12233d' },
  fileInfo: { flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0, gap: 5 },
  fileTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  fileName: { fontSize: 14, fontWeight: '600', color: '#edf3fc', flexShrink: 1 },
  loadedBadge: { fontSize: 10, fontWeight: '700', color: '#93c5fd', backgroundColor: '#1c3b65', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 5, overflow: 'hidden' },
  meta: { color: '#8fa2bc', fontSize: 12, lineHeight: 18 },
  fileActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fileActionsCompact: { width: '100%' },
  deleteButton: { borderColor: 'transparent', backgroundColor: 'transparent' },
  deleteLabel: { color: '#fca5a5', fontSize: 12, fontWeight: '600' },
  emptyState: { paddingVertical: 32, paddingHorizontal: 16, alignItems: 'center', gap: 10, backgroundColor: '#0e1829', borderRadius: 10, borderWidth: 1, borderColor: '#283a53' },
  emptyTitle: { color: '#dbe5f3', fontSize: 14, fontWeight: '600' },
  backupsSection: { gap: 12, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#26364d', marginTop: 'auto' },
  backupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  backupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, flexGrow: 1, flexShrink: 1, flexBasis: 320, minWidth: 0 },
  backupLabel: { color: '#94a3b8', fontSize: 13 },
  backupActions: { flexDirection: 'row', gap: 6 },
});
