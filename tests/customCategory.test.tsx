import React from 'react';
import renderer, { act } from 'react-test-renderer';
import App from '../App';
import { CUSTOM_C1_COLOURS, CUSTOM_C1_2_CALENDAR } from '../mobile/src/data/customVocabulary';
import { LEADERBOARD_DATABASE_KEY } from '../mobile/src/utils/desktopLeaderboardStorage';
import { styles } from '../mobile/src/styles/appStyles';
import { JOYO_KANJI_READING_LOOKUP } from '../mobile/src/data/joyo_kanji_readings';

jest.mock('react-native', () => ({
  Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', TextInput: 'TextInput', View: 'View',
  Platform: { OS: 'web', select: (options: any) => options.web ?? options.default },
  StyleSheet: { create: (styles: any) => styles },
  useWindowDimensions: () => ({ width: 1280, height: 800 }),
  Alert: { alert: jest.fn() }, Linking: { openURL: jest.fn() },
  Animated: {
    View: 'View',
    Value: class { interpolate() { return 0; } },
    timing: () => ({ start: () => {} }),
  },
}));
jest.mock('react-native-svg', () => ({
  __esModule: true, default: 'Svg', Circle: 'Circle', Line: 'Line', Path: 'Path', Polyline: 'Polyline', Text: 'SvgText',
}));
jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map();
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
    multiSet: async (entries: string[][]) => { entries.forEach(([key, value]) => values.set(key, value)); },
    removeItem: async (key: string) => { values.delete(key); },
  };
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let tree: renderer.ReactTestRenderer;
const textNodes = () => tree.root.findAllByType('Text' as any);
const content = (node: renderer.ReactTestInstance) => [node.props.children].flat().join('');
const hasText = (value: string) => textNodes().some(node => content(node) === value);
const button = (label: string) => tree.root.findAllByType('Pressable' as any).find(node =>
  node.props.accessibilityLabel === label || node.findAllByType('Text' as any).some(text => content(text) === label),
)!;
const press = async (label: string) => { await act(async () => button(label).props.onPress()); };
const readingFields = () => tree.root.findAllByType('TextInput' as any).filter(node => node.props.placeholder === 'Type reading...');
const setReadingMode = async (label: string) => {
  await press('Reading mode');
  await press(label);
};
const quizFields = () => tree.root.findAllByType('TextInput' as any).filter(node => ['Type reading...', 'Type full reading...', 'Type meaning...', 'Type kanji ...'].includes(node.props.placeholder));

beforeEach(async () => { await act(async () => { tree = renderer.create(<App />); }); });
afterEach(async () => { await act(async () => tree.unmount()); });

test('Custom opens C1-1 Colours with 25 answerable words and C2-C5 show empty sections', async () => {
  await press('Custom');
  expect(readingFields()).toHaveLength(25);
  expect(hasText('色')).toBe(true);
  expect(hasText('カラフル')).toBe(true);
  expect(button('Custom C1').props.accessibilityState.selected).toBe(true);
  for (const section of ['C2', 'C3', 'C4', 'C5']) {
    await press(`Custom ${section}`);
    expect(hasText('No subjects yet. Choose C1 to practise C1-1 Colours.')).toBe(true);
    expect(button('Play Quiz')).toBeUndefined();
    expect(readingFields()).toHaveLength(0);
  }
  await press('Custom C1');
  expect(readingFields()).toHaveLength(25);
  await press('Play Quiz');
  expect(readingFields().every(field => field.props.editable !== false)).toBe(true);
  await press('Stop');
});

test('Custom glossary keeps whole-word readings, meanings and Focus selections', async () => {
  await press('Custom');
  await press('Glossary');
  expect(hasText('C1-1 Colours Glossary')).toBe(true);
  for (const item of CUSTOM_C1_COLOURS) {
    expect(hasText(item.kana)).toBe(true);
    expect(hasText(item.meanings.join(' / '))).toBe(true);
  }
  await press('色');
  await press('Quiz');
  await press('Focus');
  expect(hasText('色')).toBe(true);
  expect(tree.root.findAllByType('TextInput' as any).filter(node => node.props.placeholder === 'Type answer...')).toHaveLength(1);
});

test('Custom is available across the practice views', async () => {
  await press('Custom');
  for (const view of ['Endless', 'TypeMaster', 'Multiple Choice', 'Quiz']) {
    await press(view);
    expect(button('Custom C1').props.accessibilityState.selected).toBe(true);
    expect(button(view === 'Quiz' ? 'Play Quiz' : view === 'Multiple Choice' ? 'Play Multiple Choice' : `Play ${view}`)).toBeDefined();
  }
});

