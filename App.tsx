// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
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
  { value: 'friends', label: 'Friends' },
  { value: 'media', label: 'Media' },
  { value: 'reading', label: 'Reading' },
  { value: 'websearch', label: 'Web search' },
  { value: 'environment', label: 'Environment' },
];

const SOURCE_LABELS = {
  study: 'Study session',
  friends: 'Friends',
  media: 'Media',
  reading: 'Reading',
  websearch: 'Web search',
  environment: 'Environment',
  other: 'Other',
};

const DEFAULT_LANG = CALENDAR_LANG_OPTIONS[0].value;
const DEFAULT_SOURCE = CALENDAR_SOURCE_OPTIONS[0].value;

const CALENDAR_NOTES_STORAGE_KEY = 'tensai-note.calendar.local';
const QUIZ_LEADERBOARD_STORAGE_KEY = 'tensai-note.quiz-leaderboard.v1';

const SOURCE_COLORS = {
  study: '#2563eb',
  friends: '#ec4899',
  media: '#f59e0b',
  reading: '#a855f7',
  websearch: '#10b981',
  environment: '#06b6d4',
  other: '#94a3b8',
};

const TAU = Math.PI * 2;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const QUIZ_TIMER_MIN_MINUTES = 1;
const QUIZ_TIMER_MAX_MINUTES = 30;

const KATAKANA_QUIZ = [
  { id: 'ka', kana: 'カ', answers: ['ka'] },
  { id: 'ki', kana: 'キ', answers: ['ki'] },
  { id: 'ku', kana: 'ク', answers: ['ku'] },
  { id: 'ke', kana: 'ケ', answers: ['ke'] },
  { id: 'ko', kana: 'コ', answers: ['ko'] },
  { id: 'sa', kana: 'サ', answers: ['sa'] },
  { id: 'shi', kana: 'シ', answers: ['shi', 'si'] },
  { id: 'su', kana: 'ス', answers: ['su'] },
  { id: 'se', kana: 'セ', answers: ['se'] },
  { id: 'so', kana: 'ソ', answers: ['so'] },
  { id: 'ta', kana: 'タ', answers: ['ta'] },
  { id: 'chi', kana: 'チ', answers: ['chi', 'ti'] },
  { id: 'tsu', kana: 'ツ', answers: ['tsu', 'tu'] },
  { id: 'te', kana: 'テ', answers: ['te'] },
  { id: 'to', kana: 'ト', answers: ['to'] },
  { id: 'na', kana: 'ナ', answers: ['na'] },
  { id: 'ni', kana: 'ニ', answers: ['ni'] },
  { id: 'nu', kana: 'ヌ', answers: ['nu'] },
  { id: 'ne', kana: 'ネ', answers: ['ne'] },
  { id: 'no', kana: 'ノ', answers: ['no'] },
  { id: 'ha', kana: 'ハ', answers: ['ha'] },
  { id: 'hi', kana: 'ヒ', answers: ['hi'] },
  { id: 'fu', kana: 'フ', answers: ['fu', 'hu'] },
  { id: 'he', kana: 'ヘ', answers: ['he'] },
  { id: 'ho', kana: 'ホ', answers: ['ho'] },
  { id: 'ma', kana: 'マ', answers: ['ma'] },
  { id: 'mi', kana: 'ミ', answers: ['mi'] },
  { id: 'mu', kana: 'ム', answers: ['mu'] },
  { id: 'me', kana: 'メ', answers: ['me'] },
  { id: 'mo', kana: 'モ', answers: ['mo'] },
  { id: 'ya', kana: 'ヤ', answers: ['ya'] },
  { id: 'yu', kana: 'ユ', answers: ['yu'] },
  { id: 'yo', kana: 'ヨ', answers: ['yo'] },
  { id: 'ra', kana: 'ラ', answers: ['ra'] },
  { id: 'ri', kana: 'リ', answers: ['ri'] },
  { id: 'ru', kana: 'ル', answers: ['ru'] },
  { id: 're', kana: 'レ', answers: ['re'] },
  { id: 'ro', kana: 'ロ', answers: ['ro'] },
  { id: 'wa', kana: 'ワ', answers: ['wa'] },
  { id: 'n', kana: 'ン', answers: ['n'] },
  { id: 'a', kana: 'ア', answers: ['a'] },
  { id: 'i', kana: 'イ', answers: ['i'] },
  { id: 'u', kana: 'ウ', answers: ['u'] },
  { id: 'e', kana: 'エ', answers: ['e'] },
  { id: 'o', kana: 'オ', answers: ['o'] },
];

