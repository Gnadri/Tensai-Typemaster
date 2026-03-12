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
const QUIZ_LEADERBOARD_SCORES_ENABLED_STORAGE_KEY = 'tensai-note.quiz-leaderboard-scores-enabled.v1';
const QUIZ_SCORE_MODE_STORAGE_KEY = 'tensai-note.quiz-score-mode.v1';
const QUIZ_ENG_MODE_ENABLED_STORAGE_KEY = 'tensai-note.quiz-eng-mode-enabled.v1';
const QUIZ_FOCUS_STORAGE_KEY = 'tensai-note.quiz-focus.v1';
const QUIZ_LEADERBOARD_SNAPSHOTS_STORAGE_KEY = 'tensai-note.quiz-leaderboard-snapshots.v1';
const QUIZ_FOCUS_SNAPSHOTS_STORAGE_KEY = 'tensai-note.quiz-focus-snapshots.v1';
const QUIZ_ACTIVE_FOCUS_SNAPSHOT_STORAGE_KEY = 'tensai-note.quiz-active-focus-snapshot.v1';
const QUIZ_LEADERBOARD_EXPORT_EVENT = 'tensai:leaderboard-export';
const QUIZ_LEADERBOARD_IMPORT_EVENT = 'tensai:leaderboard-import';
const QUIZ_SAVE_MANAGER_OPEN_EVENT = 'tensai:save-manager-open';
const SAVE_STATES_FILE_EXTENSION = '.tensai-saves.json';
const FOCUS_SAVE_STATES_FILE_EXTENSION = '.tensai-focus-saves.json';

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
type QuizScoreMode = 'off' | 'speedrun_points' | 'study_points';

const QUIZ_TIMER_MIN_MINUTES = 1;
const QUIZ_TIMER_MAX_MINUTES = 30;
const SPEEDRUN_SCORE_MAX = 1_000_000_000;
const SPEEDRUN_SCORE_INPUT_CHARS_PER_WORD = 5;
const SPEEDRUN_SCORE_SPEED_ANCHOR_WPM = 70;
const SPEEDRUN_SCORE_SPEED_SHAPE_K = 11;
const SPEEDRUN_SCORE_TIMER_WEIGHT = 1.2;
const SPEEDRUN_SCORE_TIMER_CURVE = 0.7;
const SPEEDRUN_SCORE_BACKSPACE_PENALTY_POINTS = 1000;
const STUDY_SCORE_MAX = 10_000_000;
const STUDY_SCORE_INPUT_CHARS_PER_WORD = 5;
const STUDY_SCORE_BACKSPACE_PENALTY_POINTS = 15000;
const STUDY_SCORE_COMPLETION_LINEAR_WEIGHT = 0.35;
const STUDY_SCORE_COMPLETION_FINISH_WEIGHT = 0.55;
const STUDY_SCORE_COMPLETION_FINISH_POWER = 4.0;
const STUDY_SCORE_SPEED_ANCHOR_WPM = 60;
const STUDY_SCORE_SPEED_BONUS_MAX = 0.1;

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

const HIRAGANA_DAKUTEN_HANDAKUTEN_QUIZ = [
  { id: 'ga', kana: 'ãŒ', answers: ['ga'] },
  { id: 'gi', kana: 'ãŽ', answers: ['gi'] },
  { id: 'gu', kana: 'ã', answers: ['gu'] },
  { id: 'ge', kana: 'ã’', answers: ['ge'] },
  { id: 'go', kana: 'ã”', answers: ['go'] },
  { id: 'za', kana: 'ã–', answers: ['za'] },
  { id: 'ji', kana: 'ã˜', answers: ['ji', 'zi'] },
  { id: 'zu', kana: 'ãš', answers: ['zu'] },
  { id: 'ze', kana: 'ãœ', answers: ['ze'] },
  { id: 'zo', kana: 'ãž', answers: ['zo'] },
  { id: 'da', kana: 'ã ', answers: ['da'] },
  { id: 'di', kana: 'ã¢', answers: ['ji', 'di'] },
  { id: 'du', kana: 'ã¥', answers: ['zu', 'du'] },
  { id: 'de', kana: 'ã§', answers: ['de'] },
  { id: 'do', kana: 'ã©', answers: ['do'] },
  { id: 'ba', kana: 'ã°', answers: ['ba'] },
  { id: 'bi', kana: 'ã³', answers: ['bi'] },
  { id: 'bu', kana: 'ã¶', answers: ['bu'] },
  { id: 'be', kana: 'ã¹', answers: ['be'] },
  { id: 'bo', kana: 'ã¼', answers: ['bo'] },
  { id: 'pa', kana: 'ã±', answers: ['pa'] },
  { id: 'pi', kana: 'ã´', answers: ['pi'] },
  { id: 'pu', kana: 'ã·', answers: ['pu'] },
  { id: 'pe', kana: 'ãº', answers: ['pe'] },
  { id: 'po', kana: 'ã½', answers: ['po'] },
];

const KATAKANA_DAKUTEN_HANDAKUTEN_QUIZ = [
  { id: 'ga', kana: 'ã‚¬', answers: ['ga'] },
  { id: 'gi', kana: 'ã‚®', answers: ['gi'] },
  { id: 'gu', kana: 'ã‚°', answers: ['gu'] },
  { id: 'ge', kana: 'ã‚²', answers: ['ge'] },
  { id: 'go', kana: 'ã‚´', answers: ['go'] },
  { id: 'za', kana: 'ã‚¶', answers: ['za'] },
  { id: 'ji', kana: 'ã‚¸', answers: ['ji', 'zi'] },
  { id: 'zu', kana: 'ã‚º', answers: ['zu'] },
  { id: 'ze', kana: 'ã‚¼', answers: ['ze'] },
  { id: 'zo', kana: 'ã‚¾', answers: ['zo'] },
  { id: 'da', kana: 'ãƒ€', answers: ['da'] },
  { id: 'di', kana: 'ãƒ‚', answers: ['ji', 'di'] },
  { id: 'du', kana: 'ãƒ…', answers: ['zu', 'du'] },
  { id: 'de', kana: 'ãƒ‡', answers: ['de'] },
  { id: 'do', kana: 'ãƒ‰', answers: ['do'] },
  { id: 'ba', kana: 'ãƒ', answers: ['ba'] },
  { id: 'bi', kana: 'ãƒ“', answers: ['bi'] },
  { id: 'bu', kana: 'ãƒ–', answers: ['bu'] },
  { id: 'be', kana: 'ãƒ™', answers: ['be'] },
  { id: 'bo', kana: 'ãƒœ', answers: ['bo'] },
  { id: 'pa', kana: 'ãƒ‘', answers: ['pa'] },
  { id: 'pi', kana: 'ãƒ”', answers: ['pi'] },
  { id: 'pu', kana: 'ãƒ—', answers: ['pu'] },
  { id: 'pe', kana: 'ãƒš', answers: ['pe'] },
  { id: 'po', kana: 'ãƒ', answers: ['po'] },
];

const HIRAGANA_DAKUTEN_HANDAKUTEN_CLEAN_QUIZ = [
  { id: 'ga', kana: 'が', answers: ['ga'] },
  { id: 'gi', kana: 'ぎ', answers: ['gi'] },
  { id: 'gu', kana: 'ぐ', answers: ['gu'] },
  { id: 'ge', kana: 'げ', answers: ['ge'] },
  { id: 'go', kana: 'ご', answers: ['go'] },
  { id: 'za', kana: 'ざ', answers: ['za'] },
  { id: 'ji', kana: 'じ', answers: ['ji', 'zi'] },
  { id: 'zu', kana: 'ず', answers: ['zu'] },
  { id: 'ze', kana: 'ぜ', answers: ['ze'] },
  { id: 'zo', kana: 'ぞ', answers: ['zo'] },
  { id: 'da', kana: 'だ', answers: ['da'] },
  { id: 'di', kana: 'ぢ', answers: ['ji', 'di'] },
  { id: 'du', kana: 'づ', answers: ['zu', 'du'] },
  { id: 'de', kana: 'で', answers: ['de'] },
  { id: 'do', kana: 'ど', answers: ['do'] },
  { id: 'ba', kana: 'ば', answers: ['ba'] },
  { id: 'bi', kana: 'び', answers: ['bi'] },
  { id: 'bu', kana: 'ぶ', answers: ['bu'] },
  { id: 'be', kana: 'べ', answers: ['be'] },
  { id: 'bo', kana: 'ぼ', answers: ['bo'] },
  { id: 'pa', kana: 'ぱ', answers: ['pa'] },
  { id: 'pi', kana: 'ぴ', answers: ['pi'] },
  { id: 'pu', kana: 'ぷ', answers: ['pu'] },
  { id: 'pe', kana: 'ぺ', answers: ['pe'] },
  { id: 'po', kana: 'ぽ', answers: ['po'] },
  { id: 'ya', kana: 'や', answers: ['ya'] },
  { id: 'yu', kana: 'ゆ', answers: ['yu'] },
  { id: 'yo', kana: 'よ', answers: ['yo'] },
  { id: 'small_ya', kana: 'ゃ', answers: ['xya', 'lya'] },
  { id: 'small_yu', kana: 'ゅ', answers: ['xyu', 'lyu'] },
  { id: 'small_yo', kana: 'ょ', answers: ['xyo', 'lyo'] },
  { id: 'small_tsu', kana: 'っ', answers: ['xtsu', 'xtu', 'ltsu', 'ltu'] },
  { id: 'sha', kana: 'しゃ', answers: ['sha', 'sya'] },
  { id: 'shu', kana: 'しゅ', answers: ['shu', 'syu'] },
  { id: 'sho', kana: 'しょ', answers: ['sho', 'syo'] },
  { id: 'hya', kana: 'ひゃ', answers: ['hya'] },
  { id: 'hyu', kana: 'ひゅ', answers: ['hyu'] },
  { id: 'hyo', kana: 'ひょ', answers: ['hyo'] },
  { id: 'bya', kana: 'びゃ', answers: ['bya'] },
  { id: 'byu', kana: 'びゅ', answers: ['byu'] },
  { id: 'byo', kana: 'びょ', answers: ['byo'] },
  { id: 'pya', kana: 'ぴゃ', answers: ['pya'] },
  { id: 'pyu', kana: 'ぴゅ', answers: ['pyu'] },
  { id: 'pyo', kana: 'ぴょ', answers: ['pyo'] },
];

const KATAKANA_DAKUTEN_HANDAKUTEN_CLEAN_QUIZ = [
  { id: 'ga', kana: 'ガ', answers: ['ga'] },
  { id: 'gi', kana: 'ギ', answers: ['gi'] },
  { id: 'gu', kana: 'グ', answers: ['gu'] },
  { id: 'ge', kana: 'ゲ', answers: ['ge'] },
  { id: 'go', kana: 'ゴ', answers: ['go'] },
  { id: 'za', kana: 'ザ', answers: ['za'] },
  { id: 'ji', kana: 'ジ', answers: ['ji', 'zi'] },
  { id: 'zu', kana: 'ズ', answers: ['zu'] },
  { id: 'ze', kana: 'ゼ', answers: ['ze'] },
  { id: 'zo', kana: 'ゾ', answers: ['zo'] },
  { id: 'da', kana: 'ダ', answers: ['da'] },
  { id: 'di', kana: 'ヂ', answers: ['ji', 'di'] },
  { id: 'du', kana: 'ヅ', answers: ['zu', 'du'] },
  { id: 'de', kana: 'デ', answers: ['de'] },
  { id: 'do', kana: 'ド', answers: ['do'] },
  { id: 'ba', kana: 'バ', answers: ['ba'] },
  { id: 'bi', kana: 'ビ', answers: ['bi'] },
  { id: 'bu', kana: 'ブ', answers: ['bu'] },
  { id: 'be', kana: 'ベ', answers: ['be'] },
  { id: 'bo', kana: 'ボ', answers: ['bo'] },
  { id: 'pa', kana: 'パ', answers: ['pa'] },
  { id: 'pi', kana: 'ピ', answers: ['pi'] },
  { id: 'pu', kana: 'プ', answers: ['pu'] },
  { id: 'pe', kana: 'ペ', answers: ['pe'] },
  { id: 'po', kana: 'ポ', answers: ['po'] },
  { id: 'ya', kana: 'ヤ', answers: ['ya'] },
  { id: 'yu', kana: 'ユ', answers: ['yu'] },
  { id: 'yo', kana: 'ヨ', answers: ['yo'] },
  { id: 'small_ya', kana: 'ャ', answers: ['xya', 'lya'] },
  { id: 'small_yu', kana: 'ュ', answers: ['xyu', 'lyu'] },
  { id: 'small_yo', kana: 'ョ', answers: ['xyo', 'lyo'] },
  { id: 'small_tsu', kana: 'ッ', answers: ['xtsu', 'xtu', 'ltsu', 'ltu'] },
  { id: 'sha', kana: 'シャ', answers: ['sha', 'sya'] },
  { id: 'shu', kana: 'シュ', answers: ['shu', 'syu'] },
  { id: 'sho', kana: 'ショ', answers: ['sho', 'syo'] },
  { id: 'hya', kana: 'ヒャ', answers: ['hya'] },
  { id: 'hyu', kana: 'ヒュ', answers: ['hyu'] },
  { id: 'hyo', kana: 'ヒョ', answers: ['hyo'] },
  { id: 'bya', kana: 'ビャ', answers: ['bya'] },
  { id: 'byu', kana: 'ビュ', answers: ['byu'] },
  { id: 'byo', kana: 'ビョ', answers: ['byo'] },
  { id: 'pya', kana: 'ピャ', answers: ['pya'] },
  { id: 'pyu', kana: 'ピュ', answers: ['pyu'] },
  { id: 'pyo', kana: 'ピョ', answers: ['pyo'] },
];
const ENGLISH_ALPHABET_QUIZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => ({
  id: `alpha_${letter.toLowerCase()}`,
  kana: letter,
  answers: [letter.toLowerCase()],
}));

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

const JLPT_N4_KANJI_SOURCE =
  '会 同 事 自 社 発 者 地 業 方 新 場 員 立 開 手 力 問 代 明 動 京 目 通 言 理 体 田 主 題 意 不 作 用 度 強 公 持 野 以 思 家 世 多 正 安 院 心 界 教 文 元 重 近 考 画 海 売 知 道 集 別 物 使 品 計 死 特 私 始 朝 運 終 台 広 住 無 真 有 口 少 町 料 工 建 空 急 止 送 切 転 研 足 究 楽 起 着 店 病 質';
const JLPT_N4_KANJI_DETAILS: Record<string, { readings: string[]; meanings: string[] }> = {
  会: { readings: ['kai', 'e', 'au'], meanings: ['meet', 'meeting', 'association'] },
  同: { readings: ['dou', 'onaji'], meanings: ['same', 'identical'] },
  事: { readings: ['ji', 'koto'], meanings: ['matter', 'thing', 'incident'] },
  自: { readings: ['ji', 'mizuka'], meanings: ['self', 'oneself'] },
  社: { readings: ['sha', 'yashiro'], meanings: ['company', 'society', 'shrine'] },
  発: { readings: ['hatsu'], meanings: ['depart', 'emit', 'start'] },
  者: { readings: ['sha', 'mono'], meanings: ['person', 'one who'] },
  地: { readings: ['chi', 'ji'], meanings: ['ground', 'earth', 'place'] },
  業: { readings: ['gyou', 'waza'], meanings: ['business', 'work', 'profession'] },
  方: { readings: ['hou', 'kata'], meanings: ['direction', 'way', 'method'] },
  新: { readings: ['shin', 'atara'], meanings: ['new'] },
  場: { readings: ['jou', 'ba'], meanings: ['place', 'location'] },
  員: { readings: ['in'], meanings: ['member', 'staff'] },
  立: { readings: ['ritsu', 'tatsu'], meanings: ['stand', 'establish'] },
  開: { readings: ['kai', 'aku'], meanings: ['open'] },
  手: { readings: ['shu', 'te'], meanings: ['hand'] },
  力: { readings: ['ryoku', 'chikara'], meanings: ['power', 'strength'] },
  問: { readings: ['mon', 'tou'], meanings: ['question', 'problem', 'ask'] },
  代: { readings: ['dai', 'yo'], meanings: ['generation', 'substitute', 'charge'] },
  明: { readings: ['mei', 'aka'], meanings: ['bright', 'clear'] },
  動: { readings: ['dou', 'ugo'], meanings: ['move', 'motion'] },
  京: { readings: ['kyou'], meanings: ['capital'] },
  目: { readings: ['moku', 'me'], meanings: ['eye', 'item'] },
  通: { readings: ['tsuu', 'tooru'], meanings: ['pass', 'through', 'commute'] },
  言: { readings: ['gen', 'i'], meanings: ['say', 'word'] },
  理: { readings: ['ri'], meanings: ['reason', 'logic'] },
  体: { readings: ['tai', 'karada'], meanings: ['body'] },
  田: { readings: ['den', 'ta'], meanings: ['rice field'] },
  主: { readings: ['shu', 'nushi'], meanings: ['main', 'master', 'owner'] },
  題: { readings: ['dai'], meanings: ['topic', 'title', 'problem'] },
  意: { readings: ['i'], meanings: ['meaning', 'intent'] },
  不: { readings: ['fu'], meanings: ['not', 'un-'] },
  作: { readings: ['saku', 'tsuku'], meanings: ['make', 'create'] },
  用: { readings: ['you', 'mochi'], meanings: ['use', 'business', 'task'] },
  度: { readings: ['do', 'tabi'], meanings: ['degree', 'time', 'occurrence'] },
  強: { readings: ['kyou', 'tsuyo'], meanings: ['strong'] },
  公: { readings: ['kou', 'oo'], meanings: ['public', 'official'] },
  持: { readings: ['ji', 'mo'], meanings: ['hold', 'have'] },
  野: { readings: ['ya', 'no'], meanings: ['field', 'plain'] },
  以: { readings: ['i'], meanings: ['by means of', 'since'] },
  思: { readings: ['shi', 'omo'], meanings: ['think', 'feel'] },
  家: { readings: ['ka', 'ie'], meanings: ['house', 'home', 'family'] },
  世: { readings: ['sei', 'yo'], meanings: ['world', 'generation'] },
  多: { readings: ['ta', 'oo'], meanings: ['many', 'much'] },
  正: { readings: ['sei', 'tadashi'], meanings: ['correct', 'right'] },
  安: { readings: ['an', 'yasu'], meanings: ['cheap', 'safe', 'peaceful'] },
  院: { readings: ['in'], meanings: ['institution', 'temple', 'hospital'] },
  心: { readings: ['shin', 'kokoro'], meanings: ['heart', 'mind'] },
  界: { readings: ['kai'], meanings: ['world', 'boundary'] },
  教: { readings: ['kyou', 'oshie'], meanings: ['teach', 'education'] },
  文: { readings: ['bun', 'fumi'], meanings: ['sentence', 'writing', 'literature'] },
  元: { readings: ['gen', 'moto'], meanings: ['origin', 'former', 'base'] },
  重: { readings: ['juu', 'omo'], meanings: ['heavy', 'important'] },
  近: { readings: ['kin', 'chika'], meanings: ['near'] },
  考: { readings: ['kou', 'kangae'], meanings: ['think', 'consider'] },
  画: { readings: ['ga', 'kaku'], meanings: ['picture', 'plan'] },
  海: { readings: ['kai', 'umi'], meanings: ['sea', 'ocean'] },
  売: { readings: ['bai', 'uru'], meanings: ['sell'] },
  知: { readings: ['chi', 'shiru'], meanings: ['know'] },
  道: { readings: ['dou', 'michi'], meanings: ['road', 'way', 'path'] },
  集: { readings: ['shuu', 'atsu'], meanings: ['gather', 'collect'] },
  別: { readings: ['betsu', 'waka'], meanings: ['separate', 'distinguish'] },
  物: { readings: ['butsu', 'mono'], meanings: ['thing', 'object'] },
  使: { readings: ['shi', 'tsuka'], meanings: ['use'] },
  品: { readings: ['hin', 'shina'], meanings: ['item', 'goods', 'quality'] },
  計: { readings: ['kei', 'haka'], meanings: ['measure', 'plan', 'total'] },
  死: { readings: ['shi', 'shi'], meanings: ['die', 'death'] },
  特: { readings: ['toku'], meanings: ['special'] },
  私: { readings: ['shi', 'watashi'], meanings: ['private', 'I', 'me'] },
  始: { readings: ['shi', 'haji'], meanings: ['begin', 'start'] },
  朝: { readings: ['chou', 'asa'], meanings: ['morning'] },
  運: { readings: ['un', 'hakobu'], meanings: ['carry', 'luck', 'transport'] },
  終: { readings: ['shuu', 'owa'], meanings: ['end', 'finish'] },
  台: { readings: ['dai'], meanings: ['stand', 'platform', 'counter'] },
  広: { readings: ['kou', 'hiro'], meanings: ['wide', 'broad'] },
  住: { readings: ['juu', 'su'], meanings: ['live', 'reside'] },
  無: { readings: ['mu', 'na'], meanings: ['none', 'without'] },
  真: { readings: ['shin', 'ma'], meanings: ['true', 'real'] },
  有: { readings: ['yuu', 'a'], meanings: ['have', 'exist'] },
  口: { readings: ['kou', 'kuchi'], meanings: ['mouth'] },
  少: { readings: ['shou', 'suko'], meanings: ['few', 'little'] },
  町: { readings: ['chou', 'machi'], meanings: ['town'] },
  料: { readings: ['ryou'], meanings: ['fee', 'material', 'charge'] },
  工: { readings: ['kou', 'takumi'], meanings: ['craft', 'construction'] },
  建: { readings: ['ken', 'ta'], meanings: ['build'] },
  空: { readings: ['kuu', 'sora'], meanings: ['sky', 'empty'] },
  急: { readings: ['kyuu', 'iso'], meanings: ['hurry', 'sudden'] },
  止: { readings: ['shi', 'toma'], meanings: ['stop', 'halt'] },
  送: { readings: ['sou', 'oku'], meanings: ['send'] },
  切: { readings: ['setsu', 'kiri'], meanings: ['cut', 'switch off'] },
  転: { readings: ['ten', 'koro'], meanings: ['turn', 'roll', 'transfer'] },
  研: { readings: ['ken', 'togu'], meanings: ['polish', 'study', 'research'] },
  足: { readings: ['soku', 'ashi'], meanings: ['foot', 'leg', 'sufficient'] },
  究: { readings: ['kyuu', 'kiwa'], meanings: ['study', 'research', 'investigate'] },
  楽: { readings: ['gaku', 'raku', 'tano'], meanings: ['music', 'enjoy', 'comfort'] },
  起: { readings: ['ki', 'oki'], meanings: ['wake', 'rise', 'happen'] },
  着: { readings: ['chaku', 'tsu'], meanings: ['arrive', 'wear', 'put on'] },
  店: { readings: ['ten', 'mise'], meanings: ['shop', 'store'] },
  病: { readings: ['byou', 'yamai'], meanings: ['illness', 'sick'] },
  質: { readings: ['shitsu'], meanings: ['quality', 'nature', 'question'] },
};
const JLPT_N4_KANJI_QUIZ = JLPT_N4_KANJI_SOURCE.split(/\s+/)
  .filter(Boolean)
  .map((kana, index) => {
    const detail = JLPT_N4_KANJI_DETAILS[kana];
    return {
      id: `n4_${`${index + 1}`.padStart(3, '0')}`,
      kana,
      answers: detail?.readings || [],
      onyomi: detail?.readings?.slice(0, 1) || [],
      kunyomi: detail?.readings?.slice(1) || [],
    };
  });
