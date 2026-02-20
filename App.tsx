// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
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

const JLPT_N5_KANJI_QUIZ = [
  { id: 'n5_001', kana: '日', answers: ['nichi', 'jitsu', 'hi', 'bi', 'ka'] },
  { id: 'n5_002', kana: '一', answers: ['ichi', 'itsu', 'hito', 'hitotsu'] },
  { id: 'n5_003', kana: '国', answers: ['koku', 'kuni'] },
  { id: 'n5_004', kana: '人', answers: ['jin', 'nin', 'hito'] },
  { id: 'n5_005', kana: '年', answers: ['nen', 'toshi'] },
  { id: 'n5_006', kana: '大', answers: ['dai', 'tai', 'oo', 'ookii'] },
  { id: 'n5_007', kana: '十', answers: ['juu', 'to', 'too'] },
  { id: 'n5_008', kana: '二', answers: ['ni', 'futa', 'futatsu'] },
  { id: 'n5_009', kana: '本', answers: ['hon', 'moto'] },
  { id: 'n5_010', kana: '中', answers: ['chuu', 'naka'] },
  { id: 'n5_011', kana: '長', answers: ['chou', 'naga'] },
  { id: 'n5_012', kana: '出', answers: ['shutsu', 'sui', 'de', 'da', 'deru', 'dasu'] },
  { id: 'n5_013', kana: '三', answers: ['san', 'mi', 'mitsu'] },
  { id: 'n5_014', kana: '時', answers: ['ji', 'toki'] },
  { id: 'n5_015', kana: '行', answers: ['kou', 'gyou', 'an', 'i', 'yu', 'okona'] },
  { id: 'n5_016', kana: '見', answers: ['ken', 'mi', 'miru'] },
  { id: 'n5_017', kana: '月', answers: ['getsu', 'gatsu', 'tsuki'] },
  { id: 'n5_018', kana: '分', answers: ['bun', 'fun', 'bu', 'wa', 'waka'] },
  { id: 'n5_019', kana: '後', answers: ['go', 'kou', 'ato', 'ushiro', 'nochi'] },
  { id: 'n5_020', kana: '前', answers: ['zen', 'mae'] },
  { id: 'n5_021', kana: '生', answers: ['sei', 'shou', 'i', 'u', 'o', 'ha', 'ki', 'nama'] },
  { id: 'n5_022', kana: '五', answers: ['go', 'itsu', 'itsutsu'] },
  { id: 'n5_023', kana: '間', answers: ['kan', 'ken', 'aida', 'ma'] },
  { id: 'n5_024', kana: '上', answers: ['jou', 'shou', 'ue', 'uwa', 'kami', 'a', 'aga', 'sage', 'nobo'] },
  { id: 'n5_025', kana: '東', answers: ['tou', 'higashi'] },
  { id: 'n5_026', kana: '四', answers: ['shi', 'yon', 'yo', 'yottsu'] },
  { id: 'n5_027', kana: '今', answers: ['kon', 'ima'] },
  { id: 'n5_028', kana: '金', answers: ['kin', 'kon', 'kane'] },
  { id: 'n5_029', kana: '九', answers: ['kyuu', 'ku', 'kokono', 'kokonotsu'] },
  { id: 'n5_030', kana: '入', answers: ['nyuu', 'ju', 'iru', 'hairu'] },
  { id: 'n5_031', kana: '学', answers: ['gaku', 'manabu'] },
  { id: 'n5_032', kana: '高', answers: ['kou', 'taka', 'takai'] },
  { id: 'n5_033', kana: '円', answers: ['en', 'maru'] },
  { id: 'n5_034', kana: '子', answers: ['shi', 'su', 'ko'] },
  { id: 'n5_035', kana: '外', answers: ['gai', 'ge', 'soto', 'hoka', 'hazusu'] },
  { id: 'n5_036', kana: '八', answers: ['hachi', 'ya', 'yattsu'] },
  { id: 'n5_037', kana: '六', answers: ['roku', 'mu', 'muttsu'] },
  { id: 'n5_038', kana: '下', answers: ['ka', 'ge', 'shita', 'kuda', 'saga'] },
  { id: 'n5_039', kana: '来', answers: ['rai', 'kuru', 'kita'] },
  { id: 'n5_040', kana: '気', answers: ['ki', 'ke'] },
  { id: 'n5_041', kana: '小', answers: ['shou', 'ko', 'o', 'chii'] },
  { id: 'n5_042', kana: '七', answers: ['shichi', 'nana', 'nanatsu'] },
  { id: 'n5_043', kana: '山', answers: ['san', 'yama'] },
  { id: 'n5_044', kana: '話', answers: ['wa', 'hanashi', 'hanasu'] },
  { id: 'n5_045', kana: '女', answers: ['jo', 'nyo', 'onna'] },
  { id: 'n5_046', kana: '北', answers: ['hoku', 'kita'] },
  { id: 'n5_047', kana: '午', answers: ['go'] },
  { id: 'n5_048', kana: '百', answers: ['hyaku', 'bya', 'pyaku'] },
  { id: 'n5_049', kana: '書', answers: ['sho', 'kaku'] },
  { id: 'n5_050', kana: '先', answers: ['sen', 'saki'] },
  { id: 'n5_051', kana: '名', answers: ['mei', 'myou', 'na'] },
  { id: 'n5_052', kana: '川', answers: ['sen', 'kawa'] },
  { id: 'n5_053', kana: '千', answers: ['sen', 'chi'] },
  { id: 'n5_054', kana: '水', answers: ['sui', 'mizu'] },
  { id: 'n5_055', kana: '半', answers: ['han'] },
  { id: 'n5_056', kana: '男', answers: ['dan', 'nan', 'otoko'] },
  { id: 'n5_057', kana: '西', answers: ['sei', 'sai', 'nishi'] },
  { id: 'n5_058', kana: '電', answers: ['den'] },
  { id: 'n5_059', kana: '校', answers: ['kou'] },
  { id: 'n5_060', kana: '語', answers: ['go', 'kata', 'kataru'] },
  { id: 'n5_061', kana: '土', answers: ['do', 'to', 'tsuchi'] },
  { id: 'n5_062', kana: '木', answers: ['moku', 'boku', 'ki', 'ko'] },
  { id: 'n5_063', kana: '聞', answers: ['bun', 'mon', 'kiku'] },
  { id: 'n5_064', kana: '食', answers: ['shoku', 'jiki', 'kuu', 'taberu'] },
  { id: 'n5_065', kana: '車', answers: ['sha', 'kuruma'] },
  { id: 'n5_066', kana: '何', answers: ['ka', 'nani'] },
  { id: 'n5_067', kana: '南', answers: ['nan', 'na', 'minami'] },
  { id: 'n5_068', kana: '万', answers: ['man', 'ban'] },
  { id: 'n5_069', kana: '毎', answers: ['mai'] },
  { id: 'n5_070', kana: '白', answers: ['haku', 'bya', 'shiro'] },
  { id: 'n5_071', kana: '天', answers: ['ten', 'ame', 'ama'] },
  { id: 'n5_072', kana: '母', answers: ['bo', 'haha'] },
  { id: 'n5_073', kana: '火', answers: ['ka', 'hi'] },
  { id: 'n5_074', kana: '右', answers: ['u', 'yuu', 'migi'] },
  { id: 'n5_075', kana: '読', answers: ['doku', 'toku', 'yomu'] },
  { id: 'n5_076', kana: '友', answers: ['yuu', 'tomo'] },
  { id: 'n5_077', kana: '左', answers: ['sa', 'hidari'] },
  { id: 'n5_078', kana: '休', answers: ['kyuu', 'yasu'] },
  { id: 'n5_079', kana: '父', answers: ['fu', 'chichi'] },
  { id: 'n5_080', kana: '雨', answers: ['u', 'ame', 'ama'] },
];
const JLPT_N5_ENGLISH_MEANINGS = {
  n5_001: ['day', 'sun'],
  n5_002: ['one'],
  n5_003: ['country', 'nation'],
  n5_004: ['person', 'human'],
  n5_005: ['year'],
  n5_006: ['big', 'large', 'great'],
  n5_007: ['ten'],
  n5_008: ['two'],
  n5_009: ['book'],
  n5_010: ['middle', 'inside', 'center'],
  n5_011: ['long'],
  n5_012: ['exit', 'leave', 'go out'],
  n5_013: ['three'],
  n5_014: ['time', 'hour'],
  n5_015: ['go'],
  n5_016: ['see', 'look'],
  n5_017: ['month', 'moon'],
  n5_018: ['minute', 'part', 'divide'],
  n5_019: ['after', 'behind'],
  n5_020: ['before', 'front'],
  n5_021: ['life', 'birth'],
  n5_022: ['five'],
  n5_023: ['between', 'interval', 'space'],
  n5_024: ['up', 'above'],
  n5_025: ['east'],
  n5_026: ['four'],
  n5_027: ['now'],
  n5_028: ['gold', 'money'],
  n5_029: ['nine'],
  n5_030: ['enter', 'insert'],
  n5_031: ['study', 'learn'],
  n5_032: ['high', 'tall'],
  n5_033: ['yen', 'circle'],
  n5_034: ['child'],
  n5_035: ['outside', 'external'],
  n5_036: ['eight'],
  n5_037: ['six'],
  n5_038: ['down', 'below', 'under'],
  n5_039: ['come'],
  n5_040: ['spirit', 'energy'],
  n5_041: ['small', 'little'],
  n5_042: ['seven'],
  n5_043: ['mountain'],
  n5_044: ['talk', 'speak'],
  n5_045: ['woman', 'female'],
  n5_046: ['north'],
  n5_047: ['noon'],
  n5_048: ['hundred'],
  n5_049: ['write'],
  n5_050: ['previous', 'ahead', 'before'],
  n5_051: ['name'],
  n5_052: ['river'],
  n5_053: ['thousand'],
  n5_054: ['water'],
  n5_055: ['half'],
  n5_056: ['man', 'male'],
  n5_057: ['west'],
  n5_058: ['electricity', 'electric'],
  n5_059: ['school'],
  n5_060: ['language', 'word'],
  n5_061: ['earth', 'soil'],
  n5_062: ['tree', 'wood'],
  n5_063: ['hear', 'ask', 'listen'],
  n5_064: ['eat', 'food'],
  n5_065: ['car', 'vehicle'],
  n5_066: ['what'],
  n5_067: ['south'],
  n5_068: ['ten thousand', 'myriad'],
  n5_069: ['every'],
  n5_070: ['white'],
  n5_071: ['heaven', 'sky'],
  n5_072: ['mother'],
  n5_073: ['fire'],
  n5_074: ['right'],
  n5_075: ['read'],
  n5_076: ['friend'],
  n5_077: ['left'],
  n5_078: ['rest'],
  n5_079: ['father'],
  n5_080: ['rain'],
};
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

const JAPANESE_INPUT_CHAR_REGEX = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々〆〤]/;

const sanitizeJapaneseInput = (value: string) =>
  value.replace(/[^\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々〆〤ー]/g, '');

const shuffleQuiz = (items: any[]) => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

// Smart character queue for endless mode
// Ensures all characters are shown at least once per cycle before repeating
class CharacterQueue {
  private pool: any[];
  private currentCycle: any[];
  private nextIndex: number;

  constructor(items: any[]) {
    this.pool = [...items];
    this.currentCycle = shuffleQuiz([...items]);
    this.nextIndex = 0;
  }

  // Get the next N characters from the queue
  getNext(count: number = 1): any[] {
    const result: any[] = [];

    for (let i = 0; i < count; i++) {
      // If we've exhausted the current cycle, start a new one
      if (this.nextIndex >= this.currentCycle.length) {
        this.currentCycle = shuffleQuiz([...this.pool]);
        this.nextIndex = 0;
      }

      result.push(this.currentCycle[this.nextIndex]);
      this.nextIndex++;
    }

    return result;
  }

  // Reset the queue with a new dataset
  reset(items: any[]) {
    this.pool = [...items];
    this.currentCycle = shuffleQuiz([...items]);
    this.nextIndex = 0;
  }

  // Get current progress in the cycle (for debugging/stats)
  getCycleProgress(): { shown: number; total: number; cycle: number } {
    const cycleNumber = Math.floor(this.nextIndex / this.pool.length) + 1;
    return {
      shown: this.nextIndex % this.pool.length,
      total: this.pool.length,
      cycle: cycleNumber,
    };
  }
}

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

