// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Path } from 'react-native-svg';
import { styles } from './mobile/src/styles/appStyles';
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
  { value: 'environment', label: 'Environment' },
];

const SOURCE_LABELS = {
  study: 'Study session',
  friends: 'Friend',
  media: 'Media',
  websearch: 'Web search',
  environment: 'Environment',
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
  environment: '#06b6d4',
  other: '#94a3b8',
};

const TAU = Math.PI * 2;

const PAGES = [
  { key: 'calendar', label: 'Calendar' },
  { key: 'notes', label: 'Notes' },
  { key: 'insights', label: 'Insights' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount, 1);
  return startOfMonth(next);
};

const buildCalendarCells = (monthStart: Date) => {
  const firstDay = startOfMonth(monthStart);
  const startOffset = firstDay.getDay();
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - startOffset);

  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + i);
    cells.push({
      key: formatDateKey(cellDate),
      date: cellDate,
      isCurrentMonth:
        cellDate.getMonth() === monthStart.getMonth() &&
        cellDate.getFullYear() === monthStart.getFullYear(),
    });
  }
  return cells;
};

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
  sourceOrigin: '',
  text: '',
});

export default function App() {
  const [activePage, setActivePage] = useState('calendar');
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(() => initialCalendarForm());
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [noteStage, setNoteStage] = useState<'text' | 'source'>('text');

  const selectedDateKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);
  const todayKey = useMemo(() => formatDateKey(new Date()), []);

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

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotes();
  }, [loadNotes]);

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    setCurrentMonth(startOfMonth(date));
    setForm(prev => ({ ...prev, dateKey: formatDateKey(date) }));
  }, []);

  const handleMonthChange = useCallback((direction: number) => {
    setCurrentMonth(prev => addMonths(prev, direction));
  }, []);

  const handleJumpToday = useCallback(() => {
    handleSelectDate(new Date());
  }, [handleSelectDate]);

  const handleFormChange = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'dateKey') {
      const parsed = new Date(`${value}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
        setCurrentMonth(startOfMonth(parsed));
      }
    }
  }, []);

  const persistNotes = useCallback(async updated => {
    setNotes(updated);
    await AsyncStorage.setItem(CALENDAR_NOTES_STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dateKey)) {
      setError('Enter the date as YYYY-MM-DD.');
      return;
    }
    if (!form.text.trim()) {
      setError('Note text cannot be empty.');
      return;
    }

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
        sourceOrigin: form.sourceOrigin.trim(),
        ts: timestamp,
      });
      const updated = insertOrUpdateNote(notes, newNote);
      await persistNotes(updated);

      const savedDate = new Date(`${form.dateKey}T00:00:00`);
      const fallbackDate = Number.isNaN(savedDate.getTime()) ? new Date() : savedDate;
      setForm(prev => ({
        ...initialCalendarForm(),
        language: prev.language,
        sourceType: prev.sourceType,
        dateKey: formatDateKey(fallbackDate),
      }));
      handleSelectDate(fallbackDate);
      setNoteStage('text');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save note locally';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [form, submitting, notes, persistNotes, handleSelectDate]);

  const handleDelete = useCallback(
    async noteId => {
      try {
        const updated = notes.filter(note => note.id !== noteId);
        await persistNotes(updated);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete note locally';
        setError(message);
      }
    },
    [notes, persistNotes],
  );

  const handleAdvanceStage = useCallback(() => {
    if (!form.text.trim()) {
      setError('Note text cannot be empty.');
      return;
    }
    setError(null);
    setNoteStage('source');
  }, [form.text]);

  const handleBackStage = useCallback(() => {
    setError(null);
    setNoteStage('text');
  }, []);

  const openSidebar = useCallback(() => setSidebarVisible(true), []);
  const closeSidebar = useCallback(() => setSidebarVisible(false), []);
  const handleSelectPage = useCallback((pageKey: string) => {
    setActivePage(pageKey);
    setSidebarVisible(false);
  }, []);

  const handleOpenNotes = useCallback(() => {
    setNoteStage('text');
    handleSelectPage('notes');
  }, [handleSelectPage]);

  const renderContent = () => {
    switch (activePage) {
      case 'notes':
        return (
          <NotesView
            form={form}
            onChangeForm={handleFormChange}
            onSubmit={handleSubmit}
            submitting={submitting}
            notes={notes}
            onDelete={handleDelete}
            error={error}
            noteStage={noteStage}
            onAdvanceStage={handleAdvanceStage}
            onBackStage={handleBackStage}
          />
        );
      case 'insights':
        return (
          <InsightsView
            notes={notes}
            sourceSlices={sourceSlices}
            onDelete={handleDelete}
            loading={loading}
          />
        );
      case 'calendar':
      default:
        return (
          <CalendarView
            notes={notes}
            loading={loading}
            error={error}
            refreshing={refreshing}
            submitting={submitting}
            form={form}
            currentMonth={currentMonth}
            selectedDateKey={selectedDateKey}
            todayKey={todayKey}
            onMonthChange={handleMonthChange}
            onSelectDate={handleSelectDate}
            onJumpToday={handleJumpToday}
            onRefresh={handleRefresh}
            onChangeForm={handleFormChange}
            onSubmit={handleSubmit}
            onDelete={handleDelete}
            noteStage={noteStage}
            onAdvanceStage={handleAdvanceStage}
            onBackStage={handleBackStage}
          />
        );
    }
  };

  return (
    <View style={styles.appShell}>
      <View style={styles.topRow}>
        <Pressable style={styles.menuButton} onPress={openSidebar}>
          <Text style={styles.menuButtonLabel}>Menu</Text>
        </Pressable>
        <Text style={styles.appHeadline}>Tensai Note</Text>
      </View>
      <View style={styles.appLayout}>
        <View style={styles.mainContent}>{renderContent()}</View>
      </View>

      <Pressable style={styles.fab} onPress={handleOpenNotes}>
        <Text style={styles.fabLabel}>Note</Text>
      </Pressable>

      {sidebarVisible && (
        <View style={styles.sidebarOverlay}>
          <View style={styles.sidebarPanel}>
            {PAGES.map(page => {
              const isActive = activePage === page.key;
              return (
                <Pressable
                  key={page.key}
                  style={[styles.sidebarItem, isActive && styles.sidebarItemActive]}
                  onPress={() => handleSelectPage(page.key)}
                >
                  <Text style={[styles.sidebarLabel, isActive && styles.sidebarLabelActive]}>
                    {page.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.sidebarBackdrop} onPress={closeSidebar} />
        </View>
      )}
    </View>
  );
}

/* Analyzer and kanji views are temporarily disabled until backend work resumes. */


function CalendarView({
  notes,
  loading,
  error,
  refreshing,
  submitting,
  form,
  currentMonth,
  selectedDateKey,
  todayKey,
  onMonthChange,
  onSelectDate,
  onJumpToday,
  onRefresh,
  onChangeForm,
  onSubmit,
  onDelete,
  noteStage,
  onAdvanceStage,
  onBackStage,
}) {
  const monthLabel = useMemo(() => {
    try {
      return currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } catch (_err) {
      return `${currentMonth.getFullYear()}-${currentMonth.getMonth() + 1}`;
    }
  }, [currentMonth]);

  const calendarCells = useMemo(() => buildCalendarCells(currentMonth), [currentMonth]);
  const noteKeySet = useMemo(() => new Set(notes.map(note => note.dateKey)), [notes]);
  const selectedNotes = useMemo(
    () => notes.filter(note => note.dateKey === selectedDateKey),
    [notes, selectedDateKey],
  );

  return (
    <ScrollView
      contentContainerStyle={styles.featureContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.featureHeadline}>Practice calendar</Text>
      <Text style={styles.featureSubtitle}>
        Tap a day to review entries, then jot quick notes with language/source context.
      </Text>

      <View style={styles.calendarLayout}>
        <NoteComposer
          form={form}
          noteStage={noteStage}
          submitting={submitting}
          error={error}
          onChangeForm={onChangeForm}
          onAdvanceStage={onAdvanceStage}
          onBackStage={onBackStage}
          onSubmit={onSubmit}
        />

        <View style={[styles.featureCard, styles.calendarWrapper]}>
          <View style={styles.calendarBoard}>
            <View style={styles.calendarBoardHeader}>
              <Pressable
                accessibilityLabel="Previous month"
                onPress={() => onMonthChange(-1)}
                style={styles.calendarHeaderButton}
              >
                <Text style={styles.calendarHeaderButtonLabel}>{'<'}</Text>
              </Pressable>
              <Text style={styles.calendarBoardTitle}>{monthLabel}</Text>
              <Pressable
                accessibilityLabel="Next month"
                onPress={() => onMonthChange(1)}
                style={styles.calendarHeaderButton}
              >
                <Text style={styles.calendarHeaderButtonLabel}>{'>'}</Text>
              </Pressable>
            </View>

            <View style={styles.calendarWeekdays}>
              {WEEKDAYS.map(day => (
                <Text key={day} style={styles.calendarWeekdayLabel}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarCells.map(cell => {
                const cellKey = formatDateKey(cell.date);
                const isSelected = cellKey === selectedDateKey;
                const isToday = cellKey === todayKey;
                const hasNotes = noteKeySet.has(cellKey);
                return (
                  <Pressable
                    key={cell.key}
                    style={[
                      styles.calendarDay,
                      !cell.isCurrentMonth && styles.calendarDayMuted,
                      isSelected && styles.calendarDaySelected,
                      isToday && styles.calendarDayToday,
                    ]}
                    onPress={() => onSelectDate(cell.date)}
                  >
                    <Text
                      style={[
                        styles.calendarDayLabel,
                        !cell.isCurrentMonth && styles.calendarDayLabelMuted,
                        isSelected && styles.calendarDayLabelSelected,
                      ]}
                    >
                      {cell.date.getDate()}
                    </Text>
                    {hasNotes ? <View style={styles.calendarDayDot} /> : null}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.calendarSelectedActions}>
              <Text style={styles.calendarSelectedLabel}>
                Selected: {formatDisplayDate(selectedDateKey)}
              </Text>
              <Pressable onPress={onJumpToday} style={styles.calendarTodayButton}>
                <Text style={styles.calendarTodayLabel}>Today</Text>
              </Pressable>
            </View>
          </View>

        <View style={[styles.featureCard, styles.calendarNotePane]}>
          <View style={styles.calendarNotePaneHeader}>
            <View>
              <Text style={styles.calendarNotePaneTitle}>{formatDisplayDate(selectedDateKey)}</Text>
              <Text style={styles.calendarNotePaneCount}>
                {selectedNotes.length
                  ? `${selectedNotes.length} note${selectedNotes.length === 1 ? '' : 's'} saved`
                  : 'No notes saved yet'}
              </Text>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator style={styles.calendarNoteLoading} />
          ) : selectedNotes.length === 0 ? (
            <Text style={styles.calendarNoteEmpty}>No notes for this day. Capture one from the form.</Text>
          ) : (
            <NoteList notes={selectedNotes} onDelete={onDelete} />
          )}
        </View>
      </View>
    </ScrollView>
  );
}


function NoteComposer({
  form,
  noteStage,
  submitting,
  error,
  onChangeForm,
  onAdvanceStage,
  onBackStage,
  onSubmit,
}) {
  const isTextStage = noteStage === 'text';
  const canAdvance = Boolean(form.text.trim());

  return (
    <View style={[styles.featureCard, styles.calendarWrapper]}>
      {isTextStage ? (
        <>
          <Text style={styles.noteStageTitle}>Stage 1 · Write your note</Text>
          <TextInput
            style={styles.calendarNoteEditor}
            multiline
            placeholder="Describe what you practiced or noticed..."
            placeholderTextColor="#94A3B8"
            value={form.text}
            onChangeText={value => onChangeForm('text', value)}
            textAlignVertical="top"
          />
          <View style={styles.stageActionsSingle}>
            <Pressable
              style={[styles.stagePrimaryButton, !canAdvance && styles.primaryButtonDisabled]}
              onPress={onAdvanceStage}
              disabled={!canAdvance}
            >
              <Text style={styles.stagePrimaryLabel}>Next: Source</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.noteStageTitle}>Stage 2 · Add source context</Text>
          <Text style={styles.notePreviewLabel}>Note</Text>
          <Text style={styles.notePreviewText}>{form.text}</Text>

          <OptionPillGroup
            label="Language"
            options={CALENDAR_LANG_OPTIONS}
            value={form.language}
            onChange={value => onChangeForm('language', value)}
          />

          <OptionPillGroup
            label="Source"
            options={CALENDAR_SOURCE_OPTIONS}
            value={form.sourceType}
            onChange={value => onChangeForm('sourceType', value)}
          />

          <TextInput
            style={styles.calendarInput}
            placeholder="Date (YYYY-MM-DD)"
            placeholderTextColor="#94A3B8"
            value={form.dateKey}
            onChangeText={value => onChangeForm('dateKey', value)}
          />

          <TextInput
            style={styles.calendarInput}
            placeholder="Source origin (sign, friend name, show, etc.)"
            placeholderTextColor="#94A3B8"
            value={form.sourceOrigin}
            onChangeText={value => onChangeForm('sourceOrigin', value)}
          />

          <View style={styles.stageActions}>
            <Pressable style={styles.stageSecondaryButton} onPress={onBackStage}>
              <Text style={styles.stageSecondaryLabel}>Back</Text>
            </Pressable>
            <Pressable
              style={[styles.stagePrimaryButton, submitting && styles.primaryButtonDisabled]}
              onPress={onSubmit}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.stagePrimaryLabel}>Save note</Text>}
            </Pressable>
          </View>
        </>
      )}

      {error ? (
        <View style={[styles.errorBox, styles.calendarNoteAlert]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
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

function NotesView({
  form,
  onChangeForm,
  onSubmit,
  submitting,
  notes,
  onDelete,
  error,
  noteStage,
  onAdvanceStage,
  onBackStage,
}) {
  const orderedNotes = useMemo(
    () => [...notes].sort((a, b) => (b.ts || 0) - (a.ts || 0)),
    [notes],
  );

  return (
    <ScrollView contentContainerStyle={styles.featureContent}>
      <Text style={styles.featureHeadline}>Note composer</Text>
      <Text style={styles.featureSubtitle}>Capture new study notes with language/source context.</Text>

      <NoteComposer
        form={form}
        noteStage={noteStage}
        submitting={submitting}
        error={error}
        onChangeForm={onChangeForm}
        onAdvanceStage={onAdvanceStage}
        onBackStage={onBackStage}
        onSubmit={onSubmit}
      />

      <View style={[styles.featureCard, styles.calendarNotePane]}>
        <View style={styles.calendarNotePaneHeader}>
          <View>
            <Text style={styles.calendarNotePaneTitle}>All notes</Text>
            <Text style={styles.calendarNotePaneCount}>
              {orderedNotes.length
                ? `${orderedNotes.length} saved`
                : 'No notes saved yet'}
            </Text>
          </View>
        </View>

        <NoteList notes={orderedNotes} onDelete={onDelete} showDate />
      </View>
    </ScrollView>
  );
}

function InsightsView({ notes, sourceSlices, onDelete, loading }) {
  const orderedNotes = useMemo(
    () => [...notes].sort((a, b) => (b.ts || 0) - (a.ts || 0)),
    [notes],
  );

  return (
    <ScrollView contentContainerStyle={styles.featureContent}>
      <Text style={styles.featureHeadline}>Insights</Text>
      <Text style={styles.featureSubtitle}>
        See where your sentences come from and skim through saved notes.
      </Text>

      <View style={[styles.featureCard, styles.calendarWrapper]}>
        <SourceDistributionChart slices={sourceSlices} />
      </View>

      <View style={[styles.featureCard, styles.calendarNotePane]}>
        <View style={styles.calendarNotePaneHeader}>
          <View>
            <Text style={styles.calendarNotePaneTitle}>Note browser</Text>
            <Text style={styles.calendarNotePaneCount}>
              {orderedNotes.length
                ? `${orderedNotes.length} saved`
                : 'No notes saved yet'}
            </Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator style={styles.calendarNoteLoading} />
        ) : (
          <NoteList notes={orderedNotes} onDelete={onDelete} showDate />
        )}
      </View>
    </ScrollView>
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

function NoteList({ notes, onDelete, showDate = false }) {
  if (!notes.length) {
    return <Text style={styles.calendarNoteEmpty}>Nothing logged yet.</Text>;
  }

  return (
    <View style={styles.calendarNoteList}>
      {notes.map(note => {
        const sourceLabel = SOURCE_LABELS[note.sourceType] || 'Other';
        const sourceDisplay = note.sourceOrigin ? `${sourceLabel}:${note.sourceOrigin}` : sourceLabel;

        return (
          <View key={note.id} style={[styles.featureCard, styles.calendarNoteCard]}>
            <View style={styles.calendarNoteMeta}>
              <View>
                {showDate ? (
                  <Text style={styles.noteListDate}>{formatDisplayDate(note.dateKey)}</Text>
                ) : null}
                <Text style={styles.calendarNoteBadge}>{note.language}</Text>
                <Text style={styles.calendarNoteSource}>{sourceDisplay}</Text>
              </View>
              <Pressable onPress={() => onDelete(note.id)}>
                <Text style={styles.calendarNoteDelete}>Delete</Text>
              </Pressable>
            </View>
            <Text style={styles.calendarNoteText}>{note.text}</Text>
          </View>
        );
      })}
    </View>
  );
}

function sanitizeNote(note) {
  return {
    id: note.id || note._id || `${note.dateKey}-${note.ts}`,
    dateKey: note.dateKey,
    language: note.language,
    text: note.text || note.content || '',
    ts: note.ts || Date.now(),
    sourceType: note.sourceType || DEFAULT_SOURCE,
    sourceOrigin: note.sourceOrigin || note.sourceDetail || '',
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




















