const JLPT_N4_ENGLISH_MEANINGS_BY_KANA: Record<string, string[]> = Object.fromEntries(
  Object.entries(JLPT_N4_KANJI_DETAILS).map(([kana, detail]) => [kana, detail.meanings]),
);
const JLPT_N4_2_KANJI_SOURCE =
  '春 夏 秋 冬 昼 夕 夜 雪 森 林 池 島 風 色 音 牛 犬 猫 鳥 兄 弟 妹 親 夫 婦 民 客 童 族 達 館 区 市 都 所 門 部 寺 室 堂 帰 去 乗 進 走 歩 登 回 歌 答 伝 借 買 払 洗 選 遊 待 降 困 散 写 注 寒 暑 冷 暗 軽 黒 悪 弱 太 短 早 首 顔 頭 紙 薬 肉 茶 洋 服 線 字 漢 験 勉 査 説 留 図 婚 産 旅 便 両 礼 然 全 組 点 番 味 由 予';
const JLPT_N4_2_KANJI_DETAILS: Record<string, { readings: string[]; meanings: string[] }> = {
  春: { readings: ['shun', 'haru'], meanings: ['spring'] },
  夏: { readings: ['ka', 'natsu'], meanings: ['summer'] },
  秋: { readings: ['shuu', 'aki'], meanings: ['autumn'] },
  冬: { readings: ['tou', 'fuyu'], meanings: ['winter'] },
  昼: { readings: ['chuu', 'hiru'], meanings: ['daytime', 'noon'] },
  夕: { readings: ['yuu'], meanings: ['evening'] },
  夜: { readings: ['ya', 'yoru', 'yo'], meanings: ['night'] },
  雪: { readings: ['setsu', 'yuki'], meanings: ['snow'] },
  森: { readings: ['shin', 'mori'], meanings: ['forest'] },
  林: { readings: ['rin', 'hayashi'], meanings: ['woods'] },
  池: { readings: ['chi', 'ike'], meanings: ['pond'] },
  島: { readings: ['tou', 'shima'], meanings: ['island'] },
  風: { readings: ['fuu', 'kaze'], meanings: ['wind'] },
  色: { readings: ['shoku', 'iro', 'shiki'], meanings: ['color'] },
  音: { readings: ['on', 'oto'], meanings: ['sound'] },
  牛: { readings: ['gyuu', 'ushi'], meanings: ['cow'] },
  犬: { readings: ['ken', 'inu'], meanings: ['dog'] },
  猫: { readings: ['byou', 'neko'], meanings: ['cat'] },
  鳥: { readings: ['chou', 'tori'], meanings: ['bird'] },
  兄: { readings: ['kei', 'ani', 'kyou'], meanings: ['older brother'] },
  弟: { readings: ['tei', 'otouto', 'dai'], meanings: ['younger brother'] },
  妹: { readings: ['mai', 'imouto'], meanings: ['younger sister'] },
  親: { readings: ['shin', 'oya', 'shita'], meanings: ['parent'] },
  夫: { readings: ['fuu', 'otto', 'fu'], meanings: ['husband'] },
  婦: { readings: ['fu'], meanings: ['wife'] },
  民: { readings: ['min', 'tami'], meanings: ['people'] },
  客: { readings: ['kyaku'], meanings: ['guest'] },
  童: { readings: ['dou', 'warabe'], meanings: ['child'] },
  族: { readings: ['zoku'], meanings: ['family', 'tribe'] },
  達: { readings: ['tatsu', 'tachi'], meanings: ['plural', 'reach'] },
  館: { readings: ['kan', 'yakata'], meanings: ['building', 'hall'] },
  区: { readings: ['ku'], meanings: ['ward', 'district'] },
  市: { readings: ['shi', 'ichi'], meanings: ['city', 'market'] },
  都: { readings: ['to', 'miyako', 'tsu'], meanings: ['capital', 'metropolis'] },
  所: { readings: ['sho', 'tokoro'], meanings: ['place'] },
  門: { readings: ['mon', 'kado'], meanings: ['gate'] },
  部: { readings: ['bu'], meanings: ['section', 'department'] },
  寺: { readings: ['ji', 'tera'], meanings: ['temple'] },
  室: { readings: ['shitsu', 'muro'], meanings: ['room'] },
  堂: { readings: ['dou'], meanings: ['hall'] },
  帰: { readings: ['ki', 'kae'], meanings: ['return'] },
  去: { readings: ['kyo', 'sa'], meanings: ['leave', 'past'] },
  乗: { readings: ['jou', 'no'], meanings: ['ride'] },
  進: { readings: ['shin', 'susu'], meanings: ['advance'] },
  走: { readings: ['sou', 'hashi'], meanings: ['run'] },
  歩: { readings: ['ho', 'aru', 'ayu', 'po'], meanings: ['walk'] },
  登: { readings: ['tou', 'nobo'], meanings: ['climb'] },
  回: { readings: ['kai', 'mawa'], meanings: ['turn', 'times'] },
  歌: { readings: ['ka', 'uta'], meanings: ['song'] },
  答: { readings: ['tou', 'kotae'], meanings: ['answer'] },
  伝: { readings: ['den', 'tsutae', 'tsuda'], meanings: ['convey'] },
  借: { readings: ['shaku', 'ka'], meanings: ['borrow'] },
  買: { readings: ['bai', 'ka'], meanings: ['buy'] },
  払: { readings: ['futsu', 'hara'], meanings: ['pay'] },
  洗: { readings: ['sen', 'ara'], meanings: ['wash'] },
  選: { readings: ['sen', 'era'], meanings: ['choose'] },
  遊: { readings: ['yuu', 'aso'], meanings: ['play'] },
  待: { readings: ['tai', 'ma'], meanings: ['wait'] },
  降: { readings: ['kou', 'o', 'fu'], meanings: ['descend', 'fall'] },
  困: { readings: ['kon', 'koma'], meanings: ['troubled'] },
  散: { readings: ['san', 'chi'], meanings: ['scatter'] },
  写: { readings: ['sha', 'utsu'], meanings: ['copy'] },
  注: { readings: ['chuu', 'soso'], meanings: ['pour', 'note'] },
  寒: { readings: ['kan', 'samu'], meanings: ['cold'] },
  暑: { readings: ['sho', 'atsu'], meanings: ['hot'] },
  冷: { readings: ['rei', 'tsume', 'hie', 'sa'], meanings: ['cool', 'cold'] },
  暗: { readings: ['an', 'kura'], meanings: ['dark'] },
  軽: { readings: ['kei', 'karu'], meanings: ['light'] },
  黒: { readings: ['koku', 'kuro'], meanings: ['black'] },
  悪: { readings: ['aku', 'waru'], meanings: ['bad'] },
  弱: { readings: ['jaku', 'yowa'], meanings: ['weak'] },
  太: { readings: ['tai', 'futo', 'ta'], meanings: ['thick', 'fat'] },
  短: { readings: ['tan', 'mijika'], meanings: ['short'] },
  早: { readings: ['sou', 'haya'], meanings: ['early'] },
  首: { readings: ['shu', 'kubi'], meanings: ['neck'] },
  顔: { readings: ['gan', 'kao'], meanings: ['face'] },
  頭: { readings: ['tou', 'atama', 'zu'], meanings: ['head'] },
  紙: { readings: ['shi', 'kami'], meanings: ['paper'] },
  薬: { readings: ['yaku', 'kusuri'], meanings: ['medicine'] },
  肉: { readings: ['niku'], meanings: ['meat'] },
  茶: { readings: ['cha', 'sa'], meanings: ['tea'] },
  洋: { readings: ['you'], meanings: ['western'] },
  服: { readings: ['fuku'], meanings: ['clothes'] },
  線: { readings: ['sen'], meanings: ['line'] },
  字: { readings: ['ji', 'aza'], meanings: ['character', 'letter'] },
  漢: { readings: ['kan'], meanings: ['china'] },
  験: { readings: ['ken'], meanings: ['test'] },
  勉: { readings: ['ben', 'tsuto'], meanings: ['diligence'] },
  査: { readings: ['sa'], meanings: ['inspect', 'investigate'] },
  説: { readings: ['setsu', 'to'], meanings: ['explain'] },
  留: { readings: ['ryuu', 'to', 'ru'], meanings: ['stay'] },
  図: { readings: ['zu', 'haka', 'to'], meanings: ['diagram'] },
  婚: { readings: ['kon'], meanings: ['marriage'] },
  産: { readings: ['san', 'u'], meanings: ['produce', 'give birth'] },
  旅: { readings: ['ryo', 'tabi'], meanings: ['trip'] },
  便: { readings: ['ben', 'bin', 'tayo'], meanings: ['convenience', 'mail'] },
  両: { readings: ['ryou'], meanings: ['both'] },
  礼: { readings: ['rei'], meanings: ['thanks', 'courtesy'] },
  然: { readings: ['zen', 'shika'], meanings: ['so', 'natural'] },
  全: { readings: ['zen', 'matta'], meanings: ['all'] },
  組: { readings: ['so', 'kumi'], meanings: ['group'] },
  点: { readings: ['ten'], meanings: ['point'] },
  番: { readings: ['ban'], meanings: ['number', 'turn'] },
  味: { readings: ['mi', 'aji'], meanings: ['taste'] },
  由: { readings: ['yu', 'yoshi', 'yuu'], meanings: ['reason'] },
  予: { readings: ['yo'], meanings: ['beforehand'] },
};
const JLPT_N4_2_KANJI_QUIZ = JLPT_N4_2_KANJI_SOURCE.split(/\s+/)
  .filter(Boolean)
  .map((kana, index) => {
    const detail = JLPT_N4_2_KANJI_DETAILS[kana];
    return {
      id: `n4_2_${`${index + 1}`.padStart(3, '0')}`,
      kana,
      answers: detail?.readings || [],
      onyomi: detail?.readings?.slice(0, 1) || [],
      kunyomi: detail?.readings?.slice(1) || [],
    };
  });
const JLPT_N4_2_ENGLISH_MEANINGS_BY_KANA: Record<string, string[]> = Object.fromEntries(
  Object.entries(JLPT_N4_2_KANJI_DETAILS).map(([kana, detail]) => [kana, detail.meanings]),
);
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
const buildColumnBuckets = <T,>(items: T[], count: number): T[][] => {
  const safeCount = Math.max(1, count);
  const rowsPerColumn = Math.ceil(items.length / safeCount);
  return Array.from({ length: safeCount }, (_, columnIndex) =>
    items.slice(columnIndex * rowsPerColumn, (columnIndex + 1) * rowsPerColumn),
  );
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [quizScoreMode, setQuizScoreMode] = useState<QuizScoreMode>('off');
  const [engModeEnabled, setEngModeEnabled] = useState(false);
  const leaderboardScoresEnabled = quizScoreMode !== 'off';

  const dispatchLeaderboardSettingsEvent = useCallback((eventName: string) => {
    setIsSettingsOpen(false);
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      Alert.alert('Unavailable', 'Leaderboard import/export is only available in the web/extension view.');
      return;
    }
    try {
      window.dispatchEvent(new CustomEvent(eventName));
    } catch {
      Alert.alert('Settings action failed', 'Could not trigger the leaderboard import/export action.');
    }
  }, []);

  const handleExtensionReload = useCallback(() => {
    const runtime = (globalThis as any)?.chrome?.runtime;
    if (runtime && typeof runtime.reload === 'function') {
      const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
      const path = isWeb ? window.location.pathname : '';
      const isQuizPage = isWeb && /(^|\/)(quiz\.html)$/.test(path);
      const isPopupPage = isWeb && /(^|\/)(popup\.html)$/.test(path);

      // Best-effort refresh for already-open extension pages after the extension reloads.
      // In some contexts the page is torn down before this runs, so this is not guaranteed.
      if (isWeb && (isQuizPage || isPopupPage)) {
        setTimeout(() => {
          try {
            window.location.reload();
          } catch {
            // If the extension context is already torn down, ignore.
          }
        }, 800);
      }

      runtime.reload();

      if (isWeb && isPopupPage) {
        setTimeout(() => {
          try {
            window.close();
          } catch {
            // Ignore close failures outside popup contexts.
          }
        }, 50);
      }
      return;
    }
    Alert.alert('Extension reload', 'Chrome extension runtime API is not available in this view.');
  }, []);

  const handleUpdatePress = useCallback(() => {
    setIsSettingsOpen(false);
    Alert.alert(
      'Update Extension (Rebuild + Reload)',
      'Run BuildDist.cmd from the project root first to rebuild dist, then use Reload Extension below. The extension page cannot run local .cmd scripts directly.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reload Extension', onPress: handleExtensionReload },
      ],
    );
  }, [handleExtensionReload]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [scoreModeStored, scoreStored, engModeStored] = await Promise.all([
          AsyncStorage.getItem(QUIZ_SCORE_MODE_STORAGE_KEY),
          AsyncStorage.getItem(QUIZ_LEADERBOARD_SCORES_ENABLED_STORAGE_KEY),
          AsyncStorage.getItem(QUIZ_ENG_MODE_ENABLED_STORAGE_KEY),
        ]);
        if (scoreModeStored === 'speedrun_points' || scoreModeStored === 'study_points' || scoreModeStored === 'off') {
          setQuizScoreMode(scoreModeStored);
        } else if (scoreModeStored === 'quiz_points') {
          setQuizScoreMode('speedrun_points');
        } else if (scoreStored != null) {
          setQuizScoreMode(scoreStored === 'true' ? 'speedrun_points' : 'off');
        }
        if (engModeStored != null) {
          setEngModeEnabled(engModeStored === 'true');
        }
      } catch (err) {
        console.error('Failed to load quiz settings:', err);
      }
    };
    void loadSettings();
  }, []);

  const persistQuizScoreMode = useCallback((next: QuizScoreMode) => {
    void Promise.all([
      AsyncStorage.setItem(QUIZ_SCORE_MODE_STORAGE_KEY, next),
      AsyncStorage.setItem(QUIZ_LEADERBOARD_SCORES_ENABLED_STORAGE_KEY, next === 'off' ? 'false' : 'true'),
    ]).catch(err => {
      console.error('Failed to persist leaderboard score mode:', err);
    });
  }, []);

  const handleToggleQuizScorePress = useCallback(() => {
    setQuizScoreMode(prev => {
      const next: QuizScoreMode = prev === 'speedrun_points' ? 'off' : 'speedrun_points';
      persistQuizScoreMode(next);
      return next;
    });
  }, [persistQuizScoreMode]);

  const handleToggleStudyScorePress = useCallback(() => {
    setQuizScoreMode(prev => {
      const next: QuizScoreMode = prev === 'study_points' ? 'off' : 'study_points';
      persistQuizScoreMode(next);
      return next;
    });
  }, [persistQuizScoreMode]);

  const handleToggleEngModePress = useCallback(() => {
    setEngModeEnabled(prev => {
      const next = !prev;
      void AsyncStorage.setItem(QUIZ_ENG_MODE_ENABLED_STORAGE_KEY, next ? 'true' : 'false').catch(err => {
        console.error('Failed to persist ENG mode toggle:', err);
      });
      return next;
    });
  }, []);

  const handleExportLeaderboardPress = useCallback(() => {
    dispatchLeaderboardSettingsEvent(QUIZ_LEADERBOARD_EXPORT_EVENT);
  }, [dispatchLeaderboardSettingsEvent]);

  const handleImportLeaderboardPress = useCallback(() => {
    dispatchLeaderboardSettingsEvent(QUIZ_LEADERBOARD_IMPORT_EVENT);
  }, [dispatchLeaderboardSettingsEvent]);

  const handleOpenSaveManagerPress = useCallback(() => {
    dispatchLeaderboardSettingsEvent(QUIZ_SAVE_MANAGER_OPEN_EVENT);
  }, [dispatchLeaderboardSettingsEvent]);

  return (
    <View style={styles.appShell}>
      <View style={styles.mainContent}>
        <View style={styles.appTitleBar}>
          <View style={styles.appTitleBarRow}>
            <Text style={styles.appTitleText}>Tensai TypeMaster</Text>
            <Pressable
              style={styles.appSettingsButton}
              onPress={() => setIsSettingsOpen(prev => !prev)}
            >
              <Text style={styles.appSettingsButtonLabel}>Settings</Text>
            </Pressable>
          </View>
          {isSettingsOpen ? (
            <View style={styles.appSettingsMenu}>
              <Pressable style={styles.appSettingsMenuItem} onPress={handleUpdatePress}>
                <Text style={styles.appSettingsMenuItemLabel}>Update (BuildDist + Reload)</Text>
              </Pressable>
              <Pressable style={styles.appSettingsMenuItem} onPress={handleExportLeaderboardPress}>
                <Text style={styles.appSettingsMenuItemLabel}>Export Leaderboard</Text>
              </Pressable>
              <Pressable style={styles.appSettingsMenuItem} onPress={handleImportLeaderboardPress}>
                <Text style={styles.appSettingsMenuItemLabel}>Import Leaderboard</Text>
              </Pressable>
              <Pressable style={styles.appSettingsMenuItem} onPress={handleOpenSaveManagerPress}>
                <Text style={styles.appSettingsMenuItemLabel}>Save Manager</Text>
              </Pressable>
              <Pressable style={styles.appSettingsMenuItem} onPress={handleToggleQuizScorePress}>
                <Text style={styles.appSettingsMenuItemLabel}>
                  Speedrun Score ({quizScoreMode === 'speedrun_points' ? 'On' : 'Off'})
                </Text>
              </Pressable>
              <Pressable style={styles.appSettingsMenuItem} onPress={handleToggleStudyScorePress}>
                <Text style={styles.appSettingsMenuItemLabel}>
                  Study Score ({quizScoreMode === 'study_points' ? 'On' : 'Off'})
                </Text>
              </Pressable>
              <Pressable style={styles.appSettingsMenuItem} onPress={handleToggleEngModePress}>
                <Text style={styles.appSettingsMenuItemLabel}>
                  ENG Mode ({engModeEnabled ? 'On' : 'Off'})
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        <View style={styles.quizPageFrame}>
          <KanaQuizView scoreMode={quizScoreMode} engModeEnabled={engModeEnabled} />
        </View>
      </View>
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
  { value: 'hiragana', label: 'Hiragana', tabLabel: 'Hiragana', family: 'kana', dataset: HIRAGANA_QUIZ },
  { value: 'hiragana_dakuten', label: 'Hiragana - Dakuten/Handakuten', tabLabel: 'Dakuten/Handakuten', family: 'kana', dataset: HIRAGANA_DAKUTEN_HANDAKUTEN_CLEAN_QUIZ },
  { value: 'katakana', label: 'Katakana', tabLabel: 'Katakana', family: 'kana', dataset: KATAKANA_QUIZ },
  { value: 'katakana_dakuten', label: 'Katakana - Dakuten/Handakuten', tabLabel: 'Dakuten/Handakuten', family: 'kana', dataset: KATAKANA_DAKUTEN_HANDAKUTEN_CLEAN_QUIZ },
  { value: 'jlpt_n5', label: 'JLPT N5 (On/Kun)', tabLabel: 'N5', family: 'jlpt', dataset: JLPT_N5_KANJI_QUIZ },
  { value: 'jlpt_n4', label: 'JLPT N4', tabLabel: 'N4', family: 'jlpt', dataset: JLPT_N4_KANJI_QUIZ },
  { value: 'jlpt_n4_2', label: 'JLPT N4-2', tabLabel: 'N4-2', family: 'jlpt', dataset: JLPT_N4_2_KANJI_QUIZ },
  { value: 'focus', label: 'Focus', tabLabel: 'Focus', family: 'focus', dataset: [] },
];
const JLPT_READING_MODES = [
  { value: 'on_kun', label: 'On/Kun (Default)' },
  { value: 'onyomi_only', label: 'Onyomi only' },
  { value: 'kunyomi_only', label: 'Kunyomi only' },
  { value: 'en_on_kun', label: 'English Translate' },
  { value: 'jp_on_kun_kanji', label: 'Kanji Input' },
];
const DEFAULT_JLPT_READING_MODE = JLPT_READING_MODES[0].value;
const JLPT_ENGLISH_TRANSLATE_MODES = ['en_on_kun'];
const QUIZ_FAMILY_OPTIONS = [
  { value: 'kana', label: 'Kana' },
  { value: 'jlpt', label: 'JLPT' },
  { value: 'focus', label: 'Focus' },
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
const LEADERBOARD_RANK_OPTIONS = [
  { value: 'time', label: 'Time' },
  { value: 'score', label: 'Score' },
];
const KANA_VARIANT_OPTIONS = {
  hiragana: ['hiragana', 'hiragana_dakuten'],
  katakana: ['katakana', 'katakana_dakuten'],
};
const JLPT_N4_VARIANT_VALUES = ['jlpt_n4', 'jlpt_n4_2'];

const isJlptQuizMode = (mode: string) => mode.startsWith('jlpt_');

const getDefaultQuizModeForWeb = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return QUIZ_MODES[0].value;
  }
  const anyWindow = window as any;
  const explicit = anyWindow.__TENSAI_DEFAULT_QUIZ_MODE__;
  if (typeof explicit === 'string' && QUIZ_MODES.some(option => option.value === explicit)) {
    return explicit;
  }
  const modeFromUrl = new URLSearchParams(window.location.search).get('mode');
  if (modeFromUrl && QUIZ_MODES.some(option => option.value === modeFromUrl)) {
    return modeFromUrl;
  }
  return QUIZ_MODES[0].value;
};

const getDefaultQuizViewForWeb = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return QUIZ_VIEW_OPTIONS[0].value;
  }
  const anyWindow = window as any;
  const explicit = anyWindow.__TENSAI_DEFAULT_QUIZ_VIEW__;
  if (typeof explicit === 'string' && QUIZ_VIEW_OPTIONS.some(option => option.value === explicit)) {
    return explicit;
  }
  const viewFromUrl = new URLSearchParams(window.location.search).get('view');
  if (viewFromUrl && QUIZ_VIEW_OPTIONS.some(option => option.value === viewFromUrl)) {
    return viewFromUrl;
  }
  return QUIZ_VIEW_OPTIONS[0].value;
};

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
  isJlptQuizMode(mode) || mode === 'focus' ? `${mode}:${jlptReadingMode}` : mode;