const formatLeaderboardDateTime = (timestamp: number) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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
  { value: 'katakana', label: 'Katakana', tabLabel: 'Katakana', family: 'kana', dataset: KATAKANA_QUIZ },
  { value: 'hiragana', label: 'Hiragana', tabLabel: 'Hiragana', family: 'kana', dataset: HIRAGANA_QUIZ },
  { value: 'jlpt_n5', label: 'JLPT N5 (On/Kun)', tabLabel: 'N5', family: 'jlpt', dataset: JLPT_N5_KANJI_QUIZ },
];
const JLPT_READING_MODES = [
  { value: 'on_kun', label: 'On/Kun (Default)' },
  { value: 'onyomi_only', label: 'Onyomi only' },
  { value: 'kunyomi_only', label: 'Kunyomi only' },
  { value: 'en_on_kun', label: 'English Translate' },
];
const DEFAULT_JLPT_READING_MODE = JLPT_READING_MODES[0].value;
const JLPT_ENGLISH_TRANSLATE_MODES = ['en_on_kun'];
const QUIZ_FAMILY_OPTIONS = [
  { value: 'kana', label: 'Kana' },
  { value: 'jlpt', label: 'JLPT' },
];
const QUIZ_VIEW_OPTIONS = [
  { value: 'quiz', label: 'Quiz' },
  { value: 'endless', label: 'Endless' },
  { value: 'typemaster', label: 'TypeMaster' },
  { value: 'leaderboard', label: 'Leaderboard' },
];
const TYPEMASTER_QUEUE_OPTIONS = [
  { value: 'rapidfire', label: 'Rapidfire' },
  { value: 'burst', label: 'Burst' },
];
const DEFAULT_TYPEMASTER_QUEUE_MODE = TYPEMASTER_QUEUE_OPTIONS[0].value;
const LEADERBOARD_SCOPE_OPTIONS = [
  { value: 'all_time', label: 'All time' },
  { value: 'session', label: 'Current Session' },
];
const LEADERBOARD_GAME_OPTIONS = [
  { value: 'quiz', label: 'Quiz' },
  { value: 'typemaster', label: 'TypeMaster' },
];

const getQuizDataset = (mode: string) => {
  const selected = QUIZ_MODES.find(option => option.value === mode) || QUIZ_MODES[0];
  return selected.dataset;
};
const getQuizModeFamily = (mode: string) => {
  const selected = QUIZ_MODES.find(option => option.value === mode) || QUIZ_MODES[0];
  return selected.family;
};
const getQuizModesForFamily = (family: string) => QUIZ_MODES.filter(option => option.family === family);

const getQuizModeKey = (mode: string, jlptReadingMode: string = DEFAULT_JLPT_READING_MODE) =>
  mode === 'jlpt_n5' ? `${mode}:${jlptReadingMode}` : mode;

const getTypeMasterModeKey = (quizModeKey: string) => `typemaster:${quizModeKey}`;

const parseTypeMasterModeKey = (mode: string) => {
  if (!mode.startsWith('typemaster:')) return null;
  const raw = mode.replace('typemaster:', '');
  const parts = raw.split(':').filter(Boolean);
  if (!parts.length) return null;
  const last = parts[parts.length - 1];
  const hasQueueMode = TYPEMASTER_QUEUE_OPTIONS.some(option => option.value === last);
  const queueMode = hasQueueMode ? last : DEFAULT_TYPEMASTER_QUEUE_MODE;
  const baseParts = hasQueueMode ? parts.slice(0, -1) : parts;
  const baseMode = baseParts[0] || QUIZ_MODES[0].value;
  const jlptReadingMode = baseMode === 'jlpt_n5'
    ? (baseParts[1] || DEFAULT_JLPT_READING_MODE)
    : null;
  const normalizedQuizModeKey = baseMode === 'jlpt_n5'
    ? getQuizModeKey('jlpt_n5', jlptReadingMode || DEFAULT_JLPT_READING_MODE)
    : baseMode;
  return {
    queueMode,
    quizModeKey: normalizedQuizModeKey,
  };
};

const normalizeStoredQuizModeKey = (mode: string) => {
  if (mode.startsWith('endless:')) {
    const withoutEndless = mode.replace('endless:', '');
    if (withoutEndless === 'jlpt_n5') {
      return `endless:${getQuizModeKey('jlpt_n5', DEFAULT_JLPT_READING_MODE)}`;
    }
    return mode;
  }
  if (mode.startsWith('typemaster:')) {
    const parsed = parseTypeMasterModeKey(mode);
    if (!parsed) return mode;
    return getTypeMasterModeKey(parsed.quizModeKey);
  }
  return mode === 'jlpt_n5' ? getQuizModeKey('jlpt_n5', DEFAULT_JLPT_READING_MODE) : mode;
};

const getQuizModeLabel = (mode: string) => {
  // Handle endless mode: "endless:mode" or "endless:mode:jlptReadingMode"
  if (mode.startsWith('endless:')) {
    const withoutEndless = mode.replace('endless:', '');
    const [baseMode, jlptReadingMode] = withoutEndless.split(':');
    const selected = QUIZ_MODES.find(option => option.value === baseMode);
    if (!selected) return `Endless - ${withoutEndless}`;
    if (baseMode !== 'jlpt_n5') return `Endless - ${selected.label}`;
    const selectedJlptMode = JLPT_READING_MODES.find(option => option.value === jlptReadingMode);
    return selectedJlptMode ? `Endless - JLPT N5 - ${selectedJlptMode.label}` : `Endless - ${selected.label}`;
  }

  // Handle typemaster mode: "typemaster:mode" or "typemaster:mode:jlptReadingMode"
  if (mode.startsWith('typemaster:')) {
    const parsed = parseTypeMasterModeKey(mode);
    if (!parsed) return `TypeMaster - ${mode.replace('typemaster:', '')}`;
    const [baseMode, jlptReadingMode] = parsed.quizModeKey.split(':');
    const selected = QUIZ_MODES.find(option => option.value === baseMode);
    const queueLabel = (TYPEMASTER_QUEUE_OPTIONS.find(option => option.value === parsed.queueMode) || TYPEMASTER_QUEUE_OPTIONS[0]).label;
    if (!selected) return `TypeMaster (${queueLabel}) - ${parsed.quizModeKey}`;
    if (baseMode !== 'jlpt_n5') return `TypeMaster (${queueLabel}) - ${selected.label}`;
    const selectedJlptMode = JLPT_READING_MODES.find(option => option.value === jlptReadingMode);
    return selectedJlptMode
      ? `TypeMaster (${queueLabel}) - JLPT N5 - ${selectedJlptMode.label}`
      : `TypeMaster (${queueLabel}) - ${selected.label}`;
  }

  const [baseMode, jlptReadingMode] = mode.split(':');
  const selected = QUIZ_MODES.find(option => option.value === baseMode);
  if (!selected) return mode;
  if (baseMode !== 'jlpt_n5') return selected.label;
  const selectedJlptMode = JLPT_READING_MODES.find(option => option.value === jlptReadingMode);
  return selectedJlptMode ? `JLPT N5 - ${selectedJlptMode.label}` : selected.label;
};

const getJlptAcceptedReadings = (item: any, jlptReadingMode: string) => {
  const normalized = (item.answers || []).map((value: string) => normalizeRomaji(value)).filter(Boolean);
  if (!normalized.length) return [];
  if (jlptReadingMode === 'onyomi_only') {
    return [normalized[0]];
  }
  if (jlptReadingMode === 'kunyomi_only') {
    return normalized.slice(1).length ? normalized.slice(1) : [normalized[0]];
  }
  return normalized;
};

const isJlptEnglishTranslateMode = (jlptReadingMode: string) =>
  JLPT_ENGLISH_TRANSLATE_MODES.includes(jlptReadingMode);
const getJlptAcceptedAnswers = (item: any, jlptReadingMode: string) => {
  if (isJlptEnglishTranslateMode(jlptReadingMode)) {
    return (JLPT_N5_ENGLISH_MEANINGS[item.id] || [])
      .map((value: string) => normalizeRomaji(value))
      .filter(Boolean);
  }
  return getJlptAcceptedReadings(item, jlptReadingMode);
};
const getJlptPromptText = (item: any, jlptReadingMode: string) => {
  if (jlptReadingMode === 'onyomi_only') {
    return item.kana;
  }
  if (jlptReadingMode === 'kunyomi_only') {
    return item.kana;
  }
  if (jlptReadingMode === 'jp_on_kun_kanji') {
    return (item.answers || []).join(' / ');
  }
  return item.kana;
};

const getFinishReasonLabel = (reason: string) => {
  if (reason === 'complete') return 'Complete';
  if (reason === 'time') return 'Time up';
  if (reason === 'stopped') return 'Stopped';
  return 'Complete';
};

const isTypeMasterModeKey = (mode: string) => typeof mode === 'string' && mode.startsWith('typemaster:');

const getLeaderboardFinishReasonLabel = (entry: { mode: string; finishReason?: string }) => {
  const reason = entry.finishReason || 'complete';
  if (isTypeMasterModeKey(entry.mode) && reason === 'time') return 'Complete';
  return getFinishReasonLabel(reason);
};

const getLeaderboardTimeDisplay = (entry: { mode: string; finishReason?: string; timeMs: number }) => {
  const reason = entry.finishReason || 'complete';
  if (isTypeMasterModeKey(entry.mode) && reason === 'time') return 'Complete';
  return formatMilliseconds(entry.timeMs);
};

const getLeaderboardModeDisplayLabel = (entry: { mode: string; typemasterQueueMode?: string }) => {
  const baseLabel = getQuizModeLabel(entry.mode);
  if (!isTypeMasterModeKey(entry.mode)) return baseLabel;
  const queueLabel = (TYPEMASTER_QUEUE_OPTIONS.find(option => option.value === entry.typemasterQueueMode) || TYPEMASTER_QUEUE_OPTIONS[0]).label;
  return `${baseLabel} (${queueLabel})`;
};

const normalizeLeaderboardTimerMinutes = (value: any) => {
  const parsed = Number.parseInt(`${value}`, 10);
  if (Number.isNaN(parsed)) return 5;
  return Math.max(QUIZ_TIMER_MIN_MINUTES, Math.min(QUIZ_TIMER_MAX_MINUTES, parsed));
};