test('a complete colours round accepts whole-word readings and saves its own leaderboard mode', async () => {
  await press('Custom');
  await press('Play Quiz');
  for (const field of readingFields()) {
    const word = field.parent!.findAllByType('Text' as any).map(content).find(value => CUSTOM_C1_COLOURS.some(item => item.kana === value));
    const item = CUSTOM_C1_COLOURS.find(candidate => candidate.kana === word)!;
    await act(async () => field.props.onChangeText(item.answers[0]));
  }
  expect(hasText('Quiz Complete')).toBe(true);
  const storage = (await import('@react-native-async-storage/async-storage')).default;
  const saved = JSON.parse((await storage.getItem(LEADERBOARD_DATABASE_KEY)) || '{}');
  expect(saved.data.allTime.find((entry: any) => entry.mode === 'custom_c1_colours:on_kun' && entry.finishReason === 'complete')).toMatchObject({ correctCount: 25 });
});

test('C1-2 Calendar shows weekdays and months, accepts their readings and saves a separate result', async () => {
  await press('Custom');
  expect(button('C1-1 Colours (25)')).toBeUndefined();
  expect(button('C1-2 Calendar (25)')).toBeUndefined();
  await press('C1 subjects');
  expect(button('C1 subjects').props.accessibilityState.expanded).toBe(true);
  expect(button('C1-1 Colours (25)').props.accessibilityState.selected).toBe(true);
  await press('C1-2 Calendar (25)');
  expect(button('C1 subjects').props.accessibilityState.expanded).toBe(false);
  expect(button('C1-2 Calendar (25)')).toBeUndefined();
  await press('Custom C1');
  expect(readingFields()).toHaveLength(25);
  expect(hasText('月曜日')).toBe(true);
  expect(hasText('十二月')).toBe(true);
  await press('Glossary');
  expect(hasText('C1-2 Calendar Glossary')).toBe(true);
  for (const meaning of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']) {
    expect(hasText(meaning)).toBe(true);
  }
  await press('Quiz');
  await press('Play Quiz');
  for (const field of readingFields()) {
    const word = field.parent!.findAllByType('Text' as any).map(content).find(value => CUSTOM_C1_2_CALENDAR.some(item => item.kana === value));
    const item = CUSTOM_C1_2_CALENDAR.find(candidate => candidate.kana === word)!;
    await act(async () => field.props.onChangeText(item.answers[0]));
  }
  expect(hasText('Quiz Complete')).toBe(true);
  const storage = (await import('@react-native-async-storage/async-storage')).default;
  const saved = JSON.parse((await storage.getItem(LEADERBOARD_DATABASE_KEY)) || '{}');
  expect(saved.data.allTime.find((entry: any) => entry.mode === 'custom_c1_2_calendar:on_kun' && entry.finishReason === 'complete')).toMatchObject({ correctCount: 25 });
});

test.each([
  ['On/Kun (Default)', 'on_kun'],
  ['Full Joyo Readings', 'joyo_full'],
  ['Onyomi only', 'onyomi_only'],
  ['Kunyomi only', 'kunyomi_only'],
  ['English Translate', 'en_on_kun'],
  ['Kanji Input', 'jp_on_kun_kanji'],
])('C1 Colours supports %s and saves its result separately', async (label, mode) => {
  await press('Custom');
  await setReadingMode(label);
  expect(quizFields()).toHaveLength(25);
  await press('Play Quiz');
  for (const field of quizFields()) {
    const texts = field.parent!.findAllByType('Text' as any).map(content);
    const item = CUSTOM_C1_COLOURS.find(candidate => texts.includes(mode === 'jp_on_kun_kanji' ? candidate.answers.join(' / ') : candidate.kana))!;
    let answer = mode === 'en_on_kun' ? item.meanings[0] : mode === 'jp_on_kun_kanji' ? item.kana : item.answers[0];
    if (mode === 'onyomi_only') answer = (item.onyomi || JOYO_KANJI_READING_LOOKUP[item.kana]?.onyomiRomaji)?.[0] || item.answers[0];
    if (mode === 'kunyomi_only') answer = (item.kunyomi || JOYO_KANJI_READING_LOOKUP[item.kana]?.kunyomiRomaji)?.[0] || item.answers[0];
    // Check a real distinction between On and Kun, rather than just menu labels.
    if (item.kana === '色' && ['onyomi_only', 'kunyomi_only'].includes(mode)) {
      await act(async () => field.props.onChangeText(mode === 'onyomi_only' ? 'iro' : 'shoku'));
      expect(field.props.style).toContain(styles.quizAnswerInputIncorrect);
      answer = mode === 'onyomi_only' ? 'shoku' : 'iro';
    }
    if (item.kana === '色' && ['on_kun', 'joyo_full'].includes(mode)) answer = 'shoku';
    if (mode === 'jp_on_kun_kanji') expect(field.props.maxLength).toBeGreaterThanOrEqual(Array.from(item.kana).length);
    await act(async () => field.props.onChangeText(answer));
    if (!hasText('Quiz Complete')) expect(field.props.style).not.toContain(styles.quizAnswerInputIncorrect);
  }
  expect(hasText('Quiz Complete')).toBe(true);
  const storage = (await import('@react-native-async-storage/async-storage')).default;
  const saved = JSON.parse((await storage.getItem(LEADERBOARD_DATABASE_KEY)) || '{}');
  expect(saved.data.allTime.find((entry: any) => entry.mode === `custom_c1_colours:${mode}` && entry.finishReason === 'complete')).toMatchObject({ correctCount: 25 });
});

