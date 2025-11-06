import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import type { ListRenderItem } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

type CalendarCell = {
  key: string;
  date: Date | null;
};

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatISODate = (date: Date): string =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;

const getMonthStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const getMonthCells = (month: Date): CalendarCell[] => {
  const monthStart = getMonthStart(month);
  const leadingEmptyCells = monthStart.getDay();
  const daysInMonth = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
  ).getDate();
  const cells: CalendarCell[] = [];

  for (let i = 0; i < leadingEmptyCells; i += 1) {
    cells.push({ key: `prev-${i}`, date: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth(),
      day,
    );
    cells.push({ key: formatISODate(date), date });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `next-${cells.length}`, date: null });
  }

  return cells;
};

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const [currentMonth, setCurrentMonth] = useState<Date>(() =>
    getMonthStart(new Date()),
  );
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const todayKey = useMemo(() => formatISODate(new Date()), []);
  const selectedKey = useMemo(
    () => formatISODate(selectedDate),
    [selectedDate],
  );

  const monthLabel = useMemo(() => {
    try {
      return currentMonth.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return `${currentMonth.getFullYear()}-${currentMonth.getMonth() + 1}`;
    }
  }, [currentMonth]);

  const calendarCells = useMemo(
    () => getMonthCells(currentMonth),
    [currentMonth],
  );

  const renderCalendarCell: ListRenderItem<CalendarCell> = useCallback(
    ({ item }) => {
      if (!item.date) {
        return <View style={styles.calendarCell} />;
      }

      const cellKey = formatISODate(item.date);
      const isSelected = cellKey === selectedKey;
      const isToday = cellKey === todayKey;

      return (
        <Pressable
          accessibilityRole="button"
          onPress={() => setSelectedDate(item.date!)}
          style={[
            styles.calendarCell,
            isSelected && styles.calendarCellSelected,
            isToday && styles.calendarCellToday,
          ]}
        >
          <Text
            style={[
              styles.calendarCellText,
              isSelected && styles.calendarCellTextSelected,
            ]}
          >
            {item.date.getDate()}
          </Text>
        </Pressable>
      );
    },
    [selectedKey, todayKey],
  );

  const handlePrevMonth = useCallback(() => {
    setCurrentMonth((prev) => getMonthStart(
      new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
    ));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth((prev) => getMonthStart(
      new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
    ));
  }, []);

  const handleNoteChange = useCallback(
    (value: string) => {
      setNotes((prev) => ({
        ...prev,
        [selectedKey]: value,
      }));
    },
    [selectedKey],
  );

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: safeAreaInsets.top,
          paddingBottom: Math.max(safeAreaInsets.bottom, 16),
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={handlePrevMonth}>
          <Text style={styles.headerControl}>{'<'}</Text>
        </Pressable>
        <Text style={styles.headerLabel}>{monthLabel}</Text>
        <Pressable accessibilityRole="button" onPress={handleNextMonth}>
          <Text style={styles.headerControl}>{'>'}</Text>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {weekdays.map((day) => (
          <Text key={day} style={styles.weekdayCell}>
            {day}
          </Text>
        ))}
      </View>

      <FlatList
        data={calendarCells}
        keyExtractor={(item) => item.key}
        numColumns={7}
        scrollEnabled={false}
        renderItem={renderCalendarCell}
        contentContainerStyle={styles.calendarGrid}
      />

      <View style={styles.noteContainer}>
        <Text style={styles.noteHeader}>
          Notes for {selectedDate.toLocaleDateString()}
        </Text>
        <TextInput
          multiline
          numberOfLines={4}
          placeholder="Write your study notes, prompts, or kanji insights..."
          style={styles.noteInput}
          value={notes[selectedKey] ?? ''}
          onChangeText={handleNoteChange}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: '#101820',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLabel: {
    color: '#F2F2F2',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  headerControl: {
    color: '#F2F2F2',
    fontSize: 18,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekdayCell: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: '#9AA0A6',
    fontSize: 12,
    fontWeight: '500',
  },
  calendarGrid: {
    marginBottom: 24,
  },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginBottom: 8,
  },
  calendarCellSelected: {
    backgroundColor: '#4C8BF5',
  },
  calendarCellToday: {
    borderWidth: 1,
    borderColor: '#4C8BF5',
  },
  calendarCellText: {
    color: '#E8EAED',
    fontSize: 16,
    fontWeight: '500',
  },
  calendarCellTextSelected: {
    color: '#FFFFFF',
  },
  noteContainer: {
    flex: 1,
    backgroundColor: '#202830',
    borderRadius: 16,
    padding: 16,
  },
  noteHeader: {
    color: '#F2F2F2',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  noteInput: {
    flex: 1,
    color: '#F2F2F2',
    fontSize: 15,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3C4043',
    textAlignVertical: 'top',
  },
});

export default App;