function KanaQuizView() {
  const [quizView, setQuizView] = useState(QUIZ_VIEW_OPTIONS[0].value);
  const [quizMode, setQuizMode] = useState(QUIZ_MODES[0].value);
  const [jlptReadingMode, setJlptReadingMode] = useState(DEFAULT_JLPT_READING_MODE);
  const [isJlptModeDropdownOpen, setIsJlptModeDropdownOpen] = useState(false);
  const [quizFamily, setQuizFamily] = useState(getQuizModeFamily(QUIZ_MODES[0].value));
  const [leaderboardScope, setLeaderboardScope] = useState(LEADERBOARD_SCOPE_OPTIONS[0].value);
  const [leaderboardGameType, setLeaderboardGameType] = useState(LEADERBOARD_GAME_OPTIONS[0].value);
  const [timerMinutes, setTimerMinutes] = useState(1);
  const [customMinutes, setCustomMinutes] = useState('1');
  const [quizItems, setQuizItems] = useState(() => shuffleQuiz(getQuizDataset(QUIZ_MODES[0].value)));
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(() => timerMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const [finishReason, setFinishReason] = useState<'time' | 'complete' | 'stopped' | null>(null);
  const [completionTimeMs, setCompletionTimeMs] = useState<number | null>(null);
  const [isLeaderboardEditMode, setIsLeaderboardEditMode] = useState(false);
  const [lastRecordUpdate, setLastRecordUpdate] = useState<{ mode: string; isNewRecord: boolean; rank: number | null } | null>(null);
  const [leaderboard, setLeaderboard] = useState<Array<{ mode: string; timeMs: number; score: number; total: number; date: number; finishReason: 'complete' | 'time' | 'stopped' }>>([]);
  const [sessionLeaderboard, setSessionLeaderboard] = useState<Array<{ mode: string; timeMs: number; score: number; total: number; date: number; finishReason: 'complete' | 'time' | 'stopped' }>>([]);
  const inputRefs = React.useRef<Record<string, TextInput | null>>({});
  const timerDeadlineMsRef = React.useRef<number | null>(null);
  const remainingSecondsRef = React.useRef(remainingSeconds);

  // Endless mode state
  const [endlessScore, setEndlessScore] = useState(0);
  const [endlessCurrentInput, setEndlessCurrentInput] = useState('');
  const [endlessVisibleChars, setEndlessVisibleChars] = useState<Array<{ id: string; item: any; position: number }>>([]);
  const [endlessIsRunning, setEndlessIsRunning] = useState(false);
  const [endlessHasFinished, setEndlessHasFinished] = useState(false);
  const [endlessShowHints, setEndlessShowHints] = useState(true);
  const endlessQueueRef = React.useRef<CharacterQueue | null>(null);
  const endlessAnimationRef = React.useRef<number | null>(null);
  const endlessInputRef = React.useRef<TextInput | null>(null);

  // TypeMaster mode state
  const [typemasterScore, setTypemasterScore] = useState(0);
  const [typemasterCurrentInput, setTypemasterCurrentInput] = useState('');
  const [typemasterQueue, setTypemasterQueue] = useState<Array<{ id: string; item: any }>>([]);
  const [typemasterQueueMode, setTypemasterQueueMode] = useState(DEFAULT_TYPEMASTER_QUEUE_MODE);
  const [typemasterBurstCursor, setTypemasterBurstCursor] = useState(0);
  const [typemasterIsRunning, setTypemasterIsRunning] = useState(false);
  const [typemasterHasFinished, setTypemasterHasFinished] = useState(false);
  const [typemasterFinishReason, setTypemasterFinishReason] = useState<'time' | 'stopped' | null>(null);
  const [typemasterShowHints, setTypemasterShowHints] = useState(true);
  const typemasterQueueRef = React.useRef<CharacterQueue | null>(null);
  const typemasterInputRef = React.useRef<TextInput | null>(null);

  const isJlptMode = quizMode === 'jlpt_n5';
  const isJlptJapaneseInputMode = isJlptMode && jlptReadingMode === 'jp_on_kun_kanji';
  const isJlptEnglishMode = isJlptMode && isJlptEnglishTranslateMode(jlptReadingMode);
  const shouldShowJlptKanjiInfo = isJlptMode && !isJlptJapaneseInputMode;
  const activeModeKey = getQuizModeKey(quizMode, jlptReadingMode);
  const columnCount = isJlptJapaneseInputMode ? 4 : 5;

  const openJishoWord = useCallback(async (kanji: string) => {
    if (!kanji) return;
    const url = `https://jisho.org/word/${encodeURIComponent(kanji)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open link', 'Could not open Jisho for this kanji.');
    }
  }, []);

  useEffect(() => {
    const family = getQuizModeFamily(quizMode);
    if (family !== quizFamily) {
      setQuizFamily(family);
    }
  }, [quizFamily, quizMode]);

  useEffect(() => {
    if (!isJlptMode) {
      setIsJlptModeDropdownOpen(false);
    }
  }, [isJlptMode]);

  useEffect(() => {
    remainingSecondsRef.current = remainingSeconds;
  }, [remainingSeconds]);


  const focusOrder = useMemo(() => {
    const buckets = Array.from({ length: columnCount }, () => []);
    quizItems.forEach((item, index) => {
      buckets[index % columnCount].push(item.id);
    });
    return buckets.flat();
  }, [columnCount, quizItems]);

  const indexById = useMemo(() => {
    const map: Record<string, number> = {};
    focusOrder.forEach((id, index) => {
      map[id] = index;
    });
    return map;
  }, [focusOrder]);

  const acceptedLookup = useMemo(() => {
    return quizItems.reduce<Record<string, string[]>>((acc, item) => {
      if (isJlptMode) {
        if (isJlptJapaneseInputMode) {
          acc[item.id] = [item.kana];
        } else {
          acc[item.id] = getJlptAcceptedAnswers(item, jlptReadingMode);
        }
      } else {
        acc[item.id] = item.answers.map((value: string) => normalizeRomaji(value));
      }
      return acc;
    }, {});
  }, [isJlptJapaneseInputMode, isJlptMode, jlptReadingMode, quizItems]);

  const isCorrectAnswer = useCallback(
    (id: string, value: string) => {
      const accepted = acceptedLookup[id] || [];
      if (isJlptJapaneseInputMode) {
        const sanitized = sanitizeJapaneseInput(value).trim();
        if (!sanitized || !JAPANESE_INPUT_CHAR_REGEX.test(sanitized)) return false;
        return accepted.includes(sanitized);
      }
      const normalized = normalizeRomaji(value);
      return normalized.length > 0 && accepted.includes(normalized);
    },
    [acceptedLookup, isJlptJapaneseInputMode],
  );

  const compareLeaderboardEntries = useCallback(
    (
      a: { mode: string; timeMs: number; score: number; total: number; date: number; finishReason?: 'complete' | 'time' | 'stopped' },
      b: { mode: string; timeMs: number; score: number; total: number; date: number; finishReason?: 'complete' | 'time' | 'stopped' },
    ) => {
      if (b.score !== a.score) return b.score - a.score;
      const aComplete = (a.finishReason || 'complete') === 'complete' ? 1 : 0;
      const bComplete = (b.finishReason || 'complete') === 'complete' ? 1 : 0;
      if (bComplete !== aComplete) return bComplete - aComplete;
      if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
      return a.date - b.date;
    },
    [],
  );

  const limitLeaderboardPerMode = useCallback(
    (items: Array<{ mode: string; timeMs: number; score: number; total: number; date: number; finishReason?: 'complete' | 'time' | 'stopped'; timerMinutes?: number }>) => {
      const byMode = items.reduce<Record<string, Array<{ mode: string; timeMs: number; score: number; total: number; date: number; finishReason?: 'complete' | 'time' | 'stopped'; timerMinutes?: number }>>>(
        (acc, item) => {
          const rawMode = item?.mode || QUIZ_MODES[0].value;
          const modeKey = normalizeStoredQuizModeKey(rawMode);
          const normalizedTimerMinutes = normalizeLeaderboardTimerMinutes(item?.timerMinutes);
          const bucketKey = `${modeKey}|${normalizedTimerMinutes}`;
          if (!acc[bucketKey]) acc[bucketKey] = [];
          acc[bucketKey].push({ ...item, mode: modeKey, timerMinutes: normalizedTimerMinutes });
          return acc;
        },
        {},
      );
      return Object.values(byMode).flatMap(modeEntries =>
        modeEntries
          .map(entry => ({ ...entry, finishReason: entry.finishReason || 'complete' }))
          .sort(compareLeaderboardEntries)
          .slice(0, 10),
      );
    },
    [compareLeaderboardEntries],
  );

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const stored = await AsyncStorage.getItem(QUIZ_LEADERBOARD_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          const normalized = Array.isArray(parsed) ? limitLeaderboardPerMode(parsed) : [];
          setLeaderboard(normalized);
          await AsyncStorage.setItem(QUIZ_LEADERBOARD_STORAGE_KEY, JSON.stringify(normalized));
        }
      } catch (err) {
        console.error('Failed to load leaderboard:', err);
      }
    };
    loadLeaderboard();
  }, [limitLeaderboardPerMode]);

  const saveLeaderboardEntry = useCallback(async (entry: { mode: string; timeMs: number; score: number; total: number; date: number; finishReason: 'complete' | 'time' | 'stopped'; timerMinutes?: number }) => {
    try {
      const normalizedEntry = {
        ...entry,
        timerMinutes: normalizeLeaderboardTimerMinutes(entry.timerMinutes),
      };
      const todayKey = formatDateKey(new Date());
      setSessionLeaderboard(prev => {
        const sessionToday = prev.filter(item => formatDateKey(new Date(item.date)) === todayKey);
        const perModeTop10 = limitLeaderboardPerMode([...sessionToday, normalizedEntry]);
        return perModeTop10.filter(item => formatDateKey(new Date(item.date)) === todayKey);
      });

      const stored = await AsyncStorage.getItem(QUIZ_LEADERBOARD_STORAGE_KEY);
      const current = stored ? JSON.parse(stored) : [];
      const currentEntries = Array.isArray(current) ? current : [];
      const currentModeEntries = currentEntries
        .filter(item => normalizeStoredQuizModeKey(item?.mode) === normalizedEntry.mode)
        .filter(item => normalizeLeaderboardTimerMinutes(item?.timerMinutes) === normalizedEntry.timerMinutes)
        .map(item => ({ ...item, finishReason: item.finishReason || 'complete', timerMinutes: normalizeLeaderboardTimerMinutes(item?.timerMinutes) }))
        .sort(compareLeaderboardEntries);
      const previousTop = currentModeEntries.length ? currentModeEntries[0] : null;
      const updated = Array.isArray(current) ? [...current, normalizedEntry] : [normalizedEntry];
      const perModeTop10 = limitLeaderboardPerMode(updated);
      await AsyncStorage.setItem(QUIZ_LEADERBOARD_STORAGE_KEY, JSON.stringify(perModeTop10));
      setLeaderboard(perModeTop10);
      const updatedModeEntries = perModeTop10
        .filter(item => item?.mode === normalizedEntry.mode)
        .filter(item => normalizeLeaderboardTimerMinutes(item?.timerMinutes) === normalizedEntry.timerMinutes)
        .map(item => ({ ...item, finishReason: item.finishReason || 'complete', timerMinutes: normalizeLeaderboardTimerMinutes(item?.timerMinutes) }))
        .sort(compareLeaderboardEntries);
      const rankIndex = updatedModeEntries.findIndex(item => item?.date === normalizedEntry.date);
      return {
        isNewRecord: rankIndex === 0 && (!previousTop || previousTop.date !== normalizedEntry.date),
        rank: rankIndex >= 0 ? rankIndex + 1 : null,
      };
    } catch (err) {
      console.error('Failed to save leaderboard entry:', err);
      return null;
    }
  }, [compareLeaderboardEntries, limitLeaderboardPerMode]);

  const getEntryIdentity = useCallback(
    (entry: { mode: string; timeMs: number; score: number; total: number; date: number; finishReason?: 'complete' | 'time' | 'stopped'; timerMinutes?: number; typemasterQueueMode?: string }) =>
      `${entry.mode}|${normalizeLeaderboardTimerMinutes(entry.timerMinutes)}|${entry.typemasterQueueMode || ''}|${entry.date}|${entry.timeMs}|${entry.score}|${entry.total}|${entry.finishReason || 'complete'}`,
    [],
  );

  const deleteLeaderboardEntry = useCallback(
    async (target: { mode: string; timeMs: number; score: number; total: number; date: number; finishReason?: 'complete' | 'time' | 'stopped' }) => {
      const targetKey = getEntryIdentity(target);
      try {
        setLeaderboard(prev => prev.filter(entry => getEntryIdentity(entry) !== targetKey));
        setSessionLeaderboard(prev => prev.filter(entry => getEntryIdentity(entry) !== targetKey));

        const stored = await AsyncStorage.getItem(QUIZ_LEADERBOARD_STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        const entries = Array.isArray(parsed) ? parsed : [];
        const filtered = entries.filter((entry: any) => getEntryIdentity(entry) !== targetKey);
        await AsyncStorage.setItem(QUIZ_LEADERBOARD_STORAGE_KEY, JSON.stringify(filtered));
      } catch (err) {
        console.error('Failed to delete leaderboard entry:', err);
      }
    },
    [getEntryIdentity],
  );

  const requestDeleteLeaderboardEntry = useCallback(
    (entry: { mode: string; timeMs: number; score: number; total: number; date: number; finishReason?: 'complete' | 'time' | 'stopped' }) => {
      const message = `Remove ${formatMilliseconds(entry.timeMs)} (${entry.score}/${entry.total}) from leaderboard?`;
      if (Platform.OS === 'web') {
        const confirmed = typeof window !== 'undefined' ? window.confirm(message) : false;
        if (confirmed) {
          void deleteLeaderboardEntry(entry);
        }
        return;
      }
      Alert.alert(
        'Delete score',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => void deleteLeaderboardEntry(entry) },
        ],
      );
    },
    [deleteLeaderboardEntry],
  );

  const calculateScoreFromAnswers = useCallback(
    (answerMap: Record<string, string>) =>
      quizItems.reduce((sum, item) => {
        const response = answerMap[item.id];
        if (!response) return sum;
        const accepted = acceptedLookup[item.id] || [];
        if (isJlptJapaneseInputMode) {
          const sanitized = sanitizeJapaneseInput(response).trim();
          if (!sanitized || !JAPANESE_INPUT_CHAR_REGEX.test(sanitized)) return sum;
          return accepted.includes(sanitized) ? sum + 1 : sum;
        }
        const normalized = normalizeRomaji(response);
        return accepted.includes(normalized) ? sum + 1 : sum;
      }, 0),
    [acceptedLookup, isJlptJapaneseInputMode, quizItems],
  );

  const finalizeQuiz = useCallback(
    (reason: 'complete' | 'time' | 'stopped', answerMap?: Record<string, string>, remainingMsSnapshot?: number) => {
      if (hasFinished) return;
      const finalAnswers = answerMap || answers;
      const finalScore = calculateScoreFromAnswers(finalAnswers);
      const now = Date.now();
      const timerTotalMs = timerMinutes * 60 * 1000;
      const remainingMs =
        typeof remainingMsSnapshot === 'number'
          ? Math.max(0, remainingMsSnapshot)
          : timerDeadlineMsRef.current
            ? Math.max(0, timerDeadlineMsRef.current - now)
            : Math.max(0, remainingSecondsRef.current * 1000);
      const remainingSecondsAtFinish = Math.ceil(remainingMs / 1000);
      let elapsedMs = Math.max(0, timerTotalMs - remainingMs);
      if (reason === 'time') {
        elapsedMs = timerTotalMs;
      }
      elapsedMs = Math.max(0, Math.min(elapsedMs, timerTotalMs));

      setCompletionTimeMs(elapsedMs);
      setRemainingSeconds(remainingSecondsAtFinish);
      remainingSecondsRef.current = remainingSecondsAtFinish;
      setHasFinished(true);
      setIsRunning(false);
      setFinishReason(reason);
      timerDeadlineMsRef.current = null;

      const entry = {
        mode: activeModeKey,
        timeMs: elapsedMs,
        score: finalScore,
        total: quizItems.length,
        date: now,
        finishReason: reason,
        timerMinutes,
      };
      saveLeaderboardEntry(entry).then(result => {
        if (result) {
          setLastRecordUpdate({ mode: entry.mode, ...result });
        }
      });
    },
    [activeModeKey, answers, calculateScoreFromAnswers, hasFinished, quizItems.length, saveLeaderboardEntry, timerMinutes],
  );

  useEffect(() => {
    if (!isRunning) return;
    const tick = () => {
      const now = Date.now();
      const deadline = timerDeadlineMsRef.current || now;
      const remainingMs = Math.max(0, deadline - now);
      const nextSeconds = Math.ceil(remainingMs / 1000);
      remainingSecondsRef.current = nextSeconds;
      setRemainingSeconds(prev => (prev === nextSeconds ? prev : nextSeconds));
      if (remainingMs <= 0) {
        finalizeQuiz('time', undefined, 0);
      }
    };
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [finalizeQuiz, isRunning]);

  const updateTimerMinutes = (minutes: number) => {
    const normalized = Math.max(QUIZ_TIMER_MIN_MINUTES, Math.min(QUIZ_TIMER_MAX_MINUTES, minutes));
    setTimerMinutes(normalized);
    setCustomMinutes(`${normalized}`);
    if (!isRunning) {
      setRemainingSeconds(normalized * 60);
      remainingSecondsRef.current = normalized * 60;
      timerDeadlineMsRef.current = null;
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
    setLastRecordUpdate(null);
    setRemainingSeconds(timerMinutes * 60);
    remainingSecondsRef.current = timerMinutes * 60;
    setIsRunning(false);
    timerDeadlineMsRef.current = null;
  };

  const resetQuiz = () => {
    setIsRunning(false);
    setQuizItems(shuffleQuiz(getQuizDataset(quizMode)));
    setAnswers({});
    setHasFinished(false);
    setFinishReason(null);
    setCompletionTimeMs(null);
    setLastRecordUpdate(null);
    setRemainingSeconds(timerMinutes * 60);
    remainingSecondsRef.current = timerMinutes * 60;
    timerDeadlineMsRef.current = null;
  };

  const stopQuiz = () => {
    if (hasFinished) return;
    const now = Date.now();
    const remainingMs = timerDeadlineMsRef.current
      ? Math.max(0, timerDeadlineMsRef.current - now)
      : Math.max(0, remainingSecondsRef.current * 1000);
    finalizeQuiz('stopped', undefined, remainingMs);
  };

  // Endless mode functions
  const startEndlessMode = useCallback(() => {
    const dataset = getQuizDataset(quizMode);
    endlessQueueRef.current = new CharacterQueue(dataset);

    // Initialize with 3 characters spread across the screen
    const initialChars = endlessQueueRef.current.getNext(3);
    setEndlessVisibleChars(
      initialChars.map((item, index) => ({
        id: `${item.id}-${Date.now()}-${index}`,
        item,
        position: 100 + (index * 40), // Start off-screen to the right, spaced out
      }))
    );

    setEndlessScore(0);
    setEndlessCurrentInput('');
    setEndlessIsRunning(true);
    setEndlessHasFinished(false);
    setRemainingSeconds(timerMinutes * 60);
    remainingSecondsRef.current = timerMinutes * 60;
    timerDeadlineMsRef.current = Date.now() + timerMinutes * 60 * 1000;

    // Focus input field
    setTimeout(() => {
      if (endlessInputRef.current && typeof endlessInputRef.current.focus === 'function') {
        endlessInputRef.current.focus();
      }
    }, 100);
  }, [quizMode, timerMinutes]);

  const resetEndlessToSetup = useCallback(() => {
    if (endlessAnimationRef.current) {
      cancelAnimationFrame(endlessAnimationRef.current);
      endlessAnimationRef.current = null;
    }
    setEndlessIsRunning(false);
    setEndlessHasFinished(false);
    setEndlessScore(0);
    setEndlessCurrentInput('');
    setEndlessVisibleChars([]);
    setRemainingSeconds(timerMinutes * 60);
    remainingSecondsRef.current = timerMinutes * 60;
    timerDeadlineMsRef.current = null;
  }, [timerMinutes]);

  const stopEndlessMode = useCallback((reason: 'time' | 'stopped' = 'stopped') => {
    if (endlessAnimationRef.current) {
      cancelAnimationFrame(endlessAnimationRef.current);
      endlessAnimationRef.current = null;
    }
    setEndlessIsRunning(false);
    setEndlessHasFinished(true);

    // Save to leaderboard with 'endless' prefix
    const endlessModeKey = `endless:${activeModeKey}`;
    const timerTotalMs = timerMinutes * 60 * 1000;
    const remainingMs = timerDeadlineMsRef.current ? Math.max(0, timerDeadlineMsRef.current - Date.now()) : 0;
    const completionTimeMs = reason === 'time'
      ? timerTotalMs
      : Math.max(0, Math.min(timerTotalMs, timerTotalMs - remainingMs));
    void saveLeaderboardEntry({
      mode: endlessModeKey,
      timeMs: completionTimeMs,
      score: endlessScore,
      total: endlessScore,
      date: Date.now(),
      finishReason: reason,
      timerMinutes,
    });
  }, [activeModeKey, endlessScore, saveLeaderboardEntry, timerMinutes]);

  const handleEndlessInput = useCallback(
    (text: string) => {
      if (!endlessIsRunning) return;

      setEndlessCurrentInput(text);

      // Check answer and update state in a single operation
      setEndlessVisibleChars(prev => {
        if (prev.length === 0) return prev;

        // Get the leftmost character (the one the user should type)
        const targetChar = prev[0];
        const targetItem = targetChar.item;

        // Check if answer is correct
        let isCorrect = false;
        if (isJlptMode) {
          if (isJlptJapaneseInputMode) {
            const sanitized = sanitizeJapaneseInput(text).trim();
            isCorrect = sanitized === targetItem.kana;
          } else {
            const normalized = normalizeRomaji(text);
            const accepted = getJlptAcceptedAnswers(targetItem, jlptReadingMode);
            isCorrect = normalized.length > 0 && accepted.includes(normalized);
          }
        } else {
          const normalized = normalizeRomaji(text);
          const accepted = (targetItem.answers || []).map((ans: string) => normalizeRomaji(ans));
          isCorrect = normalized.length > 0 && accepted.includes(normalized);
        }

        if (isCorrect) {
          // Clear input and increment score
          setEndlessCurrentInput('');
          setEndlessScore(s => s + 1);

          // Get new character from queue
          let newChar = null;
          if (endlessQueueRef.current) {
            const newChars = endlessQueueRef.current.getNext(1);
            if (newChars.length > 0) {
              // Find the rightmost character's position
              const updated = prev.slice(1);
              const rightmostPosition = updated.length > 0
                ? Math.max(...updated.map(c => c.position))
                : 100;

              // Add new character to the right of the rightmost character
              // with some spacing (at least 30 units apart)
              const newPosition = Math.max(100, rightmostPosition + 30);

              newChar = {
                id: `${newChars[0].id}-${Date.now()}`,
                item: newChars[0],
                position: newPosition,
              };
            }
          }

          // Remove first character and add new one
          const updated = prev.slice(1);
          return newChar ? [...updated, newChar] : updated;
        }

        return prev; // No change if answer is incorrect
      });
    },
    [
      endlessIsRunning,
      isJlptMode,
      isJlptJapaneseInputMode,
      jlptReadingMode,
    ]
  );

  // Endless mode animation loop
  useEffect(() => {
    if (!endlessIsRunning) {
      if (endlessAnimationRef.current) {
        cancelAnimationFrame(endlessAnimationRef.current);
        endlessAnimationRef.current = null;
      }
      return;
    }

    let lastTime = Date.now();
    const animate = () => {
      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000; // in seconds
      lastTime = now;

      // Move characters to the left (scroll speed: 20 units per second)
      setEndlessVisibleChars(prev => {
        const updated = prev.map(char => ({
          ...char,
          position: char.position - 20 * deltaTime,
        }));

        // Sort characters by position (leftmost first) to maintain correct order
        const sorted = updated.sort((a, b) => a.position - b.position);

        // Check if the leftmost character has passed the safe zone (failed to answer in time)
        if (sorted.length > 0 && sorted[0].position < -10) {
          // Game over - character reached the left edge
          setTimeout(() => stopEndlessMode('stopped'), 0);
        }

        // Remove characters that have scrolled past the left edge (off screen completely)
        return sorted.filter(char => char.position > -20);
      });

      endlessAnimationRef.current = requestAnimationFrame(animate);
    };

    endlessAnimationRef.current = requestAnimationFrame(animate);

    return () => {
      if (endlessAnimationRef.current) {
        cancelAnimationFrame(endlessAnimationRef.current);
        endlessAnimationRef.current = null;
      }
    };
  }, [endlessIsRunning, stopEndlessMode]);

  // Endless mode timer
  useEffect(() => {
    if (!endlessIsRunning) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const deadlineMs = timerDeadlineMsRef.current;
      if (!deadlineMs) return;

      const remaining = Math.max(0, Math.floor((deadlineMs - now) / 1000));
      setRemainingSeconds(remaining);

      if (remaining === 0) {
        stopEndlessMode('time');
      }
    }, 100);

    return () => clearInterval(interval);
  }, [endlessIsRunning, stopEndlessMode]);

  // TypeMaster mode functions
  const startTypemasterMode = useCallback(() => {
    const dataset = getQuizDataset(quizMode);
    typemasterQueueRef.current = new CharacterQueue(dataset);

    // Initialize with 5 characters in the queue
    const initialChars = typemasterQueueRef.current.getNext(5);
    setTypemasterQueue(
      initialChars.map((item, index) => ({
        id: `${item.id}-${Date.now()}-${index}`,
        item,
      }))
    );

    setTypemasterScore(0);
    setTypemasterCurrentInput('');
    setTypemasterBurstCursor(0);
    setTypemasterIsRunning(true);
    setTypemasterHasFinished(false);
    setTypemasterFinishReason(null);
    setRemainingSeconds(timerMinutes * 60);
    remainingSecondsRef.current = timerMinutes * 60;
    timerDeadlineMsRef.current = Date.now() + timerMinutes * 60 * 1000;

    // Focus input field
    setTimeout(() => {
      if (typemasterInputRef.current && typeof typemasterInputRef.current.focus === 'function') {
        typemasterInputRef.current.focus();
      }
    }, 100);
  }, [quizMode, timerMinutes]);

  const resetTypemasterToSetup = useCallback(() => {
    setTypemasterIsRunning(false);
    setTypemasterHasFinished(false);
    setTypemasterFinishReason(null);
    setTypemasterScore(0);
    setTypemasterCurrentInput('');
    setTypemasterQueue([]);
    setTypemasterBurstCursor(0);
    setRemainingSeconds(timerMinutes * 60);
    remainingSecondsRef.current = timerMinutes * 60;
    timerDeadlineMsRef.current = null;
  }, [timerMinutes]);

  const stopTypemasterMode = useCallback((reason: 'time' | 'stopped' = 'stopped') => {
    setTypemasterIsRunning(false);
    setTypemasterHasFinished(true);
    setTypemasterFinishReason(reason);

    // Save to leaderboard with 'typemaster' prefix
    const typemasterModeKey = getTypeMasterModeKey(activeModeKey);
    const timerTotalMs = timerMinutes * 60 * 1000;
    const remainingMs = timerDeadlineMsRef.current ? Math.max(0, timerDeadlineMsRef.current - Date.now()) : 0;
    const completionTimeMs = reason === 'time'
      ? timerTotalMs
      : Math.max(0, Math.min(timerTotalMs, timerTotalMs - remainingMs));
    void saveLeaderboardEntry({
      mode: typemasterModeKey,
      timeMs: completionTimeMs,
      score: typemasterScore,
      total: typemasterScore,
      date: Date.now(),
      finishReason: reason,
      timerMinutes,
      typemasterQueueMode,
    });
  }, [activeModeKey, typemasterQueueMode, typemasterScore, saveLeaderboardEntry, timerMinutes]);

  const handleTypemasterInput = useCallback(
    (text: string) => {
      if (!typemasterIsRunning) return;

      setTypemasterCurrentInput(text);

      // Check answer and update queue in a single operation
      setTypemasterQueue(prev => {
        if (prev.length === 0) return prev;

        // Get the current character: cursor-based in burst mode, otherwise first in queue.
        const targetIndex = typemasterQueueMode === 'burst'
          ? Math.max(0, Math.min(typemasterBurstCursor, prev.length - 1))
          : 0;
        const targetChar = prev[targetIndex];
        const targetItem = targetChar.item;

        // Check if answer is correct
        let isCorrect = false;
        if (isJlptMode) {
          if (isJlptJapaneseInputMode) {
            const sanitized = sanitizeJapaneseInput(text).trim();
            isCorrect = sanitized === targetItem.kana;
          } else {
            const normalized = normalizeRomaji(text);
            const accepted = getJlptAcceptedAnswers(targetItem, jlptReadingMode);
            isCorrect = normalized.length > 0 && accepted.includes(normalized);
          }
        } else {
          const normalized = normalizeRomaji(text);
          const accepted = (targetItem.answers || []).map((ans: string) => normalizeRomaji(ans));
          isCorrect = normalized.length > 0 && accepted.includes(normalized);
        }

        if (isCorrect) {
          // Clear input and increment score
          setTypemasterCurrentInput('');
          setTypemasterScore(s => s + 1);

          if (typemasterQueueMode === 'burst') {
            const nextCursor = typemasterBurstCursor + 1;
            if (nextCursor < prev.length) {
              setTypemasterBurstCursor(nextCursor);
              return prev;
            }

            if (!typemasterQueueRef.current) return prev;
            const burstBatch = typemasterQueueRef.current.getNext(5);
            setTypemasterBurstCursor(0);
            return burstBatch.map((item, index) => ({
              id: `${item.id}-${Date.now()}-${index}`,
              item,
            }));
          }

          const updated = prev.slice(1);

          let newChar = null;
          if (typemasterQueueRef.current) {
            const newChars = typemasterQueueRef.current.getNext(1);
            if (newChars.length > 0) {
              newChar = {
                id: `${newChars[0].id}-${Date.now()}`,
                item: newChars[0],
              };
            }
          }
          return newChar ? [...updated, newChar] : updated;
        }

        return prev; // No change if answer is incorrect
      });
    },
    [
      typemasterIsRunning,
      typemasterQueueMode,
      typemasterBurstCursor,
      isJlptMode,
      isJlptJapaneseInputMode,
      jlptReadingMode,
    ]
  );

  // TypeMaster mode timer
  useEffect(() => {
    if (!typemasterIsRunning) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const deadlineMs = timerDeadlineMsRef.current;
      if (!deadlineMs) return;

      const remaining = Math.max(0, Math.floor((deadlineMs - now) / 1000));
      setRemainingSeconds(remaining);

      if (remaining === 0) {
        stopTypemasterMode('time');
      }
    }, 100);

    return () => clearInterval(interval);
  }, [typemasterIsRunning, stopTypemasterMode]);

  const score = useMemo(() => calculateScoreFromAnswers(answers), [answers, calculateScoreFromAnswers]);

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
      const nextText = isJlptJapaneseInputMode ? sanitizeJapaneseInput(text) : text;
      if (!isRunning && !hasFinished) {
        const startSeconds = remainingSeconds > 0 ? remainingSeconds : timerMinutes * 60;
        const now = Date.now();
        if (remainingSeconds <= 0) {
          setRemainingSeconds(startSeconds);
          remainingSecondsRef.current = startSeconds;
        }
        timerDeadlineMsRef.current = now + startSeconds * 1000;
        setIsRunning(true);
      }
      setAnswers(prev => {
        const next = { ...prev, [id]: nextText };
        if (!hasFinished && isCorrectAnswer(id, nextText)) {
          focusNextAnswer(id, next);
        }
        if (!hasFinished) {
          const allCorrect = quizItems.every(item => isCorrectAnswer(item.id, next[item.id] || ''));
          if (allCorrect) {
            finalizeQuiz('complete', next);
          }
        }
        return next;
      });
    },
    [finalizeQuiz, focusNextAnswer, hasFinished, isCorrectAnswer, isJlptJapaneseInputMode, isRunning, quizItems, remainingSeconds, timerMinutes],
  );

  const columns = useMemo(() => {
    const buckets = Array.from({ length: columnCount }, () => []);
    quizItems.forEach((item, index) => {
      buckets[index % columnCount].push(item);
    });
    return buckets;
  }, [columnCount, quizItems]);
  const todayKey = formatDateKey(new Date());
  const activeLeaderboardModeKey = leaderboardGameType === 'typemaster'
    ? getTypeMasterModeKey(activeModeKey)
    : activeModeKey;
  const scopeLabel = (LEADERBOARD_SCOPE_OPTIONS.find(option => option.value === leaderboardScope) || LEADERBOARD_SCOPE_OPTIONS[0]).label;
  const activeLeaderboardModeLabel = getQuizModeLabel(activeLeaderboardModeKey);
  const activeLeaderboardSource = leaderboardScope === 'session' ? sessionLeaderboard : leaderboard;
  const activeLeaderboard = useMemo(
    () =>
      activeLeaderboardSource
        .filter(entry => leaderboardScope === 'all_time' || formatDateKey(new Date(entry.date)) === todayKey)
        .filter(entry => entry.mode === activeLeaderboardModeKey)
        .filter(entry => normalizeLeaderboardTimerMinutes(entry.timerMinutes) === timerMinutes)
        .sort(compareLeaderboardEntries)
        .slice(0, 10),
    [activeLeaderboardModeKey, activeLeaderboardSource, compareLeaderboardEntries, leaderboardScope, timerMinutes, todayKey],
  );
  const completedModeLabel = getQuizModeLabel(activeModeKey);
  const typemasterModeKey = getTypeMasterModeKey(activeModeKey);
  const typemasterCompletedModeLabel = getQuizModeLabel(typemasterModeKey);
  const typemasterCompletionTimeMs = Math.max(0, timerMinutes * 60 * 1000 - remainingSeconds * 1000);
  const typemasterCurrentTargetIndex = typemasterQueueMode === 'burst'
    ? Math.max(0, Math.min(typemasterBurstCursor, Math.max(typemasterQueue.length - 1, 0)))
    : 0;
  const typemasterCurrentTarget = typemasterQueue.length > 0 ? typemasterQueue[typemasterCurrentTargetIndex] : null;
  const typemasterHintText = typemasterCurrentTarget
    ? (isJlptMode
      ? getJlptAcceptedAnswers(typemasterCurrentTarget.item, jlptReadingMode).join('/')
      : typemasterCurrentTarget.item.answers.join('/'))
    : 'Start to begin...';
  const activeFamilyModes = getQuizModesForFamily(quizFamily);
  const promptColumnLabel = isJlptJapaneseInputMode ? 'Romaji Reading' : isJlptMode ? 'Kanji' : 'Kana';
  const answerColumnLabel = isJlptJapaneseInputMode
    ? 'Kanji (Japanese input)'
    : isJlptEnglishMode
      ? 'English Translation'
      : isJlptMode
        ? 'Reading'
        : 'English Syllable';
  const answerPlaceholder = isJlptJapaneseInputMode
    ? 'Type kanji ...'
    : isJlptEnglishMode
      ? 'Type meaning...'
      : isJlptMode
        ? 'Type reading...'
        : 'Type...';
  const completedModeLeaderboardSource = leaderboardScope === 'session' ? sessionLeaderboard : leaderboard;
  const completedModeLeaderboard = useMemo(
    () =>
      completedModeLeaderboardSource
        .filter(entry => leaderboardScope === 'all_time' || formatDateKey(new Date(entry.date)) === todayKey)
        .filter(entry => entry.mode === activeModeKey)
        .filter(entry => normalizeLeaderboardTimerMinutes(entry.timerMinutes) === timerMinutes)
        .sort(compareLeaderboardEntries)
        .slice(0, 10),
    [activeModeKey, compareLeaderboardEntries, completedModeLeaderboardSource, leaderboardScope, timerMinutes, todayKey],
  );
  const typemasterCompletedModeLeaderboard = useMemo(
    () =>
      completedModeLeaderboardSource
        .filter(entry => leaderboardScope === 'all_time' || formatDateKey(new Date(entry.date)) === todayKey)
        .filter(entry => entry.mode === typemasterModeKey)
        .filter(entry => normalizeLeaderboardTimerMinutes(entry.timerMinutes) === timerMinutes)
        .sort(compareLeaderboardEntries)
        .slice(0, 10),
    [compareLeaderboardEntries, completedModeLeaderboardSource, leaderboardScope, timerMinutes, todayKey, typemasterModeKey],
  );

  return (
    <ScrollView
      style={styles.quizScroll}
      contentContainerStyle={styles.quizContent}
      onTouchStart={() => {
        if (isJlptModeDropdownOpen) {
          setIsJlptModeDropdownOpen(false);
        }
      }}
    >
      {/* Primary Nav Tabs */}
      <View style={styles.quizNavBar}>
        <View style={styles.quizNavTabs}>
          {QUIZ_VIEW_OPTIONS.map(option => {
            const selected = option.value === quizView;
            return (
              <Pressable
                key={option.value}
                style={[styles.quizNavTab, selected && styles.quizNavTabActive]}
                onPress={() => setQuizView(option.value)}
              >
                <Text style={[styles.quizNavTabText, selected && styles.quizNavTabTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Sub Nav Tabs - Mode and Tab selection */}
      <View style={styles.quizSubNavBar}>
        <View style={styles.quizSubNavSection}>
          <View style={styles.quizSubNavTabs}>
            {QUIZ_FAMILY_OPTIONS.map(option => {
              const selected = option.value === quizFamily;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.quizSubNavTab, selected && styles.quizSubNavTabActive]}
                  onPress={() => {
                    if (isRunning) return;
                    setQuizFamily(option.value);
                    setIsJlptModeDropdownOpen(false);
                    const familyModes = getQuizModesForFamily(option.value);
                    const nextMode = familyModes[0]?.value || QUIZ_MODES[0].value;
                    setQuizMode(nextMode);
                    setAnswers({});
                    setHasFinished(false);
                    setFinishReason(null);
                    setLastRecordUpdate(null);
                    timerDeadlineMsRef.current = null;
                    setQuizItems(shuffleQuiz(getQuizDataset(nextMode)));
                  }}
                >
                  <Text style={[styles.quizSubNavTabText, selected && styles.quizSubNavTabTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.quizSubNavDivider} />
          <View style={styles.quizSubNavTabs}>
            {activeFamilyModes.map(({ value, tabLabel }) => {
              const selected = value === quizMode;
              return (
                <Pressable
                  key={value}
                  style={[styles.quizSubNavTab, selected && styles.quizSubNavTabActive]}
                  onPress={() => {
                    if (isRunning) return;
                    setQuizMode(value);
                    setIsJlptModeDropdownOpen(false);
                    setQuizItems(shuffleQuiz(getQuizDataset(value)));
                    setAnswers({});
                    setHasFinished(false);
                    setFinishReason(null);
                    setLastRecordUpdate(null);
                    timerDeadlineMsRef.current = null;
                  }}
                >
                  <Text style={[styles.quizSubNavTabText, selected && styles.quizSubNavTabTextActive]}>
                    {tabLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {isJlptMode ? (
            <View style={styles.quizDropdownWrap} onTouchStart={(event) => event.stopPropagation()}>
              <Text style={styles.quizDropdownLabel}>JLPT Mode</Text>
              <Pressable
                style={styles.quizDropdownTrigger}
                onPress={() => setIsJlptModeDropdownOpen(prev => !prev)}
              >
                <Text style={styles.quizDropdownTriggerText}>
                  {(JLPT_READING_MODES.find(option => option.value === jlptReadingMode) || JLPT_READING_MODES[0]).label}
                </Text>
                <Text style={styles.quizDropdownTriggerChevron}>{isJlptModeDropdownOpen ? '▲' : '▼'}</Text>
              </Pressable>
              {isJlptModeDropdownOpen ? (
                <View style={styles.quizDropdownMenu}>
                  {JLPT_READING_MODES.map(option => {
                    const selected = option.value === jlptReadingMode;
                    return (
                      <Pressable
                        key={option.value}
                        style={[styles.quizDropdownMenuItem, selected && styles.quizDropdownMenuItemActive]}
                        onPress={() => {
                          if (isRunning) return;
                          setIsJlptModeDropdownOpen(false);
                          setJlptReadingMode(option.value);
                          setAnswers({});
                          setHasFinished(false);
                          setFinishReason(null);
                          setCompletionTimeMs(null);
                          setLastRecordUpdate(null);
                          timerDeadlineMsRef.current = null;
                        }}
                      >
                        <Text style={[styles.quizDropdownMenuItemText, selected && styles.quizDropdownMenuItemTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.quizControlsSection}>
          <View style={styles.quizTimerControl}>
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
              placeholder="1"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.quizTimerUnitLabel}>min</Text>
            <Pressable style={styles.quizTimerStepperButton} onPress={() => adjustCustomMinutes(1)}>
              <Text style={styles.quizTimerStepperLabel}>+</Text>
            </Pressable>
          </View>
          <View style={styles.quizStatBlock}>
            <Text style={styles.quizStatLabel}>
              {quizView === 'endless' || quizView === 'typemaster' ? 'Characters' : 'Score'}
            </Text>
            <Text style={styles.quizStatValue}>
              {quizView === 'endless'
                ? endlessScore
                : quizView === 'typemaster'
                  ? typemasterScore
                  : `${score}/${quizItems.length}`}
            </Text>
          </View>
          <View style={styles.quizStatBlock}>
            <Text style={styles.quizStatLabel}>Timer</Text>
            <Text style={[styles.quizStatValueTimer, (hasFinished || endlessHasFinished || typemasterHasFinished) && styles.quizTimerValueExpired]}>
              {formatTimer(remainingSeconds)}
            </Text>
          </View>
          {quizView === 'typemaster' ? (
            <View style={[styles.quizSubNavTabs, typemasterIsRunning && { opacity: 0.65 }]}>
              {TYPEMASTER_QUEUE_OPTIONS.map(option => {
                const selected = option.value === typemasterQueueMode;
                return (
                  <Pressable
                    key={`typemaster-queue-${option.value}`}
                    style={[styles.quizSubNavTab, selected && styles.quizSubNavTabActive]}
                    onPress={() => {
                      if (typemasterIsRunning) return;
                      setTypemasterQueueMode(option.value);
                    }}
                  >
                    <Text style={[styles.quizSubNavTabText, selected && styles.quizSubNavTabTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <View style={styles.quizActionButtonsRow}>
            {quizView === 'endless' ? (
              <>
                <Pressable style={styles.quizPlayButton} onPress={startEndlessMode}>
                  <Text style={styles.quizPlayButtonLabel}>Play Endless</Text>
                </Pressable>
                <Pressable style={styles.quizStopButton} onPress={() => stopEndlessMode('stopped')}>
                  <Text style={styles.quizStopButtonLabel}>Stop</Text>
                </Pressable>
              </>
            ) : quizView === 'typemaster' ? (
              <>
                <Pressable style={styles.quizPlayButton} onPress={startTypemasterMode}>
                  <Text style={styles.quizPlayButtonLabel}>Play TypeMaster</Text>
                </Pressable>
                <Pressable style={styles.quizStopButton} onPress={() => stopTypemasterMode('stopped')}>
                  <Text style={styles.quizStopButtonLabel}>Stop</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable style={styles.quizPlayButton} onPress={startQuiz}>
                  <Text style={styles.quizPlayButtonLabel}>Play Quiz</Text>
                </Pressable>
                <Pressable style={styles.quizStopButton} onPress={stopQuiz}>
                  <Text style={styles.quizStopButtonLabel}>Stop</Text>
                </Pressable>
                <Pressable style={styles.quizResetButton} onPress={resetQuiz}>
                  <Text style={styles.quizResetButtonLabel}>Reset</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>

      <View style={styles.quizTableRow}>
        {quizView === 'typemaster' ? (
          <View style={styles.quizFinishCard}>
            {typemasterHasFinished ? (
              // TypeMaster mode finish screen
              <View>
                <View style={styles.quizFinishHeader}>
                  <View>
                    <Text style={styles.quizFinishTitle}>TypeMaster Complete</Text>
                    <Text style={styles.quizFinishSubtitle}>
                      {typemasterFinishReason === 'stopped' ? 'TypeMaster stopped early.' : 'TypeMaster run complete.'}
                    </Text>
                  </View>
                  <Pressable style={styles.quizFinishButton} onPress={resetTypemasterToSetup}>
                    <Text style={styles.quizFinishButtonLabel}>Play Again</Text>
                  </Pressable>
                </View>
                <View style={styles.quizFinishContent}>
                  <View style={styles.quizFinishStatsTop}>
                    <View style={styles.quizFinishStatsTopRow}>
                      <View style={[styles.quizFinishStat, styles.quizFinishStatCompact]}>
                        <Text style={styles.quizFinishStatLabel}>Characters Typed</Text>
                        <Text style={styles.quizFinishStatValue}>{typemasterScore}</Text>
                      </View>
                      <View style={[styles.quizFinishStat, styles.quizFinishStatCompact]}>
                        {typemasterFinishReason === 'stopped' ? (
                          <>
                            <Text style={styles.quizFinishStatLabel}>Time Left</Text>
                            <Text style={[styles.quizFinishStatValue, styles.quizTimerValueExpired]}>{formatTimer(remainingSeconds)}</Text>
                          </>
                        ) : (
                          <>
                            <Text style={styles.quizFinishStatLabel}>Complete</Text>
                            <Text style={[styles.quizFinishStatValue, styles.quizRecordNoticeNew]}>Complete</Text>
                          </>
                        )}
                      </View>
                      <View style={[styles.quizFinishStat, styles.quizFinishStatCompact]}>
                        <Text style={styles.quizFinishStatLabel}>Completion Time</Text>
                        <Text style={styles.quizFinishStatValue}>{formatMilliseconds(typemasterCompletionTimeMs)}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.quizFinishLeaderboardPanelWide}>
                    {typemasterCompletedModeLeaderboard.length > 0 ? (
                      <View style={styles.quizLeaderboard}>
                        <View style={styles.quizLeaderboardHeaderRow}>
                          <Text style={styles.quizLeaderboardTitle}>{typemasterCompletedModeLabel} Top 10 ({timerMinutes} min, {scopeLabel})</Text>
                          <View style={styles.quizLeaderboardScopeTabs}>
                            <Pressable
                              style={[styles.quizLeaderboardEditPill, isLeaderboardEditMode && styles.quizLeaderboardEditPillActive]}
                              onPress={() => setIsLeaderboardEditMode(prev => !prev)}
                            >
                              <Text style={[styles.quizLeaderboardEditPillLabel, isLeaderboardEditMode && styles.quizLeaderboardEditPillLabelActive]}>
                                {isLeaderboardEditMode ? 'Done' : 'Edit'}
                              </Text>
                            </Pressable>
                            {LEADERBOARD_SCOPE_OPTIONS.map(option => {
                              const selected = option.value === leaderboardScope;
                              return (
                                <Pressable
                                  key={`typemaster-completed-scope-${option.value}`}
                                  style={[styles.quizLeaderboardScopePill, selected && styles.quizLeaderboardScopePillActive]}
                                  onPress={() => setLeaderboardScope(option.value)}
                                >
                                  <Text style={[styles.quizLeaderboardScopeLabel, selected && styles.quizLeaderboardScopeLabelActive]}>
                                    {option.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                        <View style={styles.quizLeaderboardList}>
                          {typemasterCompletedModeLeaderboard.map((entry, index) => (
                            <View key={`${entry.date}-${index}`} style={styles.quizLeaderboardEntry}>
                              <Text style={styles.quizLeaderboardRank}>#{index + 1}</Text>
                              <Text style={styles.quizLeaderboardMode}>
                                {getLeaderboardModeDisplayLabel(entry)} - {getLeaderboardFinishReasonLabel(entry)}
                              </Text>
                              <Text style={[styles.quizLeaderboardTime, isTypeMasterModeKey(entry.mode) && entry.finishReason === 'stopped' && styles.quizLeaderboardTimeStopped]}>
                                {getLeaderboardTimeDisplay(entry)}
                              </Text>
                              <Text style={styles.quizLeaderboardDate}>{formatLeaderboardDateTime(entry.date)}</Text>
                              <Text style={styles.quizLeaderboardScore}>
                                {entry.score}/{entry.total}
                              </Text>
                              {isLeaderboardEditMode ? (
                                <Pressable
                                  style={styles.quizLeaderboardDeleteButton}
                                  onPress={() => requestDeleteLeaderboardEntry(entry)}
                                >
                                  <Text style={styles.quizLeaderboardDeleteButtonLabel}>Delete</Text>
                                </Pressable>
                              ) : null}
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : (
                      <View style={styles.quizLeaderboard}>
                        <View style={styles.quizLeaderboardHeaderRow}>
                          <Text style={styles.quizLeaderboardTitle}>{typemasterCompletedModeLabel} Top 10 ({timerMinutes} min, {scopeLabel})</Text>
                          <View style={styles.quizLeaderboardScopeTabs}>
                            <Pressable
                              style={[styles.quizLeaderboardEditPill, isLeaderboardEditMode && styles.quizLeaderboardEditPillActive]}
                              onPress={() => setIsLeaderboardEditMode(prev => !prev)}
                            >
                              <Text style={[styles.quizLeaderboardEditPillLabel, isLeaderboardEditMode && styles.quizLeaderboardEditPillLabelActive]}>
                                {isLeaderboardEditMode ? 'Done' : 'Edit'}
                              </Text>
                            </Pressable>
                            {LEADERBOARD_SCOPE_OPTIONS.map(option => {
                              const selected = option.value === leaderboardScope;
                              return (
                                <Pressable
                                  key={`typemaster-completed-empty-scope-${option.value}`}
                                  style={[styles.quizLeaderboardScopePill, selected && styles.quizLeaderboardScopePillActive]}
                                  onPress={() => setLeaderboardScope(option.value)}
                                >
                                  <Text style={[styles.quizLeaderboardScopeLabel, selected && styles.quizLeaderboardScopeLabelActive]}>
                                    {option.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                        <Text style={styles.quizLeaderboardEmpty}>No {scopeLabel.toLowerCase()} scores for this mode.</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ) : (
              // TypeMaster mode game screen
              <View style={{ width: '100%', padding: 20 }}>
                <View style={{ marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: '#e2e8f0', fontSize: 18, fontWeight: '600' }}>
                      Score: {typemasterScore}
                    </Text>
                    <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>
                      Time: {formatTimer(remainingSeconds)}
                    </Text>
                    <Pressable
                      style={{
                        marginTop: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                      onPress={() => setTypemasterShowHints(prev => !prev)}
                    >
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          borderWidth: 2,
                          borderColor: '#64748b',
                          backgroundColor: typemasterShowHints ? '#10b981' : 'transparent',
                          marginRight: 8,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {typemasterShowHints && (
                          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>
                        )}
                      </View>
                      <Text style={{ color: '#94a3b8', fontSize: 14 }}>Show hints</Text>
                    </Pressable>
                  </View>
                  {!typemasterIsRunning && (
                    <Pressable
                      style={{
                        backgroundColor: '#10b981',
                        paddingHorizontal: 24,
                        paddingVertical: 12,
                        borderRadius: 8,
                      }}
                      onPress={startTypemasterMode}
                    >
                      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Start</Text>
                    </Pressable>
                  )}
                  {typemasterIsRunning && (
                    <Pressable
                      style={{
                        backgroundColor: '#ef4444',
                        paddingHorizontal: 24,
                        paddingVertical: 12,
                        borderRadius: 8,
                      }}
                      onPress={() => stopTypemasterMode('stopped')}
                    >
                      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Stop</Text>
                    </Pressable>
                  )}
                </View>

                {/* Queue display - show 5 upcoming characters */}
                <View
                  style={{
                    backgroundColor: '#1e293b',
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 20,
                    borderWidth: 2,
                    borderColor: '#334155',
                  }}
                >
                  <Text style={{ color: '#94a3b8', fontSize: 14, marginBottom: 12, textAlign: 'center' }}>
                    Upcoming Characters
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
                    {typemasterQueue.map((char, index) => (
                      (() => {
                        const isBurst = typemasterQueueMode === 'burst';
                        const isCurrent = isBurst ? index === typemasterBurstCursor : index === 0;
                        const isTyped = isBurst && index < typemasterBurstCursor;
                        const charColor = isTyped ? '#64748b' : '#ffffff';
                        return (
                      <View
                        key={char.id}
                        style={{
                          alignItems: 'center',
                          minHeight: 86,
                          justifyContent: 'flex-start',
                        }}
                      >
                        <View
                          style={{
                            alignItems: 'center',
                            padding: 12,
                            borderRadius: 8,
                            backgroundColor: '#1e293b',
                            borderWidth: 2,
                            borderColor: '#475569',
                            minWidth: 80,
                            position: 'relative',
                          }}
                        >
                          {shouldShowJlptKanjiInfo ? (
                            <Pressable
                              onPress={() => openJishoWord(char.item.kana)}
                              style={styles.quizKanjiInfoButton}
                              hitSlop={6}
                            >
                              <Text style={styles.quizKanjiInfoLabel}>i</Text>
                            </Pressable>
                          ) : null}
                          <Text
                            style={{
                              color: charColor,
                              fontSize: 32,
                              fontWeight: '700',
                              marginBottom: 4,
                            }}
                          >
                            {isJlptMode ? getJlptPromptText(char.item, jlptReadingMode) : char.item.kana}
                          </Text>
                        </View>
                        <View
                          style={{
                            width: 34,
                            height: 3,
                            borderRadius: 2,
                            backgroundColor: '#86efac',
                            marginTop: 6,
                            opacity: isCurrent ? 1 : 0,
                          }}
                        />
                      </View>
                        );
                      })()
                    ))}
                  </View>

                  {!typemasterIsRunning && typemasterQueue.length === 0 && (
                    <Text style={{ color: '#94a3b8', fontSize: 16, textAlign: 'center', paddingVertical: 40 }}>
                      Press Start to begin!
                    </Text>
                  )}
                </View>

                {/* Input field */}
                <View>
                  {typemasterShowHints && (
                    <Text style={{ color: '#94a3b8', fontSize: 14, marginBottom: 8 }}>
                      Type here:
                    </Text>
                  )}
                  <TextInput
                    ref={typemasterInputRef}
                    style={{
                      backgroundColor: '#1e293b',
                      color: '#e2e8f0',
                      fontSize: 24,
                      padding: 16,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor: '#334155',
                      textAlign: 'center',
                      fontWeight: '600',
                    }}
                    value={typemasterCurrentInput}
                    onChangeText={handleTypemasterInput}
                    editable={typemasterIsRunning}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={typemasterShowHints ? `Type: ${typemasterHintText}` : ''}
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>
            )}
          </View>
        ) : quizView === 'endless' ? (
          <View style={styles.quizFinishCard}>
            {endlessHasFinished ? (
              // Endless mode finish screen
              <View>
                <View style={styles.quizFinishHeader}>
                  <View>
                    <Text style={styles.quizFinishTitle}>Endless Mode Complete</Text>
                    <Text style={styles.quizFinishSubtitle}>Time's up!</Text>
                  </View>
                  <Pressable style={styles.quizFinishButton} onPress={resetEndlessToSetup}>
                    <Text style={styles.quizFinishButtonLabel}>Play Again</Text>
                  </Pressable>
                </View>
                <View style={styles.quizFinishContent}>
                  <View style={styles.quizFinishStatsTop}>
                    <View style={styles.quizFinishStatsTopRow}>
                      <View style={[styles.quizFinishStat, styles.quizFinishStatCompact]}>
                        <Text style={styles.quizFinishStatLabel}>Characters Typed</Text>
                        <Text style={styles.quizFinishStatValue}>{endlessScore}</Text>
                      </View>
                      <View style={[styles.quizFinishStat, styles.quizFinishStatCompact]}>
                        <Text style={styles.quizFinishStatLabel}>Time</Text>
                        <Text style={styles.quizFinishStatValue}>{timerMinutes} min</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              // Endless mode game screen
              <View style={{ width: '100%', padding: 20 }}>
                <View style={{ marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: '#e2e8f0', fontSize: 18, fontWeight: '600' }}>
                      Score: {endlessScore}
                    </Text>
                    <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>
                      Time: {formatTimer(remainingSeconds)}
                    </Text>
                    <Pressable
                      style={{
                        marginTop: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                      onPress={() => setEndlessShowHints(prev => !prev)}
                    >
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          borderWidth: 2,
                          borderColor: '#64748b',
                          backgroundColor: endlessShowHints ? '#10b981' : 'transparent',
                          marginRight: 8,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {endlessShowHints && (
                          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>
                        )}
                      </View>
                      <Text style={{ color: '#94a3b8', fontSize: 14 }}>Show hints</Text>
                    </Pressable>
                  </View>
                  {!endlessIsRunning && (
                    <Pressable
                      style={{
                        backgroundColor: '#10b981',
                        paddingHorizontal: 24,
                        paddingVertical: 12,
                        borderRadius: 8,
                      }}
                      onPress={startEndlessMode}
                    >
                      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Start</Text>
                    </Pressable>
                  )}
                  {endlessIsRunning && (
                    <Pressable
                      style={{
                        backgroundColor: '#ef4444',
                        paddingHorizontal: 24,
                        paddingVertical: 12,
                        borderRadius: 8,
                      }}
                      onPress={() => stopEndlessMode('stopped')}
                    >
                      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Stop</Text>
                    </Pressable>
                  )}
                </View>

                {/* Scrolling area */}
                <View
                  style={{
                    height: 200,
                    backgroundColor: '#1e293b',
                    borderRadius: 12,
                    position: 'relative',
                    overflow: 'hidden',
                    marginBottom: 20,
                    borderWidth: 2,
                    borderColor: '#334155',
                  }}
                >
                  {/* Danger zone indicator (left edge) */}
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 60,
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      borderRightWidth: 2,
                      borderRightColor: '#ef4444',
                    }}
                  />

                  {/* Scrolling characters */}
                  {endlessVisibleChars.map(char => (
                    <View
                      key={char.id}
                      style={{
                        position: 'absolute',
                        left: `${char.position}%`,
                        top: '50%',
                        transform: [{ translateY: -40 }],
                      }}
                    >
                      <Text
                        style={{
                          color: '#e2e8f0',
                          fontSize: isJlptJapaneseInputMode ? 48 : 64,
                          fontWeight: '700',
                          textShadowColor: 'rgba(0, 0, 0, 0.5)',
                          textShadowOffset: { width: 2, height: 2 },
                          textShadowRadius: 4,
                        }}
                      >
                        {isJlptMode ? getJlptPromptText(char.item, jlptReadingMode) : char.item.kana}
                      </Text>
                    </View>
                  ))}

                  {/* Instructions overlay when not running */}
                  {!endlessIsRunning && endlessVisibleChars.length === 0 && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#94a3b8', fontSize: 18, textAlign: 'center' }}>
                        Press Start to begin!
                      </Text>
                      <Text style={{ color: '#64748b', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
                        Type characters before they reach the red zone
                      </Text>
                    </View>
                  )}
                </View>

                {/* Input field */}
                <View>
                  {endlessShowHints && (
                    <Text style={{ color: '#94a3b8', fontSize: 14, marginBottom: 8 }}>
                      Type here:
                    </Text>
                  )}
                  <TextInput
                    ref={endlessInputRef}
                    style={{
                      backgroundColor: '#1e293b',
                      color: '#e2e8f0',
                      fontSize: 24,
                      padding: 16,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor: '#334155',
                      textAlign: 'center',
                      fontWeight: '600',
                    }}
                    value={endlessCurrentInput}
                    onChangeText={handleEndlessInput}
                    editable={endlessIsRunning}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder={
                      endlessShowHints
                        ? (endlessVisibleChars.length > 0
                          ? `Type: ${isJlptMode
                              ? getJlptAcceptedAnswers(endlessVisibleChars[0].item, jlptReadingMode).join('/')
                              : endlessVisibleChars[0].item.answers.join('/')}`
                          : 'Start to begin...')
                        : ''
                    }
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>
            )}
          </View>
        ) : quizView === 'leaderboard' ? (
          <View style={styles.quizFinishCard}>
            <View style={styles.quizFinishHeader}>
              <View>
                <Text style={styles.quizFinishTitle}>Leaderboard</Text>
                <Text style={styles.quizFinishSubtitle}>Browse best times by gamemode.</Text>
              </View>
            </View>

            <View style={styles.quizFinishLeaderboardPanel}>
              {activeLeaderboard.length > 0 ? (
                <View style={styles.quizLeaderboard}>
                  <View style={styles.quizLeaderboardHeaderRow}>
                    <Text style={styles.quizLeaderboardTitle}>{activeLeaderboardModeLabel} Top 10 ({timerMinutes} min, {scopeLabel})</Text>
                    <View style={styles.quizLeaderboardScopeTabs}>
                      {LEADERBOARD_GAME_OPTIONS.map(option => {
                        const selected = option.value === leaderboardGameType;
                        return (
                          <Pressable
                            key={`leaderboard-game-${option.value}`}
                            style={[styles.quizLeaderboardScopePill, selected && styles.quizLeaderboardScopePillActive]}
                            onPress={() => setLeaderboardGameType(option.value)}
                          >
                            <Text style={[styles.quizLeaderboardScopeLabel, selected && styles.quizLeaderboardScopeLabelActive]}>
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                      <Pressable
                        style={[styles.quizLeaderboardEditPill, isLeaderboardEditMode && styles.quizLeaderboardEditPillActive]}
                        onPress={() => setIsLeaderboardEditMode(prev => !prev)}
                      >
                        <Text style={[styles.quizLeaderboardEditPillLabel, isLeaderboardEditMode && styles.quizLeaderboardEditPillLabelActive]}>
                          {isLeaderboardEditMode ? 'Done' : 'Edit'}
                        </Text>
                      </Pressable>
                      {LEADERBOARD_SCOPE_OPTIONS.map(option => {
                        const selected = option.value === leaderboardScope;
                        return (
                          <Pressable
                            key={`leaderboard-scope-${option.value}`}
                            style={[styles.quizLeaderboardScopePill, selected && styles.quizLeaderboardScopePillActive]}
                            onPress={() => setLeaderboardScope(option.value)}
                          >
                            <Text style={[styles.quizLeaderboardScopeLabel, selected && styles.quizLeaderboardScopeLabelActive]}>
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <View style={styles.quizLeaderboardList}>
                    {activeLeaderboard.map((entry, index) => (
                      <View key={`${entry.date}-${index}`} style={styles.quizLeaderboardEntry}>
                        <Text style={styles.quizLeaderboardRank}>#{index + 1}</Text>
                        <Text style={styles.quizLeaderboardMode}>
                          {getLeaderboardModeDisplayLabel(entry)} - {getLeaderboardFinishReasonLabel(entry)}
                        </Text>
                        <Text style={[styles.quizLeaderboardTime, isTypeMasterModeKey(entry.mode) && entry.finishReason === 'stopped' && styles.quizLeaderboardTimeStopped]}>
                          {getLeaderboardTimeDisplay(entry)}
                        </Text>
                        <Text style={styles.quizLeaderboardDate}>{formatLeaderboardDateTime(entry.date)}</Text>
                        <Text style={styles.quizLeaderboardScore}>
                          {entry.score}/{entry.total}
                        </Text>
                        {isLeaderboardEditMode ? (
                          <Pressable
                            style={styles.quizLeaderboardDeleteButton}
                            onPress={() => requestDeleteLeaderboardEntry(entry)}
                          >
                            <Text style={styles.quizLeaderboardDeleteButtonLabel}>Delete</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.quizLeaderboard}>
                  <View style={styles.quizLeaderboardHeaderRow}>
                    <Text style={styles.quizLeaderboardTitle}>{activeLeaderboardModeLabel} Top 10 ({timerMinutes} min, {scopeLabel})</Text>
                    <View style={styles.quizLeaderboardScopeTabs}>
                      {LEADERBOARD_GAME_OPTIONS.map(option => {
                        const selected = option.value === leaderboardGameType;
                        return (
                          <Pressable
                            key={`leaderboard-game-${option.value}`}
                            style={[styles.quizLeaderboardScopePill, selected && styles.quizLeaderboardScopePillActive]}
                            onPress={() => setLeaderboardGameType(option.value)}
                          >
                            <Text style={[styles.quizLeaderboardScopeLabel, selected && styles.quizLeaderboardScopeLabelActive]}>
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                      <Pressable
                        style={[styles.quizLeaderboardEditPill, isLeaderboardEditMode && styles.quizLeaderboardEditPillActive]}
                        onPress={() => setIsLeaderboardEditMode(prev => !prev)}
                      >
                        <Text style={[styles.quizLeaderboardEditPillLabel, isLeaderboardEditMode && styles.quizLeaderboardEditPillLabelActive]}>
                          {isLeaderboardEditMode ? 'Done' : 'Edit'}
                        </Text>
                      </Pressable>
                      {LEADERBOARD_SCOPE_OPTIONS.map(option => {
                        const selected = option.value === leaderboardScope;
                        return (
                          <Pressable
                            key={`leaderboard-scope-${option.value}`}
                            style={[styles.quizLeaderboardScopePill, selected && styles.quizLeaderboardScopePillActive]}
                            onPress={() => setLeaderboardScope(option.value)}
                          >
                            <Text style={[styles.quizLeaderboardScopeLabel, selected && styles.quizLeaderboardScopeLabelActive]}>
                              {option.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <Text style={styles.quizLeaderboardEmpty}>No {scopeLabel.toLowerCase()} scores for this mode.</Text>
                </View>
              )}
            </View>
          </View>
        ) : hasFinished ? (
          <View style={styles.quizFinishCard}>
            <View style={styles.quizFinishHeader}>
              <View>
                <Text style={styles.quizFinishTitle}>Quiz Complete</Text>
                <Text style={styles.quizFinishSubtitle}>
                  {finishReason === 'time'
                    ? 'Time is up.'
                    : finishReason === 'stopped'
                      ? 'Quiz stopped early.'
                      : 'All answers correct.'}
                </Text>
                {finishReason === 'complete' && lastRecordUpdate && lastRecordUpdate.mode === activeModeKey ? (
                  <Text style={[styles.quizRecordNotice, lastRecordUpdate.isNewRecord && styles.quizRecordNoticeNew]}>
                    {lastRecordUpdate.isNewRecord
                      ? `New ${completedModeLabel} record!`
                      : lastRecordUpdate.rank
                        ? `Placed #${lastRecordUpdate.rank} on ${completedModeLabel} leaderboard.`
                        : `Completed ${completedModeLabel} run saved.`}
                  </Text>
                ) : null}
              </View>
              <Pressable style={styles.quizFinishButton} onPress={startQuiz}>
                <Text style={styles.quizFinishButtonLabel}>Play Again</Text>
              </Pressable>
            </View>

            <View style={styles.quizFinishContent}>
              <View style={styles.quizFinishStatsTop}>
                <View style={styles.quizFinishStatsTopRow}>
                  <View style={[styles.quizFinishStat, styles.quizFinishStatCompact]}>
                    <Text style={styles.quizFinishStatLabel}>Score</Text>
                    <Text style={styles.quizFinishStatValue}>
                      {score}/{quizItems.length}
                    </Text>
                  </View>
                  <View style={[styles.quizFinishStat, styles.quizFinishStatCompact]}>
                    {finishReason === 'stopped' ? (
                      <>
                        <Text style={styles.quizFinishStatLabel}>Time Left</Text>
                        <Text style={[styles.quizFinishStatValue, styles.quizTimerValueExpired]}>{formatTimer(remainingSeconds)}</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.quizFinishStatLabel}>Status</Text>
                        <Text style={[styles.quizFinishStatValue, styles.quizRecordNoticeNew]}>Complete</Text>
                      </>
                    )}
                  </View>
                  {completionTimeMs !== null && finishReason === 'complete' ? (
                    <View style={[styles.quizFinishStat, styles.quizFinishStatCompact]}>
                      <Text style={styles.quizFinishStatLabel}>Completion Time</Text>
                      <Text style={styles.quizFinishStatValue}>{formatMilliseconds(completionTimeMs)}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.quizFinishLeaderboardPanelWide}>
                {completedModeLeaderboard.length > 0 ? (
                  <View style={styles.quizLeaderboard}>
                    <View style={styles.quizLeaderboardHeaderRow}>
                      <Text style={styles.quizLeaderboardTitle}>{completedModeLabel} Top 10 ({timerMinutes} min, {scopeLabel})</Text>
                      <View style={styles.quizLeaderboardScopeTabs}>
                        <Pressable
                          style={[styles.quizLeaderboardEditPill, isLeaderboardEditMode && styles.quizLeaderboardEditPillActive]}
                          onPress={() => setIsLeaderboardEditMode(prev => !prev)}
                        >
                          <Text style={[styles.quizLeaderboardEditPillLabel, isLeaderboardEditMode && styles.quizLeaderboardEditPillLabelActive]}>
                            {isLeaderboardEditMode ? 'Done' : 'Edit'}
                          </Text>
                        </Pressable>
                        {LEADERBOARD_SCOPE_OPTIONS.map(option => {
                          const selected = option.value === leaderboardScope;
                          return (
                            <Pressable
                              key={`completed-scope-${option.value}`}
                              style={[styles.quizLeaderboardScopePill, selected && styles.quizLeaderboardScopePillActive]}
                              onPress={() => setLeaderboardScope(option.value)}
                            >
                              <Text style={[styles.quizLeaderboardScopeLabel, selected && styles.quizLeaderboardScopeLabelActive]}>
                                {option.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    <View style={styles.quizLeaderboardList}>
                      {completedModeLeaderboard.map((entry, index) => (
                        <View key={`${entry.date}-${index}`} style={styles.quizLeaderboardEntry}>
                          <Text style={styles.quizLeaderboardRank}>#{index + 1}</Text>
                          <Text style={styles.quizLeaderboardMode}>
                            {getLeaderboardModeDisplayLabel(entry)} - {getLeaderboardFinishReasonLabel(entry)}
                          </Text>
                          <Text style={[styles.quizLeaderboardTime, isTypeMasterModeKey(entry.mode) && entry.finishReason === 'stopped' && styles.quizLeaderboardTimeStopped]}>
                            {getLeaderboardTimeDisplay(entry)}
                          </Text>
                          <Text style={styles.quizLeaderboardDate}>{formatLeaderboardDateTime(entry.date)}</Text>
                          <Text style={styles.quizLeaderboardScore}>
                            {entry.score}/{entry.total}
                          </Text>
                          {isLeaderboardEditMode ? (
                            <Pressable
                              style={styles.quizLeaderboardDeleteButton}
                              onPress={() => requestDeleteLeaderboardEntry(entry)}
                            >
                              <Text style={styles.quizLeaderboardDeleteButtonLabel}>Delete</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={styles.quizLeaderboard}>
                    <View style={styles.quizLeaderboardHeaderRow}>
                      <Text style={styles.quizLeaderboardTitle}>{completedModeLabel} Top 10 ({timerMinutes} min, {scopeLabel})</Text>
                      <View style={styles.quizLeaderboardScopeTabs}>
                        <Pressable
                          style={[styles.quizLeaderboardEditPill, isLeaderboardEditMode && styles.quizLeaderboardEditPillActive]}
                          onPress={() => setIsLeaderboardEditMode(prev => !prev)}
                        >
                          <Text style={[styles.quizLeaderboardEditPillLabel, isLeaderboardEditMode && styles.quizLeaderboardEditPillLabelActive]}>
                            {isLeaderboardEditMode ? 'Done' : 'Edit'}
                          </Text>
                        </Pressable>
                        {LEADERBOARD_SCOPE_OPTIONS.map(option => {
                          const selected = option.value === leaderboardScope;
                          return (
                            <Pressable
                              key={`completed-scope-${option.value}`}
                              style={[styles.quizLeaderboardScopePill, selected && styles.quizLeaderboardScopePillActive]}
                              onPress={() => setLeaderboardScope(option.value)}
                            >
                              <Text style={[styles.quizLeaderboardScopeLabel, selected && styles.quizLeaderboardScopeLabelActive]}>
                                {option.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    <Text style={styles.quizLeaderboardEmpty}>No {scopeLabel.toLowerCase()} scores for this mode.</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ) : (
          columns.map((column, columnIndex) => (
            <View key={`quiz-column-${columnIndex}`} style={styles.quizTable}>
              <View style={styles.quizTableHeader}>
                <Text style={styles.quizTableHeaderLabel}>{promptColumnLabel}</Text>
                <Text style={styles.quizTableHeaderLabel}>{answerColumnLabel}</Text>
              </View>
              <View style={styles.quizTableBody}>
                {column.map(item => (
                  <View key={item.id} style={styles.quizTableRowItem}>
                    <View style={[styles.quizKanaCell, isJlptJapaneseInputMode && styles.quizKanaCellWide]}>
                      <View
                        style={[
                          styles.quizKanaCellContent,
                          isJlptJapaneseInputMode ? { alignItems: 'flex-start' } : null,
                        ]}
                      >
                        {shouldShowJlptKanjiInfo ? (
                          <Pressable
                            onPress={() => openJishoWord(item.kana)}
                            style={styles.quizKanjiInfoButton}
                            hitSlop={6}
                          >
                            <Text style={styles.quizKanjiInfoLabel}>i</Text>
                          </Pressable>
                        ) : null}
                        <Text style={[styles.quizKanaText, isJlptJapaneseInputMode && styles.quizKanaTextWide]}>
                          {isJlptMode ? getJlptPromptText(item, jlptReadingMode) : item.kana}
                        </Text>
                      </View>
                    </View>
                    <TextInput
                      ref={ref => {
                        inputRefs.current[item.id] = ref;
                      }}
                      style={[
                        styles.quizAnswerInput,
                        (answers[item.id] || '').length > 0 &&
                        !isCorrectAnswer(item.id, answers[item.id] || '')
                          ? styles.quizAnswerInputIncorrect
                          : null,
                      ]}
                      value={answers[item.id] || ''}
                      editable={!hasFinished}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={isJlptJapaneseInputMode ? 2 : 40}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => focusNextAnswer(item.id, answers)}
                      onChangeText={text => handleAnswerChange(item.id, text)}
                      placeholder={answerPlaceholder}
                      placeholderTextColor="#64748b"
                    />
                  </View>
                ))}
              </View>
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