const HIRAGANA_QUIZ = [
  { id: 'ka', kana: 'か', answers: ['ka'] },
  { id: 'ki', kana: 'き', answers: ['ki'] },
  { id: 'ku', kana: 'く', answers: ['ku'] },
  { id: 'ke', kana: 'け', answers: ['ke'] },
  { id: 'ko', kana: 'こ', answers: ['ko'] },
  { id: 'sa', kana: 'さ', answers: ['sa'] },
  { id: 'shi', kana: 'し', answers: ['shi', 'si'] },
  { id: 'su', kana: 'す', answers: ['su'] },
  { id: 'se', kana: 'せ', answers: ['se'] },
  { id: 'so', kana: 'そ', answers: ['so'] },
  { id: 'ta', kana: 'た', answers: ['ta'] },
  { id: 'chi', kana: 'ち', answers: ['chi', 'ti'] },
  { id: 'tsu', kana: 'つ', answers: ['tsu', 'tu'] },
  { id: 'te', kana: 'て', answers: ['te'] },
  { id: 'to', kana: 'と', answers: ['to'] },
  { id: 'na', kana: 'な', answers: ['na'] },
  { id: 'ni', kana: 'に', answers: ['ni'] },
  { id: 'nu', kana: 'ぬ', answers: ['nu'] },
  { id: 'ne', kana: 'ね', answers: ['ne'] },
  { id: 'no', kana: 'の', answers: ['no'] },
  { id: 'ha', kana: 'は', answers: ['ha'] },
  { id: 'hi', kana: 'ひ', answers: ['hi'] },
  { id: 'fu', kana: 'ふ', answers: ['fu', 'hu'] },
  { id: 'he', kana: 'へ', answers: ['he'] },
  { id: 'ho', kana: 'ほ', answers: ['ho'] },
  { id: 'ma', kana: 'ま', answers: ['ma'] },
  { id: 'mi', kana: 'み', answers: ['mi'] },
  { id: 'mu', kana: 'む', answers: ['mu'] },
  { id: 'me', kana: 'め', answers: ['me'] },
  { id: 'mo', kana: 'も', answers: ['mo'] },
  { id: 'ya', kana: 'や', answers: ['ya'] },
  { id: 'yu', kana: 'ゆ', answers: ['yu'] },
  { id: 'yo', kana: 'よ', answers: ['yo'] },
  { id: 'ra', kana: 'ら', answers: ['ra'] },
  { id: 'ri', kana: 'り', answers: ['ri'] },
  { id: 'ru', kana: 'る', answers: ['ru'] },
  { id: 're', kana: 'れ', answers: ['re'] },
  { id: 'ro', kana: 'ろ', answers: ['ro'] },
  { id: 'wa', kana: 'わ', answers: ['wa'] },
  { id: 'n', kana: 'ん', answers: ['n'] },
  { id: 'a', kana: 'あ', answers: ['a'] },
  { id: 'i', kana: 'い', answers: ['i'] },
  { id: 'u', kana: 'う', answers: ['u'] },
  { id: 'e', kana: 'え', answers: ['e'] },
  { id: 'o', kana: 'お', answers: ['o'] },
];

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

function useNativeCalendarCells(monthStart: Date) {
  const [cells, setCells] = useState(() => buildCalendarCells(monthStart));

  useEffect(() => {
    let cancelled = false;
    const loadCells = async () => {
      if (!cancelled) {
        setCells(buildCalendarCells(monthStart));
      }
    };

    loadCells();
    return () => {
      cancelled = true;
    };
  }, [monthStart.getFullYear(), monthStart.getMonth()]);

  return cells;
}

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

function parseDateKey(dateKey: string) {
  if (dateKey instanceof Date) return new Date(dateKey);
  if (typeof dateKey !== 'string') {
    const fallback = new Date(dateKey);
    return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    const fallback = new Date(dateKey);
    return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
  }
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
}

const normalizeRomaji = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z]/g, '');

const shuffleQuiz = (items: any[]) => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const formatTimer = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
};

const formatMilliseconds = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

const initialCalendarForm = () => ({
  dateKey: formatDateKey(new Date()),
  language: DEFAULT_LANG,
  sourceType: DEFAULT_SOURCE,
  sourceOrigin: '',
  additionalDetails: '',
  text: '',
});