const getTypeMasterModeKey = (quizModeKey: string) => `typemaster:${quizModeKey}`;
const isFocusModeKey = (mode: string) =>
  mode === 'focus' ||
  mode.startsWith('focus:') ||
  mode.startsWith('endless:focus') ||
  mode.startsWith('typemaster:focus');

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
  const jlptReadingMode = isJlptQuizMode(baseMode)
    ? (baseParts[1] || DEFAULT_JLPT_READING_MODE)
    : null;
  const normalizedQuizModeKey = isJlptQuizMode(baseMode)
    ? getQuizModeKey(baseMode, jlptReadingMode || DEFAULT_JLPT_READING_MODE)
    : baseMode;
  return {
    queueMode,
    quizModeKey: normalizedQuizModeKey,
  };
};

const normalizeStoredQuizModeKey = (mode: any) => {
  const safeMode = typeof mode === 'string' ? mode : QUIZ_MODES[0].value;
  if (safeMode.startsWith('endless:')) {
    const withoutEndless = safeMode.replace('endless:', '');
    const [baseMode, jlptReadingMode] = withoutEndless.split(':');
    if (isJlptQuizMode(baseMode)) {
      return `endless:${getQuizModeKey(baseMode, jlptReadingMode || DEFAULT_JLPT_READING_MODE)}`;
    }
    return safeMode;
  }
  if (safeMode.startsWith('typemaster:')) {
    const parsed = parseTypeMasterModeKey(safeMode);
    if (!parsed) return safeMode;
    return getTypeMasterModeKey(parsed.quizModeKey);
  }
  const [baseMode, jlptReadingMode] = safeMode.split(':');
  return isJlptQuizMode(baseMode)
    ? getQuizModeKey(baseMode, jlptReadingMode || DEFAULT_JLPT_READING_MODE)
    : safeMode;
};

const getQuizModeLabel = (mode: string) => {
  // Handle endless mode: "endless:mode" or "endless:mode:jlptReadingMode"
  if (mode.startsWith('endless:')) {
    const withoutEndless = mode.replace('endless:', '');
    const [baseMode, jlptReadingMode] = withoutEndless.split(':');
    const selected = QUIZ_MODES.find(option => option.value === baseMode);
    if (!selected) return `Endless - ${withoutEndless}`;
    if (!isJlptQuizMode(baseMode)) return `Endless - ${selected.label}`;
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
    if (!isJlptQuizMode(baseMode)) return `TypeMaster (${queueLabel}) - ${selected.label}`;
    const selectedJlptMode = JLPT_READING_MODES.find(option => option.value === jlptReadingMode);
    return selectedJlptMode
      ? `TypeMaster (${queueLabel}) - JLPT N5 - ${selectedJlptMode.label}`
      : `TypeMaster (${queueLabel}) - ${selected.label}`;
  }

  const [baseMode, jlptReadingMode] = mode.split(':');
  const selected = QUIZ_MODES.find(option => option.value === baseMode);
  if (!selected) return mode;
  if (!isJlptQuizMode(baseMode)) return selected.label;
  const selectedJlptMode = JLPT_READING_MODES.find(option => option.value === jlptReadingMode);
  return selectedJlptMode ? `JLPT N5 - ${selectedJlptMode.label}` : selected.label;
};

const getNormalizedJlptReadingGroups = (item: any) => {
  const normalizedAnswers = (item.answers || []).map((value: string) => normalizeRomaji(value)).filter(Boolean);
  const normalizedOnyomi = (Array.isArray(item.onyomi) && item.onyomi.length ? item.onyomi : (item.answers || []).slice(0, 1))
    .map((value: string) => normalizeRomaji(value))
    .filter(Boolean);
  const normalizedKunyomi = (Array.isArray(item.kunyomi) && item.kunyomi.length ? item.kunyomi : (item.answers || []).slice(1))
    .map((value: string) => normalizeRomaji(value))
    .filter(Boolean);
  return {
    all: Array.from(new Set([...normalizedOnyomi, ...normalizedKunyomi, ...normalizedAnswers])),
    onyomi: Array.from(new Set(normalizedOnyomi)),
    kunyomi: Array.from(new Set(normalizedKunyomi)),
  };
};

const getJlptAcceptedReadings = (item: any, jlptReadingMode: string) => {
  const groupedReadings = getNormalizedJlptReadingGroups(item);
  if (!groupedReadings.all.length) return [];
  if (jlptReadingMode === 'onyomi_only') {
    return groupedReadings.onyomi.length ? groupedReadings.onyomi : groupedReadings.all.slice(0, 1);
  }
  if (jlptReadingMode === 'kunyomi_only') {
    return groupedReadings.kunyomi.length ? groupedReadings.kunyomi : groupedReadings.all.slice(0, 1);
  }
  return groupedReadings.all;
};

const isJlptEnglishTranslateMode = (jlptReadingMode: string) =>
  JLPT_ENGLISH_TRANSLATE_MODES.includes(jlptReadingMode);
const getJlptEnglishMeaningsForItem = (item: any) =>
  ([...(JLPT_N5_ENGLISH_MEANINGS[item.id] || []), ...(JLPT_N4_ENGLISH_MEANINGS_BY_KANA[item.kana] || []), ...(JLPT_N4_2_ENGLISH_MEANINGS_BY_KANA[item.kana] || [])])
    .map((value: string) => normalizeRomaji(value))
    .filter(Boolean);
const getJlptAcceptedAnswers = (item: any, jlptReadingMode: string) => {
  const englishMeanings = getJlptEnglishMeaningsForItem(item);

  if (isJlptEnglishTranslateMode(jlptReadingMode)) {
    return englishMeanings;
  }
  if (jlptReadingMode === 'jp_on_kun_kanji' && !(item.answers || []).length && item.kana) {
    return [item.kana];
  }
  const readings = getJlptAcceptedReadings(item, jlptReadingMode);
  // If a JLPT set only ships meanings, keep the prompt answerable.
  // so hints/answers are never blank in JLPT modes.
  if (!readings.length && englishMeanings.length) {
    return englishMeanings;
  }
  return readings;
};
const getJlptPromptText = (item: any, jlptReadingMode: string) => {
  if (jlptReadingMode === 'onyomi_only') {
    return item.kana;
  }
  if (jlptReadingMode === 'kunyomi_only') {
    return item.kana;
  }
  if (jlptReadingMode === 'jp_on_kun_kanji') {
    if (!(item.answers || []).length) {
      const englishMeanings = getJlptEnglishMeaningsForItem(item);
      return englishMeanings.length ? englishMeanings.join(' / ') : item.kana;
    }
    return (item.answers || []).join(' / ');
  }
  return item.kana;
};
const getCanonicalFocusItem = (sourceMode: string | undefined, rawItem: any) => {
  if (!sourceMode || sourceMode === 'focus') return null;
  const dataset = getQuizDataset(sourceMode);
  if (!Array.isArray(dataset) || !dataset.length) return null;
  const originalId = rawItem?.__focusOriginalId || rawItem?.id;
  const kana = rawItem?.kana;
  return dataset.find((candidate: any) =>
    (originalId && candidate?.id === originalId) ||
    (kana && candidate?.kana === kana),
  ) || null;
};
const normalizeStoredFocusItem = (rawItem: any, sourceMode?: string) => {
  const canonical = getCanonicalFocusItem(sourceMode, rawItem);
  const base = canonical || rawItem || {};
  return {
    ...rawItem,
    id: rawItem?.id ?? base.id,
    kana: rawItem?.kana ?? base.kana,
    answers: Array.isArray(base?.answers) ? base.answers : Array.isArray(rawItem?.answers) ? rawItem.answers : [],
    onyomi: Array.isArray(base?.onyomi) ? base.onyomi : Array.isArray(rawItem?.onyomi) ? rawItem.onyomi : [],
    kunyomi: Array.isArray(base?.kunyomi) ? base.kunyomi : Array.isArray(rawItem?.kunyomi) ? rawItem.kunyomi : [],
  };
};

const getFinishReasonLabel = (reason: string) => {
  if (reason === 'complete') return 'Complete';
  if (reason === 'time') return 'Time up';
  if (reason === 'stopped') return 'Stopped';
  return 'Complete';
};

const clampNumber = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const getQuizTotalChars = (items: Array<{ kana?: string }>) =>
  items.reduce((sum, it) => sum + (it.kana ? it.kana.length : 0), 0);
const isEndlessModeKey = (mode: string) => typeof mode === 'string' && mode.startsWith('endless:');
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

const getLeaderboardRankScore = (entry: { score: number; gamepoints?: number; scoreType?: string }) => {
  if (entry.scoreType === 'speedrun_points' || entry.scoreType === 'quiz_points' || entry.scoreType === 'study_points') {
    return Math.round(entry.gamepoints ?? entry.score ?? 0);
  }
  return Math.round(entry.score ?? 0);
};

const getLeaderboardTestscoreDisplay = (entry: { mode: string; score: number; total: number; scoreType?: string; correctCount?: number; gamepoints?: number; testscore?: number; totalTestscore?: number }) => {
  if (entry.scoreType === 'speedrun_points' || entry.scoreType === 'quiz_points' || entry.scoreType === 'study_points') {
    if (typeof entry.testscore === 'number' && typeof entry.totalTestscore === 'number') {
      return `${entry.testscore}/${entry.totalTestscore}`;
    }
    if (typeof entry.correctCount === 'number') {
      return `${entry.correctCount}/${entry.total}`;
    }
    if (entry.score <= entry.total) {
      return `${entry.score}/${entry.total}`;
    }
    return `${getLeaderboardRankScore(entry).toLocaleString()}`;
  }
  if (isEndlessModeKey(entry.mode) || isTypeMasterModeKey(entry.mode) || entry.score === entry.total) {
    return `${Math.round(entry.score).toLocaleString()}`;
  }
  return `${entry.score}/${entry.total}`;
};

const getLeaderboardGamepointsDisplay = (entry: { scoreType?: string; gamepoints?: number }) => {
  if ((entry.scoreType !== 'speedrun_points' && entry.scoreType !== 'quiz_points' && entry.scoreType !== 'study_points') || typeof entry.gamepoints !== 'number') {
    return null;
  }
  return `Pts ${entry.gamepoints.toLocaleString()}`;
};

const normalizeLeaderboardTimerMinutes = (value: any) => {
  const parsed = Number.parseInt(`${value}`, 10);
  if (Number.isNaN(parsed)) return 5;
  return Math.max(QUIZ_TIMER_MIN_MINUTES, Math.min(QUIZ_TIMER_MAX_MINUTES, parsed));
};

const normalizeLeaderboardScoreType = (value: any): QuizScoreMode => {
  if (value === 'study_points') return 'study_points';
  if (value === 'speedrun_points' || value === 'quiz_points') return 'speedrun_points';
  return 'off';
};

