// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Path } from 'react-native-svg';
// Sentence analyzer wiring is temporarily disabled until backend integration is ready.
// const AsyncStorage: any = require('@react-native-async-storage/async-storage');
// import { analyzeSentence } from './mobile/src/services/analyzerClient';
// API clients are disabled while the app runs fully offline.
// import { PROMPTS } from './mobile/src/data/prompts';
// import { KANJI_BY_LEVEL } from './mobile/src/data/kanji';

// const TAB_OPTIONS = [
//   { key: 'study', label: 'Study Tool' },
//   { key: 'kanji', label: 'Kanji Explorer' },
//   { key: 'calendar', label: 'Practice Calendar' },
// ];
//
// const LEVEL_OPTIONS = ['N5', 'N4', 'N3', 'N2', 'N1'];
//
// const MODE_OPTIONS = [
//   { value: 'sentence', label: 'Sentence' },
//   { value: 'story', label: 'Story' },
// ];
//
// const HISTORY_STORAGE_KEY = 'tensai-note.history.v1';
// const HISTORY_LIMIT = 20;

const CALENDAR_LANG_OPTIONS = [
  { value: 'japanese', label: 'Japanese' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'portuguese', label: 'Portuguese' },
  { value: 'russian', label: 'Russian' },
  { value: 'german', label: 'German' },
  { value: 'italian', label: 'Italian' },
  { value: 'chinese', label: 'Chinese' },
];

const CALENDAR_SOURCE_OPTIONS = [
  { value: 'study', label: 'Study session' },
  { value: 'friends', label: 'Friend' },
  { value: 'media', label: 'Media' },
  { value: 'websearch', label: 'Web search' },
];

const SOURCE_LABELS = {
  study: 'Study session',
  friends: 'Friend',
  media: 'Media',
  websearch: 'Web search',
  other: 'Other',
};

const DEFAULT_LANG = CALENDAR_LANG_OPTIONS[0].value;
const DEFAULT_SOURCE = CALENDAR_SOURCE_OPTIONS[0].value;

const CALENDAR_NOTES_STORAGE_KEY = 'tensai-note.calendar.local';

const SOURCE_COLORS = {
  study: '#2563eb',
  friends: '#ec4899',
  media: '#f59e0b',
  websearch: '#10b981',
  other: '#94a3b8',
};

const TAU = Math.PI * 2;

// const emptyResult = {
//   score: 0,
//   grade: '',
//   particleBonus: 0,
//   clauseJoins: 0,
//   complexity: 0,
//   hits: [],
//   penalties: [],
// };