test('Calendar Kanji Input accepts full weekday and month words longer than two characters', async () => {
  await press('Custom');
  await press('C1 subjects');
  await press('C1-2 Calendar (25)');
  await setReadingMode('Kanji Input');
  await press('Play Quiz');
  for (const field of quizFields()) {
    const texts = field.parent!.findAllByType('Text' as any).map(content);
    const item = CUSTOM_C1_2_CALENDAR.find(candidate => texts.includes(candidate.answers.join(' / ')))!;
    expect(field.props.maxLength).toBeGreaterThanOrEqual(Array.from(item.kana).length);
    await act(async () => field.props.onChangeText(item.kana));
  }
  expect(hasText('Quiz Complete')).toBe(true);
});

test('C1 English Translate supplies meanings in Multiple Choice', async () => {
  await press('Custom');
  await setReadingMode('English Translate');
  await press('Multiple Choice');
  await press('Play Multiple Choice');
  expect(CUSTOM_C1_COLOURS.some(item => hasText(item.meanings.map(value => value.toLowerCase().replace(/[^a-z]/g, '')).join(' / ')))).toBe(true);
  await press('Stop');
});

const hintNodes = () => textNodes().filter(node => node.props.accessibilityLabel?.startsWith('Hint for '));
const hintFor = (word: string) => content(hintNodes().find(node => node.props.accessibilityLabel === `Hint for ${word}`)!);

test('Quiz hints toggle without filling answers and follow the selected reading mode', async () => {
  await press('Custom');
  expect(hintNodes()).toHaveLength(0);
  await press('Show Hint');
  expect(hintNodes()).toHaveLength(25);
  expect(hintFor('色')).toContain('iro');
  await setReadingMode('Onyomi only');
  expect(hintFor('色')).toContain('shoku');
  expect(hintFor('色')).not.toContain('iro');
  await setReadingMode('English Translate');
  expect(hintFor('色')).toContain('colour');
  expect(hintFor('色')).not.toContain('iro');
  await setReadingMode('Kanji Input');
  expect(hintFor('カラフル')).toContain('カラフル');
  expect(quizFields().every(field => field.props.value === '')).toBe(true);
  await press('Hide Hint');
  expect(hintNodes()).toHaveLength(0);
});

test('paused Quiz hides hints until resumed', async () => {
  await press('Custom');
  await press('Show Hint');
  await press('Play Quiz');
  await act(async () => readingFields()[0].props.onChangeText('not-a-reading'));
  await press('Pause Quiz');
  expect(hintNodes()).toHaveLength(0);
  expect(button('Hide Hint').props.disabled).toBe(true);
  await press('Resume Quiz');
  expect(hintNodes()).toHaveLength(25);
  await press('Stop');
});

test('Quiz hints also work for Kana and JLPT lessons', async () => {
  await press('Show Hint');
  expect(hintFor('あ')).toBe('Hint: a');
  await press('JLPT');
  expect(hintNodes().length).toBeGreaterThan(0);
  expect(hintNodes().every(node => content(node).length > 'Hint: '.length)).toBe(true);
  await press('Endless');
  expect(button('Hide Hint')).toBeUndefined();
});