function KanaQuizView({ scoreMode = 'off', engModeEnabled = false }: { scoreMode?: QuizScoreMode; engModeEnabled?: boolean }) {
  const leaderboardScoresEnabled = scoreMode !== 'off';
  const isStudyScoreMode = scoreMode === 'study_points';
  const activeQuizLeaderboardScoreType = isStudyScoreMode ? 'study_points' : leaderboardScoresEnabled ? 'speedrun_points' : 'off';
  const activeQuizLeaderboardLabel = activeQuizLeaderboardScoreType === 'study_points'
    ? 'Study Score'
    : activeQuizLeaderboardScoreType === 'speedrun_points'
      ? 'Speedrun Score'
      : 'Time';
  const defaultQuizMode = useMemo(() => getDefaultQuizModeForWeb(), []);
  const defaultQuizView = useMemo(() => getDefaultQuizViewForWeb(), []);
  const [quizView, setQuizView] = useState(defaultQuizView);
  const [quizMode, setQuizMode] = useState(defaultQuizMode);
  const [jlptReadingMode, setJlptReadingMode] = useState(DEFAULT_JLPT_READING_MODE);
  const [isJlptModeDropdownOpen, setIsJlptModeDropdownOpen] = useState(false);
  const [isJlptSetDropdownOpen, setIsJlptSetDropdownOpen] = useState(false);
  const [openKanaDropdownBase, setOpenKanaDropdownBase] = useState<string | null>(null);
  const [quizFamily, setQuizFamily] = useState(getQuizModeFamily(defaultQuizMode));
  const [leaderboardScope, setLeaderboardScope] = useState(LEADERBOARD_SCOPE_OPTIONS[0].value);
  const [leaderboardGameType, setLeaderboardGameType] = useState(LEADERBOARD_GAME_OPTIONS[0].value);
  const [leaderboardRankMode, setLeaderboardRankMode] = useState(LEADERBOARD_RANK_OPTIONS[0].value);
  const [timerMinutes, setTimerMinutes] = useState(1);
  const [customMinutes, setCustomMinutes] = useState('1');
  const [quizItems, setQuizItems] = useState(() =>
    defaultQuizMode === 'focus' ? [] : shuffleQuiz(getQuizDataset(defaultQuizMode)),
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(() => timerMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isQuizPaused, setIsQuizPaused] = useState(false);
  const [hasFinished, setHasFinished] = useState(false);
  const [finishReason, setFinishReason] = useState<'time' | 'complete' | 'stopped' | null>(null);
  const [completionTimeMs, setCompletionTimeMs] = useState<number | null>(null);
  const [isQuizScoreHidden, setIsQuizScoreHidden] = useState(false);
  const [isLeaderboardEditMode, setIsLeaderboardEditMode] = useState(false);
  const [lastRecordUpdate, setLastRecordUpdate] = useState<{ mode: string; scoreType?: QuizScoreMode; isNewRecord: boolean; rank: number | null } | null>(null);
  const [leaderboard, setLeaderboard] = useState<Array<{ mode: string; timeMs: number; score: number; total: number; date: number; finishReason: 'complete' | 'time' | 'stopped'; scoreType?: string }>>([]);
  const [sessionLeaderboard, setSessionLeaderboard] = useState<Array<{ mode: string; timeMs: number; score: number; total: number; date: number; finishReason: 'complete' | 'time' | 'stopped'; scoreType?: string }>>([]);
  const [quizBackspaceCount, setQuizBackspaceCount] = useState(0);
  const quizBackspacePenaltyWordIdsRef = React.useRef<Set<string>>(new Set());
  const inputRefs = React.useRef<Record<string, TextInput | null>>({});
  const timerDeadlineMsRef = React.useRef<number | null>(null);
  const remainingSecondsRef = React.useRef(remainingSeconds);

  // Endless mode state
  const [endlessScore, setEndlessScore] = useState(0);
  const [endlessCurrentInput, setEndlessCurrentInput] = useState('');
  const [endlessVisibleChars, setEndlessVisibleChars] = useState<Array<{ id: string; item: any; position: number }>>([]);
  const [endlessIsRunning, setEndlessIsRunning] = useState(false);
  const [isEndlessPaused, setIsEndlessPaused] = useState(false);
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
  const [isTypemasterPaused, setIsTypemasterPaused] = useState(false);
  const [typemasterHasFinished, setTypemasterHasFinished] = useState(false);
  const [typemasterFinishReason, setTypemasterFinishReason] = useState<'time' | 'stopped' | null>(null);
  const [typemasterShowHints, setTypemasterShowHints] = useState(true);
  const typemasterQueueRef = React.useRef<CharacterQueue | null>(null);
  const typemasterInputRef = React.useRef<TextInput | null>(null);
  const typemasterTimerWasArmedRef = React.useRef(false);
  const [focusedItems, setFocusedItems] = useState<Array<{ key: string; sourceMode: string; item: any }>>([]);
  const [isSaveManagerOpen, setIsSaveManagerOpen] = useState(false);
  const [saveManagerTab, setSaveManagerTab] = useState<'focus' | 'leaderboard'>('focus');
  const [leaderboardSnapshots, setLeaderboardSnapshots] = useState<Array<{ id: string; name: string; createdAt: number; leaderboard: any[]; sessionLeaderboard: any[] }>>([]);
  const [focusSnapshots, setFocusSnapshots] = useState<Array<{ id: string; name: string; createdAt: number; focusItems: any[]; focusLeaderboard?: any[] }>>([]);
  const [activeFocusSnapshotId, setActiveFocusSnapshotId] = useState<string | null>(null);
  const [leaderboardSnapshotName, setLeaderboardSnapshotName] = useState('');
  const [focusSnapshotName, setFocusSnapshotName] = useState('');

  const focusDataset = useMemo(
    () =>
      focusedItems.map(entry => ({
        ...entry.item,
        id: entry.key,
        __focusSourceMode: entry.sourceMode,
        __focusOriginalId: entry.item.id,
      })),
    [focusedItems],
  );
  const focusLookup = useMemo(() => new Set(focusedItems.map(entry => entry.key)), [focusedItems]);
  const getFocusItemKey = useCallback((item: any, sourceMode: string) => {
    const idPart = item?.__focusOriginalId || item?.id || item?.kana || '';
    return `${sourceMode}:${idPart}`;
  }, []);
  const getItemSourceMode = useCallback(
    (item: any) => {
      if (item?.__focusSourceMode) return item.__focusSourceMode;
      if (quizMode !== 'focus') return quizMode;
      if (typeof item?.id === 'string') {
        const separatorIndex = item.id.indexOf(':');
        if (separatorIndex > 0) {
          return item.id.slice(0, separatorIndex);
        }
      }
      return focusedItems[0]?.sourceMode || 'hiragana';
    },
    [focusedItems, quizMode],
  );
  const isJlptStyleItem = useCallback(
    (item: any, sourceMode?: string) => isJlptQuizMode(sourceMode || getItemSourceMode(item)),
    [getItemSourceMode],
  );
  const usesJapaneseInputForItem = useCallback(
    (item: any, sourceMode?: string) => isJlptStyleItem(item, sourceMode) && jlptReadingMode === 'jp_on_kun_kanji',
    [isJlptStyleItem, jlptReadingMode],
  );
  const getAcceptedAnswersForItem = useCallback(
    (item: any, sourceMode?: string) => {
      const resolvedSourceMode = sourceMode || getItemSourceMode(item);
      if (isJlptQuizMode(resolvedSourceMode)) {
        if (engModeEnabled) {
          const englishMeanings = getJlptEnglishMeaningsForItem(item);
          if (englishMeanings.length) return englishMeanings;
          const fallbackReadings = (item.answers || []).map((value: string) => normalizeRomaji(value)).filter(Boolean);
          return fallbackReadings.length ? fallbackReadings : [normalizeRomaji(item.kana || '')].filter(Boolean);
        }
        if (usesJapaneseInputForItem(item, resolvedSourceMode)) {
          return [item.kana];
        }
        const jlptAccepted = getJlptAcceptedAnswers(item, jlptReadingMode);
        return jlptAccepted.length ? jlptAccepted : [item.kana];
      }
      return (item.answers || []).map((value: string) => normalizeRomaji(value));
    },
    [engModeEnabled, getItemSourceMode, jlptReadingMode, usesJapaneseInputForItem],
  );
  const getPromptTextForItem = useCallback(
    (item: any, sourceMode?: string) => {
      const resolvedSourceMode = sourceMode || getItemSourceMode(item);
      if (isJlptQuizMode(resolvedSourceMode)) {
        if (engModeEnabled) {
          const englishMeanings = getJlptEnglishMeaningsForItem(item);
          if (englishMeanings.length) {
            return englishMeanings[0];
          }
          const fallbackReadings = (item.answers || []).map((value: string) => normalizeRomaji(value)).filter(Boolean);
          return fallbackReadings.length ? fallbackReadings[0] : item.kana;
        }
        return getJlptPromptText(item, jlptReadingMode);
      }
      if (engModeEnabled) {
        const primary = normalizeRomaji((item.answers || [item.kana])[0] || item.kana);
        return primary ? primary.toUpperCase() : item.kana;
      }
      return item.kana;
    },
    [engModeEnabled, getItemSourceMode, jlptReadingMode],
  );
  const getHintTextForItem = useCallback(
    (item: any, sourceMode?: string) => {
      const accepted = getAcceptedAnswersForItem(item, sourceMode);
      return accepted.length ? accepted.join('/') : '';
    },
    [getAcceptedAnswersForItem],
  );
  const getScoreInputLengthForItem = useCallback(
    (item: any, sourceMode?: string) => {
      const resolvedSourceMode = sourceMode || getItemSourceMode(item);
      const accepted = getAcceptedAnswersForItem(item, resolvedSourceMode)
        .map((value: string) => String(value || '').trim())
        .filter(Boolean);

      if (accepted.length > 0) {
        return accepted.reduce((min, value) => Math.min(min, value.length), accepted[0].length);
      }

      if (usesJapaneseInputForItem(item, resolvedSourceMode)) {
        const fallbackRomanized = (item.answers || [])
          .map((value: string) => normalizeRomaji(value))
          .filter(Boolean);
        if (fallbackRomanized.length > 0) {
          return fallbackRomanized.reduce((min, value) => Math.min(min, value.length), fallbackRomanized[0].length);
        }
      }

      const fallback = String(item.kana || '').trim();
      return fallback.length;
    },
    [getAcceptedAnswersForItem, getItemSourceMode, usesJapaneseInputForItem],
  );
  const isFocusedItem = useCallback(
    (item: any, sourceMode?: string) => {
      const resolvedSourceMode = sourceMode || getItemSourceMode(item);
      return focusLookup.has(getFocusItemKey(item, resolvedSourceMode));
    },
    [focusLookup, getFocusItemKey, getItemSourceMode],
  );
  const getDatasetForMode = useCallback(
    (mode: string) => {
      if (mode === 'focus') return focusDataset;
      const isKanaMode =
        KANA_VARIANT_OPTIONS.hiragana.includes(mode as any) ||
        KANA_VARIANT_OPTIONS.katakana.includes(mode as any);
      if (engModeEnabled && isKanaMode) {
        return ENGLISH_ALPHABET_QUIZ;
      }
      return getQuizDataset(mode);
    },
    [engModeEnabled, focusDataset],
  );
  const saveFocusedItems = useCallback(async (items: Array<{ key: string; sourceMode: string; item: any }>) => {
    setFocusedItems(items);
    await AsyncStorage.setItem(QUIZ_FOCUS_STORAGE_KEY, JSON.stringify(items));
  }, []);
  const toggleFocusedItem = useCallback(
    async (item: any, sourceMode?: string) => {
      try {
        const resolvedSourceMode = sourceMode || getItemSourceMode(item);
        const key = getFocusItemKey(item, resolvedSourceMode);
        const plainItem = normalizeStoredFocusItem({
          id: item.__focusOriginalId || item.id,
          kana: item.kana,
          answers: Array.isArray(item.answers) ? item.answers : [],
          onyomi: Array.isArray(item.onyomi) ? item.onyomi : [],
          kunyomi: Array.isArray(item.kunyomi) ? item.kunyomi : [],
        }, resolvedSourceMode);
        const existing = focusedItems.some(entry => entry.key === key);
        const next = existing
          ? focusedItems.filter(entry => entry.key !== key)
          : [...focusedItems, { key, sourceMode: resolvedSourceMode, item: plainItem }];
        await saveFocusedItems(next);
        // Focus leaderboard session is tied to the current focus set; reset it whenever the set changes.
        setSessionLeaderboard(prev => prev.filter(entry => !isFocusModeKey(entry.mode)));
        setLastRecordUpdate(prev => (prev && isFocusModeKey(prev.mode) ? null : prev));
        void persistActiveFocusSnapshotId(null);
      } catch (err) {
        console.error('Failed to toggle Focus item:', err);
      }
    },
    [focusedItems, getFocusItemKey, getItemSourceMode, persistActiveFocusSnapshotId, saveFocusedItems],
  );

  const isJlptMode = isJlptQuizMode(quizMode);
  const isFocusMode = quizMode === 'focus';
  const shouldShowJlptModeControls = (isJlptMode || isFocusMode) && !engModeEnabled;
  const isJlptJapaneseInputMode = !engModeEnabled && isJlptMode && jlptReadingMode === 'jp_on_kun_kanji';
  const isJlptEnglishMode = isJlptMode && (engModeEnabled || isJlptEnglishTranslateMode(jlptReadingMode));
  const isKanjiStudyMode = isJlptMode || isFocusMode;
  const isEnglishVocabularyMode = engModeEnabled && isKanjiStudyMode;
  const isEnglishAlphabetMode = engModeEnabled && !isKanjiStudyMode;
  const shouldShowJlptKanjiInfo = isKanjiStudyMode && !isJlptJapaneseInputMode;
  const activeModeKey = getQuizModeKey(quizMode, jlptReadingMode);
  const columnCount = isJlptJapaneseInputMode ? 4 : 5;

  useEffect(() => {
    if (!engModeEnabled) return;
    if (quizFamily !== 'kana') return;
    if (quizMode === 'hiragana' || quizMode === 'hiragana_dakuten') return;
    if (isRunning) return;
    selectQuizMode('hiragana');
  }, [engModeEnabled, isRunning, quizFamily, quizMode]);

  useEffect(() => {
    if (quizMode === 'focus') return;
    const isKanaMode =
      KANA_VARIANT_OPTIONS.hiragana.includes(quizMode as any) ||
      KANA_VARIANT_OPTIONS.katakana.includes(quizMode as any);
    const isJlptLikeMode = isJlptQuizMode(quizMode);
    if (!isKanaMode && !isJlptLikeMode) return;
    const nextDataset = engModeEnabled && isKanaMode
      ? ENGLISH_ALPHABET_QUIZ
      : getQuizDataset(quizMode);
    setQuizItems(shuffleQuiz(nextDataset));
    setAnswers({});
    setHasFinished(false);
    setFinishReason(null);
    setCompletionTimeMs(null);
  }, [engModeEnabled, quizMode]);

  const openJishoWord = useCallback(async (kanji: string) => {
    if (!kanji) return;
    const url = `https://jisho.org/search/${encodeURIComponent(kanji)}`;
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
    const loadFocusedItems = async () => {
      try {
        const stored = await AsyncStorage.getItem(QUIZ_FOCUS_STORAGE_KEY);
        if (!stored) return;
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return;
        const cleaned = parsed
          .filter(entry => entry && entry.item && entry.sourceMode)
          .map(entry => ({
            key: entry.key || `${entry.sourceMode}:${entry.item?.id || entry.item?.kana || ''}`,
            sourceMode: entry.sourceMode,
            item: normalizeStoredFocusItem({
              id: entry.item.id,
              kana: entry.item.kana,
              answers: entry.item.answers,
              onyomi: entry.item.onyomi,
              kunyomi: entry.item.kunyomi,
            }, entry.sourceMode),
          }));
        setFocusedItems(cleaned);
        await AsyncStorage.setItem(QUIZ_FOCUS_STORAGE_KEY, JSON.stringify(cleaned));
      } catch (err) {
        console.error('Failed to load focus items:', err);
      }
    };
    void loadFocusedItems();
  }, []);

  useEffect(() => {
    if (quizMode !== 'focus') return;
    setQuizItems(
      focusDataset.map(entry => ({
        ...entry,
      })),
    );
    setAnswers({});
    setIsRunning(false);
    setHasFinished(false);
    setFinishReason(null);
    setCompletionTimeMs(null);
    setQuizBackspaceCount(0);
    quizBackspacePenaltyWordIdsRef.current.clear();
    setLastRecordUpdate(null);
    setRemainingSeconds(timerMinutes * 60);
    remainingSecondsRef.current = timerMinutes * 60;
    timerDeadlineMsRef.current = null;
  }, [quizMode]);

  useEffect(() => {
    if (!shouldShowJlptModeControls) {
      setIsJlptModeDropdownOpen(false);
      setIsJlptSetDropdownOpen(false);
    }
  }, [shouldShowJlptModeControls]);

  useEffect(() => {
    if (quizFamily !== 'kana') {
      setOpenKanaDropdownBase(null);
    }
  }, [quizFamily]);

  useEffect(() => {
    remainingSecondsRef.current = remainingSeconds;
  }, [remainingSeconds]);

  useEffect(() => {
    if (quizMode === 'focus' && leaderboardScope !== 'session') {
      setLeaderboardScope('session');
    }
  }, [leaderboardScope, quizMode]);

  useEffect(() => {
    if (!leaderboardScoresEnabled && leaderboardRankMode !== 'time') {
      setLeaderboardRankMode('time');
    }
  }, [leaderboardRankMode, leaderboardScoresEnabled]);


  const focusColumnBuckets = useMemo(() => {
    return buildColumnBuckets(
      quizItems.map(item => item.id),
      columnCount,
    );
  }, [columnCount, quizItems]);

  const focusOrder = useMemo(() => focusColumnBuckets.flat(), [focusColumnBuckets]);

  const focusDownById = useMemo(() => {
    const map: Record<string, string[]> = {};
    focusColumnBuckets.forEach(column => {
      column.forEach((id, index) => {
        map[id] = column.slice(index + 1);
      });
    });
    return map;
  }, [focusColumnBuckets]);

  const indexById = useMemo(() => {
    const map: Record<string, number> = {};
    focusOrder.forEach((id, index) => {
      map[id] = index;
    });
    return map;
  }, [focusOrder]);

  const acceptedLookup = useMemo(() => {
    return quizItems.reduce<Record<string, string[]>>((acc, item) => {
      acc[item.id] = getAcceptedAnswersForItem(item);
      return acc;
    }, {});
  }, [getAcceptedAnswersForItem, quizItems]);

  const isCorrectAnswer = useCallback(
    (id: string, value: string) => {
      const accepted = acceptedLookup[id] || [];
      if (isJlptJapaneseInputMode) {
        const sanitized = sanitizeJapaneseInput(value).trim();
        if (!sanitized || !JAPANESE_INPUT_CHAR_REGEX.test(sanitized)) return false;
        return accepted.includes(sanitized);
      }
      const hasJapaneseAccepted = accepted.some(entry => JAPANESE_INPUT_CHAR_REGEX.test(entry || ''));
      if (hasJapaneseAccepted) {
        const sanitized = sanitizeJapaneseInput(value).trim();
        return sanitized.length > 0 && accepted.includes(sanitized);
      }
      const normalized = normalizeRomaji(value);
      return normalized.length > 0 && accepted.includes(normalized);
    },
    [acceptedLookup, isJlptJapaneseInputMode],
  );

  const compareLeaderboardEntriesByTime = useCallback(
    (
      a: { mode: string; timeMs: number; score: number; total: number; date: number; finishReason?: 'complete' | 'time' | 'stopped' },
      b: { mode: string; timeMs: number; score: number; total: number; date: number; finishReason?: 'complete' | 'time' | 'stopped' },
    ) => {
      const aComplete = (a.finishReason || 'complete') === 'complete' ? 1 : 0;
      const bComplete = (b.finishReason || 'complete') === 'complete' ? 1 : 0;
      if (bComplete !== aComplete) return bComplete - aComplete;
      if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
      if (b.score !== a.score) return b.score - a.score;
      return a.date - b.date;
    },
    [],
  );

  const compareLeaderboardEntriesByScore = useCallback(
    (
      a: { mode: string; timeMs: number; score: number; total: number; date: number; finishReason?: 'complete' | 'time' | 'stopped' },
      b: { mode: string; timeMs: number; score: number; total: number; date: number; finishReason?: 'complete' | 'time' | 'stopped' },
    ) => {
      const aRankScore = getLeaderboardRankScore(a as any);
      const bRankScore = getLeaderboardRankScore(b as any);
      if (bRankScore !== aRankScore) return bRankScore - aRankScore;
      const aComplete = (a.finishReason || 'complete') === 'complete' ? 1 : 0;
      const bComplete = (b.finishReason || 'complete') === 'complete' ? 1 : 0;
      if (bComplete !== aComplete) return bComplete - aComplete;
      if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
      return a.date - b.date;
    },
    [],
  );

  const activeLeaderboardComparator = useMemo(
    () =>
      leaderboardScoresEnabled && leaderboardRankMode === 'score'
        ? compareLeaderboardEntriesByScore
        : compareLeaderboardEntriesByTime,
    [compareLeaderboardEntriesByScore, compareLeaderboardEntriesByTime, leaderboardRankMode, leaderboardScoresEnabled],
  );

  const limitLeaderboardPerMode = useCallback(
    (items: Array<{ mode: string; timeMs: number; score: number; total: number; date: number; finishReason?: 'complete' | 'time' | 'stopped'; timerMinutes?: number }>) => {
      const byMode = items.reduce<Record<string, Array<{ mode: string; timeMs: number; score: number; total: number; date: number; finishReason?: 'complete' | 'time' | 'stopped'; timerMinutes?: number }>>>(
        (acc, item) => {
          const rawMode = item?.mode || QUIZ_MODES[0].value;
          const modeKey = normalizeStoredQuizModeKey(rawMode);
          const normalizedTimerMinutes = normalizeLeaderboardTimerMinutes(item?.timerMinutes);
          const normalizedScoreType = normalizeLeaderboardScoreType(item?.scoreType);
          const bucketKey = `${modeKey}|${normalizedTimerMinutes}|${normalizedScoreType}`;
          if (!acc[bucketKey]) acc[bucketKey] = [];
          acc[bucketKey].push({ ...item, mode: modeKey, timerMinutes: normalizedTimerMinutes, scoreType: normalizedScoreType === 'off' ? undefined : normalizedScoreType });
          return acc;
        },
        {},
      );
      return Object.values(byMode).flatMap(modeEntries =>
        {
          const normalizedEntries = modeEntries.map(entry => ({ ...entry, finishReason: entry.finishReason || 'complete' }));
          const topTimeEntries = [...normalizedEntries].sort(compareLeaderboardEntriesByTime).slice(0, 10);
          const topScoreEntries = [...normalizedEntries].sort(compareLeaderboardEntriesByScore).slice(0, 10);
          const keptEntries = [...topTimeEntries];
          topScoreEntries.forEach(entry => {
            const alreadyIncluded = keptEntries.some(candidate =>
              candidate.date === entry.date &&
              candidate.timeMs === entry.timeMs &&
              candidate.score === entry.score &&
              candidate.total === entry.total &&
              candidate.mode === entry.mode &&
              normalizeLeaderboardTimerMinutes(candidate.timerMinutes) === normalizeLeaderboardTimerMinutes(entry.timerMinutes) &&
              normalizeLeaderboardScoreType(candidate.scoreType) === normalizeLeaderboardScoreType(entry.scoreType) &&
              (candidate.finishReason || 'complete') === (entry.finishReason || 'complete') &&
              (candidate.typemasterQueueMode || '') === (entry.typemasterQueueMode || '')
            );
            if (!alreadyIncluded) {
              keptEntries.push(entry);
            }
          });
          return keptEntries;
        },
      );
    },
    [compareLeaderboardEntriesByScore, compareLeaderboardEntriesByTime],
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

  useEffect(() => {
    const loadSnapshots = async () => {
      try {
        const [leaderboardRaw, focusRaw, activeFocusSnapshotRaw] = await Promise.all([
          AsyncStorage.getItem(QUIZ_LEADERBOARD_SNAPSHOTS_STORAGE_KEY),
          AsyncStorage.getItem(QUIZ_FOCUS_SNAPSHOTS_STORAGE_KEY),
          AsyncStorage.getItem(QUIZ_ACTIVE_FOCUS_SNAPSHOT_STORAGE_KEY),
        ]);
        const parsedLeaderboard = leaderboardRaw ? JSON.parse(leaderboardRaw) : [];
        const parsedFocus = focusRaw ? JSON.parse(focusRaw) : [];
        setLeaderboardSnapshots(
          Array.isArray(parsedLeaderboard)
            ? parsedLeaderboard
                .filter(item => item && item.id && item.name)
                .map(item => ({
                  id: `${item.id}`,
                  name: `${item.name}`,
                  createdAt: Number(item.createdAt) || Date.now(),
                  leaderboard: Array.isArray(item.leaderboard) ? item.leaderboard : [],
                  sessionLeaderboard: Array.isArray(item.sessionLeaderboard) ? item.sessionLeaderboard : [],
                }))
            : [],
        );
        setFocusSnapshots(
          Array.isArray(parsedFocus)
            ? parsedFocus
                .filter(item => item && item.id && item.name)
                .map(item => ({
                  id: `${item.id}`,
                  name: `${item.name}`,
                  createdAt: Number(item.createdAt) || Date.now(),
                  focusItems: Array.isArray(item.focusItems) ? item.focusItems : [],
                  focusLeaderboard: Array.isArray(item.focusLeaderboard) ? item.focusLeaderboard : [],
                }))
            : [],
        );
        setActiveFocusSnapshotId(activeFocusSnapshotRaw ? `${activeFocusSnapshotRaw}` : null);
      } catch (err) {
        console.error('Failed to load save snapshots:', err);
      }
    };
    void loadSnapshots();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const openSaveManager = () => setIsSaveManagerOpen(true);
    window.addEventListener(QUIZ_SAVE_MANAGER_OPEN_EVENT, openSaveManager as EventListener);
    return () => {
      window.removeEventListener(QUIZ_SAVE_MANAGER_OPEN_EVENT, openSaveManager as EventListener);
    };
  }, []);

  const exportLeaderboardData = useCallback(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      Alert.alert('Unavailable', 'Leaderboard export is only available in the web/extension view.');
      return;
    }
    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        storageKey: QUIZ_LEADERBOARD_STORAGE_KEY,
        leaderboard,
        sessionLeaderboard,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const stamp = formatDateKey(new Date()).replace(/-/g, '');
      anchor.href = url;
      anchor.download = `tensai-leaderboard-${stamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export leaderboard:', err);
      Alert.alert('Export failed', 'Could not export leaderboard data.');
    }
  }, [leaderboard, sessionLeaderboard]);

  const importLeaderboardData = useCallback(async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      Alert.alert('Unavailable', 'Leaderboard import is only available in the web/extension view.');
      return;
    }

    try {
      const shouldReplace = window.confirm('Importing will replace the current saved leaderboard. Continue?');
      if (!shouldReplace) return;

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.style.display = 'none';

      input.onchange = async () => {
        try {
          const file = input.files?.[0];
          if (!file) return;
          const text = await file.text();
          const parsed = JSON.parse(text);
          const rawLeaderboard = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.leaderboard)
              ? parsed.leaderboard
              : [];
          const rawSessionLeaderboard = Array.isArray(parsed?.sessionLeaderboard)
            ? parsed.sessionLeaderboard
            : [];

          const normalizedLeaderboard = limitLeaderboardPerMode(rawLeaderboard);
          const normalizedSession = limitLeaderboardPerMode(rawSessionLeaderboard);

          await AsyncStorage.setItem(QUIZ_LEADERBOARD_STORAGE_KEY, JSON.stringify(normalizedLeaderboard));
          setLeaderboard(normalizedLeaderboard);
          setSessionLeaderboard(normalizedSession);
          setIsLeaderboardEditMode(false);
          Alert.alert('Import complete', `Loaded ${normalizedLeaderboard.length} leaderboard entries.`);
        } catch (err) {
          console.error('Failed to import leaderboard:', err);
          Alert.alert('Import failed', 'The selected file is not a valid leaderboard export.');
        } finally {
          if (input.parentNode) {
            input.parentNode.removeChild(input);
          }
        }
      };

      document.body.appendChild(input);
      input.click();
    } catch (err) {
      console.error('Failed to open leaderboard import picker:', err);
      Alert.alert('Import failed', 'Could not open file picker.');
    }
  }, [limitLeaderboardPerMode]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleExport = () => {
      exportLeaderboardData();
    };
    const handleImport = () => {
      void importLeaderboardData();
    };

    window.addEventListener(QUIZ_LEADERBOARD_EXPORT_EVENT, handleExport as EventListener);
    window.addEventListener(QUIZ_LEADERBOARD_IMPORT_EVENT, handleImport as EventListener);

    return () => {
      window.removeEventListener(QUIZ_LEADERBOARD_EXPORT_EVENT, handleExport as EventListener);
      window.removeEventListener(QUIZ_LEADERBOARD_IMPORT_EVENT, handleImport as EventListener);
    };
  }, [exportLeaderboardData, importLeaderboardData]);

  const persistActiveFocusSnapshotLeaderboard = useCallback(
    async (focusEntries: any[]) => {
      if (!activeFocusSnapshotId) return;
      const nextSnapshots = focusSnapshots.map(snapshot =>
        snapshot.id === activeFocusSnapshotId
          ? { ...snapshot, focusLeaderboard: limitLeaderboardPerMode(focusEntries.filter(entry => isFocusModeKey(entry?.mode))) }
          : snapshot,
      );
      await persistFocusSnapshots(nextSnapshots);
    },
    [activeFocusSnapshotId, focusSnapshots, limitLeaderboardPerMode, persistFocusSnapshots],
  );

  useEffect(() => {
    if (!activeFocusSnapshotId) return;
    const focusEntries = sessionLeaderboard.filter(entry => isFocusModeKey(entry.mode));
    void persistActiveFocusSnapshotLeaderboard(focusEntries);
  }, [activeFocusSnapshotId, persistActiveFocusSnapshotLeaderboard, sessionLeaderboard]);

  const saveLeaderboardEntry = useCallback(async (entry: { mode: string; timeMs: number; score: number; total: number; date: number; finishReason: 'complete' | 'time' | 'stopped'; timerMinutes?: number; scoreType?: string }) => {
    try {
      const isFocusEntry = isFocusModeKey(entry.mode);
      const normalizedEntry = {
        ...entry,
        timerMinutes: normalizeLeaderboardTimerMinutes(entry.timerMinutes),
      };
      const todayKey = formatDateKey(new Date());
      const currentSessionEntries = Array.isArray(sessionLeaderboard) ? sessionLeaderboard : [];
      let nextFocusSessionEntries: any[] = [];
      let nextSessionLeaderboard: any[] = currentSessionEntries;
      if (isFocusEntry) {
        const nonFocusEntries = currentSessionEntries.filter(item => !isFocusModeKey(item.mode));
        const focusEntries = currentSessionEntries.filter(item => isFocusModeKey(item.mode));
        const nextFocusEntries = limitLeaderboardPerMode([...focusEntries, normalizedEntry]).filter(item => isFocusModeKey(item.mode));
        nextFocusSessionEntries = nextFocusEntries;
        nextSessionLeaderboard = [...nonFocusEntries, ...nextFocusEntries];
      } else {
        const focusEntries = currentSessionEntries.filter(item => isFocusModeKey(item.mode));
        const nonFocusEntries = currentSessionEntries.filter(item => !isFocusModeKey(item.mode));
        const sessionToday = nonFocusEntries.filter(item => formatDateKey(new Date(item.date)) === todayKey);
        const perModeTop10 = limitLeaderboardPerMode([...sessionToday, normalizedEntry]).filter(item => !isFocusModeKey(item.mode));
        const nextSession = perModeTop10.filter(item => formatDateKey(new Date(item.date)) === todayKey);
        nextFocusSessionEntries = focusEntries;
        nextSessionLeaderboard = [...focusEntries, ...nextSession];
      }
      setSessionLeaderboard(nextSessionLeaderboard);

      // Focus mode participates only in Current Session leaderboard (no persisted all-time storage).
      if (isFocusEntry) {
        await persistActiveFocusSnapshotLeaderboard(nextFocusSessionEntries);
        return null;
      }

      const stored = await AsyncStorage.getItem(QUIZ_LEADERBOARD_STORAGE_KEY);
      const current = stored ? JSON.parse(stored) : [];
      const currentEntries = Array.isArray(current) ? current : [];
      const normalizedScoreType = normalizeLeaderboardScoreType(normalizedEntry.scoreType);
      const currentModeEntries = currentEntries
        .filter(item => normalizeStoredQuizModeKey(item?.mode) === normalizedEntry.mode)
        .filter(item => normalizeLeaderboardTimerMinutes(item?.timerMinutes) === normalizedEntry.timerMinutes)
        .filter(item => normalizeLeaderboardScoreType(item?.scoreType) === normalizedScoreType)
        .map(item => ({ ...item, finishReason: item.finishReason || 'complete', timerMinutes: normalizeLeaderboardTimerMinutes(item?.timerMinutes), scoreType: normalizeLeaderboardScoreType(item?.scoreType) === 'off' ? undefined : normalizeLeaderboardScoreType(item?.scoreType) }))
        .sort(compareLeaderboardEntriesByTime);
      const previousTop = currentModeEntries.length ? currentModeEntries[0] : null;
      const updated = Array.isArray(current) ? [...current, normalizedEntry] : [normalizedEntry];
      const perModeTop10 = limitLeaderboardPerMode(updated);
      await AsyncStorage.setItem(QUIZ_LEADERBOARD_STORAGE_KEY, JSON.stringify(perModeTop10));
      setLeaderboard(perModeTop10);
      const updatedModeEntries = perModeTop10
        .filter(item => item?.mode === normalizedEntry.mode)
        .filter(item => normalizeLeaderboardTimerMinutes(item?.timerMinutes) === normalizedEntry.timerMinutes)
        .filter(item => normalizeLeaderboardScoreType(item?.scoreType) === normalizedScoreType)
        .map(item => ({ ...item, finishReason: item.finishReason || 'complete', timerMinutes: normalizeLeaderboardTimerMinutes(item?.timerMinutes), scoreType: normalizeLeaderboardScoreType(item?.scoreType) === 'off' ? undefined : normalizeLeaderboardScoreType(item?.scoreType) }))
        .sort(compareLeaderboardEntriesByTime);
      const rankIndex = updatedModeEntries.findIndex(item => item?.date === normalizedEntry.date);
      return {
        isNewRecord: rankIndex === 0 && (!previousTop || previousTop.date !== normalizedEntry.date),
        rank: rankIndex >= 0 ? rankIndex + 1 : null,
      };
    } catch (err) {
      console.error('Failed to save leaderboard entry:', err);
      return null;
    }
  }, [compareLeaderboardEntriesByTime, limitLeaderboardPerMode, persistActiveFocusSnapshotLeaderboard, sessionLeaderboard]);

  const persistLeaderboardSnapshots = useCallback(async (next: Array<{ id: string; name: string; createdAt: number; leaderboard: any[]; sessionLeaderboard: any[] }>) => {
    setLeaderboardSnapshots(next);
    await AsyncStorage.setItem(QUIZ_LEADERBOARD_SNAPSHOTS_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const persistFocusSnapshots = useCallback(async (next: Array<{ id: string; name: string; createdAt: number; focusItems: any[]; focusLeaderboard?: any[] }>) => {
    setFocusSnapshots(next);
    await AsyncStorage.setItem(QUIZ_FOCUS_SNAPSHOTS_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const persistActiveFocusSnapshotId = useCallback(async (snapshotId: string | null) => {
    setActiveFocusSnapshotId(snapshotId);
    if (snapshotId) {
      await AsyncStorage.setItem(QUIZ_ACTIVE_FOCUS_SNAPSHOT_STORAGE_KEY, snapshotId);
      return;
    }
    await AsyncStorage.removeItem(QUIZ_ACTIVE_FOCUS_SNAPSHOT_STORAGE_KEY);
  }, []);

  const exportSaveStatesData = useCallback(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      Alert.alert('Unavailable', 'Save state export is only available in the web/extension view.');
      return;
    }
    try {
      const payload = {
        version: 1,
        type: 'tensai-save-states',
        exportedAt: new Date().toISOString(),
        leaderboardSnapshots,
        focusSnapshots,
        activeFocusSnapshotId,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const stamp = formatDateKey(new Date()).replace(/-/g, '');
      anchor.href = url;
      anchor.download = `tensai-save-states-${stamp}${SAVE_STATES_FILE_EXTENSION}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export save states:', err);
      Alert.alert('Export failed', 'Could not export save states.');
    }
  }, [activeFocusSnapshotId, focusSnapshots, leaderboardSnapshots]);

  const importSaveStatesData = useCallback(async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      Alert.alert('Unavailable', 'Save state import is only available in the web/extension view.');
      return;
    }

    try {
      const shouldReplace = window.confirm('Importing save states will replace all Save Manager entries. Continue?');
      if (!shouldReplace) return;

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = `application/json,.json,${SAVE_STATES_FILE_EXTENSION}`;
      input.style.display = 'none';

      input.onchange = async () => {
        try {
          const file = input.files?.[0];
          if (!file) return;
          const text = await file.text();
          const parsed = JSON.parse(text);

          const rawLeaderboardSnapshots = Array.isArray(parsed?.leaderboardSnapshots) ? parsed.leaderboardSnapshots : [];
          const rawFocusSnapshots = Array.isArray(parsed?.focusSnapshots) ? parsed.focusSnapshots : [];

          const normalizedLeaderboardSnapshots = rawLeaderboardSnapshots
            .filter(item => item && typeof item === 'object')
            .map(item => ({
              id: item.id ? `${item.id}` : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: item.name ? `${item.name}` : 'Imported leaderboard save',
              createdAt: Number(item.createdAt) || Date.now(),
              leaderboard: limitLeaderboardPerMode(Array.isArray(item.leaderboard) ? item.leaderboard : []),
              sessionLeaderboard: limitLeaderboardPerMode(Array.isArray(item.sessionLeaderboard) ? item.sessionLeaderboard : []),
            }))
            .slice(0, 50);

          const normalizedFocusSnapshots = rawFocusSnapshots
            .filter(item => item && typeof item === 'object')
            .map(item => ({
              id: item.id ? `${item.id}` : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: item.name ? `${item.name}` : 'Imported focus save',
              createdAt: Number(item.createdAt) || Date.now(),
              focusItems: (Array.isArray(item.focusItems) ? item.focusItems : [])
                .filter(entry => entry && typeof entry === 'object' && entry.item && entry.sourceMode)
                .map(entry => {
                  const sourceMode = `${entry.sourceMode}`;
                  const rawItem = entry.item && typeof entry.item === 'object' ? entry.item : {};
                  return {
                    key: entry.key ? `${entry.key}` : `${sourceMode}:${rawItem.id || rawItem.kana || Math.random().toString(36).slice(2, 8)}`,
                    sourceMode,
                    item: {
                      ...normalizeStoredFocusItem(rawItem, sourceMode),
                    },
                  };
                }),
              focusLeaderboard: limitLeaderboardPerMode(
                (Array.isArray(item.focusLeaderboard) ? item.focusLeaderboard : [])
                  .filter(entry => isFocusModeKey(entry?.mode || '')),
              ),
            }))
            .slice(0, 100);

          const requestedActiveFocusSnapshotId = parsed?.activeFocusSnapshotId ? `${parsed.activeFocusSnapshotId}` : null;
          const normalizedActiveFocusSnapshotId = requestedActiveFocusSnapshotId &&
            normalizedFocusSnapshots.some(snapshot => snapshot.id === requestedActiveFocusSnapshotId)
            ? requestedActiveFocusSnapshotId
            : null;

          await persistLeaderboardSnapshots(normalizedLeaderboardSnapshots);
          await persistFocusSnapshots(normalizedFocusSnapshots);
          await persistActiveFocusSnapshotId(normalizedActiveFocusSnapshotId);

          Alert.alert(
            'Import complete',
            `Loaded ${normalizedLeaderboardSnapshots.length} leaderboard saves and ${normalizedFocusSnapshots.length} focus saves.`,
          );
        } catch (err) {
          console.error('Failed to import save states:', err);
          Alert.alert('Import failed', 'The selected file is not a valid save state export.');
        } finally {
          if (input.parentNode) {
            input.parentNode.removeChild(input);
          }
        }
      };

      document.body.appendChild(input);
      input.click();
    } catch (err) {
      console.error('Failed to open save state import picker:', err);
      Alert.alert('Import failed', 'Could not open file picker.');
    }
  }, [limitLeaderboardPerMode, persistActiveFocusSnapshotId, persistFocusSnapshots, persistLeaderboardSnapshots]);

  const exportFocusSaveStatesData = useCallback(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      Alert.alert('Unavailable', 'Focus save export is only available in the web/extension view.');
      return;
    }
    try {
      const payload = {
        version: 1,
        type: 'tensai-focus-save-states',
        exportedAt: new Date().toISOString(),
        focusSnapshots,
        activeFocusSnapshotId,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const stamp = formatDateKey(new Date()).replace(/-/g, '');
      anchor.href = url;
      anchor.download = `tensai-focus-save-states-${stamp}${FOCUS_SAVE_STATES_FILE_EXTENSION}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export focus save states:', err);
      Alert.alert('Export failed', 'Could not export Focus save states.');
    }
  }, [activeFocusSnapshotId, focusSnapshots]);

  const importFocusSaveStatesData = useCallback(async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      Alert.alert('Unavailable', 'Focus save import is only available in the web/extension view.');
      return;
    }
    try {
      const shouldReplace = window.confirm('Importing Focus save states will replace all Focus saves. Continue?');
      if (!shouldReplace) return;

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = `application/json,.json,${FOCUS_SAVE_STATES_FILE_EXTENSION},${SAVE_STATES_FILE_EXTENSION}`;
      input.style.display = 'none';

      input.onchange = async () => {
        try {
          const file = input.files?.[0];
          if (!file) return;
          const text = await file.text();
          const parsed = JSON.parse(text);

          const rawFocusSnapshots = Array.isArray(parsed?.focusSnapshots)
            ? parsed.focusSnapshots
            : Array.isArray(parsed)
              ? parsed
              : [];

          const normalizedFocusSnapshots = rawFocusSnapshots
            .filter(item => item && typeof item === 'object')
            .map(item => ({
              id: item.id ? `${item.id}` : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: item.name ? `${item.name}` : 'Imported focus save',
              createdAt: Number(item.createdAt) || Date.now(),
              focusItems: (Array.isArray(item.focusItems) ? item.focusItems : [])
                .filter(entry => entry && typeof entry === 'object' && entry.item && entry.sourceMode)
                .map(entry => {
                  const sourceMode = `${entry.sourceMode}`;
                  const rawItem = entry.item && typeof entry.item === 'object' ? entry.item : {};
                  return {
                    key: entry.key ? `${entry.key}` : `${sourceMode}:${rawItem.id || rawItem.kana || Math.random().toString(36).slice(2, 8)}`,
                    sourceMode,
                    item: {
                      ...normalizeStoredFocusItem(rawItem, sourceMode),
                    },
                  };
                }),
              focusLeaderboard: limitLeaderboardPerMode(
                (Array.isArray(item.focusLeaderboard) ? item.focusLeaderboard : [])
                  .filter(entry => isFocusModeKey(entry?.mode || '')),
              ),
            }))
            .slice(0, 100);

          const requestedActiveFocusSnapshotId = parsed?.activeFocusSnapshotId ? `${parsed.activeFocusSnapshotId}` : null;
          const normalizedActiveFocusSnapshotId = requestedActiveFocusSnapshotId &&
            normalizedFocusSnapshots.some(snapshot => snapshot.id === requestedActiveFocusSnapshotId)
            ? requestedActiveFocusSnapshotId
            : null;

          await persistFocusSnapshots(normalizedFocusSnapshots);
          await persistActiveFocusSnapshotId(normalizedActiveFocusSnapshotId);

          Alert.alert('Import complete', `Loaded ${normalizedFocusSnapshots.length} Focus saves.`);
        } catch (err) {
          console.error('Failed to import focus save states:', err);
          Alert.alert('Import failed', 'The selected file is not a valid Focus save export.');
        } finally {
          if (input.parentNode) {
            input.parentNode.removeChild(input);
          }
        }
      };

      document.body.appendChild(input);
      input.click();
    } catch (err) {
      console.error('Failed to open focus save state import picker:', err);
      Alert.alert('Import failed', 'Could not open file picker.');
    }
  }, [limitLeaderboardPerMode, persistActiveFocusSnapshotId, persistFocusSnapshots]);

  const createLeaderboardSnapshot = useCallback(async () => {
    const name = leaderboardSnapshotName.trim();
    if (!name) {
      Alert.alert('Name required', 'Enter a name for the leaderboard save.');
      return;
    }
    const snapshot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      createdAt: Date.now(),
      leaderboard: [...leaderboard],
      sessionLeaderboard: [...sessionLeaderboard],
    };
    const next = [snapshot, ...leaderboardSnapshots].slice(0, 50);
    try {
      await persistLeaderboardSnapshots(next);
      setLeaderboardSnapshotName('');
    } catch (err) {
      console.error('Failed to save leaderboard snapshot:', err);
      Alert.alert('Save failed', 'Could not save leaderboard snapshot.');
    }
  }, [leaderboard, leaderboardSnapshotName, leaderboardSnapshots, persistLeaderboardSnapshots, sessionLeaderboard]);

  const loadLeaderboardSnapshot = useCallback(async (snapshot: { id: string; name: string; createdAt: number; leaderboard: any[]; sessionLeaderboard: any[] }) => {
    try {
      const normalizedLeaderboard = limitLeaderboardPerMode(Array.isArray(snapshot.leaderboard) ? snapshot.leaderboard : []);
      const normalizedSession = limitLeaderboardPerMode(Array.isArray(snapshot.sessionLeaderboard) ? snapshot.sessionLeaderboard : []);
      setLeaderboard(normalizedLeaderboard);
      setSessionLeaderboard(normalizedSession);
      await AsyncStorage.setItem(QUIZ_LEADERBOARD_STORAGE_KEY, JSON.stringify(normalizedLeaderboard));
      setIsSaveManagerOpen(false);
    } catch (err) {
      console.error('Failed to load leaderboard snapshot:', err);
      Alert.alert('Load failed', 'Could not load leaderboard snapshot.');
    }
  }, [limitLeaderboardPerMode]);

  const deleteLeaderboardSnapshot = useCallback(async (snapshotId: string) => {
    try {
      await persistLeaderboardSnapshots(leaderboardSnapshots.filter(item => item.id !== snapshotId));
    } catch (err) {
      console.error('Failed to delete leaderboard snapshot:', err);
      Alert.alert('Delete failed', 'Could not delete leaderboard snapshot.');
    }
  }, [leaderboardSnapshots, persistLeaderboardSnapshots]);

  const confirmAction = useCallback(
    (title: string, message: string) =>
      new Promise<boolean>(resolve => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          resolve(window.confirm(message));
          return;
        }
        Alert.alert(
          title,
          message,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Yes', onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        );
      }),
    [],
  );

  const createFocusSnapshot = useCallback(async () => {
    const name = focusSnapshotName.trim();
    if (!name) {
      Alert.alert('Name required', 'Enter a name for the Focus save.');
      return;
    }
    const snapshot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      createdAt: Date.now(),
      focusItems: focusedItems.map(item => ({
        key: item.key,
        sourceMode: item.sourceMode,
        item: item.item,
      })),
      focusLeaderboard: sessionLeaderboard.filter(entry => isFocusModeKey(entry.mode)),
    };
    const next = [snapshot, ...focusSnapshots].slice(0, 100);
    try {
      await persistFocusSnapshots(next);
      await persistActiveFocusSnapshotId(snapshot.id);
      setFocusSnapshotName('');
    } catch (err) {
      console.error('Failed to save focus snapshot:', err);
      Alert.alert('Save failed', 'Could not save Focus snapshot.');
    }
  }, [focusSnapshotName, focusSnapshots, focusedItems, persistActiveFocusSnapshotId, persistFocusSnapshots, sessionLeaderboard]);

  const overwriteFocusSnapshot = useCallback(async (snapshotId: string) => {
    const targetSnapshot = focusSnapshots.find(item => item.id === snapshotId);
    if (!targetSnapshot) {
      Alert.alert('Overwrite failed', 'That Focus save no longer exists.');
      return;
    }

    const confirmed = await confirmAction(
      'Overwrite Focus Save',
      `Overwrite "${targetSnapshot.name}" with the currently loaded Focus items? This cannot be undone.`,
    );
    if (!confirmed) return;

    const nextSnapshots = focusSnapshots.map(snapshot =>
      snapshot.id === snapshotId
        ? {
            ...snapshot,
            createdAt: Date.now(),
            focusItems: focusedItems.map(item => ({
              key: item.key,
              sourceMode: item.sourceMode,
              item: item.item,
            })),
            focusLeaderboard: sessionLeaderboard.filter(entry => isFocusModeKey(entry.mode)),
          }
        : snapshot,
    );

    try {
      await persistFocusSnapshots(nextSnapshots);
      await persistActiveFocusSnapshotId(snapshotId);
    } catch (err) {
      console.error('Failed to overwrite focus snapshot:', err);
      Alert.alert('Overwrite failed', 'Could not overwrite Focus snapshot.');
    }
  }, [confirmAction, focusSnapshots, focusedItems, persistActiveFocusSnapshotId, persistFocusSnapshots, sessionLeaderboard]);

  const loadFocusSnapshot = useCallback(async (snapshot: { id: string; name: string; createdAt: number; focusItems: any[]; focusLeaderboard?: any[] }) => {
    try {
      const cleaned = (Array.isArray(snapshot.focusItems) ? snapshot.focusItems : [])
        .filter(entry => entry && entry.item && entry.sourceMode)
        .map(entry => ({
          key: entry.key || `${entry.sourceMode}:${entry.item?.id || entry.item?.kana || Math.random().toString(36).slice(2, 8)}`,
          sourceMode: entry.sourceMode,
          item: {
            ...normalizeStoredFocusItem(entry.item, entry.sourceMode),
          },
        }));
      await saveFocusedItems(cleaned);
      const restoredFocusLeaderboard = limitLeaderboardPerMode(
        (Array.isArray(snapshot.focusLeaderboard) ? snapshot.focusLeaderboard : [])
          .filter(entry => isFocusModeKey(entry?.mode)),
      );
      setSessionLeaderboard(prev => [
        ...prev.filter(entry => !isFocusModeKey(entry.mode)),
        ...restoredFocusLeaderboard,
      ]);
      await persistActiveFocusSnapshotId(snapshot.id);
      if (quizMode === 'focus') {
        setQuizItems(
          shuffleQuiz(
            cleaned.map(entry => ({
              ...entry.item,
              id: entry.key,
              __focusSourceMode: entry.sourceMode,
              __focusOriginalId: entry.item.id,
            })),
          ),
        );
        setAnswers({});
        setHasFinished(false);
        setFinishReason(null);
        setCompletionTimeMs(null);
        setQuizBackspaceCount(0);
        quizBackspacePenaltyWordIdsRef.current.clear();
      }
      setIsSaveManagerOpen(false);
    } catch (err) {
      console.error('Failed to load focus snapshot:', err);
      Alert.alert('Load failed', 'Could not load Focus snapshot.');
    }
  }, [limitLeaderboardPerMode, persistActiveFocusSnapshotId, quizMode, saveFocusedItems]);

  const deleteFocusSnapshot = useCallback(async (snapshotId: string) => {
    try {
      await persistFocusSnapshots(focusSnapshots.filter(item => item.id !== snapshotId));
      if (activeFocusSnapshotId === snapshotId) {
        await persistActiveFocusSnapshotId(null);
      }
    } catch (err) {
      console.error('Failed to delete focus snapshot:', err);
      Alert.alert('Delete failed', 'Could not delete Focus snapshot.');
    }
  }, [activeFocusSnapshotId, focusSnapshots, persistActiveFocusSnapshotId, persistFocusSnapshots]);

  const getEntryIdentity = useCallback(
    (entry: { mode: string; timeMs: number; score: number; total: number; date: number; finishReason?: 'complete' | 'time' | 'stopped'; timerMinutes?: number; typemasterQueueMode?: string; scoreType?: string }) =>
      `${entry.mode}|${normalizeLeaderboardTimerMinutes(entry.timerMinutes)}|${normalizeLeaderboardScoreType(entry.scoreType)}|${entry.typemasterQueueMode || ''}|${entry.date}|${entry.timeMs}|${entry.score}|${entry.total}|${entry.finishReason || 'complete'}`,
    [],
  );

  const deleteLeaderboardEntry = useCallback(
    async (target: { mode: string; timeMs: number; score: number; total: number; date: number; finishReason?: 'complete' | 'time' | 'stopped' }) => {
      const targetKey = getEntryIdentity(target);
      try {
        let nextFocusSessionEntries: any[] = [];
        setLeaderboard(prev => prev.filter(entry => getEntryIdentity(entry) !== targetKey));
        setSessionLeaderboard(prev => {
          const next = prev.filter(entry => getEntryIdentity(entry) !== targetKey);
          nextFocusSessionEntries = next.filter(entry => isFocusModeKey(entry.mode));
          return next;
        });
        if (isFocusModeKey(target.mode)) {
          await persistActiveFocusSnapshotLeaderboard(nextFocusSessionEntries);
        }

        const stored = await AsyncStorage.getItem(QUIZ_LEADERBOARD_STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        const entries = Array.isArray(parsed) ? parsed : [];
        const filtered = entries.filter((entry: any) => getEntryIdentity(entry) !== targetKey);
        await AsyncStorage.setItem(QUIZ_LEADERBOARD_STORAGE_KEY, JSON.stringify(filtered));
      } catch (err) {
        console.error('Failed to delete leaderboard entry:', err);
      }
    },
    [getEntryIdentity, persistActiveFocusSnapshotLeaderboard],
  );

  const requestDeleteLeaderboardEntry = useCallback(
    (entry: { mode: string; timeMs: number; score: number; total: number; date: number; finishReason?: 'complete' | 'time' | 'stopped' }) => {
      const scoreDetails = leaderboardScoresEnabled ? ` (${getLeaderboardTestscoreDisplay(entry)})` : '';
      const message = `Remove ${formatMilliseconds(entry.timeMs)}${scoreDetails} from leaderboard?`;
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
    [deleteLeaderboardEntry, leaderboardScoresEnabled],
  );

  const calculateCorrectAnswers = useCallback(
    (answerMap: Record<string, string>) =>
      quizItems.reduce((sum, item) => {
        const response = answerMap[item.id];
        if (!response) return sum;
        return isCorrectAnswer(item.id, response) ? sum + 1 : sum;
      }, 0),
    [isCorrectAnswer, quizItems],
  );

  const calculateCorrectCharacterCount = useCallback(
    (answerMap: Record<string, string>) =>
      quizItems.reduce((sum, item) => {
        const response = answerMap[item.id];
        if (!response) return sum;
        if (!isCorrectAnswer(item.id, response)) return sum;
        return sum + (item.kana ? item.kana.length : 0);
      }, 0),
    [isCorrectAnswer, quizItems],
  );

  const calculateSpeedrunQuizGamepoints = useCallback(
    (correctCharCount: number, elapsedMs: number, backspaces: number) => {
      if (correctCharCount <= 0 || elapsedMs <= 0) return 0;

      const elapsedMinutes = elapsedMs / 60000;
      if (elapsedMinutes <= 0) return 0;

      const timerSeconds = timerMinutes * 60;
      const quizTotalChars = getQuizTotalChars(quizItems);
      if (quizTotalChars <= 0) return 0;
      const estimatedInputCharsTotal = quizItems.reduce(
        (sum, item) => sum + getScoreInputLengthForItem(item),
        0,
      );
      if (estimatedInputCharsTotal <= 0) return 0;

      // Use accepted-answer input length rather than kana prompt length as the speed workload.
      const measuredWpm = (estimatedInputCharsTotal * (correctCharCount / quizTotalChars) / SPEEDRUN_SCORE_INPUT_CHARS_PER_WORD) / elapsedMinutes;
      const speedNorm = clampNumber(
        Math.log(1 + measuredWpm) / Math.log(1 + SPEEDRUN_SCORE_SPEED_ANCHOR_WPM),
        0,
        1,
      );
      const completionFactor = clampNumber(correctCharCount / quizTotalChars, 0, 1);

      const minTimerSeconds = QUIZ_TIMER_MIN_MINUTES * 60;
      const maxTimerSeconds = QUIZ_TIMER_MAX_MINUTES * 60;
      const clampedTimerSeconds = clampNumber(timerSeconds, minTimerSeconds, maxTimerSeconds);
      const timerRangeRatio = maxTimerSeconds / minTimerSeconds;
      const rawTimerReward = Math.pow(maxTimerSeconds / clampedTimerSeconds, SPEEDRUN_SCORE_TIMER_CURVE);
      const timerRewardRange = Math.pow(timerRangeRatio, SPEEDRUN_SCORE_TIMER_CURVE) - 1;
      const baseTimerFactor =
        timerRewardRange > 0
          ? clampNumber((rawTimerReward - 1) / timerRewardRange, 0, 1)
          : 0;
      const timerBonus = 1.0 + 0.25 * baseTimerFactor;

      const scoreFrac =
        (Math.exp(SPEEDRUN_SCORE_SPEED_SHAPE_K * speedNorm) - 1) /
        (Math.exp(SPEEDRUN_SCORE_SPEED_SHAPE_K) - 1);
      const rawScore =
        SPEEDRUN_SCORE_MAX *
        scoreFrac *
        completionFactor *
        Math.pow(timerBonus, SPEEDRUN_SCORE_TIMER_WEIGHT);
      const backspacePenaltyPoints = Math.max(0, backspaces) * SPEEDRUN_SCORE_BACKSPACE_PENALTY_POINTS;
      const adjustedScore = rawScore - backspacePenaltyPoints;

      return Math.round(clampNumber(adjustedScore, 0, SPEEDRUN_SCORE_MAX));
    },
    [getScoreInputLengthForItem, quizItems, timerMinutes],
  );

  const calculateStudyQuizGamepoints = useCallback(
    (correctCharCount: number, elapsedMs: number, backspaces: number) => {
      if (correctCharCount <= 0 || elapsedMs <= 0) return 0;

      const elapsedMinutes = elapsedMs / 60000;
      if (elapsedMinutes <= 0) return 0;

      const quizTotalChars = getQuizTotalChars(quizItems);
      if (quizTotalChars <= 0) return 0;
      const estimatedInputCharsTotal = quizItems.reduce(
        (sum, item) => sum + getScoreInputLengthForItem(item),
        0,
      );
      if (estimatedInputCharsTotal <= 0) return 0;

      const measuredWpm = (estimatedInputCharsTotal * (correctCharCount / quizTotalChars) / STUDY_SCORE_INPUT_CHARS_PER_WORD) / elapsedMinutes;
      const completionFactor = clampNumber(correctCharCount / quizTotalChars, 0, 1);

      // Study Score is completion-first, but it should still separate moderately faster clean solves.
      const completionScoreFrac = clampNumber(
        (STUDY_SCORE_COMPLETION_LINEAR_WEIGHT * completionFactor) +
          (STUDY_SCORE_COMPLETION_FINISH_WEIGHT * Math.pow(completionFactor, STUDY_SCORE_COMPLETION_FINISH_POWER)),
        0,
        1,
      );
      const speedNorm = clampNumber(
        Math.log(1 + measuredWpm) / Math.log(1 + STUDY_SCORE_SPEED_ANCHOR_WPM),
        0,
        1,
      );
      const speedBonusMultiplier = 1.0 + (STUDY_SCORE_SPEED_BONUS_MAX * speedNorm);
      const rawScore =
        STUDY_SCORE_MAX *
        completionScoreFrac *
        speedBonusMultiplier;
      const backspacePenaltyPoints = Math.max(0, backspaces) * STUDY_SCORE_BACKSPACE_PENALTY_POINTS;
      const adjustedScore = rawScore - backspacePenaltyPoints;

      return Math.round(clampNumber(adjustedScore, 0, STUDY_SCORE_MAX));
    },
    [getScoreInputLengthForItem, quizItems],
  );

  const finalizeQuiz = useCallback(
    (reason: 'complete' | 'time' | 'stopped', answerMap?: Record<string, string>, remainingMsSnapshot?: number) => {
      if (hasFinished) return;
      const finalAnswers = answerMap || answers;
      const finalCorrectCount = calculateCorrectAnswers(finalAnswers);
      const finalCorrectCharCount = calculateCorrectCharacterCount(finalAnswers);
      const now = Date.now();
      const timerTotalMs = timerMinutes * 60 * 1000;
      const totalCharCount = getQuizTotalChars(quizItems);
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

      const finalGamepoints = leaderboardScoresEnabled
        ? (isStudyScoreMode
          ? calculateStudyQuizGamepoints(finalCorrectCharCount, elapsedMs, quizBackspaceCount)
          : calculateSpeedrunQuizGamepoints(finalCorrectCharCount, elapsedMs, quizBackspaceCount))
        : finalCorrectCharCount;

      setCompletionTimeMs(elapsedMs);
      setIsQuizScoreHidden(false);
      setRemainingSeconds(remainingSecondsAtFinish);
      remainingSecondsRef.current = remainingSecondsAtFinish;
      setHasFinished(true);
      setIsRunning(false);
      setIsQuizPaused(false);
      setFinishReason(reason);
      timerDeadlineMsRef.current = null;

      const entry = {
        mode: activeModeKey,
        timeMs: elapsedMs,
        score: finalCorrectCharCount,
        total: totalCharCount,
        date: now,
        finishReason: reason,
        timerMinutes,
        scoreType: leaderboardScoresEnabled ? (isStudyScoreMode ? 'study_points' : 'speedrun_points') : undefined,
        correctCount: finalCorrectCount,
        testscore: finalCorrectCharCount,
        totalTestscore: totalCharCount,
        gamepoints: leaderboardScoresEnabled ? finalGamepoints : undefined,
      };
      saveLeaderboardEntry(entry).then(result => {
        if (result) {
          setLastRecordUpdate({ mode: entry.mode, scoreType: activeQuizLeaderboardScoreType, ...result });
        }
      });
    },
    [activeModeKey, activeQuizLeaderboardScoreType, answers, calculateCorrectAnswers, calculateCorrectCharacterCount, calculateSpeedrunQuizGamepoints, calculateStudyQuizGamepoints, hasFinished, isStudyScoreMode, leaderboardScoresEnabled, quizBackspaceCount, quizItems, saveLeaderboardEntry, timerMinutes],
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
    const dataset = getDatasetForMode(quizMode);
    if (!dataset.length) {
      Alert.alert('Focus list is empty', 'Add items to Focus by clicking a prompt in Quiz or TypeMaster.');
      return;
    }
    setQuizItems(shuffleQuiz(dataset));
    setAnswers({});
    setHasFinished(false);
    setFinishReason(null);
    setCompletionTimeMs(null);
    setIsQuizScoreHidden(false);
    setQuizBackspaceCount(0);
    quizBackspacePenaltyWordIdsRef.current.clear();
    setIsQuizPaused(false);
    setLastRecordUpdate(null);
    setRemainingSeconds(timerMinutes * 60);
    remainingSecondsRef.current = timerMinutes * 60;
    setIsRunning(false);
    timerDeadlineMsRef.current = null;
  };

  const pauseQuiz = () => {
    if (!isRunning || hasFinished) return;
    const remainingMs = timerDeadlineMsRef.current
      ? Math.max(0, timerDeadlineMsRef.current - Date.now())
      : Math.max(0, remainingSecondsRef.current * 1000);
    const nextSeconds = Math.ceil(remainingMs / 1000);
    setRemainingSeconds(nextSeconds);
    remainingSecondsRef.current = nextSeconds;
    setIsRunning(false);
    setIsQuizPaused(true);
    timerDeadlineMsRef.current = null;
  };

  const resumeQuiz = () => {
    if (!isQuizPaused || hasFinished) return;
    const startSeconds = remainingSecondsRef.current > 0 ? remainingSecondsRef.current : timerMinutes * 60;
    timerDeadlineMsRef.current = Date.now() + startSeconds * 1000;
    setIsRunning(true);
    setIsQuizPaused(false);
  };

  const resetQuiz = () => {
    setIsRunning(false);
    setIsQuizPaused(false);
    setQuizItems(shuffleQuiz(getDatasetForMode(quizMode)));
    setAnswers({});
    setHasFinished(false);
    setFinishReason(null);
    setCompletionTimeMs(null);
    setIsQuizScoreHidden(false);
    setQuizBackspaceCount(0);
    quizBackspacePenaltyWordIdsRef.current.clear();
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
    const dataset = getDatasetForMode(quizMode);
    if (!dataset.length) {
      Alert.alert('Focus list is empty', 'Add items to Focus by clicking a prompt in Quiz or TypeMaster.');
      return;
    }
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
    setIsEndlessPaused(false);
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
  }, [getDatasetForMode, quizMode, timerMinutes]);

  const resetEndlessToSetup = useCallback(() => {
    if (endlessAnimationRef.current) {
      cancelAnimationFrame(endlessAnimationRef.current);
      endlessAnimationRef.current = null;
    }
    setEndlessIsRunning(false);
    setIsEndlessPaused(false);
    setEndlessHasFinished(false);
    setEndlessScore(0);
    setEndlessCurrentInput('');
    setEndlessVisibleChars([]);
    setRemainingSeconds(timerMinutes * 60);
    remainingSecondsRef.current = timerMinutes * 60;
    timerDeadlineMsRef.current = null;
  }, [timerMinutes]);

  const pauseEndlessMode = useCallback(() => {
    if (!endlessIsRunning || endlessHasFinished) return;
    if (endlessAnimationRef.current) {
      cancelAnimationFrame(endlessAnimationRef.current);
      endlessAnimationRef.current = null;
    }
    const remainingMs = timerDeadlineMsRef.current
      ? Math.max(0, timerDeadlineMsRef.current - Date.now())
      : Math.max(0, remainingSecondsRef.current * 1000);
    const nextSeconds = Math.ceil(remainingMs / 1000);
    setRemainingSeconds(nextSeconds);
    remainingSecondsRef.current = nextSeconds;
    setEndlessIsRunning(false);
    setIsEndlessPaused(true);
    timerDeadlineMsRef.current = null;
  }, [endlessHasFinished, endlessIsRunning]);

  const resumeEndlessMode = useCallback(() => {
    if (!isEndlessPaused || endlessHasFinished) return;
    const startSeconds = remainingSecondsRef.current > 0 ? remainingSecondsRef.current : timerMinutes * 60;
    timerDeadlineMsRef.current = Date.now() + startSeconds * 1000;
    setEndlessIsRunning(true);
    setIsEndlessPaused(false);
    setTimeout(() => {
      if (endlessInputRef.current && typeof endlessInputRef.current.focus === 'function') {
        endlessInputRef.current.focus();
      }
    }, 0);
  }, [endlessHasFinished, isEndlessPaused, timerMinutes]);

  const stopEndlessMode = useCallback((reason: 'time' | 'stopped' = 'stopped') => {
    if (endlessAnimationRef.current) {
      cancelAnimationFrame(endlessAnimationRef.current);
      endlessAnimationRef.current = null;
    }
    setEndlessIsRunning(false);
    setIsEndlessPaused(false);
    setEndlessHasFinished(true);

    // Save to leaderboard with 'endless' prefix
    const endlessModeKey = `endless:${activeModeKey}`;
    const timerTotalMs = timerMinutes * 60 * 1000;
    const remainingMs = timerDeadlineMsRef.current
      ? Math.max(0, timerDeadlineMsRef.current - Date.now())
      : Math.max(0, remainingSecondsRef.current * 1000);
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
        const accepted = getAcceptedAnswersForItem(targetItem);
        const usesJapaneseInput = usesJapaneseInputForItem(targetItem);
        let isCorrect = false;
        if (usesJapaneseInput) {
          const sanitized = sanitizeJapaneseInput(text).trim();
          isCorrect = sanitized.length > 0 && accepted.includes(sanitized);
        } else {
          const normalized = normalizeRomaji(text);
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
      getAcceptedAnswersForItem,
      usesJapaneseInputForItem,
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
    const dataset = getDatasetForMode(quizMode);
    if (!dataset.length) {
      Alert.alert('Focus list is empty', 'Add items to Focus by clicking a prompt in Quiz or TypeMaster.');
      return;
    }
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
    setIsTypemasterPaused(false);
    setTypemasterHasFinished(false);
    setTypemasterFinishReason(null);
    setLastRecordUpdate(null);
    setRemainingSeconds(timerMinutes * 60);
    remainingSecondsRef.current = timerMinutes * 60;
    timerDeadlineMsRef.current = null;
    typemasterTimerWasArmedRef.current = false;

    // Focus input field
    setTimeout(() => {
      if (typemasterInputRef.current && typeof typemasterInputRef.current.focus === 'function') {
        typemasterInputRef.current.focus();
      }
    }, 100);
  }, [getDatasetForMode, quizMode, timerMinutes]);

  const resetTypemasterToSetup = useCallback(() => {
    setTypemasterIsRunning(false);
    setIsTypemasterPaused(false);
    setTypemasterHasFinished(false);
    setTypemasterFinishReason(null);
    setLastRecordUpdate(null);
    setTypemasterScore(0);
    setTypemasterCurrentInput('');
    setTypemasterQueue([]);
    setTypemasterBurstCursor(0);
    setRemainingSeconds(timerMinutes * 60);
    remainingSecondsRef.current = timerMinutes * 60;
    timerDeadlineMsRef.current = null;
    typemasterTimerWasArmedRef.current = false;
  }, [timerMinutes]);

  const pauseTypemasterMode = useCallback(() => {
    if (!typemasterIsRunning || typemasterHasFinished) return;
    const remainingMs = timerDeadlineMsRef.current
      ? Math.max(0, timerDeadlineMsRef.current - Date.now())
      : Math.max(0, remainingSecondsRef.current * 1000);
    const nextSeconds = Math.ceil(remainingMs / 1000);
    typemasterTimerWasArmedRef.current = Boolean(timerDeadlineMsRef.current);
    setRemainingSeconds(nextSeconds);
    remainingSecondsRef.current = nextSeconds;
    setTypemasterIsRunning(false);
    setIsTypemasterPaused(true);
    timerDeadlineMsRef.current = null;
  }, [typemasterHasFinished, typemasterIsRunning]);

  const resumeTypemasterMode = useCallback(() => {
    if (!isTypemasterPaused || typemasterHasFinished) return;
    if (typemasterTimerWasArmedRef.current) {
      const startSeconds = remainingSecondsRef.current > 0 ? remainingSecondsRef.current : timerMinutes * 60;
      timerDeadlineMsRef.current = Date.now() + startSeconds * 1000;
    } else {
      timerDeadlineMsRef.current = null;
    }
    setTypemasterIsRunning(true);
    setIsTypemasterPaused(false);
    setTimeout(() => {
      if (typemasterInputRef.current && typeof typemasterInputRef.current.focus === 'function') {
        typemasterInputRef.current.focus();
      }
    }, 0);
  }, [isTypemasterPaused, timerMinutes, typemasterHasFinished]);

  const stopTypemasterMode = useCallback((reason: 'time' | 'stopped' = 'stopped') => {
    setTypemasterIsRunning(false);
    setIsTypemasterPaused(false);
    setTypemasterHasFinished(true);
    setTypemasterFinishReason(reason);

    // Save to leaderboard with 'typemaster' prefix
    const typemasterModeKey = getTypeMasterModeKey(activeModeKey);
    const timerTotalMs = timerMinutes * 60 * 1000;
    const remainingMs = timerDeadlineMsRef.current
      ? Math.max(0, timerDeadlineMsRef.current - Date.now())
      : Math.max(0, remainingSecondsRef.current * 1000);
    const completionTimeMs = reason === 'time'
      ? timerTotalMs
      : Math.max(0, Math.min(timerTotalMs, timerTotalMs - remainingMs));
    const entry = {
      mode: typemasterModeKey,
      timeMs: completionTimeMs,
      score: typemasterScore,
      total: typemasterScore,
      date: Date.now(),
      finishReason: reason,
      timerMinutes,
      typemasterQueueMode,
    };
    saveLeaderboardEntry(entry).then(result => {
      if (result) {
        setLastRecordUpdate({ mode: entry.mode, ...result });
      }
    });
  }, [activeModeKey, typemasterQueueMode, typemasterScore, saveLeaderboardEntry, timerMinutes]);

  const armTypemasterTimer = useCallback(() => {
    if (!typemasterIsRunning || timerDeadlineMsRef.current) return;
    const startSeconds = remainingSecondsRef.current > 0 ? remainingSecondsRef.current : timerMinutes * 60;
    timerDeadlineMsRef.current = Date.now() + startSeconds * 1000;
    typemasterTimerWasArmedRef.current = true;
    // Kick the visible countdown immediately so the timer appears to start on first input.
    const nextRemaining = Math.max(0, Math.ceil((timerDeadlineMsRef.current - Date.now()) / 1000));
    setRemainingSeconds(nextRemaining);
    remainingSecondsRef.current = nextRemaining;
  }, [timerMinutes, typemasterIsRunning]);

  const handleTypemasterInput = useCallback(
    (text: string) => {
      if (!typemasterIsRunning) return;

      if (!timerDeadlineMsRef.current && text.length > 0) {
        armTypemasterTimer();
      }

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
        const accepted = getAcceptedAnswersForItem(targetItem);
        const usesJapaneseInput = usesJapaneseInputForItem(targetItem);
        let isCorrect = false;
        if (usesJapaneseInput) {
          const sanitized = sanitizeJapaneseInput(text).trim();
          isCorrect = sanitized.length > 0 && accepted.includes(sanitized);
        } else {
          const normalized = normalizeRomaji(text);
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
      getAcceptedAnswersForItem,
      usesJapaneseInputForItem,
      armTypemasterTimer,
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

  const correctAnswerCount = useMemo(() => calculateCorrectAnswers(answers), [answers, calculateCorrectAnswers]);
  const correctCharacterCount = useMemo(() => calculateCorrectCharacterCount(answers), [answers, calculateCorrectCharacterCount]);
  const totalCharacterCount = useMemo(() => getQuizTotalChars(quizItems), [quizItems]);
  const quizElapsedMs = useMemo(() => {
    if (completionTimeMs != null) {
      return completionTimeMs;
    }

    const timerTotalMs = timerMinutes * 60 * 1000;
    const remainingMs =
      isRunning && timerDeadlineMsRef.current
        ? Math.max(0, timerDeadlineMsRef.current - Date.now())
        : Math.max(0, remainingSeconds * 1000);

    return Math.max(0, Math.min(timerTotalMs, timerTotalMs - remainingMs));
  }, [completionTimeMs, isRunning, remainingSeconds, timerMinutes]);
  const quizGamepoints = useMemo(
    () =>
      isStudyScoreMode
        ? calculateStudyQuizGamepoints(correctCharacterCount, quizElapsedMs, quizBackspaceCount)
        : calculateSpeedrunQuizGamepoints(correctCharacterCount, quizElapsedMs, quizBackspaceCount),
    [calculateSpeedrunQuizGamepoints, calculateStudyQuizGamepoints, correctCharacterCount, isStudyScoreMode, quizBackspaceCount, quizElapsedMs],
  );

  const focusNextAnswer = useCallback(
    (currentId: string, nextAnswers: Record<string, string>) => {
      const downwardCandidates = focusDownById[currentId] || [];
      for (let i = 0; i < downwardCandidates.length; i += 1) {
        const nextId = downwardCandidates[i];
        if (isCorrectAnswer(nextId, nextAnswers[nextId] || '')) continue;
        const nextRef = inputRefs.current[nextId];
        if (nextRef && typeof nextRef.focus === 'function') {
          requestAnimationFrame(() => {
            nextRef.focus();
          });
        }
        return;
      }

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
            requestAnimationFrame(() => {
              nextRef.focus();
            });
          }
          break;
        }
      }
    },
    [focusDownById, focusOrder, indexById, isCorrectAnswer],
  );

  const handleAnswerChange = useCallback(
    (id: string, text: string) => {
      if (isQuizPaused) return;
      const nextText = isJlptJapaneseInputMode ? sanitizeJapaneseInput(text) : text;
      if (!isRunning && !hasFinished) {
        const startSecondsRefValue = remainingSecondsRef.current;
        const startSeconds = startSecondsRefValue > 0 ? startSecondsRefValue : timerMinutes * 60;
        const now = Date.now();
        if (startSecondsRefValue <= 0) {
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
    [finalizeQuiz, focusNextAnswer, hasFinished, isCorrectAnswer, isJlptJapaneseInputMode, isQuizPaused, isRunning, quizItems, timerMinutes],
  );

  const columns = useMemo(() => {
    return buildColumnBuckets(quizItems, columnCount);
  }, [columnCount, quizItems]);
  const todayKey = formatDateKey(new Date());
  const activeLeaderboardModeKey = leaderboardGameType === 'typemaster'
    ? getTypeMasterModeKey(activeModeKey)
    : activeModeKey;
  const sessionOnlyLeaderboardScopeOptions = LEADERBOARD_SCOPE_OPTIONS
    .filter(option => option.value === 'session')
    .map(option => ({ ...option, label: 'Current Focus Mode Leaderboard' }));
  const activeLeaderboardScopeOptions = isFocusModeKey(activeLeaderboardModeKey)
    ? sessionOnlyLeaderboardScopeOptions
    : LEADERBOARD_SCOPE_OPTIONS;
  const scopeLabel = (LEADERBOARD_SCOPE_OPTIONS.find(option => option.value === leaderboardScope) || LEADERBOARD_SCOPE_OPTIONS[0]).label;
  const getScopeLabelForMode = (modeKey: string) =>
    isFocusModeKey(modeKey) && leaderboardScope === 'session'
      ? 'Current Focus Mode Leaderboard'
      : scopeLabel;
  const focusLeaderboardSaveNotice = activeFocusSnapshotId
    ? `Focus leaderboard positions are saved with the active Focus save state.`
    : 'Focus leaderboard positions save with a Focus save state. Save or load a Focus set in Settings > Save Manager to keep them.';
  const activeFocusSnapshotName = activeFocusSnapshotId
    ? (focusSnapshots.find(snapshot => snapshot.id === activeFocusSnapshotId)?.name || 'Unnamed Focus save')
    : null;
  const activeLeaderboardModeLabel = getQuizModeLabel(activeLeaderboardModeKey);
  const activeLeaderboardDisplayLabel = isTypeMasterModeKey(activeLeaderboardModeKey) || isEndlessModeKey(activeLeaderboardModeKey) || isFocusModeKey(activeLeaderboardModeKey)
    ? 'Time'
    : activeQuizLeaderboardLabel;
  const activeLeaderboardSource = leaderboardScope === 'session' ? sessionLeaderboard : leaderboard;
  const activeLeaderboard = useMemo(
    () =>
      activeLeaderboardSource
        .filter(entry => {
          if (leaderboardScope === 'all_time') return true;
          if (isFocusModeKey(activeLeaderboardModeKey)) return true;
          return formatDateKey(new Date(entry.date)) === todayKey;
        })
        .filter(entry => entry.mode === activeLeaderboardModeKey)
        .filter(entry => normalizeLeaderboardTimerMinutes(entry.timerMinutes) === timerMinutes)
        .filter(entry => isTypeMasterModeKey(activeLeaderboardModeKey) || isEndlessModeKey(activeLeaderboardModeKey) || isFocusModeKey(activeLeaderboardModeKey)
          ? true
          : normalizeLeaderboardScoreType(entry.scoreType) === activeQuizLeaderboardScoreType)
        .sort(activeLeaderboardComparator)
        .slice(0, 10),
    [activeLeaderboardComparator, activeLeaderboardModeKey, activeLeaderboardSource, activeQuizLeaderboardScoreType, leaderboardScope, timerMinutes, todayKey],
  );
  const completedModeLabel = getQuizModeLabel(activeModeKey);
  const typemasterModeKey = getTypeMasterModeKey(activeModeKey);
  const completedLeaderboardScopeOptions = isFocusModeKey(activeModeKey)
    ? sessionOnlyLeaderboardScopeOptions
    : LEADERBOARD_SCOPE_OPTIONS;
  const typemasterCompletedLeaderboardScopeOptions = isFocusModeKey(typemasterModeKey)
    ? sessionOnlyLeaderboardScopeOptions
    : LEADERBOARD_SCOPE_OPTIONS;
  const typemasterCompletedModeLabel = getQuizModeLabel(typemasterModeKey);
  const activeScopeLabel = getScopeLabelForMode(activeLeaderboardModeKey);
  const completedScopeLabel = getScopeLabelForMode(activeModeKey);
  const typemasterCompletedScopeLabel = getScopeLabelForMode(typemasterModeKey);
  const typemasterCompletionTimeMs = Math.max(0, timerMinutes * 60 * 1000 - remainingSeconds * 1000);
  const typemasterCurrentTargetIndex = typemasterQueueMode === 'burst'
    ? Math.max(0, Math.min(typemasterBurstCursor, Math.max(typemasterQueue.length - 1, 0)))
    : 0;
  const typemasterCurrentTarget = typemasterQueue.length > 0 ? typemasterQueue[typemasterCurrentTargetIndex] : null;
  const typemasterHintText = typemasterCurrentTarget
    ? getHintTextForItem(typemasterCurrentTarget.item)
    : 'Start to begin...';
  const quizPromptHidden = quizView === 'quiz' && isQuizPaused && !hasFinished;
  const quizPrimaryActionLabel = isRunning ? 'Pause Quiz' : isQuizPaused ? 'Resume Quiz' : 'Play Quiz';
  const endlessPrimaryActionLabel = endlessIsRunning ? 'Pause Endless' : isEndlessPaused ? 'Resume Endless' : 'Play Endless';
  const typemasterPrimaryActionLabel = typemasterIsRunning ? 'Pause TypeMaster' : isTypemasterPaused ? 'Resume TypeMaster' : 'Play TypeMaster';
  const activeFamilyModes = getQuizModesForFamily(quizFamily);
  const displayedFamilyModes = quizFamily === 'jlpt'
    ? activeFamilyModes.filter(option => option.value !== 'jlpt_n4_2')
    : quizFamily === 'kana'
      ? engModeEnabled
        ? activeFamilyModes.filter(option => option.value === 'hiragana')
        : activeFamilyModes.filter(option => option.value !== 'hiragana_dakuten' && option.value !== 'katakana_dakuten')
      : activeFamilyModes;
  const activeKanaVariant = quizMode.startsWith('katakana') ? (KANA_VARIANT_OPTIONS.katakana.includes(quizMode) ? quizMode : 'katakana') : (KANA_VARIANT_OPTIONS.hiragana.includes(quizMode) ? quizMode : 'hiragana');
  const promptColumnLabel = isFocusMode
    ? 'Prompt'
    : isJlptJapaneseInputMode
      ? 'Romaji Reading'
      : isKanjiStudyMode
        ? (engModeEnabled ? 'Vocabulary' : 'Kanji')
        : (engModeEnabled ? 'Alphabet' : 'Kana');
  const answerColumnLabel = isFocusMode
    ? 'Answer'
    : isJlptJapaneseInputMode
    ? 'Kanji (Japanese input)'
    : isEnglishVocabularyMode
      ? 'Definition'
      : isJlptEnglishMode
      ? 'English Translation'
      : isKanjiStudyMode
        ? 'Reading'
        : isEnglishAlphabetMode
          ? 'Letter'
          : 'English Syllable';
  const answerPlaceholder = isFocusMode
    ? 'Type answer...'
    : isJlptJapaneseInputMode
    ? 'Type kanji ...'
    : isEnglishVocabularyMode
      ? 'Type definition...'
      : isJlptEnglishMode
      ? 'Type meaning...'
      : isKanjiStudyMode
        ? 'Type reading...'
        : isEnglishAlphabetMode
          ? 'Type letter...'
          : 'Type...';
  const completedModeLeaderboardSource = leaderboardScope === 'session' ? sessionLeaderboard : leaderboard;
  const completedModeLeaderboard = useMemo(
    () =>
      completedModeLeaderboardSource
        .filter(entry => {
          if (leaderboardScope === 'all_time') return true;
          if (isFocusModeKey(activeModeKey)) return true;
          return formatDateKey(new Date(entry.date)) === todayKey;
        })
        .filter(entry => entry.mode === activeModeKey)
        .filter(entry => normalizeLeaderboardTimerMinutes(entry.timerMinutes) === timerMinutes)
        .filter(entry => normalizeLeaderboardScoreType(entry.scoreType) === activeQuizLeaderboardScoreType)
        .sort(activeLeaderboardComparator)
        .slice(0, 10),
    [activeLeaderboardComparator, activeModeKey, activeQuizLeaderboardScoreType, completedModeLeaderboardSource, leaderboardScope, timerMinutes, todayKey],
  );
  const typemasterCompletedModeLeaderboard = useMemo(
    () =>
      completedModeLeaderboardSource
        .filter(entry => {
          if (leaderboardScope === 'all_time') return true;
          if (isFocusModeKey(typemasterModeKey)) return true;
          return formatDateKey(new Date(entry.date)) === todayKey;
        })
        .filter(entry => entry.mode === typemasterModeKey)
        .filter(entry => normalizeLeaderboardTimerMinutes(entry.timerMinutes) === timerMinutes)
        .sort(activeLeaderboardComparator)
        .slice(0, 10),
    [activeLeaderboardComparator, completedModeLeaderboardSource, leaderboardScope, timerMinutes, todayKey, typemasterModeKey],
  );
  const activeJlptN4Variant = JLPT_N4_VARIANT_VALUES.includes(quizMode) ? quizMode : JLPT_N4_VARIANT_VALUES[0];
  const renderLeaderboardRankPills = (prefix: string) =>
    leaderboardScoresEnabled
      ? LEADERBOARD_RANK_OPTIONS.map(option => {
          const selected = option.value === leaderboardRankMode;
          return (
            <Pressable
              key={`${prefix}-rank-${option.value}`}
              style={[styles.quizLeaderboardScopePill, selected && styles.quizLeaderboardScopePillActive]}
              onPress={() => setLeaderboardRankMode(option.value)}
            >
              <Text style={[styles.quizLeaderboardScopeLabel, selected && styles.quizLeaderboardScopeLabelActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })
      : null;
  const shouldShowLeaderboardGamepoints = leaderboardScoresEnabled && leaderboardRankMode === 'score';
  const closeQuizDropdownMenus = () => {
    setIsJlptModeDropdownOpen(false);
    setIsJlptSetDropdownOpen(false);
    setOpenKanaDropdownBase(null);
  };
  const selectQuizMode = (nextMode: string) => {
    if (isRunning) return;
    setQuizMode(nextMode);
    closeQuizDropdownMenus();
    setQuizItems(shuffleQuiz(getDatasetForMode(nextMode)));
    setAnswers({});
    setIsRunning(false);
    setIsQuizPaused(false);
    setEndlessIsRunning(false);
    setIsEndlessPaused(false);
    setTypemasterIsRunning(false);
    setIsTypemasterPaused(false);
    setHasFinished(false);
    setFinishReason(null);
    setCompletionTimeMs(null);
    setQuizBackspaceCount(0);
    quizBackspacePenaltyWordIdsRef.current.clear();
    setLastRecordUpdate(null);
    setRemainingSeconds(timerMinutes * 60);
    remainingSecondsRef.current = timerMinutes * 60;
    timerDeadlineMsRef.current = null;
    typemasterTimerWasArmedRef.current = false;
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.quizScroll}
        contentContainerStyle={styles.quizContent}
        onTouchStart={() => {
          if (isJlptModeDropdownOpen || isJlptSetDropdownOpen || openKanaDropdownBase) {
            closeQuizDropdownMenus();
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
          <Text style={styles.quizNavVersion}>v1.23</Text>
        </View>

      {/* Sub Nav Tabs - Mode and Tab selection */}
      <View style={styles.quizSubNavBar}>
        <View style={styles.quizSubNavSection}>
          <View style={styles.quizSubNavTabs}>
            {QUIZ_FAMILY_OPTIONS.map(option => {
              const selected = option.value === quizFamily;
              const familyLabel =
                option.value === 'kana' && engModeEnabled
                  ? 'Alphabet'
                  : option.value === 'jlpt' && engModeEnabled
                    ? 'Vocabulary'
                    : option.label;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.quizSubNavTab, selected && styles.quizSubNavTabActive]}
                  onPress={() => {
                    if (isRunning) return;
                    setQuizFamily(option.value);
                    const familyModes = getQuizModesForFamily(option.value);
                    const nextMode = familyModes[0]?.value || QUIZ_MODES[0].value;
                    selectQuizMode(nextMode);
                  }}
                >
                  <Text style={[styles.quizSubNavTabText, selected && styles.quizSubNavTabTextActive]}>
                    {familyLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.quizSubNavDivider} />
          <View style={styles.quizSubNavTabs}>
            {displayedFamilyModes.map(({ value, tabLabel }) => {
              const selected = value === quizMode;
              const modeTabLabel = engModeEnabled && (value === 'hiragana' || value === 'katakana') ? 'Alphabet' : tabLabel;
              if (value === 'hiragana' || value === 'katakana') {
                const kanaVariants = value === 'hiragana' ? KANA_VARIANT_OPTIONS.hiragana : KANA_VARIANT_OPTIONS.katakana;
                const isKanaSelected = kanaVariants.includes(quizMode);
                const activeVariant = value === 'hiragana'
                  ? (KANA_VARIANT_OPTIONS.hiragana.includes(activeKanaVariant) ? activeKanaVariant : 'hiragana')
                  : (KANA_VARIANT_OPTIONS.katakana.includes(activeKanaVariant) ? activeKanaVariant : 'katakana');
                return (
                  <View
                    key={`${value}-split`}
                    style={styles.quizSplitTabGroup}
                    onTouchStart={event => event.stopPropagation()}
                  >
                    <Pressable
                      style={[
                        styles.quizSubNavTab,
                        styles.quizSplitTabMain,
                        isKanaSelected && styles.quizSubNavTabActive,
                      ]}
                      onPress={() => selectQuizMode(activeVariant)}
                    >
                      <Text style={[styles.quizSubNavTabText, isKanaSelected && styles.quizSubNavTabTextActive]}>
                        {modeTabLabel}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.quizSubNavTab,
                        styles.quizSplitTabToggle,
                        isKanaSelected && styles.quizSplitTabToggleActive,
                      ]}
                      onPress={() => {
                        if (isRunning) return;
                        setIsJlptModeDropdownOpen(false);
                        setIsJlptSetDropdownOpen(false);
                        setOpenKanaDropdownBase(prev => (prev === value ? null : value));
                      }}
                    >
                      <Text
                        style={[
                          styles.quizSubNavTabText,
                          styles.quizSplitTabChevron,
                          isKanaSelected && styles.quizSubNavTabTextActive,
                        ]}
                      >
                        {openKanaDropdownBase === value ? '^' : 'v'}
                      </Text>
                    </Pressable>
                    {openKanaDropdownBase === value ? (
                      <View style={styles.quizSplitTabMenu}>
                        {kanaVariants.map(variantValue => {
                          const variantOption = QUIZ_MODES.find(mode => mode.value === variantValue);
                          if (!variantOption) return null;
                          const variantSelected = quizMode === variantValue;
                          return (
                            <Pressable
                              key={variantValue}
                              style={[styles.quizDropdownMenuItem, variantSelected && styles.quizDropdownMenuItemActive]}
                              onPress={() => selectQuizMode(variantValue)}
                            >
                              <Text style={[styles.quizDropdownMenuItemText, variantSelected && styles.quizDropdownMenuItemTextActive]}>
                                {variantValue === value ? 'Default' : variantOption.tabLabel}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              }
              if (value === 'jlpt_n4') {
                const isN4Selected = JLPT_N4_VARIANT_VALUES.includes(quizMode);
                return (
                  <View
                    key="jlpt-n4-split"
                    style={styles.quizSplitTabGroup}
                    onTouchStart={event => event.stopPropagation()}
                  >
                    <Pressable
                      style={[
                        styles.quizSubNavTab,
                        styles.quizSplitTabMain,
                        isN4Selected && styles.quizSubNavTabActive,
                      ]}
                      onPress={() => selectQuizMode(activeJlptN4Variant)}
                    >
                      <Text style={[styles.quizSubNavTabText, isN4Selected && styles.quizSubNavTabTextActive]}>
                        N4
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.quizSubNavTab,
                        styles.quizSplitTabToggle,
                        isN4Selected && styles.quizSplitTabToggleActive,
                      ]}
                      onPress={() => {
                        if (isRunning) return;
                        setIsJlptModeDropdownOpen(false);
                        setIsJlptSetDropdownOpen(prev => !prev);
                      }}
                    >
                      <Text
                        style={[
                          styles.quizSubNavTabText,
                          styles.quizSplitTabChevron,
                          isN4Selected && styles.quizSubNavTabTextActive,
                        ]}
                      >
                        {isJlptSetDropdownOpen ? '▲' : '▼'}
                      </Text>
                    </Pressable>
                    {isJlptSetDropdownOpen ? (
                      <View style={styles.quizSplitTabMenu}>
                        {JLPT_N4_VARIANT_VALUES.map(variantValue => {
                          const variantOption = QUIZ_MODES.find(mode => mode.value === variantValue);
                          if (!variantOption) return null;
                          const variantSelected = quizMode === variantValue;
                          return (
                            <Pressable
                              key={variantValue}
                              style={[styles.quizDropdownMenuItem, variantSelected && styles.quizDropdownMenuItemActive]}
                              onPress={() => selectQuizMode(variantValue)}
                            >
                              <Text style={[styles.quizDropdownMenuItemText, variantSelected && styles.quizDropdownMenuItemTextActive]}>
                                {variantOption.tabLabel}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              }
              return (
                <Pressable
                  key={value}
                  style={[styles.quizSubNavTab, selected && styles.quizSubNavTabActive]}
                  onPress={() => selectQuizMode(value)}
                >
                  <Text style={[styles.quizSubNavTabText, selected && styles.quizSubNavTabTextActive]}>
                    {tabLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {shouldShowJlptModeControls ? (
            <View style={styles.quizDropdownWrap} onTouchStart={(event) => event.stopPropagation()}>
              <Text style={styles.quizDropdownLabel}>JLPT Mode</Text>
              <Pressable
                style={styles.quizDropdownTrigger}
                onPress={() => {
                  setIsJlptSetDropdownOpen(false);
                  setIsJlptModeDropdownOpen(prev => !prev);
                }}
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
                          setIsRunning(false);
                          setIsQuizPaused(false);
                          setHasFinished(false);
                          setFinishReason(null);
                          setCompletionTimeMs(null);
                          setLastRecordUpdate(null);
                          setRemainingSeconds(timerMinutes * 60);
                          remainingSecondsRef.current = timerMinutes * 60;
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
          {quizView === 'quiz' ? (
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
          ) : null}
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
          {quizView === 'leaderboard' ? (
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
          ) : (
            <>
              <Pressable
                style={styles.quizStatBlock}
                disabled={quizView !== 'quiz' || hasFinished}
                onPress={() => {
                  if (quizView !== 'quiz' || hasFinished) return;
                  setIsQuizScoreHidden(prev => !prev);
                }}
              >
                <Text style={styles.quizStatLabel}>
                  {quizView === 'endless' || quizView === 'typemaster' ? 'Characters' : 'Score'}
                </Text>
                <Text style={styles.quizStatValue}>
                  {quizView === 'endless'
                    ? endlessScore
                    : quizView === 'typemaster'
                      ? typemasterScore
                      : isQuizScoreHidden
                        ? 'Hidden'
                        : leaderboardScoresEnabled
                          ? quizGamepoints.toLocaleString()
                          : `${correctCharacterCount}/${totalCharacterCount}`}
                </Text>
              </Pressable>
              <View style={styles.quizStatBlock}>
                <Text style={styles.quizStatLabel}>Timer</Text>
                <Text style={[styles.quizStatValueTimer, (hasFinished || endlessHasFinished || typemasterHasFinished) && styles.quizTimerValueExpired]}>
                  {formatTimer(remainingSeconds)}
                </Text>
              </View>
              <View style={styles.quizActionButtonsRow}>
                {quizView === 'endless' ? (
                  <>
                    <Pressable
                      style={styles.quizPlayButton}
                      onPress={endlessIsRunning ? pauseEndlessMode : isEndlessPaused ? resumeEndlessMode : startEndlessMode}
                    >
                      <Text style={styles.quizPlayButtonLabel}>{endlessPrimaryActionLabel}</Text>
                    </Pressable>
                    <Pressable style={styles.quizStopButton} onPress={() => stopEndlessMode('stopped')}>
                      <Text style={styles.quizStopButtonLabel}>Stop</Text>
                    </Pressable>
                  </>
                ) : quizView === 'typemaster' ? (
                  <>
                    <Pressable
                      style={styles.quizPlayButton}
                      onPress={typemasterIsRunning ? pauseTypemasterMode : isTypemasterPaused ? resumeTypemasterMode : startTypemasterMode}
                    >
                      <Text style={styles.quizPlayButtonLabel}>{typemasterPrimaryActionLabel}</Text>
                    </Pressable>
                    <Pressable style={styles.quizStopButton} onPress={() => stopTypemasterMode('stopped')}>
                      <Text style={styles.quizStopButtonLabel}>Stop</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable
                      style={styles.quizPlayButton}
                      onPress={isRunning ? pauseQuiz : isQuizPaused ? resumeQuiz : startQuiz}
                    >
                      <Text style={styles.quizPlayButtonLabel}>{quizPrimaryActionLabel}</Text>
                    </Pressable>
                    <Pressable style={styles.quizStopButton} onPress={stopQuiz}>
                      <Text style={styles.quizStopButtonLabel}>Stop</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </>
          )}
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
                    {lastRecordUpdate && lastRecordUpdate.mode === typemasterModeKey ? (
                      <Text style={[styles.quizRecordNotice, lastRecordUpdate.isNewRecord && styles.quizRecordNoticeNew]}>
                        {lastRecordUpdate.isNewRecord
                          ? `New ${typemasterCompletedModeLabel} record!`
                          : lastRecordUpdate.rank
                            ? `Placed #${lastRecordUpdate.rank} on ${typemasterCompletedModeLabel} leaderboard.`
                            : `${typemasterCompletedModeLabel} run saved.`}
                      </Text>
                    ) : null}
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
                          <Text style={styles.quizLeaderboardTitle}>{typemasterCompletedModeLabel} Top 10 ({timerMinutes} min, {typemasterCompletedScopeLabel})</Text>
                          <View style={styles.quizLeaderboardScopeTabs}>
                            {renderLeaderboardRankPills('typemaster-completed-main')}
                            <Pressable
                              style={[styles.quizLeaderboardEditPill, isLeaderboardEditMode && styles.quizLeaderboardEditPillActive]}
                              onPress={() => setIsLeaderboardEditMode(prev => !prev)}
                            >
                              <Text style={[styles.quizLeaderboardEditPillLabel, isLeaderboardEditMode && styles.quizLeaderboardEditPillLabelActive]}>
                                {isLeaderboardEditMode ? 'Done' : 'Edit'}
                              </Text>
                            </Pressable>
                            {typemasterCompletedLeaderboardScopeOptions.map(option => {
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
                        {isFocusModeKey(typemasterModeKey) && leaderboardScope === 'session' ? (
                          <Text style={styles.quizFinishSubtitle}>{focusLeaderboardSaveNotice}</Text>
                        ) : null}
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
                              {leaderboardScoresEnabled ? (
                                <>
                                  <Text style={styles.quizLeaderboardScore}>{getLeaderboardTestscoreDisplay(entry)}</Text>
                                  {shouldShowLeaderboardGamepoints && getLeaderboardGamepointsDisplay(entry) ? (
                                    <Text style={styles.quizLeaderboardScore}>{getLeaderboardGamepointsDisplay(entry)}</Text>
                                  ) : null}
                                </>
                              ) : null}
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
                          <Text style={styles.quizLeaderboardTitle}>{typemasterCompletedModeLabel} Top 10 ({timerMinutes} min, {typemasterCompletedScopeLabel})</Text>
                          <View style={styles.quizLeaderboardScopeTabs}>
                            {renderLeaderboardRankPills('typemaster-completed-empty')}
                            <Pressable
                              style={[styles.quizLeaderboardEditPill, isLeaderboardEditMode && styles.quizLeaderboardEditPillActive]}
                              onPress={() => setIsLeaderboardEditMode(prev => !prev)}
                            >
                              <Text style={[styles.quizLeaderboardEditPillLabel, isLeaderboardEditMode && styles.quizLeaderboardEditPillLabelActive]}>
                                {isLeaderboardEditMode ? 'Done' : 'Edit'}
                              </Text>
                            </Pressable>
                            {typemasterCompletedLeaderboardScopeOptions.map(option => {
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
                        {isFocusModeKey(typemasterModeKey) && leaderboardScope === 'session' ? (
                          <Text style={styles.quizFinishSubtitle}>{focusLeaderboardSaveNotice}</Text>
                        ) : null}
                        <Text style={styles.quizLeaderboardEmpty}>No {typemasterCompletedScopeLabel.toLowerCase()} scores for this mode.</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ) : (
              // TypeMaster mode game screen
              <View style={{ width: '100%', padding: 20 }}>
                <View style={styles.typemasterGameHeader}>
                  <View style={styles.typemasterGameHeaderInfo}>
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
                  <View style={styles.typemasterGameHeaderTimerWrap}>
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
                  </View>
                  <View style={styles.typemasterGameHeaderActionWrap}>
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
                        const isFocusedChar = isFocusedItem(char.item);
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
                            backgroundColor: isFocusedChar ? '#334155' : '#1e293b',
                            borderWidth: 2,
                            borderColor: isFocusedChar ? '#93c5fd' : '#475569',
                            minWidth: 80,
                            position: 'relative',
                          }}
                        >
                          {shouldShowJlptKanjiInfo && isJlptStyleItem(char.item) && !usesJapaneseInputForItem(char.item) ? (
                            <Pressable
                              onPress={() => openJishoWord(char.item.kana)}
                              style={styles.quizKanjiInfoButton}
                              hitSlop={6}
                            >
                              <Text style={styles.quizKanjiInfoLabel}>i</Text>
                            </Pressable>
                          ) : null}
                          <Pressable
                            onPress={() => {
                              void toggleFocusedItem(char.item);
                            }}
                          >
                            <Text
                              style={{
                                color: charColor,
                                fontSize: 32,
                                fontWeight: '700',
                                marginBottom: 4,
                              }}
                            >
                            {getPromptTextForItem(char.item)}
                            </Text>
                          </Pressable>
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
                    onKeyPress={event => {
                      const key = (event as any)?.nativeEvent?.key;
                      if (!key || key === 'Backspace' || key === 'Shift' || key === 'Alt' || key === 'Control' || key === 'Meta' || key === 'Tab') {
                        return;
                      }
                      armTypemasterTimer();
                    }}
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
                  <View style={styles.quizInlineTimerWrap}>
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
                          fontSize: usesJapaneseInputForItem(char.item) ? 48 : 64,
                          fontWeight: '700',
                          textShadowColor: 'rgba(0, 0, 0, 0.5)',
                          textShadowOffset: { width: 2, height: 2 },
                          textShadowRadius: 4,
                        }}
                      >
                        {getPromptTextForItem(char.item)}
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
                          ? `Type: ${getHintTextForItem(endlessVisibleChars[0].item)}`
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
                <Text style={styles.quizFinishSubtitle}>
                  {leaderboardScoresEnabled ? 'Browse best times or switch to score ranking.' : 'Browse best times by gamemode.'}
                </Text>
              </View>
            </View>

            <View style={styles.quizFinishLeaderboardPanel}>
              {activeLeaderboard.length > 0 ? (
                <View style={styles.quizLeaderboard}>
                  <View style={styles.quizLeaderboardHeaderRow}>
                    <Text style={styles.quizLeaderboardTitle}>{activeLeaderboardModeLabel} {activeLeaderboardDisplayLabel} Top 10 ({timerMinutes} min, {activeScopeLabel})</Text>
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
                      {renderLeaderboardRankPills('leaderboard-main')}
                      <Pressable
                        style={[styles.quizLeaderboardEditPill, isLeaderboardEditMode && styles.quizLeaderboardEditPillActive]}
                        onPress={() => setIsLeaderboardEditMode(prev => !prev)}
                      >
                        <Text style={[styles.quizLeaderboardEditPillLabel, isLeaderboardEditMode && styles.quizLeaderboardEditPillLabelActive]}>
                          {isLeaderboardEditMode ? 'Done' : 'Edit'}
                        </Text>
                      </Pressable>
                      {activeLeaderboardScopeOptions.map(option => {
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
                  {isFocusModeKey(activeLeaderboardModeKey) && leaderboardScope === 'session' ? (
                    <Text style={styles.quizFinishSubtitle}>{focusLeaderboardSaveNotice}</Text>
                  ) : null}
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
                        {leaderboardScoresEnabled ? (
                          <>
                            <Text style={styles.quizLeaderboardScore}>{getLeaderboardTestscoreDisplay(entry)}</Text>
                            {shouldShowLeaderboardGamepoints && getLeaderboardGamepointsDisplay(entry) ? (
                              <Text style={styles.quizLeaderboardScore}>{getLeaderboardGamepointsDisplay(entry)}</Text>
                            ) : null}
                          </>
                        ) : null}
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
                    <Text style={styles.quizLeaderboardTitle}>{activeLeaderboardModeLabel} {activeLeaderboardDisplayLabel} Top 10 ({timerMinutes} min, {activeScopeLabel})</Text>
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
                      {renderLeaderboardRankPills('leaderboard-empty')}
                      <Pressable
                        style={[styles.quizLeaderboardEditPill, isLeaderboardEditMode && styles.quizLeaderboardEditPillActive]}
                        onPress={() => setIsLeaderboardEditMode(prev => !prev)}
                      >
                        <Text style={[styles.quizLeaderboardEditPillLabel, isLeaderboardEditMode && styles.quizLeaderboardEditPillLabelActive]}>
                          {isLeaderboardEditMode ? 'Done' : 'Edit'}
                        </Text>
                      </Pressable>
                      {activeLeaderboardScopeOptions.map(option => {
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
                  {isFocusModeKey(activeLeaderboardModeKey) && leaderboardScope === 'session' ? (
                    <Text style={styles.quizFinishSubtitle}>{focusLeaderboardSaveNotice}</Text>
                  ) : null}
                  <Text style={styles.quizLeaderboardEmpty}>No {activeScopeLabel.toLowerCase()} {activeLeaderboardDisplayLabel.toLowerCase()} entries for this mode.</Text>
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
                {finishReason === 'complete' && lastRecordUpdate && lastRecordUpdate.mode === activeModeKey && normalizeLeaderboardScoreType(lastRecordUpdate.scoreType) === activeQuizLeaderboardScoreType ? (
                  <Text style={[styles.quizRecordNotice, lastRecordUpdate.isNewRecord && styles.quizRecordNoticeNew]}>
                    {lastRecordUpdate.isNewRecord
                      ? `New ${completedModeLabel} ${activeQuizLeaderboardLabel} record!`
                      : lastRecordUpdate.rank
                        ? `Placed #${lastRecordUpdate.rank} on ${completedModeLabel} ${activeQuizLeaderboardLabel} leaderboard.`
                        : `Completed ${completedModeLabel} ${activeQuizLeaderboardLabel.toLowerCase()} run saved.`}
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
                      {leaderboardScoresEnabled ? quizGamepoints.toLocaleString() : `${correctCharacterCount}/${totalCharacterCount}`}
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
                      <Text style={styles.quizLeaderboardTitle}>{completedModeLabel} {activeQuizLeaderboardLabel} Top 10 ({timerMinutes} min, {completedScopeLabel})</Text>
                      <View style={styles.quizLeaderboardScopeTabs}>
                        {renderLeaderboardRankPills('completed-main')}
                        <Pressable
                          style={[styles.quizLeaderboardEditPill, isLeaderboardEditMode && styles.quizLeaderboardEditPillActive]}
                          onPress={() => setIsLeaderboardEditMode(prev => !prev)}
                        >
                          <Text style={[styles.quizLeaderboardEditPillLabel, isLeaderboardEditMode && styles.quizLeaderboardEditPillLabelActive]}>
                            {isLeaderboardEditMode ? 'Done' : 'Edit'}
                          </Text>
                        </Pressable>
                        {completedLeaderboardScopeOptions.map(option => {
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
                    {isFocusModeKey(activeModeKey) && leaderboardScope === 'session' ? (
                      <Text style={styles.quizFinishSubtitle}>{focusLeaderboardSaveNotice}</Text>
                    ) : null}
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
                          {leaderboardScoresEnabled ? (
                            <>
                              <Text style={styles.quizLeaderboardScore}>{getLeaderboardTestscoreDisplay(entry)}</Text>
                              {shouldShowLeaderboardGamepoints && getLeaderboardGamepointsDisplay(entry) ? (
                                <Text style={styles.quizLeaderboardScore}>{getLeaderboardGamepointsDisplay(entry)}</Text>
                              ) : null}
                            </>
                          ) : null}
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
                      <Text style={styles.quizLeaderboardTitle}>{completedModeLabel} {activeQuizLeaderboardLabel} Top 10 ({timerMinutes} min, {completedScopeLabel})</Text>
                      <View style={styles.quizLeaderboardScopeTabs}>
                        {renderLeaderboardRankPills('completed-empty')}
                        <Pressable
                          style={[styles.quizLeaderboardEditPill, isLeaderboardEditMode && styles.quizLeaderboardEditPillActive]}
                          onPress={() => setIsLeaderboardEditMode(prev => !prev)}
                        >
                          <Text style={[styles.quizLeaderboardEditPillLabel, isLeaderboardEditMode && styles.quizLeaderboardEditPillLabelActive]}>
                            {isLeaderboardEditMode ? 'Done' : 'Edit'}
                          </Text>
                        </Pressable>
                        {completedLeaderboardScopeOptions.map(option => {
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
                    {isFocusModeKey(activeModeKey) && leaderboardScope === 'session' ? (
                      <Text style={styles.quizFinishSubtitle}>{focusLeaderboardSaveNotice}</Text>
                    ) : null}
                    <Text style={styles.quizLeaderboardEmpty}>No {completedScopeLabel.toLowerCase()} {activeQuizLeaderboardLabel.toLowerCase()} entries for this mode.</Text>
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
              <View style={[styles.quizTableBody, quizMode === 'focus' && styles.quizTableBodyTopAligned]}>
                {column.map(item => (
                  <View key={item.id} style={styles.quizTableRowItem}>
                    <View
                      style={[
                        styles.quizKanaCell,
                        isJlptJapaneseInputMode && styles.quizKanaCellWide,
                        engModeEnabled && styles.quizKanaCellEnglish,
                        isFocusedItem(item) && styles.quizKanaCellFocused,
                      ]}
                    >
                      <View
                        style={[
                          styles.quizKanaCellContent,
                          isJlptJapaneseInputMode ? { alignItems: 'flex-start' } : null,
                          engModeEnabled && styles.quizKanaCellContentEnglish,
                        ]}
                      >
                        {shouldShowJlptKanjiInfo && !quizPromptHidden && isJlptStyleItem(item) && !usesJapaneseInputForItem(item) ? (
                          <Pressable
                            onPress={() => openJishoWord(item.kana)}
                            style={styles.quizKanjiInfoButton}
                            hitSlop={6}
                          >
                            <Text style={styles.quizKanjiInfoLabel}>i</Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          onPress={() => {
                            if (quizPromptHidden) return;
                            void toggleFocusedItem(item);
                          }}
                        >
                          <Text
                            style={[
                              styles.quizKanaText,
                              isJlptJapaneseInputMode && styles.quizKanaTextWide,
                              engModeEnabled && styles.quizKanaTextEnglish,
                              engModeEnabled && isEnglishAlphabetMode && styles.quizKanaTextEnglishAlphabet,
                            ]}
                          >
                            {quizPromptHidden ? 'Paused' : getPromptTextForItem(item)}
                          </Text>
                        </Pressable>
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
                      editable={!hasFinished && !isQuizPaused}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={usesJapaneseInputForItem(item) ? 2 : 40}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => focusNextAnswer(item.id, answers)}
                      onKeyPress={event => {
                        if (
                          event.nativeEvent.key === 'Backspace' &&
                          !hasFinished &&
                          !isQuizPaused &&
                          (answers[item.id] || '').length > 0 &&
                          !quizBackspacePenaltyWordIdsRef.current.has(item.id)
                        ) {
                          quizBackspacePenaltyWordIdsRef.current.add(item.id);
                          setQuizBackspaceCount(prev => prev + 1);
                        }
                      }}
                      onFocus={event => {
                        if (Platform.OS !== 'web') return;
                        const target = (event as any)?.target as HTMLInputElement | undefined;
                        if (target && typeof target.scrollLeft === 'number') {
                          target.scrollLeft = 0;
                        }
                        if (target && typeof target.scrollIntoView === 'function') {
                          requestAnimationFrame(() => {
                            target.scrollIntoView({
                              behavior: 'smooth',
                              block: 'center',
                              inline: 'nearest',
                            });
                          });
                        }
                      }}
                      onChangeText={text => handleAnswerChange(item.id, usesJapaneseInputForItem(item) ? sanitizeJapaneseInput(text) : text)}
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

      {isSaveManagerOpen ? (
        <View style={styles.editModalOverlay}>
          <View style={[styles.editModalPanel, styles.saveManagerModalPanel]}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Save Manager</Text>
              <Pressable onPress={() => setIsSaveManagerOpen(false)}>
                <Text style={styles.editModalClose}>×</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.saveManagerScroll} contentContainerStyle={styles.saveManagerScrollContent}>
              <View style={styles.saveManagerToolbar}>
                <View style={styles.saveManagerSummaryGrid}>
                  <View style={styles.saveManagerSummaryCard}>
                    <Text style={styles.saveManagerSummaryValue}>{focusSnapshots.length}</Text>
                    <Text style={styles.saveManagerSummaryLabel}>Focus saves</Text>
                  </View>
                  <View style={styles.saveManagerSummaryCard}>
                    <Text style={styles.saveManagerSummaryValue}>{leaderboardSnapshots.length}</Text>
                    <Text style={styles.saveManagerSummaryLabel}>Leaderboard saves</Text>
                  </View>
                  <View style={styles.saveManagerSummaryCard}>
                    <Text style={styles.saveManagerSummaryValue}>{focusedItems.length}</Text>
                    <Text style={styles.saveManagerSummaryLabel}>Current Focus items</Text>
                  </View>
                </View>
                <View style={styles.saveManagerActionRow}>
                  <View style={styles.saveManagerActionInfo}>
                    <Text style={styles.saveManagerSectionEyebrow}>Save Manager backup</Text>
                    <Text style={styles.calendarNoteSource}>{`Export or import the full Save Manager as *${SAVE_STATES_FILE_EXTENSION}`}</Text>
                  </View>
                  <View style={styles.saveManagerButtonRow}>
                    <Pressable style={[styles.stageSecondaryButton, styles.saveManagerTopActionButton]} onPress={exportSaveStatesData}>
                      <Text style={styles.stageSecondaryLabel}>Export Save States</Text>
                    </Pressable>
                    <Pressable style={[styles.stageSecondaryButton, styles.saveManagerTopActionButton]} onPress={() => void importSaveStatesData()}>
                      <Text style={styles.stageSecondaryLabel}>Import Save States</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.saveManagerTabRow}>
                  <Pressable
                    style={[styles.saveManagerTab, saveManagerTab === 'focus' && styles.saveManagerTabActive]}
                    onPress={() => setSaveManagerTab('focus')}
                  >
                    <Text style={[styles.saveManagerTabLabel, saveManagerTab === 'focus' && styles.saveManagerTabLabelActive]}>
                      Focus Saves
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.saveManagerTab, saveManagerTab === 'leaderboard' && styles.saveManagerTabActive]}
                    onPress={() => setSaveManagerTab('leaderboard')}
                  >
                    <Text style={[styles.saveManagerTabLabel, saveManagerTab === 'leaderboard' && styles.saveManagerTabLabelActive]}>
                      Leaderboards
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.saveManagerBody}>
                <View style={styles.saveManagerComposePane}>
                  <View style={styles.saveManagerGuideCard}>
                    <Text style={styles.saveManagerSectionEyebrow}>How to use</Text>
                    <Text style={styles.saveManagerPaneTitle}>
                      {saveManagerTab === 'leaderboard' ? 'Save leaderboard snapshots in 3 steps' : 'Save Focus sets in 3 steps'}
                    </Text>
                    <View style={styles.saveManagerGuideList}>
                      <Text style={styles.saveManagerGuideStep}>
                        {saveManagerTab === 'leaderboard'
                          ? '1. Name the snapshot you want to keep.'
                          : '1. Build or update your current Focus item list.'}
                      </Text>
                      <Text style={styles.saveManagerGuideStep}>
                        {saveManagerTab === 'leaderboard'
                          ? '2. Click the save button to capture the current all-time and session boards.'
                          : '2. Enter a save name, then click Save Focus Set.'}
                      </Text>
                      <Text style={styles.saveManagerGuideStep}>
                        {saveManagerTab === 'leaderboard'
                          ? '3. Load a snapshot later to restore both leaderboard views.'
                          : '3. Load a saved set later, or overwrite an existing one from the list.'}
                      </Text>
                    </View>
                  </View>

                  {saveManagerTab === 'leaderboard' ? (
                    <View style={styles.saveManagerPaneCard}>
                      <Text style={styles.saveManagerSectionEyebrow}>Step 1</Text>
                      <Text style={styles.saveManagerPaneTitle}>Create leaderboard save</Text>
                      <Text style={styles.saveManagerPaneSubtitle}>Store the current all-time and session leaderboards as a named snapshot.</Text>
                      <TextInput
                        style={styles.calendarInput}
                        placeholder="Save name (e.g. JLPT practice set A)"
                        placeholderTextColor="#94A3B8"
                        value={leaderboardSnapshotName}
                        onChangeText={setLeaderboardSnapshotName}
                      />
                      <Pressable style={[styles.stagePrimaryButton, styles.saveManagerPrimaryButton]} onPress={() => void createLeaderboardSnapshot()}>
                        <Text style={styles.stagePrimaryLabel}>Save Leaderboard Snapshot</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.saveManagerPaneCard}>
                      <Text style={styles.saveManagerSectionEyebrow}>Step 2</Text>
                      <Text style={styles.saveManagerPaneTitle}>Create focus save</Text>
                      <Text style={styles.saveManagerPaneSubtitle}>Save the current Focus set so it can be reloaded or overwritten later.</Text>
                      <View style={styles.saveManagerPaneUtilityRow}>
                        <Text style={[styles.calendarNoteSource, styles.saveManagerPaneUtilityNote]}>
                          {`Focus-only import/export uses *${FOCUS_SAVE_STATES_FILE_EXTENSION}`}
                        </Text>
                        <View style={styles.saveManagerPaneUtilityButtons}>
                          <Pressable
                            style={[styles.stageSecondaryButton, styles.saveManagerPaneUtilityButton]}
                            onPress={exportFocusSaveStatesData}
                          >
                            <Text style={styles.stageSecondaryLabel}>Export Focus Saves</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.stageSecondaryButton, styles.saveManagerPaneUtilityButton]}
                            onPress={() => void importFocusSaveStatesData()}
                          >
                            <Text style={styles.stageSecondaryLabel}>Import Focus Saves</Text>
                          </Pressable>
                        </View>
                      </View>
                      <TextInput
                        style={styles.calendarInput}
                        placeholder="Save name (e.g. Week 2 kanji set)"
                        placeholderTextColor="#94A3B8"
                        value={focusSnapshotName}
                        onChangeText={setFocusSnapshotName}
                      />
                      <Text style={styles.saveManagerMetaText}>Current Focus items: {focusedItems.length}</Text>
                      <Text style={styles.saveManagerMetaText}>
                        {activeFocusSnapshotName ? `Loaded save: ${activeFocusSnapshotName}` : 'No Focus save is currently loaded.'}
                      </Text>
                      <Pressable style={[styles.stagePrimaryButton, styles.saveManagerPrimaryButton]} onPress={() => void createFocusSnapshot()}>
                        <Text style={styles.stagePrimaryLabel}>Save Focus Set</Text>
                      </Pressable>
                    </View>
                  )}
                </View>

                <View style={styles.saveManagerListPane}>
                  <View style={styles.saveManagerListHeader}>
                    <Text style={styles.saveManagerPaneTitle}>
                      {saveManagerTab === 'leaderboard' ? 'Saved leaderboards' : 'Saved Focus sets'}
                    </Text>
                    <Text style={styles.saveManagerMetaText}>
                      {saveManagerTab === 'leaderboard'
                        ? `${leaderboardSnapshots.length} saved`
                        : `${focusSnapshots.length} saved`}
                    </Text>
                  </View>
                  <ScrollView style={styles.saveManagerListScroll} contentContainerStyle={styles.saveManagerListContent}>
                    {saveManagerTab === 'leaderboard' ? (
                      leaderboardSnapshots.length === 0 ? (
                        <Text style={styles.calendarNoteEmpty}>No leaderboard saves yet.</Text>
                      ) : (
                        leaderboardSnapshots.map(snapshot => (
                          <View key={snapshot.id} style={styles.saveManagerEntryCard}>
                            <View style={styles.saveManagerEntryHeader}>
                              <View style={styles.saveManagerEntryInfo}>
                                <Text style={styles.calendarNoteBadge}>{snapshot.name}</Text>
                                <Text style={styles.noteListDate}>{formatLeaderboardDateTime(snapshot.createdAt)}</Text>
                              </View>
                            </View>
                            <Text style={styles.calendarNoteSource}>
                              All-time: {snapshot.leaderboard.length} entries | Session: {snapshot.sessionLeaderboard.length} entries
                            </Text>
                            <View style={styles.saveManagerEntryActions}>
                              <Pressable style={[styles.saveManagerEntryButton, styles.saveManagerEntryButtonPrimary]} onPress={() => void loadLeaderboardSnapshot(snapshot)}>
                                <Text style={styles.saveManagerEntryButtonLabel}>Load Snapshot</Text>
                              </Pressable>
                              <Pressable style={styles.saveManagerEntryDeleteButton} onPress={() => void deleteLeaderboardSnapshot(snapshot.id)}>
                                <Text style={styles.saveManagerEntryDeleteButtonLabel}>Delete</Text>
                              </Pressable>
                            </View>
                          </View>
                        ))
                      )
                    ) : focusSnapshots.length === 0 ? (
                      <Text style={styles.calendarNoteEmpty}>No focus saves yet.</Text>
                    ) : (
                      focusSnapshots.map(snapshot => (
                        <View key={snapshot.id} style={styles.saveManagerEntryCard}>
                          <View style={styles.saveManagerEntryHeader}>
                            <View style={styles.saveManagerEntryInfo}>
                              <Text style={styles.calendarNoteBadge}>{snapshot.name}</Text>
                              <Text style={styles.noteListDate}>{formatLeaderboardDateTime(snapshot.createdAt)}</Text>
                            </View>
                            {activeFocusSnapshotId === snapshot.id ? (
                              <Text style={styles.saveManagerActiveTag}>Loaded</Text>
                            ) : null}
                          </View>
                          <Text style={styles.calendarNoteSource}>Focus items: {snapshot.focusItems.length}</Text>
                          <View style={styles.saveManagerEntryActions}>
                            <Pressable style={[styles.saveManagerEntryButton, styles.saveManagerEntryButtonPrimary]} onPress={() => void loadFocusSnapshot(snapshot)}>
                              <Text style={styles.saveManagerEntryButtonLabel}>Load Set</Text>
                            </Pressable>
                            <Pressable style={styles.saveManagerEntryButton} onPress={() => void overwriteFocusSnapshot(snapshot.id)}>
                              <Text style={styles.saveManagerEntryButtonLabel}>Overwrite</Text>
                            </Pressable>
                            <Pressable style={styles.saveManagerEntryDeleteButton} onPress={() => void deleteFocusSnapshot(snapshot.id)}>
                              <Text style={styles.saveManagerEntryDeleteButtonLabel}>Delete</Text>
                            </Pressable>
                          </View>
                        </View>
                      ))
                    )}
                  </ScrollView>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}
    </View>
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