function formatDateKey(date: any): string {
  if (!(date instanceof Date)) return '';
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const initialCalendarForm = () => ({
  dateKey: formatDateKey(new Date()),
  language: DEFAULT_LANG,
  sourceType: DEFAULT_SOURCE,
  sourceDetail: '',
  text: '',
});

export default function App() {
  return (
    <View style={styles.appShell}>
      <Text style={styles.appHeadline}>Tensai Note</Text>
      <Text style={styles.appTagline}>
        Practice calendar and note journal - sentence analyzer coming soon.
      </Text>
      <View style={styles.featureLayout}>
        <CalendarPanel />
      </View>
    </View>
  );
}

/* Analyzer and kanji views are temporarily disabled until backend work resumes. */

function CalendarPanel() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(() => initialCalendarForm());

  const loadNotes = useCallback(async () => {
    setError(null);
    try {
      const stored = await AsyncStorage.getItem(CALENDAR_NOTES_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      const cleaned = Array.isArray(parsed) ? parsed.map(sanitizeNote) : [];
      cleaned.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      setNotes(cleaned);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load notes from device storage';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const groupedNotes = useMemo(() => {
    const map = new Map();
    notes.forEach(note => {
      const key = note.dateKey || 'Unknown date';
      const bucket = map.get(key) || [];
      bucket.push(note);
      map.set(key, bucket);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => (a > b ? -1 : 1))
      .map(([dateKey, list]) => ({ dateKey, items: list.sort((a, b) => (b.ts || 0) - (a.ts || 0)) }));
  }, [notes]);

  const sourceSlices = useMemo(() => {
    if (!notes.length) {
      return [];
    }

    const counts = notes.reduce<Record<string, number>>((acc, note) => {
      const sourceKey = note.sourceType || 'other';
      acc[sourceKey] = (acc[sourceKey] || 0) + 1;
      return acc;
    }, {});

    const entries = Object.entries(counts)
      .map(([source, count]) => ({
        source,
        count,
        label: SOURCE_LABELS[source as keyof typeof SOURCE_LABELS] || SOURCE_LABELS.other,
        color: SOURCE_COLORS[source as keyof typeof SOURCE_COLORS] || SOURCE_COLORS.other,
      }))
      .sort((a, b) => b.count - a.count);

    const total = entries.reduce((sum, item) => sum + item.count, 0);
    if (total === 0) {
      return [];
    }

    let angleCursor = 0;
    return entries.map(entry => {
      const fraction = entry.count / total;
      const startAngle = angleCursor;
      const endAngle = angleCursor + fraction * TAU;
      angleCursor = endAngle;
      return { ...entry, fraction, startAngle, endAngle };
    });
  }, [notes]);

  const handleRefresh = useCallback(() => { setRefreshing(true); loadNotes(); }, [loadNotes]);

  const handleFormChange = useCallback((field, value) => { setForm(prev => ({ ...prev, [field]: value })); }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dateKey)) { setError('Enter the date as YYYY-MM-DD.'); return; }
    if (!form.text.trim()) { setError('Note text cannot be empty.'); return; }

    setSubmitting(true);
    setError(null);
    try {
      const timestamp = Date.now();
      const newNote = sanitizeNote({
        id: `local-${timestamp}`,
        dateKey: form.dateKey,
        language: form.language,
        text: form.text.trim(),
        sourceType: form.sourceType,
        sourceDetail: form.sourceDetail.trim(),
        ts: timestamp,
      });
      const updated = insertOrUpdateNote(notes, newNote);
      setNotes(updated);
      await AsyncStorage.setItem(CALENDAR_NOTES_STORAGE_KEY, JSON.stringify(updated));
      setForm(initialCalendarForm());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save note locally';
      setError(message);
    } finally { setSubmitting(false); }
  }, [form, submitting, notes]);

  const handleDelete = useCallback(async noteId => {
    try {
      const updated = notes.filter(note => note.id !== noteId);
      setNotes(updated);
      await AsyncStorage.setItem(CALENDAR_NOTES_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete note locally';
      setError(message);
    }
  }, [notes]);

  return (
    <ScrollView contentContainerStyle={styles.featureContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      <Text style={styles.featureHeadline}>Practice calendar</Text>
      <Text style={styles.featureSubtitle}>Log study notes each day to see streaks and where your sentences come from.</Text>

      <View style={styles.calendarLayout}>
        <View style={[styles.featureCard, styles.calendarWrapper]}>
          <Text style={styles.sectionTitle}>Add a note</Text>
          <TextInput
            style={styles.calendarNoteEditor}
            multiline
            placeholder="Write what you practiced or noticed today..."
            value={form.text}
            onChangeText={value => handleFormChange('text', value)}
            textAlignVertical="top"
          />

          <OptionPillGroup
            label="Language"
            options={CALENDAR_LANG_OPTIONS}
            value={form.language}
            onChange={value => handleFormChange('language', value)}
          />

          <OptionPillGroup
            label="Source"
            options={CALENDAR_SOURCE_OPTIONS}
            value={form.sourceType}
            onChange={value => handleFormChange('sourceType', value)}
          />

          <SourceDistributionChart slices={sourceSlices} />

          <TextInput
            style={styles.calendarInput}
            placeholder="Date (YYYY-MM-DD)"
            value={form.dateKey}
            onChangeText={value => handleFormChange('dateKey', value)}
          />

          <TextInput
            style={styles.calendarInput}
            placeholder="Source detail (friend name, show, etc.)"
            value={form.sourceDetail}
            onChangeText={value => handleFormChange('sourceDetail', value)}
          />

          <Pressable style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]} onPress={handleSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryLabel}>Save note</Text>}
          </Pressable>
        </View>

        <View style={[styles.featureCard, styles.calendarNotePane]}>
          <View style={styles.calendarNotePaneHeader}>
            <Text style={styles.calendarNotePaneTitle}>Saved notes</Text>
            <Text style={styles.calendarNotePaneCount}>
              {notes.length ? `${notes.length} saved` : 'No entries yet'}
            </Text>
          </View>

          {error ? (
            <View style={[styles.errorBox, styles.calendarNoteAlert]}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {loading ? (
            <ActivityIndicator style={styles.calendarNoteLoading} />
          ) : groupedNotes.length === 0 ? (
            <Text style={styles.calendarNoteEmpty}>No notes yet. Add your first study note above.</Text>
          ) : (
            <View style={styles.calendarNoteList}>
              {groupedNotes.map(section => (
                <View key={section.dateKey} style={styles.calendarNoteSection}>
                  <Text style={styles.calendarNoteHeading}>{formatDisplayDate(section.dateKey)}</Text>
                  {section.items.map(note => (
                    <View key={note.id} style={[styles.featureCard, styles.calendarNoteCard]}>
                      <View style={styles.calendarNoteMeta}>
                        <View>
                          <Text style={styles.calendarNoteBadge}>{note.language}</Text>
                          <Text style={styles.calendarNoteSource}>{SOURCE_LABELS[note.sourceType] || 'Other'}</Text>
                        </View>
                        <Pressable onPress={() => handleDelete(note.id)}>
                          <Text style={styles.calendarNoteDelete}>Delete</Text>
                        </Pressable>
                      </View>
                      <Text style={styles.calendarNoteText}>{note.text}</Text>
                      {note.sourceDetail ? <Text style={styles.calendarNoteDetail}>Detail: {note.sourceDetail}</Text> : null}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function SourceDistributionChart({ slices }: { slices: Array<{ source: string; label: string; color: string; fraction: number; count: number; startAngle: number; endAngle: number }> }) {
  const size = 160;
  const radius = size / 2;

  if (!slices.length) {
    return (
      <View style={styles.calendarSourceSummaryEmpty}>
        <Text style={styles.calendarSourceSummaryTitle}>Source breakdown</Text>
        <Text style={styles.calendarNoteEmpty}>Log a note to see how your sources stack up.</Text>
      </View>
    );
  }

  return (
    <View style={styles.calendarSourceSummary}>
      <Text style={styles.calendarSourceSummaryTitle}>Source breakdown</Text>
      <Svg width={size} height={size}>
        {slices.length === 1 ? (
          <Circle cx={radius} cy={radius} r={radius - 6} fill={slices[0].color} />
        ) : (
          slices.map(slice => (
            <Path
              key={slice.source}
              d={describeSlice(radius, radius, radius - 6, slice.startAngle, slice.endAngle)}
              fill={slice.color}
            />
          ))
        )}
      </Svg>

      <View style={styles.calendarSourceLegend}>
        {slices.map(slice => (
          <View key={slice.source} style={styles.calendarSourceLegendRow}>
            <View style={[styles.calendarSourceLegendSwatch, { backgroundColor: slice.color }]} />
            <Text style={styles.calendarSourceLegendLabel}>{slice.label}</Text>
            <Text style={styles.calendarSourceLegendValue}>
              {slice.count} | {Math.round(slice.fraction * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function OptionPillGroup({ label, options, value, onChange }) {
  return (
    <View style={styles.pillGroup}>
      <Text style={styles.pillLabel}>{label}</Text>
      <View style={styles.pillRow}>
        {options.map(option => {
          const selected = option.value === value;
          return (
            <Pressable key={option.value} style={[styles.pill, selected && styles.pillActive]} onPress={() => onChange(option.value)}>
              <Text style={[styles.pillText, selected && styles.pillTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function insertOrUpdateNote(list, note) {
  const next = list.filter(item => item.id !== note.id);
  next.push(note);
  next.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return next;
}

function sanitizeNote(note) {
  return {
    id: note.id || note._id || `${note.dateKey}-${note.ts}`,
    dateKey: note.dateKey,
    language: note.language,
    text: note.text || note.content || '',
    ts: note.ts || Date.now(),
    sourceType: note.sourceType || DEFAULT_SOURCE,
    sourceDetail: note.sourceDetail || '',
  };
}

function formatDisplayDate(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRelative(ts) {
  if (!ts) return '';
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  const days = Math.floor(seconds / 86400);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function describeSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle - Math.PI / 2),
    y: cy + r * Math.sin(angle - Math.PI / 2),
  };
}

// Minimal styles to integrate with the existing app theme.
const styles = StyleSheet.create({
  appShell: { flex: 1, padding: 16, backgroundColor: '#101820' },
  appHeadline: { color: '#F2F2F2', fontSize: 20, fontWeight: '700' },
  appTagline: { color: '#9AA0A6', marginBottom: 12 },
  featureTabs: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  featureTab: { padding: 8, borderRadius: 8, backgroundColor: '#fff' },
  featureTabActive: { backgroundColor: '#2563eb' },
  featureTabLabel: { color: '#111827' },
  featureTabLabelActive: { color: '#fff' },
  featureLayout: { flex: 1 },
  featureContent: { paddingBottom: 48 },
  featureHeadline: { fontSize: 18, fontWeight: '700', color: '#F2F2F2', marginBottom: 6 },
  featureSubtitle: { color: '#9AA0A6', marginBottom: 12 },
  featureCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    shadowColor: 'rgba(15,23,42,0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  promptCard: { marginBottom: 12 },
  promptLabel: { fontWeight: '700' },
  promptText: { color: '#374151', marginVertical: 6 },
  promptButton: { alignSelf: 'flex-start', padding: 8, backgroundColor: '#2563eb', borderRadius: 8 },
  promptButtonLabel: { color: '#fff', fontWeight: '700' },
  textArea: { backgroundColor: '#fff', borderRadius: 10, padding: 12, minHeight: 120, marginBottom: 12 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  toggleLabel: { fontWeight: '600' },
  toggleHelper: { color: '#6b7280', fontSize: 12 },
  primaryButton: { backgroundColor: '#2563eb', padding: 12, borderRadius: 10, alignItems: 'center', marginVertical: 12 },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryLabel: { color: '#fff', fontWeight: '700' },
  errorBox: { backgroundColor: '#fee2e2', padding: 10, borderRadius: 8 },
  errorText: { color: '#991b1b' },
  resultCard: { marginVertical: 12 },
  resultScore: { fontSize: 36, fontWeight: '800' },
  resultSubtitle: { color: '#6b7280', marginBottom: 8 },
  resultMetricsRow: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  metricPill: { padding: 8, backgroundColor: '#f8fafc', borderRadius: 8, alignItems: 'center', marginRight: 8 },
  metricValue: { fontWeight: '800' },
  metricLabel: { fontSize: 12, color: '#6b7280' },
  sectionTitle: { fontWeight: '700', marginTop: 12 },
  emptyText: { color: '#6b7280', marginTop: 6 },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  badgeLabel: { fontWeight: '700' },
  badgeMeta: { color: '#2563eb', fontWeight: '700' },
  penaltyCard: { backgroundColor: '#fff1f2', padding: 8, borderRadius: 10, marginTop: 6 },
  penaltyTitle: { fontWeight: '800', color: '#9f1239' },
  penaltyText: { color: '#9f1239' },
  historyCard: { marginTop: 12 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clearHistory: { color: '#6b7280' },
  historyRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eef2f7' },
  historyMeta: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  historyLevel: { fontWeight: '700' },
  historyMode: { color: '#6b7280' },
  historyScore: { marginLeft: 'auto', fontWeight: '700' },
  historyText: { color: '#374151' },
  historyTimestamp: { color: '#9aa0a6', fontSize: 12, marginTop: 4 },
  kanjiGrid: { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kanjiCell: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  kanjiChar: { fontSize: 28 },
  kanjiCount: { color: '#6b7280', marginTop: 8 },
  calendarLayout: { flex: 1, width: '100%', flexDirection: 'column' },
  calendarWrapper: { marginBottom: 16 },
  calendarInput: { backgroundColor: '#fff', padding: 8, borderRadius: 8, marginVertical: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  calendarNoteEditor: { minHeight: 120, backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  calendarNotePane: { flex: 1, marginBottom: 16 },
  calendarNotePaneHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calendarNotePaneTitle: { fontWeight: '700', fontSize: 16, color: '#111827' },
  calendarNotePaneCount: { color: '#6b7280', fontSize: 12 },
  calendarNoteAlert: { marginBottom: 12 },
  calendarNoteLoading: { marginTop: 12 },
  calendarNoteEmpty: { color: '#6b7280', marginTop: 12 },
  calendarSourceSummaryEmpty: { paddingVertical: 12, alignSelf: 'stretch' },
  calendarSourceSummary: { marginTop: 12, marginBottom: 16, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f8fafc', alignItems: 'center' },
  calendarSourceSummaryTitle: { alignSelf: 'flex-start', fontWeight: '700', color: '#111827', marginBottom: 8 },
  calendarSourceLegend: { marginTop: 12, alignSelf: 'stretch' },
  calendarSourceLegendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  calendarSourceLegendSwatch: { width: 14, height: 14, borderRadius: 7, marginRight: 8 },
  calendarSourceLegendLabel: { flex: 1, color: '#111827', fontWeight: '600' },
  calendarSourceLegendValue: { color: '#6b7280', fontVariant: ['tabular-nums'] },
  calendarNoteList: { marginTop: 8 },
  calendarNoteSection: { marginTop: 12 },
  calendarNoteHeading: { fontWeight: '700', marginBottom: 8, color: '#111827' },
  calendarNoteCard: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 10, marginTop: 8 },
  calendarNoteMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  calendarNoteBadge: { fontWeight: '700', color: '#2563eb' },
  calendarNoteSource: { color: '#6b7280', marginTop: 2 },
  calendarNoteDelete: { color: '#ef4444', fontWeight: '600' },
  calendarNoteText: { marginTop: 4, color: '#111827' },
  calendarNoteDetail: { color: '#6b7280', marginTop: 6, fontStyle: 'italic' },
  pillGroup: { marginVertical: 8 },
  pillLabel: { fontWeight: '700', marginBottom: 6 },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#fff', borderRadius: 8, marginRight: 8 },
  pillActive: { backgroundColor: '#e6f0ff' },
  pillText: { color: '#111827' },
  pillTextActive: { color: '#2563eb', fontWeight: '700' },
});



















