export default function App() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(() => initialCalendarForm());
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [noteStage, setNoteStage] = useState<'text' | 'source'>('text');
  const [editingNote, setEditingNote] = useState<any | null>(null);
  const [editDraft, setEditDraft] = useState({
    text: '',
    sourceType: DEFAULT_SOURCE,
    sourceOrigin: '',
    additionalDetails: '',
    dateKey: formatDateKey(new Date()),
  });

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
      const parsed = parseDateKey(value);
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
        additionalDetails: form.additionalDetails.trim(),
        ts: timestamp,
      });
      const updated = insertOrUpdateNote(notes, newNote);
      await persistNotes(updated);

      const savedDate = parseDateKey(form.dateKey);
      const fallbackDate = Number.isNaN(savedDate.getTime()) ? new Date() : savedDate;
      setForm(prev => ({
        ...initialCalendarForm(),
        language: prev.language,
        sourceType: prev.sourceType,
        sourceOrigin: '',
        additionalDetails: '',
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

  const handleExitApp = useCallback(() => {
    if (Platform.OS === 'ios') {
      Alert.alert('Close app', 'iOS does not allow apps to close themselves. Please swipe up to close.');
      return;
    }

    const doExitWeb = () => {
        try {
          fetch('/__tensai_exit', {
            method: 'POST',
            headers: { 'X-Tensai-Exit': '1' },
          }).catch(() => null);
        } catch (_err) {
          // ignore
        }

        setTimeout(() => {
          try {
            window.close();
          } catch {
            // ignore
          }
          try {
            window.location.href = 'about:blank';
          } catch {
            // ignore
          }
        }, 150);
    };

    const doExitNative = () => {
      try {
        BackHandler.exitApp();
      } catch {
        // ignore
      }
    };

    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined' ? window.confirm('Exit and stop the local web server?') : false;
      if (ok) {
        doExitWeb();
      }
      return;
    }

    Alert.alert('Exit', 'Close Tensai Note?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Exit', style: 'destructive', onPress: doExitNative },
    ]);
  }, []);

  const handleAddNoteForDate = useCallback(
    (dateKey?: string) => {
      const parsed = dateKey ? parseDateKey(dateKey) : new Date();
      const normalized = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
      const normalizedKey = formatDateKey(normalized);

      setForm(prev => ({
        ...prev,
        dateKey: normalizedKey,
      }));
      setNoteStage('text');
    },
    [],
  );

  const handleStartEdit = useCallback((note: any) => {
    setEditDraft({
      text: note.text || '',
      sourceType: note.sourceType || DEFAULT_SOURCE,
      sourceOrigin: note.sourceOrigin || '',
      additionalDetails: note.additionalDetails || '',
      dateKey: note.dateKey || formatDateKey(new Date()),
    });
    setEditingNote(note);
  }, []);

  const handleEditChange = useCallback((field: string, value: string) => {
    setEditDraft(prev => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingNote(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingNote) return;
    const trimmedText = editDraft.text.trim();
    if (!trimmedText) {
      setError('Note text cannot be empty.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editDraft.dateKey)) {
      setError('Enter the date as YYYY-MM-DD.');
      return;
    }

    try {
      const updatedNote = sanitizeNote({
        ...editingNote,
        text: trimmedText,
        sourceType: editDraft.sourceType,
        sourceOrigin: editDraft.sourceOrigin,
        additionalDetails: editDraft.additionalDetails,
        dateKey: editDraft.dateKey,
      });
      const filtered = notes.filter(note => note.id !== editingNote.id);
      const next = insertOrUpdateNote(filtered, updatedNote);
      await persistNotes(next);
      setEditingNote(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update note';
      setError(message);
    }
  }, [editDraft, editingNote, notes, persistNotes]);

  return (
    <View style={styles.appShell}>
      <View style={styles.appLayout}>
        <View style={styles.mainContent}>
          <DashboardView
            notes={notes}
            loading={loading}
            refreshing={refreshing}
            currentMonth={currentMonth}
            selectedDateKey={selectedDateKey}
            todayKey={todayKey}
            onMonthChange={handleMonthChange}
            onSelectDate={handleSelectDate}
            onJumpToday={handleJumpToday}
            onRefresh={handleRefresh}
            onDelete={handleDelete}
            onAddNote={handleAddNoteForDate}
            onEditNote={handleStartEdit}
            onExitApp={handleExitApp}
            form={form}
            onChangeForm={handleFormChange}
            onSubmit={handleSubmit}
            submitting={submitting}
            noteStage={noteStage}
            onAdvanceStage={handleAdvanceStage}
            onBackStage={handleBackStage}
            sourceSlices={sourceSlices}
            onEdit={handleStartEdit}
            error={error}
          />
        </View>
      </View>

      {editingNote ? (
        <EditNoteModal
          draft={editDraft}
          onChange={handleEditChange}
          onCancel={handleCancelEdit}
          onSave={handleSaveEdit}
        />
      ) : null}
    </View>
  );
}

/* Analyzer and kanji views are temporarily disabled until backend work resumes. */


function CalendarView({
  notes,
  loading,
  refreshing,
  currentMonth,
  selectedDateKey,
  todayKey,
  onMonthChange,
  onSelectDate,
  onJumpToday,
  onRefresh,
  onDelete,
  onAddNote,
  onEditNote,
  embedded = false,
}) {
  const Container = embedded ? View : ScrollView;
  const containerProps = embedded
    ? { style: styles.dashboardSection }
    : { contentContainerStyle: styles.featureContent };
  const monthLabel = useMemo(() => {
    try {
      return currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } catch (_err) {
      return `${currentMonth.getFullYear()}-${currentMonth.getMonth() + 1}`;
    }
  }, [currentMonth]);

  const calendarCells = useNativeCalendarCells(currentMonth);
  const noteKeySet = useMemo(() => new Set(notes.map(note => note.dateKey)), [notes]);
  const calendarWeeks = useMemo(() => {
    const weeks: typeof calendarCells[] = [];
    for (let i = 0; i < calendarCells.length; i += 7) {
      weeks.push(calendarCells.slice(i, i + 7));
    }
    return weeks;
  }, [calendarCells]);
  const selectedNotes = useMemo(
    () => notes.filter(note => note.dateKey === selectedDateKey),
    [notes, selectedDateKey],
  );

  return (
    <Container
      {...containerProps}
      refreshControl={
        embedded ? undefined : <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.featureHeadline}>Practice calendar</Text>
      <View style={styles.calendarLayout}>
        <View style={styles.calendarSplit}>
          <View style={[styles.featureCard, styles.calendarWrapper, styles.calendarPane]}>
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
                {calendarWeeks.map((week, index) => (
                  <View key={`${week[0]?.key || index}-${index}`} style={styles.calendarWeekRow}>
                    {week.map(cell => {
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
                ))}
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
          </View>

          <View style={[styles.featureCard, styles.calendarNotePane, styles.calendarNotesPane]}>
            <View style={styles.calendarNotePaneHeader}>
              <View>
                <Text style={styles.calendarNotePaneTitle}>{formatDisplayDate(selectedDateKey)}</Text>
                <Text style={styles.calendarNotePaneCount}>
                  {selectedNotes.length
                    ? `${selectedNotes.length} note${selectedNotes.length === 1 ? '' : 's'} saved`
                    : 'No notes saved yet'}
                </Text>
              </View>
              <Pressable
                style={styles.calendarAddButton}
                onPress={() => onAddNote(selectedDateKey)}
              >
                <Text style={styles.calendarAddButtonLabel}>Add note</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.calendarNoteScrollArea} contentContainerStyle={styles.calendarNoteScrollContent}>
              {loading ? (
                <ActivityIndicator style={styles.calendarNoteLoading} />
              ) : selectedNotes.length === 0 ? (
                <Text style={styles.calendarNoteEmpty}>No notes for this day. Capture one from the form.</Text>
              ) : (
                <NoteList notes={selectedNotes} onEdit={onEditNote} onDelete={onDelete} />
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    </Container>
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
          <Text style={styles.noteStageTitle}>Stage 1 - Write your note</Text>
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
          <Text style={styles.noteStageTitle}>Stage 2 - Add source context</Text>
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

          <TextInput
            style={styles.calendarInput}
            placeholder="Additional details"
            placeholderTextColor="#94A3B8"
            value={form.additionalDetails}
            onChangeText={value => onChangeForm('additionalDetails', value)}
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
  onEdit,
  error,
  noteStage,
  onAdvanceStage,
  onBackStage,
  embedded = false,
}) {
  const Container = embedded ? View : ScrollView;
  const containerProps = embedded
    ? { style: styles.dashboardSection }
    : { contentContainerStyle: styles.featureContent };
  const orderedNotes = useMemo(
    () => [...notes].sort((a, b) => (b.ts || 0) - (a.ts || 0)),
    [notes],
  );

  return (
    <Container {...containerProps}>
      <Text style={styles.featureHeadline}>Note composer</Text>
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

      <NoteDateSelector
        selectedDateKey={form.dateKey}
        onSelectDate={value => onChangeForm('dateKey', value)}
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

      <NoteList notes={orderedNotes} onDelete={onDelete} onEdit={onEdit} showDate />
      </View>
    </Container>
  );
}

function NoteComposerPanel({
  form,
  onChangeForm,
  onSubmit,
  submitting,
  error,
  noteStage,
  onAdvanceStage,
  onBackStage,
}) {
  return (
    <View style={styles.dashboardSection}>
      <Text style={styles.featureHeadline}>Note composer</Text>
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

      <NoteDateSelector
        selectedDateKey={form.dateKey}
        onSelectDate={value => onChangeForm('dateKey', value)}
      />
    </View>
  );
}

function NoteDateSelector({ selectedDateKey, onSelectDate }) {
  const initialDate = useMemo(() => {
    const parsed = parseDateKey(selectedDateKey);
    if (Number.isNaN(parsed.getTime())) return new Date();
    return parsed;
  }, [selectedDateKey]);
  const [pickerMonth, setPickerMonth] = useState(() => startOfMonth(initialDate));
  const [isOpen, setIsOpen] = useState(false);

  const monthLabel = useMemo(() => {
    try {
      return pickerMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } catch {
      return `${pickerMonth.getFullYear()}-${pickerMonth.getMonth() + 1}`;
    }
  }, [pickerMonth]);

  const pickerCells = useNativeCalendarCells(pickerMonth);
  const pickerWeeks = useMemo(() => {
    const weeks: typeof pickerCells[] = [];
    for (let i = 0; i < pickerCells.length; i += 7) {
      weeks.push(pickerCells.slice(i, i + 7));
    }
    return weeks;
  }, [pickerCells]);

  return (
    <View style={[styles.featureCard, styles.noteDateCard]}>
      <Pressable style={styles.noteDateToggle} onPress={() => setIsOpen(prev => !prev)}>
        <View>
          <Text style={styles.noteStageTitle}>Note date</Text>
          <Text style={styles.notePreviewLabel}>{formatDisplayDate(selectedDateKey)}</Text>
        </View>
        <Text style={styles.noteDateToggleLabel}>{isOpen ? 'Close' : 'Select'}</Text>
      </Pressable>

      {isOpen ? (
        <View style={styles.noteDateCalendar}>
          <View style={styles.noteDateCalendarHeader}>
            <Pressable onPress={() => setPickerMonth(prev => addMonths(prev, -1))} style={styles.noteDateCalendarButton}>
              <Text style={styles.noteDateCalendarButtonLabel}>{'<'}</Text>
            </Pressable>
            <Text style={styles.noteDateCalendarTitle}>{monthLabel}</Text>
            <Pressable onPress={() => setPickerMonth(prev => addMonths(prev, 1))} style={styles.noteDateCalendarButton}>
              <Text style={styles.noteDateCalendarButtonLabel}>{'>'}</Text>
            </Pressable>
          </View>
          <View style={styles.noteDateWeekdays}>
            {WEEKDAYS.map(day => (
              <Text key={day} style={styles.noteDateWeekdayLabel}>
                {day}
              </Text>
            ))}
          </View>
          <View style={styles.noteDateGrid}>
            {pickerWeeks.map((week, index) => (
              <View key={`${week[0]?.key || index}-${index}`} style={styles.calendarWeekRow}>
                {week.map(cell => {
                  const key = formatDateKey(cell.date);
                  const active = key === selectedDateKey;
                  return (
                    <Pressable
                      key={cell.key}
                      style={[
                        styles.noteDateDay,
                        !cell.isCurrentMonth && styles.noteDateDayMuted,
                        active && styles.noteDateDayActive,
                      ]}
                      onPress={() => {
                        onSelectDate(key);
                        setPickerMonth(startOfMonth(cell.date));
                        setIsOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.noteDateDayLabel,
                          !cell.isCurrentMonth && styles.noteDateDayLabelMuted,
                          active && styles.noteDateDayLabelActive,
                        ]}
                      >
                        {cell.date.getDate()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function EditNoteModal({ draft, onChange, onCancel, onSave }) {
  return (
    <View style={styles.editModalOverlay}>
      <View style={styles.editModalPanel}>
        <View style={styles.editModalHeader}>
          <Text style={styles.editModalTitle}>Edit note</Text>
          <Pressable onPress={onCancel}>
            <Text style={styles.editModalClose}>×</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.calendarNoteEditor}
          multiline
          placeholder="Update your note..."
          placeholderTextColor="#94A3B8"
          value={draft.text}
          onChangeText={value => onChange('text', value)}
          textAlignVertical="top"
        />

        <OptionPillGroup
          label="Source"
          options={CALENDAR_SOURCE_OPTIONS}
          value={draft.sourceType}
          onChange={value => onChange('sourceType', value)}
        />

        <TextInput
          style={styles.calendarInput}
          placeholder="Source origin (e.g. Sign, Podcast...)"
          placeholderTextColor="#94A3B8"
          value={draft.sourceOrigin}
          onChangeText={value => onChange('sourceOrigin', value)}
        />

        <TextInput
          style={styles.calendarNoteEditor}
          multiline
          placeholder="Additional details"
          placeholderTextColor="#94A3B8"
          value={draft.additionalDetails}
          onChangeText={value => onChange('additionalDetails', value)}
          textAlignVertical="top"
        />

        <TextInput
          style={styles.calendarInput}
          placeholder="Date (YYYY-MM-DD)"
          placeholderTextColor="#94A3B8"
          value={draft.dateKey}
          onChangeText={value => onChange('dateKey', value)}
        />

        <View style={styles.editModalActions}>
          <Pressable style={styles.stageSecondaryButton} onPress={onCancel}>
            <Text style={styles.stageSecondaryLabel}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.stagePrimaryButton} onPress={onSave}>
            <Text style={styles.stagePrimaryLabel}>Save changes</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function InsightsView({ notes, sourceSlices, onDelete, loading, onEdit }) {
  const orderedNotes = useMemo(
    () => [...notes].sort((a, b) => (b.ts || 0) - (a.ts || 0)),
    [notes],
  );

  return (
    <View style={styles.dashboardSection}>
      <Text style={styles.featureHeadline}>Insights</Text>
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
          <NoteList notes={orderedNotes} onEdit={onEdit} onDelete={onDelete} showDate />
        )}
      </View>
    </View>
  );
}

const QUIZ_MODES = [
  { value: 'katakana', label: 'Katakana', dataset: KATAKANA_QUIZ },
  { value: 'hiragana', label: 'Hiragana', dataset: HIRAGANA_QUIZ },
];

const getQuizDataset = (mode: string) => {
  const selected = QUIZ_MODES.find(option => option.value === mode) || QUIZ_MODES[0];
  return selected.dataset;
};

function KanaQuizView() {
  const [quizMode, setQuizMode] = useState(QUIZ_MODES[0].value);
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [customMinutes, setCustomMinutes] = useState('5');
  const [quizItems, setQuizItems] = useState(() => shuffleQuiz(getQuizDataset(QUIZ_MODES[0].value)));
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(() => timerMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const [finishReason, setFinishReason] = useState<'time' | 'complete' | null>(null);
  const [completionTimeMs, setCompletionTimeMs] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<Array<{ mode: string; timeMs: number; score: number; total: number; date: number }>>([]);
  const inputRefs = React.useRef<Record<string, TextInput | null>>({});
  const startTimeRef = React.useRef<number | null>(null);


  const focusOrder = useMemo(() => {
    const buckets = [[], [], []];
    quizItems.forEach((item, index) => {
      buckets[index % 3].push(item.id);
    });
    return buckets.flat();
  }, [quizItems]);

  const indexById = useMemo(() => {
    const map: Record<string, number> = {};
    focusOrder.forEach((id, index) => {
      map[id] = index;
    });
    return map;
  }, [focusOrder]);

  const acceptedLookup = useMemo(() => {
    return quizItems.reduce<Record<string, string[]>>((acc, item) => {
      acc[item.id] = item.answers.map((value: string) => normalizeRomaji(value));
      return acc;
    }, {});
  }, [quizItems]);

  const isCorrectAnswer = useCallback(
    (id: string, value: string) => {
      const accepted = acceptedLookup[id] || [];
      const normalized = normalizeRomaji(value);
      return normalized.length > 0 && accepted.includes(normalized);
    },
    [acceptedLookup],
  );

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const stored = await AsyncStorage.getItem(QUIZ_LEADERBOARD_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setLeaderboard(Array.isArray(parsed) ? parsed : []);
        }
      } catch (err) {
        console.error('Failed to load leaderboard:', err);
      }
    };
    loadLeaderboard();
  }, []);

  const saveLeaderboardEntry = useCallback(async (entry: { mode: string; timeMs: number; score: number; total: number; date: number }) => {
    try {
      const stored = await AsyncStorage.getItem(QUIZ_LEADERBOARD_STORAGE_KEY);
      const current = stored ? JSON.parse(stored) : [];
      const updated = Array.isArray(current) ? [...current, entry] : [entry];
      // Sort by time (ascending) and keep top 10
      updated.sort((a, b) => a.timeMs - b.timeMs);
      const top10 = updated.slice(0, 10);
      await AsyncStorage.setItem(QUIZ_LEADERBOARD_STORAGE_KEY, JSON.stringify(top10));
      setLeaderboard(top10);
    } catch (err) {
      console.error('Failed to save leaderboard entry:', err);
    }
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsRunning(false);
          setHasFinished(true);
          setFinishReason('time');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning]);

  useEffect(() => {
    if (!quizItems.length) return;
    const allCorrect = quizItems.every(item => isCorrectAnswer(item.id, answers[item.id] || ''));
    if (allCorrect && !hasFinished) {
      const endTime = Date.now();
      const elapsedMs = startTimeRef.current ? endTime - startTimeRef.current : 0;
      setCompletionTimeMs(elapsedMs);
      setHasFinished(true);
      setIsRunning(false);
      setFinishReason('complete');
      // Save to leaderboard
      if (elapsedMs > 0) {
        saveLeaderboardEntry({
          mode: quizMode,
          timeMs: elapsedMs,
          score: quizItems.length,
          total: quizItems.length,
          date: Date.now(),
        });
      }
    }
  }, [answers, hasFinished, isCorrectAnswer, quizItems, quizMode, saveLeaderboardEntry]);

  const updateTimerMinutes = (minutes: number) => {
    const normalized = Math.max(QUIZ_TIMER_MIN_MINUTES, Math.min(QUIZ_TIMER_MAX_MINUTES, minutes));
    setTimerMinutes(normalized);
    setCustomMinutes(`${normalized}`);
    if (!isRunning) {
      setRemainingSeconds(normalized * 60);
    }
  };

  const applyCustomMinutes = () => {
    const parsed = Number.parseInt(customMinutes, 10);
    if (Number.isNaN(parsed) || parsed < QUIZ_TIMER_MIN_MINUTES || parsed > QUIZ_TIMER_MAX_MINUTES) {
      Alert.alert('Timer minutes', `Enter a value between ${QUIZ_TIMER_MIN_MINUTES} and ${QUIZ_TIMER_MAX_MINUTES}.`);
      return;
    }
    updateTimerMinutes(parsed);
  };

  const adjustCustomMinutes = (delta: number) => {
    const parsed = Number.parseInt(customMinutes, 10);
    const baseMinutes = Number.isNaN(parsed) ? timerMinutes : parsed;
    updateTimerMinutes(baseMinutes + delta);
  };

  const startQuiz = () => {
    setQuizItems(shuffleQuiz(getQuizDataset(quizMode)));
    setAnswers({});
    setHasFinished(false);
    setFinishReason(null);
    setCompletionTimeMs(null);
    setRemainingSeconds(timerMinutes * 60);
    setIsRunning(true);
    startTimeRef.current = Date.now();
  };

  const resetQuiz = () => {
    setIsRunning(false);
    setHasFinished(false);
    setFinishReason(null);
    setRemainingSeconds(timerMinutes * 60);
  };

  const score = useMemo(() => {
    return quizItems.reduce((sum, item) => {
      const response = answers[item.id];
      if (!response) return sum;
      const normalized = normalizeRomaji(response);
      const accepted = item.answers.map((value: string) => normalizeRomaji(value));
      return accepted.includes(normalized) ? sum + 1 : sum;
    }, 0);
  }, [answers, quizItems]);

  const focusNextAnswer = useCallback(
    (currentId: string, nextAnswers: Record<string, string>) => {
      const currentIndex = indexById[currentId] ?? -1;
      if (currentIndex < 0) return;
      const total = focusOrder.length;
      for (let offset = 1; offset <= total; offset += 1) {
        const nextIndex = currentIndex + offset;
        if (nextIndex >= total) break;
        const nextId = focusOrder[nextIndex];
        if (!isCorrectAnswer(nextId, nextAnswers[nextId] || '')) {
          const nextRef = inputRefs.current[nextId];
          if (nextRef && typeof nextRef.focus === 'function') {
            requestAnimationFrame(() => nextRef.focus());
          }
          break;
        }
      }
    },
    [focusOrder, indexById, isCorrectAnswer],
  );

  const handleAnswerChange = useCallback(
    (id: string, text: string) => {
      if (!isRunning && !hasFinished) {
        if (remainingSeconds <= 0) {
          setRemainingSeconds(timerMinutes * 60);
        }
        // Set start time when quiz auto-starts from typing
        if (!startTimeRef.current) {
          startTimeRef.current = Date.now();
        }
        setIsRunning(true);
      }
      setAnswers(prev => {
        const next = { ...prev, [id]: text };
        if (!hasFinished && isCorrectAnswer(id, text)) {
          focusNextAnswer(id, next);
        }
        return next;
      });
    },
    [focusNextAnswer, hasFinished, isCorrectAnswer, isRunning, remainingSeconds, timerMinutes],
  );

  const columns = useMemo(() => {
    const buckets = [[], [], []];
    quizItems.forEach((item, index) => {
      buckets[index % 3].push(item);
    });
    return buckets;
  }, [quizItems]);

  return (
    <ScrollView style={styles.quizScroll} contentContainerStyle={styles.quizContent}>
      <View style={styles.quizToolbar}>
        <View style={styles.quizToolbarLeft}>
          <View style={styles.quizSettingsRow}>
            <OptionPillGroup
              label="Quiz type"
              options={QUIZ_MODES.map(({ value, label }) => ({ value, label }))}
              value={quizMode}
              onChange={value => {
                setQuizMode(value);
                if (!isRunning) {
                  setQuizItems(shuffleQuiz((QUIZ_MODES.find(option => option.value === value) || QUIZ_MODES[0]).dataset));
                  setAnswers({});
                  setHasFinished(false);
                  setFinishReason(null);
                }
              }}
              compact
            />
            <View style={styles.quizCustomTimerColumn}>
              <Text style={styles.quizCustomTimerLabel}>Timer</Text>
              <View style={styles.quizCustomTimerRow}>
                <Pressable style={styles.quizTimerStepperButton} onPress={() => adjustCustomMinutes(-1)}>
                  <Text style={styles.quizTimerStepperLabel}>-</Text>
                </Pressable>
                <TextInput
                  style={styles.quizTimerInput}
                  keyboardType="number-pad"
                  value={customMinutes}
                  onChangeText={text => setCustomMinutes(text.replace(/[^0-9]/g, ''))}
                  onBlur={applyCustomMinutes}
                  onSubmitEditing={applyCustomMinutes}
                  placeholder="5"
                  placeholderTextColor="#94a3b8"
                />
                <Text style={styles.quizTimerUnitLabel}>min</Text>
                <Pressable style={styles.quizTimerStepperButton} onPress={() => adjustCustomMinutes(1)}>
                  <Text style={styles.quizTimerStepperLabel}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.quizToolbarRight}>
          <View style={styles.quizMetaRow}>
            <View style={styles.quizScoreBlock}>
              <Text style={styles.quizScoreLabel}>Score</Text>
              <Text style={styles.quizScoreValue}>
                {score}/{quizItems.length}
              </Text>
            </View>
            <View style={styles.quizTimerBlock}>
              <Text style={styles.quizTimerLabel}>Timer</Text>
              <Text style={[styles.quizTimerValue, hasFinished && styles.quizTimerValueExpired]}>
                {formatTimer(remainingSeconds)}
              </Text>
            </View>
          </View>
          <View style={styles.quizActionButtons}>
            <Pressable style={styles.quizPlayButton} onPress={startQuiz}>
              <Text style={styles.quizPlayButtonLabel}>Play Quiz</Text>
            </Pressable>
            <Pressable style={styles.quizResetButton} onPress={resetQuiz}>
              <Text style={styles.quizResetButtonLabel}>Reset</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.quizTableRow}>
        {hasFinished ? (
          <View style={styles.quizFinishCard}>
            <View style={styles.quizFinishHeader}>
              <View>
                <Text style={styles.quizFinishTitle}>Quiz Complete</Text>
                <Text style={styles.quizFinishSubtitle}>
                  {finishReason === 'time' ? 'Time is up.' : 'All answers correct.'}
                </Text>
              </View>
              <Pressable style={styles.quizFinishButton} onPress={startQuiz}>
                <Text style={styles.quizFinishButtonLabel}>Play Again</Text>
              </Pressable>
            </View>
            
            <View style={styles.quizFinishContent}>
              <View style={styles.quizFinishStatsPanel}>
                <Text style={styles.quizFinishPanelTitle}>Current Round</Text>
                <View style={styles.quizFinishStats}>
                  <View style={styles.quizFinishStat}>
                    <Text style={styles.quizFinishStatLabel}>Score</Text>
                    <Text style={styles.quizFinishStatValue}>
                      {score}/{quizItems.length}
                    </Text>
                  </View>
                  <View style={styles.quizFinishStat}>
                    <Text style={styles.quizFinishStatLabel}>Time Left</Text>
                    <Text style={styles.quizFinishStatValue}>{formatTimer(remainingSeconds)}</Text>
                  </View>
                  {completionTimeMs !== null && finishReason === 'complete' ? (
                    <View style={styles.quizFinishStat}>
                      <Text style={styles.quizFinishStatLabel}>Completion Time</Text>
                      <Text style={styles.quizFinishStatValue}>{formatMilliseconds(completionTimeMs)}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              
              <View style={styles.quizFinishLeaderboardPanel}>
                {leaderboard.length > 0 ? (
                  <View style={styles.quizLeaderboard}>
                    <Text style={styles.quizLeaderboardTitle}>🏆 Top 10 Best Times</Text>
                    <View style={styles.quizLeaderboardList}>
                      {leaderboard.map((entry, index) => (
                        <View key={`${entry.date}-${index}`} style={styles.quizLeaderboardEntry}>
                          <Text style={styles.quizLeaderboardRank}>#{index + 1}</Text>
                          <Text style={styles.quizLeaderboardMode}>{entry.mode}</Text>
                          <Text style={styles.quizLeaderboardTime}>{formatMilliseconds(entry.timeMs)}</Text>
                          <Text style={styles.quizLeaderboardScore}>
                            {entry.score}/{entry.total}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={styles.quizLeaderboard}>
                    <Text style={styles.quizLeaderboardTitle}>🏆 Leaderboard</Text>
                    <Text style={styles.quizLeaderboardEmpty}>Complete a quiz to see your best times!</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ) : (
          columns.map((column, columnIndex) => (
            <View key={`quiz-column-${columnIndex}`} style={styles.quizTable}>
              <View style={styles.quizTableHeader}>
              <Text style={styles.quizTableHeaderLabel}>Kana</Text>
              <Text style={styles.quizTableHeaderLabel}>English Syllable</Text>
            </View>
              {column.map(item => (
                <View key={item.id} style={styles.quizTableRowItem}>
                  <View style={styles.quizKanaCell}>
                    <Text style={styles.quizKanaText}>{item.kana}</Text>
                  </View>
                  <TextInput
                    ref={ref => {
                      inputRefs.current[item.id] = ref;
                    }}
                    style={styles.quizAnswerInput}
                    value={answers[item.id] || ''}
                    editable={!hasFinished}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => focusNextAnswer(item.id, answers)}
                    onChangeText={text => handleAnswerChange(item.id, text)}
                    placeholder="Type..."
                    placeholderTextColor="#64748b"
                  />
                </View>
              ))}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function DashboardView({
  notes,
  loading,
  error,
  refreshing,
  currentMonth,
  selectedDateKey,
  todayKey,
  onMonthChange,
  onSelectDate,
  onJumpToday,
  onRefresh,
  onDelete,
  onAddNote,
  onEditNote,
  onExitApp,
  form,
  onChangeForm,
  onSubmit,
  submitting,
  noteStage,
  onAdvanceStage,
  onBackStage,
  sourceSlices,
  onEdit,
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [historyViewMode, setHistoryViewMode] = useState<'list' | 'grid'>('list');
  const monthKey = useMemo(() => {
    const month = `${currentMonth.getMonth() + 1}`.padStart(2, '0');
    return `${currentMonth.getFullYear()}-${month}`;
  }, [currentMonth]);
  const monthlyNotes = useMemo(
    () =>
      notes.filter(
        note => typeof note.dateKey === 'string' && note.dateKey.startsWith(monthKey),
      ).length,
    [notes, monthKey],
  );
  const orderedNotes = useMemo(
    () => [...notes].sort((a, b) => (b.ts || 0) - (a.ts || 0)),
    [notes],
  );

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'compose', label: 'Compose' },
    { key: 'history', label: 'Note history' },
    { key: 'insights', label: 'Insights' },
    { key: 'quiz', label: 'Quiz' },
  ];

  return (
    <View style={styles.dashboardContent}>
      <View style={styles.dashboardHeader}>
        <View>
          <Text style={styles.dashboardTitle}>Tensai Note</Text>
        </View>
        <Pressable style={styles.dashboardExitButton} onPress={onExitApp}>
          <Text style={styles.dashboardExitLabel}>Exit</Text>
        </Pressable>
      </View>

      <View style={styles.dashboardTabs}>
        {tabs.map(tab => {
          const isActive = tab.key === activeTab;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.dashboardTab, isActive && styles.dashboardTabActive]}
            >
              <Text style={[styles.dashboardTabLabel, isActive && styles.dashboardTabLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.dashboardPanel}>
        {activeTab === 'overview' ? (
          <>
            <View style={styles.dashboardStats}>
              <View style={styles.dashboardStatCard}>
                <Text style={styles.dashboardStatValue}>{notes.length}</Text>
                <Text style={styles.dashboardStatLabel}>Total notes</Text>
              </View>
              <View style={styles.dashboardStatCard}>
                <Text style={styles.dashboardStatValue}>{monthlyNotes}</Text>
                <Text style={styles.dashboardStatLabel}>This month</Text>
              </View>
              <View style={styles.dashboardStatCard}>
                <Text style={styles.dashboardStatValue}>{sourceSlices.length}</Text>
                <Text style={styles.dashboardStatLabel}>Sources tracked</Text>
              </View>
            </View>

            <CalendarView
              notes={notes}
              loading={loading}
              refreshing={refreshing}
              currentMonth={currentMonth}
              selectedDateKey={selectedDateKey}
              todayKey={todayKey}
              onMonthChange={onMonthChange}
              onSelectDate={onSelectDate}
              onJumpToday={onJumpToday}
              onRefresh={onRefresh}
              onDelete={onDelete}
              onAddNote={onAddNote}
              onEditNote={onEditNote}
              embedded
            />
          </>
        ) : null}

        {activeTab === 'calendar' ? (
          <CalendarView
            notes={notes}
            loading={loading}
            refreshing={refreshing}
            currentMonth={currentMonth}
            selectedDateKey={selectedDateKey}
            todayKey={todayKey}
            onMonthChange={onMonthChange}
            onSelectDate={onSelectDate}
            onJumpToday={onJumpToday}
            onRefresh={onRefresh}
            onDelete={onDelete}
            onAddNote={onAddNote}
            onEditNote={onEditNote}
            embedded
          />
        ) : null}

        {activeTab === 'compose' ? (
          <NoteComposerPanel
            form={form}
            onChangeForm={onChangeForm}
            onSubmit={onSubmit}
            submitting={submitting}
            error={error}
            noteStage={noteStage}
            onAdvanceStage={onAdvanceStage}
            onBackStage={onBackStage}
          />
        ) : null}

        {activeTab === 'history' ? (
          <ScrollView style={styles.historyScroll} contentContainerStyle={styles.historyContent}>
            <Text style={styles.featureHeadline}>Note history</Text>
            <View style={[styles.featureCard, styles.calendarNotePane]}>
              <View style={styles.calendarNotePaneHeader}>
                <View>
                  <Text style={styles.calendarNotePaneTitle}>All notes</Text>
                  <Text style={styles.calendarNotePaneCount}>
                    {orderedNotes.length ? `${orderedNotes.length} saved` : 'No notes saved yet'}
                  </Text>
                </View>
                <View style={styles.viewToggleContainer}>
                  <Pressable
                    style={[styles.viewToggleButton, historyViewMode === 'list' && styles.viewToggleButtonActive]}
                    onPress={() => setHistoryViewMode('list')}
                  >
                    <Text style={[styles.viewToggleLabel, historyViewMode === 'list' && styles.viewToggleLabelActive]}>List</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.viewToggleButton, historyViewMode === 'grid' && styles.viewToggleButtonActive]}
                    onPress={() => setHistoryViewMode('grid')}
                  >
                    <Text style={[styles.viewToggleLabel, historyViewMode === 'grid' && styles.viewToggleLabelActive]}>Grid</Text>
                  </Pressable>
                </View>
              </View>
              {historyViewMode === 'list' ? (
                <NoteList notes={orderedNotes} onDelete={onDelete} onEdit={onEdit} showDate />
              ) : (
                <NoteGrid notes={orderedNotes} onDelete={onDelete} onEdit={onEdit} />
              )}
            </View>
          </ScrollView>
        ) : null}

        {activeTab === 'insights' ? (
          <InsightsView
            notes={notes}
            sourceSlices={sourceSlices}
            onDelete={onDelete}
            loading={loading}
            onEdit={onEdit}
          />
        ) : null}

        {activeTab === 'quiz' ? <KanaQuizView /> : null}
      </View>
    </View>
  );
}

function OptionPillGroup({ label, options, value, onChange, compact = false }) {
  return (
    <View style={[styles.pillGroup, compact && styles.quizPillGroup]}>
      <Text style={[styles.pillLabel, compact && styles.quizPillLabel]}>{label}</Text>
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

function NoteList({ notes, onEdit, onDelete, showDate = false }) {
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
            <View style={styles.noteActions}>
              <Pressable onPress={() => onEdit && onEdit(note)}>
                <Text style={styles.calendarNoteEdit}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => onDelete(note.id)}>
                <Text style={styles.calendarNoteDelete}>Delete</Text>
              </Pressable>
            </View>
          </View>
            <Text style={styles.calendarNoteText}>{note.text}</Text>
            {note.additionalDetails ? (
              <Text style={styles.calendarNoteDetail}>Details: {note.additionalDetails}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function NoteGrid({ notes, onEdit, onDelete }) {
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  if (!notes.length) {
    return <Text style={styles.calendarNoteEmpty}>Nothing logged yet.</Text>;
  }

  const toggleExpand = (noteId: string) => {
    setExpandedNoteId(prev => prev === noteId ? null : noteId);
  };

  return (
    <View style={styles.noteGrid}>
      {notes.map(note => {
        const sourceLabel = SOURCE_LABELS[note.sourceType] || 'Other';
        const sourceDisplay = note.sourceOrigin ? `${sourceLabel}: ${note.sourceOrigin}` : sourceLabel;
        const isExpanded = expandedNoteId === note.id;
        const truncatedText = note.text.length > 60 ? note.text.slice(0, 60) + '...' : note.text;

        return (
          <Pressable
            key={note.id}
            style={[styles.noteGridItem, isExpanded && styles.noteGridItemExpanded]}
            onPress={() => toggleExpand(note.id)}
          >
            <View style={styles.noteGridHeader}>
              <Text style={styles.noteGridDate}>{formatDisplayDate(note.dateKey)}</Text>
              <View style={styles.noteGridBadge}>
                <Text style={styles.noteGridBadgeText}>{note.language}</Text>
              </View>
            </View>
            
            <Text style={styles.noteGridText}>
              {isExpanded ? note.text : truncatedText}
            </Text>
            
            {isExpanded && (
              <>
                <View style={styles.noteGridMeta}>
                  <Text style={styles.noteGridMetaLabel}>Source:</Text>
                  <Text style={styles.noteGridMetaValue}>{sourceDisplay}</Text>
                </View>
                {note.additionalDetails ? (
                  <View style={styles.noteGridMeta}>
                    <Text style={styles.noteGridMetaLabel}>Details:</Text>
                    <Text style={styles.noteGridMetaValue}>{note.additionalDetails}</Text>
                  </View>
                ) : null}
                <View style={styles.noteGridActions}>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      onEdit && onEdit(note);
                    }}
                    style={styles.noteGridActionButton}
                  >
                    <Text style={styles.noteGridEditText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      onDelete(note.id);
                    }}
                    style={styles.noteGridActionButton}
                  >
                    <Text style={styles.noteGridDeleteText}>Delete</Text>
                  </Pressable>
                </View>
              </>
            )}
            
            {!isExpanded && (
              <Text style={styles.noteGridExpandHint}>Tap to expand</Text>
            )}
          </Pressable>
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
    additionalDetails: note.additionalDetails || note.extra || '',
  };
}

function formatDisplayDate(dateKey) {
  const date = parseDateKey(dateKey);
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
















































