// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Line, Path, Polyline, Text as SvgText } from 'react-native-svg';
import { styles } from './mobile/src/styles/appStyles';
import { JLPT_N3_KANJI_DETAILS, JLPT_N3_KANJI_SOURCE } from './mobile/src/data/jlpt_n3_kanji';
import {
  buildFocusNoteFolderPayload,
  buildSaveProfilePayload,
  buildSaveProfilesExportPayload,
  extractSaveProfilesFromImport,
  normalizeSaveProfilesPayload,
  SAVE_PROFILES_FILE_EXTENSION,
} from './mobile/src/utils/saveProfiles';
const QUIZ_LEADERBOARD_STORAGE_KEY = 'tensai-note.quiz-leaderboard.v1';
const QUIZ_LEADERBOARD_BACKUP_STORAGE_KEY = 'tensai-note.quiz-leaderboard-backup.v1';
const QUIZ_LEADERBOARD_SCORES_ENABLED_STORAGE_KEY = 'tensai-note.quiz-leaderboard-scores-enabled.v1';
const QUIZ_SCORE_MODE_STORAGE_KEY = 'tensai-note.quiz-score-mode.v1';
const QUIZ_ENG_MODE_ENABLED_STORAGE_KEY = 'tensai-note.quiz-eng-mode-enabled.v1';
const QUIZ_FOCUS_STORAGE_KEY = 'tensai-note.quiz-focus.v1';
const QUIZ_BOTTLENECK_STORAGE_KEY = 'tensai-note.quiz-bottleneck.v1';
const QUIZ_SAVE_PROFILES_STORAGE_KEY = 'tensai-note.quiz-save-profiles.v2';
const QUIZ_LEADERBOARD_SNAPSHOTS_STORAGE_KEY = 'tensai-note.quiz-leaderboard-snapshots.v1';
const QUIZ_FOCUS_SNAPSHOTS_STORAGE_KEY = 'tensai-note.quiz-focus-snapshots.v1';
const QUIZ_ANALYSIS_STORAGE_KEY = 'tensai-note.quiz-analysis.v1';
const QUIZ_SAVE_MANAGER_OPEN_EVENT = 'tensai:save-manager-open';
const LEADERBOARD_EXPORT_TYPE = 'tensai-leaderboard';
const LEADERBOARD_FILE_EXTENSION = '.tensai-leaderboard.json';
const FOCUS_NOTES_PANEL_GAP = 12;
const FOCUS_NOTES_DEFAULT_WIDTH = 300;
const FOCUS_NOTES_MIN_WIDTH = 240;
const FOCUS_NOTES_MAX_WIDTH = 520;

const clampFocusNotesWidth = (width: number) =>
  Math.max(FOCUS_NOTES_MIN_WIDTH, Math.min(FOCUS_NOTES_MAX_WIDTH, Math.round(width)));

const getExtensionLocalStorage = () => {
  const storage = (globalThis as any)?.chrome?.storage?.local;
  if (!storage || typeof storage.get !== 'function' || typeof storage.set !== 'function') {
    return null;
  }
  return storage;
};

const getExtensionStorageItem = (key: string) =>
  new Promise<string | null>(resolve => {
    const storage = getExtensionLocalStorage();
    if (!storage) {
      resolve(null);
      return;
    }
    try {
      storage.get([key], (result: any) => {
        const runtimeError = (globalThis as any)?.chrome?.runtime?.lastError;
        if (runtimeError) {
          console.error('Failed to read extension storage:', runtimeError);
          resolve(null);
          return;
        }
        const value = result?.[key];
        resolve(typeof value === 'string' ? value : null);
      });
    } catch (err) {
      console.error('Failed to read extension storage:', err);
      resolve(null);
    }
  });

const setExtensionStorageItem = (key: string, value: string) =>
  new Promise<void>(resolve => {
    const storage = getExtensionLocalStorage();
    if (!storage) {
      resolve();
      return;
    }
    try {
      storage.set({ [key]: value }, () => {
        const runtimeError = (globalThis as any)?.chrome?.runtime?.lastError;
        if (runtimeError) {
          console.error('Failed to write extension storage:', runtimeError);
        }
        resolve();
      });
    } catch (err) {
      console.error('Failed to write extension storage:', err);
      resolve();
    }
  });

const parseLeaderboardStoragePayload = (raw: string | null) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.leaderboard)) return parsed.leaderboard;
    return [];
  } catch {
    return [];
  }
};

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
  登: { readings: ['tou', 'nobo', 'aga'], meanings: ['climb', 'ascend'] },
  回: { readings: ['kai', 'mawa'], meanings: ['turn', 'times', 'revolve'] },
  歌: { readings: ['ka', 'uta'], meanings: ['song'] },
  答: { readings: ['tou', 'kotae'], meanings: ['answer'] },
  伝: { readings: ['den', 'tsutae', 'tsuda'], meanings: ['convey'] },
  借: { readings: ['shaku', 'ka'], meanings: ['borrow'] },
  買: { readings: ['bai', 'ka'], meanings: ['buy'] },
  払: { readings: ['futsu', 'hara'], meanings: ['pay'] },
  洗: { readings: ['sen', 'ara'], meanings: ['wash'] },
  選: { readings: ['sen', 'era', 'erabu'], meanings: ['choose'] },
  遊: { readings: ['yuu', 'aso'], meanings: ['play'] },
  待: { readings: ['tai', 'ma'], meanings: ['wait'] },
  降: { readings: ['kou', 'oriru', 'fu'], meanings: ['descend', 'fall'] },
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
  線: { readings: ['sen', 'suji'], meanings: ['line'] },
  字: { readings: ['ji', 'aza'], meanings: ['character', 'letter'] },
  漢: { readings: ['kan'], meanings: ['china'] },
  験: { readings: ['ken'], meanings: ['test'] },
  勉: { readings: ['ben', 'tsuto'], meanings: ['diligence', 'study', 'effort', 'strive'] },
  査: { readings: ['sa'], meanings: ['inspect', 'investigate'] },
  説: { readings: ['setsu', 'to'], meanings: ['explain', ] },
  留: { readings: ['ryuu', 'to', 'ru'], meanings: ['stay', 'halt', 'ruble'] },
  図: { readings: ['zu', 'haka', 'to'], meanings: ['diagram', 'map'] },
  婚: { readings: ['kon'], meanings: ['marriage'] },
  産: { readings: ['san', 'u'], meanings: ['produce', 'give birth'] },
  旅: { readings: ['ryo', 'tabi'], meanings: ['trip', 'journey', 'travel'] },
  便: { readings: ['ben', 'bin', 'tayo'], meanings: ['convenience', 'mail'] },
  両: { readings: ['ryou'], meanings: ['both'] },
  礼: { readings: ['rei'], meanings: ['thanks', 'courtesy', 'gratitude'] },
  然: { readings: ['zen', 'shika'], meanings: ['so', 'natural', 'in that case'] },
  全: { readings: ['zen', 'matta'], meanings: ['all'] },
  組: { readings: ['so', 'kumi'], meanings: ['group'] },
  点: { readings: ['ten', 'tsukeru'], meanings: ['point', 'mark', 'spot', 'dot'] },
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
const buildJlptKanjiQuiz = (
  source: string,
  details: Record<string, { readings: string[]; meanings: string[] }>,
  prefix: string,
) =>
  source.split(/\s+/)
    .filter(Boolean)
    .map((kana, index) => {
      const detail = details[kana];
      return {
        id: `${prefix}_${`${index + 1}`.padStart(3, '0')}`,
        kana,
        answers: detail?.readings || [],
        onyomi: detail?.readings?.slice(0, 1) || [],
        kunyomi: detail?.readings?.slice(1) || [],
      };
    });
const JLPT_N3_KANJI_SOURCE_PARTS = (() => {
  const allKanji = JLPT_N3_KANJI_SOURCE.split(/\s+/).filter(Boolean);
  const partSize = Math.ceil(allKanji.length / 4);
  return Array.from({ length: 4 }, (_, index) =>
    allKanji.slice(index * partSize, (index + 1) * partSize).join(' '),
  );
})();
const JLPT_N3_1_KANJI_SOURCE = JLPT_N3_KANJI_SOURCE_PARTS[0];
const JLPT_N3_2_KANJI_SOURCE = JLPT_N3_KANJI_SOURCE_PARTS[1];
const JLPT_N3_3_KANJI_SOURCE = JLPT_N3_KANJI_SOURCE_PARTS[2];
const JLPT_N3_4_KANJI_SOURCE = JLPT_N3_KANJI_SOURCE_PARTS[3];
const JLPT_N3_1_KANJI_QUIZ = buildJlptKanjiQuiz(JLPT_N3_1_KANJI_SOURCE, JLPT_N3_KANJI_DETAILS, 'n3_1');
const JLPT_N3_2_KANJI_QUIZ = buildJlptKanjiQuiz(JLPT_N3_2_KANJI_SOURCE, JLPT_N3_KANJI_DETAILS, 'n3_2');
const JLPT_N3_3_KANJI_QUIZ = buildJlptKanjiQuiz(JLPT_N3_3_KANJI_SOURCE, JLPT_N3_KANJI_DETAILS, 'n3_3');
const JLPT_N3_4_KANJI_QUIZ = buildJlptKanjiQuiz(JLPT_N3_4_KANJI_SOURCE, JLPT_N3_KANJI_DETAILS, 'n3_4');
const JLPT_N3_ENGLISH_MEANINGS_BY_KANA: Record<string, string[]> = Object.fromEntries(
  Object.entries(JLPT_N3_KANJI_DETAILS).map(([kana, detail]) => [kana, detail.meanings]),
);

function formatDateKey(date: any): string {
  if (!(date instanceof Date)) return '';
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
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

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [quizScoreMode, setQuizScoreMode] = useState<QuizScoreMode>('off');
  const [engModeEnabled, setEngModeEnabled] = useState(false);
  const [isFocusNotesOpen, setIsFocusNotesOpen] = useState(false);
  const [focusNotesPanelWidth, setFocusNotesPanelWidth] = useState(FOCUS_NOTES_DEFAULT_WIDTH);
  const focusNotesAnimation = React.useRef(new Animated.Value(0)).current;
  const focusNotesShellOffset = React.useRef(new Animated.Value(0)).current;
  const leaderboardScoresEnabled = quizScoreMode !== 'off';

  useEffect(() => {
    Animated.timing(focusNotesAnimation, {
      toValue: isFocusNotesOpen ? 1 : 0,
      duration: 240,
      useNativeDriver: false,
    }).start();
  }, [focusNotesAnimation, isFocusNotesOpen]);

  const animateFocusNotesShell = useCallback(
    (width: number, open: boolean) => {
      Animated.timing(focusNotesShellOffset, {
        toValue: open ? -((clampFocusNotesWidth(width) + FOCUS_NOTES_PANEL_GAP) / 2) : 0,
        duration: 220,
        useNativeDriver: false,
      }).start();
    },
    [focusNotesShellOffset],
  );

  useEffect(() => {
    animateFocusNotesShell(focusNotesPanelWidth, isFocusNotesOpen);
  }, [animateFocusNotesShell, isFocusNotesOpen]);

  const handleFocusNotesResizeEnd = useCallback(
    (width: number) => {
      animateFocusNotesShell(width, true);
    },
    [animateFocusNotesShell],
  );

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

  const handleOpenSaveManagerPress = useCallback(() => {
    dispatchLeaderboardSettingsEvent(QUIZ_SAVE_MANAGER_OPEN_EVENT);
  }, [dispatchLeaderboardSettingsEvent]);

  return (
    <View style={styles.appShell}>
      <Animated.View style={[styles.mainContent, { transform: [{ translateX: focusNotesShellOffset }] }]}>
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
          <MemoizedKanaQuizView
            scoreMode={quizScoreMode}
            engModeEnabled={engModeEnabled}
            isFocusNotesOpen={isFocusNotesOpen}
            setIsFocusNotesOpen={setIsFocusNotesOpen}
            focusNotesPanelWidth={focusNotesPanelWidth}
            setFocusNotesPanelWidth={setFocusNotesPanelWidth}
            onFocusNotesResizeEnd={handleFocusNotesResizeEnd}
            focusNotesAnimation={focusNotesAnimation}
          />
        </View>
      </Animated.View>
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
  { value: 'jlpt_n3', label: 'JLPT N3-1', tabLabel: 'N3-1', family: 'jlpt', dataset: JLPT_N3_1_KANJI_QUIZ },
  { value: 'jlpt_n3_2', label: 'JLPT N3-2', tabLabel: 'N3-2', family: 'jlpt', dataset: JLPT_N3_2_KANJI_QUIZ },
  { value: 'jlpt_n3_3', label: 'JLPT N3-3', tabLabel: 'N3-3', family: 'jlpt', dataset: JLPT_N3_3_KANJI_QUIZ },
  { value: 'jlpt_n3_4', label: 'JLPT N3-4', tabLabel: 'N3-4', family: 'jlpt', dataset: JLPT_N3_4_KANJI_QUIZ },
  { value: 'focus', label: 'Focus', tabLabel: 'Focus', family: 'focus', dataset: [] },
  { value: 'bottleneck', label: 'Bottleneck', tabLabel: 'Bottleneck', family: 'focus', dataset: [] },
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
  { value: 'analysis', label: 'Analysis' },
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
const LEADERBOARD_TIMER_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'dynamic', label: 'Dynamic' },
];
const LEADERBOARD_GAME_OPTIONS = [
  { value: 'quiz', label: 'Quiz' },
  { value: 'typemaster', label: 'TypeMaster' },
];
const KANA_VARIANT_OPTIONS = {
  hiragana: ['hiragana', 'hiragana_dakuten'],
  katakana: ['katakana', 'katakana_dakuten'],
};
const JLPT_N3_VARIANT_VALUES = ['jlpt_n3', 'jlpt_n3_2', 'jlpt_n3_3', 'jlpt_n3_4'];
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

const getQuizModeOption = (mode: string) => QUIZ_MODES.find(option => option.value === mode);
const getExactQuizDataset = (mode: string) => getQuizModeOption(mode)?.dataset || [];
const getQuizDataset = (mode: string) => {
  const selected = getQuizModeOption(mode) || QUIZ_MODES[0];
  return selected.dataset;
};
const getQuizModeFamily = (mode: string) => {
  const selected = getQuizModeOption(mode) || QUIZ_MODES[0];
  return selected.family;
};
const getQuizModesForFamily = (family: string) => QUIZ_MODES.filter(option => option.family === family);

const getQuizModeKey = (mode: string, jlptReadingMode: string = DEFAULT_JLPT_READING_MODE) =>
  isJlptQuizMode(mode) || mode === 'focus' ? `${mode}:${jlptReadingMode}` : mode;

const getTypeMasterModeKey = (quizModeKey: string) => `typemaster:${quizModeKey}`;
const getBaseFocusSourceMode = (sourceMode: string | undefined) => {
  if (!sourceMode) return '';
  const withoutModePrefix = sourceMode.startsWith('endless:')
    ? sourceMode.replace('endless:', '')
    : sourceMode;
  const parsedTypeMaster = withoutModePrefix.startsWith('typemaster:')
    ? parseTypeMasterModeKey(withoutModePrefix)
    : null;
  return (parsedTypeMaster?.quizModeKey || withoutModePrefix).split(':')[0];
};
const getSourceModeFromCanonicalItemId = (id: any) => {
  const safeId = `${id || ''}`;
  if (safeId.startsWith('n5_')) return 'jlpt_n5';
  if (safeId.startsWith('n4_2_')) return 'jlpt_n4_2';
  if (safeId.startsWith('n4_')) return 'jlpt_n4';
  if (safeId.startsWith('n3_1_')) return 'jlpt_n3';
  if (safeId.startsWith('n3_2_')) return 'jlpt_n3_2';
  if (safeId.startsWith('n3_3_')) return 'jlpt_n3_3';
  if (safeId.startsWith('n3_4_')) return 'jlpt_n3_4';
  return '';
};
const normalizeFocusSourceModeForItem = (sourceMode: string | undefined, item: any) =>
  getSourceModeFromCanonicalItemId(item?.id) || getBaseFocusSourceMode(sourceMode) || `${sourceMode || ''}`;
const isFocusModeKey = (mode: string) =>
  mode === 'focus' ||
  mode.startsWith('focus:') ||
  mode.startsWith('endless:focus') ||
  mode.startsWith('typemaster:focus');
const isBottleneckModeKey = (mode: string) =>
  mode === 'bottleneck' ||
  mode.startsWith('bottleneck:') ||
  mode.startsWith('endless:bottleneck') ||
  mode.startsWith('typemaster:bottleneck');

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
  const getSelectedBaseLabel = (selected: any) =>
    selected?.value === 'jlpt_n5' ? 'JLPT N5' : selected?.label;

  // Handle endless mode: "endless:mode" or "endless:mode:jlptReadingMode"
  if (mode.startsWith('endless:')) {
    const withoutEndless = mode.replace('endless:', '');
    const [baseMode, jlptReadingMode] = withoutEndless.split(':');
    const selected = QUIZ_MODES.find(option => option.value === baseMode);
    if (!selected) return `Endless - ${withoutEndless}`;
    const selectedBaseLabel = getSelectedBaseLabel(selected);
    if (!isJlptQuizMode(baseMode)) return `Endless - ${selectedBaseLabel}`;
    const selectedJlptMode = JLPT_READING_MODES.find(option => option.value === jlptReadingMode);
    return selectedJlptMode ? `Endless - ${selectedBaseLabel} - ${selectedJlptMode.label}` : `Endless - ${selectedBaseLabel}`;
  }

  // Handle typemaster mode: "typemaster:mode" or "typemaster:mode:jlptReadingMode"
  if (mode.startsWith('typemaster:')) {
    const parsed = parseTypeMasterModeKey(mode);
    if (!parsed) return `TypeMaster - ${mode.replace('typemaster:', '')}`;
    const [baseMode, jlptReadingMode] = parsed.quizModeKey.split(':');
    const selected = QUIZ_MODES.find(option => option.value === baseMode);
    const queueLabel = (TYPEMASTER_QUEUE_OPTIONS.find(option => option.value === parsed.queueMode) || TYPEMASTER_QUEUE_OPTIONS[0]).label;
    if (!selected) return `TypeMaster (${queueLabel}) - ${parsed.quizModeKey}`;
    const selectedBaseLabel = getSelectedBaseLabel(selected);
    if (!isJlptQuizMode(baseMode)) return `TypeMaster (${queueLabel}) - ${selectedBaseLabel}`;
    const selectedJlptMode = JLPT_READING_MODES.find(option => option.value === jlptReadingMode);
    return selectedJlptMode
      ? `TypeMaster (${queueLabel}) - ${selectedBaseLabel} - ${selectedJlptMode.label}`
      : `TypeMaster (${queueLabel}) - ${selectedBaseLabel}`;
  }

  const [baseMode, jlptReadingMode] = mode.split(':');
  const selected = QUIZ_MODES.find(option => option.value === baseMode);
  if (!selected) return mode;
  const selectedBaseLabel = getSelectedBaseLabel(selected);
  if (!isJlptQuizMode(baseMode)) return selectedBaseLabel;
  const selectedJlptMode = JLPT_READING_MODES.find(option => option.value === jlptReadingMode);
  return selectedJlptMode ? `${selectedBaseLabel} - ${selectedJlptMode.label}` : selectedBaseLabel;
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
  ([...(JLPT_N5_ENGLISH_MEANINGS[item.id] || []), ...(JLPT_N4_ENGLISH_MEANINGS_BY_KANA[item.kana] || []), ...(JLPT_N4_2_ENGLISH_MEANINGS_BY_KANA[item.kana] || []), ...(JLPT_N3_ENGLISH_MEANINGS_BY_KANA[item.kana] || [])])
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
  if (!sourceMode || sourceMode === 'focus' || sourceMode === 'bottleneck') return null;
  const sourceBaseMode = getBaseFocusSourceMode(sourceMode);
  const dataset = getExactQuizDataset(sourceBaseMode);
  const sourceDataset = Array.isArray(dataset) ? dataset : [];
  const originalId = rawItem?.__focusOriginalId || rawItem?.id;
  const kana = rawItem?.kana;
  const exactMatch = sourceDataset.find((candidate: any) =>
    originalId && kana && candidate?.id === originalId && candidate?.kana === kana,
  );
  if (exactMatch) return exactMatch;

  if (kana) {
    const sourceKanaMatch = sourceDataset.find((candidate: any) => candidate?.kana === kana);
    if (sourceKanaMatch) return sourceKanaMatch;

    for (const option of QUIZ_MODES) {
      if (option.value === sourceBaseMode || option.value === 'focus' || option.value === 'bottleneck') continue;
      const crossDatasetKanaMatch = option.dataset.find((candidate: any) => candidate?.kana === kana);
      if (crossDatasetKanaMatch) return crossDatasetKanaMatch;
    }
    return null;
  }

  return originalId
    ? sourceDataset.find((candidate: any) => candidate?.id === originalId) || null
    : null;
};
const normalizeStoredFocusItem = (rawItem: any, sourceMode?: string) => {
  const canonical = getCanonicalFocusItem(sourceMode, rawItem);
  const base = canonical || rawItem || {};
  return {
    ...rawItem,
    id: canonical?.id ?? rawItem?.id ?? base.id,
    kana: canonical?.kana ?? rawItem?.kana ?? base.kana,
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
  const parsed = parseTypeMasterModeKey(entry.mode);
  if (!parsed) return baseLabel;
  const queueValue = entry.typemasterQueueMode || parsed.queueMode;
  const queueLabel = (TYPEMASTER_QUEUE_OPTIONS.find(option => option.value === queueValue) || TYPEMASTER_QUEUE_OPTIONS[0]).label;
  return `TypeMaster (${queueLabel}) - ${getQuizModeLabel(parsed.quizModeKey)}`;
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

const createLeaderboardBucketKey = (mode: string, timerMinutes?: number, scoreType?: string) =>
  `${normalizeStoredQuizModeKey(mode)}|${normalizeLeaderboardTimerMinutes(timerMinutes)}|${normalizeLeaderboardScoreType(scoreType)}`;

const createLeaderboardModeTimerKey = (mode: string, timerMinutes?: number) =>
  `${normalizeStoredQuizModeKey(mode)}|${normalizeLeaderboardTimerMinutes(timerMinutes)}`;

const createLeaderboardEntryIdentity = (entry: any) =>
  `${normalizeStoredQuizModeKey(entry?.mode)}|${normalizeLeaderboardTimerMinutes(entry?.timerMinutes)}|${normalizeLeaderboardScoreType(entry?.scoreType)}|${entry?.typemasterQueueMode || ''}|${entry?.date || 0}|${entry?.timeMs || 0}|${entry?.score || 0}|${entry?.total || 0}|${entry?.finishReason || 'complete'}`;

const createStableHash = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const createAnalysisItemKey = (item: any) =>
  `${item?.__focusSourceMode || item?.sourceMode || ''}:${item?.__focusOriginalId || item?.id || item?.kana || ''}`;

const createAnalysisBottleneckSnapshot = (items: any[]) => {
  const keys = (Array.isArray(items) ? items : [])
    .map(createAnalysisItemKey)
    .filter(Boolean)
    .sort();
  return {
    itemCount: keys.length,
    signature: keys.length ? createStableHash(keys.join('|')) : 'empty',
  };
};

const formatAnalysisDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${`${minutes}`.padStart(2, '0')}:${`${seconds}`.padStart(2, '0')}`;
  return `${minutes}:${`${seconds}`.padStart(2, '0')}`;
};

const escapeXml = (value: any) =>
  `${value ?? ''}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

function PencilNoteIcon({ active = false }: { active?: boolean }) {
  const pageFill = active ? '#dbeafe' : '#162338';
  const pageStroke = active ? '#bfdbfe' : '#60a5fa';
  const pencilStroke = active ? '#0b162b' : '#93c5fd';
  const accent = active ? '#1e40af' : '#38bdf8';

  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path
        d="M4.25 2.75h6.2l3.3 3.3v8.2c0 .55-.45 1-1 1h-8.5c-.55 0-1-.45-1-1V3.75c0-.55.45-1 1-1Z"
        fill={pageFill}
        stroke={pageStroke}
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
      <Path
        d="M10.45 2.9v3.15h3.15"
        fill="none"
        stroke={pageStroke}
        strokeWidth={1.15}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6 11.95l.55-2.25 4.95-4.95 1.7 1.7-4.95 4.95L6 11.95Z"
        fill={accent}
        stroke={pencilStroke}
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10.7 5.55l1.7 1.7"
        fill="none"
        stroke={pencilStroke}
        strokeWidth={1}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function KanaQuizView({
  scoreMode = 'off',
  engModeEnabled = false,
  isFocusNotesOpen = false,
  setIsFocusNotesOpen = () => {},
  focusNotesPanelWidth = FOCUS_NOTES_DEFAULT_WIDTH,
  setFocusNotesPanelWidth = () => {},
  onFocusNotesResizeEnd = () => {},
  focusNotesAnimation,
}: {
  scoreMode?: QuizScoreMode;
  engModeEnabled?: boolean;
  isFocusNotesOpen?: boolean;
  setIsFocusNotesOpen?: (next: boolean | ((prev: boolean) => boolean)) => void;
  focusNotesPanelWidth?: number;
  setFocusNotesPanelWidth?: (next: number) => void;
  onFocusNotesResizeEnd?: (next: number) => void;
  focusNotesAnimation?: any;
}) {
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
  const [openJlptSetDropdownBase, setOpenJlptSetDropdownBase] = useState<string | null>(null);
  const [openKanaDropdownBase, setOpenKanaDropdownBase] = useState<string | null>(null);
  const [quizFamily, setQuizFamily] = useState(getQuizModeFamily(defaultQuizMode));
  const [leaderboardScope, setLeaderboardScope] = useState(LEADERBOARD_SCOPE_OPTIONS[0].value);
  const [leaderboardGameType, setLeaderboardGameType] = useState(LEADERBOARD_GAME_OPTIONS[0].value);
  const [analysisGameType, setAnalysisGameType] = useState(LEADERBOARD_GAME_OPTIONS[0].value);
  const [leaderboardTimerFilter, setLeaderboardTimerFilter] = useState<'all' | 'dynamic'>('all');
  const [isLeaderboardTimerDropdownOpen, setIsLeaderboardTimerDropdownOpen] = useState(false);
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
  const [analysisEnabled, setAnalysisEnabled] = useState(false);
  const [analysisSessionStartedAt, setAnalysisSessionStartedAt] = useState<number | null>(null);
  const [analysisElapsedNow, setAnalysisElapsedNow] = useState(Date.now());
  const [analysisEntries, setAnalysisEntries] = useState<any[]>([]);
  const [activeAnalysisGraphKey, setActiveAnalysisGraphKey] = useState('');
  const [quizBackspaceCount, setQuizBackspaceCount] = useState(0);
  const quizBackspacePenaltyWordIdsRef = React.useRef<Set<string>>(new Set());
  const inputRefs = React.useRef<Record<string, TextInput | null>>({});
  const timerDeadlineMsRef = React.useRef<number | null>(null);
  const remainingSecondsRef = React.useRef(remainingSeconds);
  const suppressNextFocusPressRef = React.useRef(false);
  const analysisSessionStartedAtRef = React.useRef<number | null>(null);
  const analysisEntriesRef = React.useRef<any[]>([]);
  const quizRoundFinalizedRef = React.useRef(false);
  const endlessRoundFinalizedRef = React.useRef(false);
  const typemasterRoundFinalizedRef = React.useRef(false);

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
  const endlessRuntimeRef = React.useRef({ isRunning: false, isPaused: false, hasFinished: false, score: 0 });
  const endlessVisibleCharsRef = React.useRef<Array<{ id: string; item: any; position: number }>>([]);
  const endlessPositionsRef = React.useRef<Record<string, number>>({});
  const endlessCharRefs = React.useRef<Record<string, any>>({});
  const endlessStopQueuedRef = React.useRef(false);

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
  const typemasterRuntimeRef = React.useRef({ isRunning: false, isPaused: false, hasFinished: false, score: 0 });
  const [focusedItems, setFocusedItems] = useState<Array<{ key: string; sourceMode: string; item: any }>>([]);
  const [bottleneckItems, setBottleneckItems] = useState<Array<{ key: string; sourceMode: string; item: any }>>([]);
  const focusedItemsRef = React.useRef<Array<{ key: string; sourceMode: string; item: any }>>([]);
  const bottleneckItemsRef = React.useRef<Array<{ key: string; sourceMode: string; item: any }>>([]);
  const [isSaveManagerOpen, setIsSaveManagerOpen] = useState(false);
  const [focusNoteFolders, setFocusNoteFolders] = useState(() => {
    const folder = buildFocusNoteFolderPayload({ title: 'General' });
    return [folder];
  });
  const [activeFocusNoteFolderId, setActiveFocusNoteFolderId] = useState('');
  const fallbackFocusNotesAnimation = React.useRef(new Animated.Value(0)).current;
  const resolvedFocusNotesAnimation = focusNotesAnimation || fallbackFocusNotesAnimation;
  const [saveProfiles, setSaveProfiles] = useState<Array<{
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    focusItems: any[];
    bottleneckItems: any[];
    focusLeaderboard: any[];
    leaderboard: any[];
    sessionLeaderboard: any[];
    notes: string;
    noteFolders: any[];
  }>>([]);
  const [loadedSaveProfileId, setLoadedSaveProfileId] = useState<string | null>(null);
  const [saveProfileName, setSaveProfileName] = useState('');
  const todayKey = formatDateKey(new Date());

  useEffect(() => {
    endlessRuntimeRef.current = {
      ...endlessRuntimeRef.current,
      isRunning: endlessIsRunning,
      isPaused: isEndlessPaused,
      hasFinished: endlessHasFinished,
      score: endlessScore,
    };
  }, [endlessHasFinished, endlessIsRunning, endlessScore, isEndlessPaused]);

  useEffect(() => {
    typemasterRuntimeRef.current = {
      ...typemasterRuntimeRef.current,
      isRunning: typemasterIsRunning,
      isPaused: isTypemasterPaused,
      hasFinished: typemasterHasFinished,
      score: typemasterScore,
    };
  }, [isTypemasterPaused, typemasterHasFinished, typemasterIsRunning, typemasterScore]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const shouldKeepForegroundActive = isRunning || endlessIsRunning || typemasterIsRunning;
    if (!shouldKeepForegroundActive) return;

    let wakeLock: any = null;
    let cancelled = false;

    const requestForegroundLock = async () => {
      const wakeLockApi = (navigator as any)?.wakeLock;
      if (!wakeLockApi || document.visibilityState !== 'visible' || cancelled || wakeLock) return;
      try {
        wakeLock = await wakeLockApi.request('screen');
      } catch {
        wakeLock = null;
      }
    };

    const releaseForegroundLock = () => {
      const lock = wakeLock;
      wakeLock = null;
      if (lock && typeof lock.release === 'function') {
        void lock.release().catch(() => {});
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void requestForegroundLock();
      } else {
        releaseForegroundLock();
      }
    };

    void requestForegroundLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseForegroundLock();
    };
  }, [endlessIsRunning, isRunning, typemasterIsRunning]);

  const setEndlessRuntime = useCallback((updates: Partial<{ isRunning: boolean; isPaused: boolean; hasFinished: boolean; score: number }>) => {
    endlessRuntimeRef.current = {
      ...endlessRuntimeRef.current,
      ...updates,
    };
  }, []);

  const setTypemasterRuntime = useCallback((updates: Partial<{ isRunning: boolean; isPaused: boolean; hasFinished: boolean; score: number }>) => {
    typemasterRuntimeRef.current = {
      ...typemasterRuntimeRef.current,
      ...updates,
    };
  }, []);

  const getEndlessCharsWithCurrentPositions = useCallback(
    (chars: Array<{ id: string; item: any; position: number }>) =>
      chars.map(char => ({
        ...char,
        position: endlessPositionsRef.current[char.id] ?? char.position,
      })),
    [],
  );

  const commitEndlessVisibleChars = useCallback((chars: Array<{ id: string; item: any; position: number }>) => {
    endlessVisibleCharsRef.current = chars;
    const nextPositions: Record<string, number> = {};
    chars.forEach(char => {
      nextPositions[char.id] = char.position;
    });
    endlessPositionsRef.current = nextPositions;
    Object.keys(endlessCharRefs.current).forEach(id => {
      if (!(id in nextPositions)) {
        delete endlessCharRefs.current[id];
      }
    });
    return chars;
  }, []);

  const applyEndlessCharPosition = useCallback((id: string, position: number) => {
    const node = endlessCharRefs.current[id];
    if (!node) return;
    if (typeof node.setNativeProps === 'function') {
      node.setNativeProps({ style: { left: `${position}%` } });
      return;
    }
    const hostNode = typeof node.getNode === 'function' ? node.getNode() : node;
    if (hostNode?.style) {
      hostNode.style.left = `${position}%`;
    }
  }, []);

  React.useLayoutEffect(() => {
    if (!endlessVisibleCharsRef.current.length) return;
    endlessVisibleCharsRef.current.forEach(char => {
      applyEndlessCharPosition(char.id, endlessPositionsRef.current[char.id] ?? char.position);
    });
  });

  const normalizeAnalysisPayload = useCallback((payload: any) => {
    const parsedEntries = Array.isArray(payload?.entries) ? payload.entries : [];
    const entries = parsedEntries
      .filter(entry => entry && typeof entry === 'object')
      .map(entry => ({
        ...entry,
        id: `${entry.id || `${entry.date || Date.now()}-${entry.gameType || 'game'}`}`,
        gameType: entry.gameType || 'quiz',
        mode: normalizeStoredQuizModeKey(entry.mode || entry.modeKey || QUIZ_MODES[0].value),
        graphKey: `${entry.graphKey || 'analysis:unknown'}`,
        graphLabel: `${entry.graphLabel || entry.displayLabel || 'Analysis'}`,
        displayLabel: `${entry.displayLabel || entry.graphLabel || 'Analysis'}`,
        score: Number(entry.score) || 0,
        total: Number(entry.total) || 0,
        date: Number(entry.date) || Date.now(),
        timeMs: Math.max(0, Number(entry.timeMs) || 0),
        timerMinutes: normalizeLeaderboardTimerMinutes(entry.timerMinutes),
        sessionStartedAt: Number(entry.sessionStartedAt) || null,
        sessionElapsedMs: Math.max(0, Number(entry.sessionElapsedMs) || 0),
        finishReason: entry.finishReason || 'complete',
        scoreLabel: entry.scoreLabel || 'Score',
        typemasterQueueMode: entry.typemasterQueueMode,
        bottleneckSignature: entry.bottleneckSignature,
        bottleneckItemCount: Number(entry.bottleneckItemCount) || 0,
      }))
      .sort((a, b) => a.date - b.date);
    return {
      enabled: Boolean(payload?.enabled),
      sessionStartedAt: Number(payload?.sessionStartedAt) || null,
      entries,
    };
  }, []);

  const persistAnalysisPayload = useCallback((payload: { enabled: boolean; sessionStartedAt: number | null; entries: any[] }) => {
    const serialized = JSON.stringify(payload);
    void Promise.all([
      AsyncStorage.setItem(QUIZ_ANALYSIS_STORAGE_KEY, serialized),
      setExtensionStorageItem(QUIZ_ANALYSIS_STORAGE_KEY, serialized),
    ]).catch(err => {
      console.error('Failed to persist analysis data:', err);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadAnalysisData = async () => {
      try {
        const [stored, extensionStored] = await Promise.all([
          AsyncStorage.getItem(QUIZ_ANALYSIS_STORAGE_KEY),
          getExtensionStorageItem(QUIZ_ANALYSIS_STORAGE_KEY),
        ]);
        const source = stored || extensionStored;
        if (!source) return;
        const normalized = normalizeAnalysisPayload(JSON.parse(source));
        if (cancelled) return;
        analysisSessionStartedAtRef.current = normalized.sessionStartedAt;
        analysisEntriesRef.current = normalized.entries;
        setAnalysisEnabled(normalized.enabled);
        setAnalysisSessionStartedAt(normalized.sessionStartedAt);
        setAnalysisEntries(normalized.entries);
      } catch (err) {
        console.error('Failed to load analysis data:', err);
      }
    };
    void loadAnalysisData();
    return () => {
      cancelled = true;
    };
  }, [normalizeAnalysisPayload]);

  useEffect(() => {
    analysisSessionStartedAtRef.current = analysisSessionStartedAt;
  }, [analysisSessionStartedAt]);

  useEffect(() => {
    analysisEntriesRef.current = analysisEntries;
  }, [analysisEntries]);

  useEffect(() => {
    if (!analysisSessionStartedAt || !analysisEnabled) return;
    const interval = setInterval(() => setAnalysisElapsedNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [analysisEnabled, analysisSessionStartedAt]);

  const activeFocusNoteFolder = useMemo(
    () => focusNoteFolders.find(folder => folder.id === activeFocusNoteFolderId) || focusNoteFolders[0] || null,
    [activeFocusNoteFolderId, focusNoteFolders],
  );
  const focusProfileNotes = activeFocusNoteFolder?.notes || '';
  const focusNotesTotalChars = useMemo(
    () => focusNoteFolders.reduce((total, folder) => total + (folder.notes || '').length, 0),
    [focusNoteFolders],
  );

  useEffect(() => {
    if (!focusNoteFolders.length) {
      const folder = buildFocusNoteFolderPayload({ title: 'General' });
      setFocusNoteFolders([folder]);
      setActiveFocusNoteFolderId(folder.id);
      return;
    }
    if (!activeFocusNoteFolderId || !focusNoteFolders.some(folder => folder.id === activeFocusNoteFolderId)) {
      setActiveFocusNoteFolderId(focusNoteFolders[0].id);
    }
  }, [activeFocusNoteFolderId, focusNoteFolders]);

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
  const bottleneckDataset = useMemo(
    () =>
      bottleneckItems.map(entry => ({
        ...entry.item,
        id: entry.key,
        __focusSourceMode: entry.sourceMode,
        __focusOriginalId: entry.item.id,
      })),
    [bottleneckItems],
  );
  const focusLookup = useMemo(() => new Set(focusedItems.map(entry => entry.key)), [focusedItems]);
  const bottleneckLookup = useMemo(() => new Set(bottleneckItems.map(entry => entry.key)), [bottleneckItems]);
  const getFocusItemKey = useCallback((item: any, sourceMode: string) => {
    const normalizedSourceMode = normalizeFocusSourceModeForItem(sourceMode, item);
    const idPart = item?.__focusOriginalId || item?.id || item?.kana || '';
    return `${normalizedSourceMode}:${idPart}`;
  }, []);
  const getItemSourceMode = useCallback(
    (item: any) => {
      if (item?.__focusSourceMode) return item.__focusSourceMode;
      if (quizMode !== 'focus' && quizMode !== 'bottleneck') return quizMode;
      if (typeof item?.id === 'string') {
        const separatorIndex = item.id.indexOf(':');
        if (separatorIndex > 0) {
          return item.id.slice(0, separatorIndex);
        }
      }
      return bottleneckItems[0]?.sourceMode || focusedItems[0]?.sourceMode || 'hiragana';
    },
    [bottleneckItems, focusedItems, quizMode],
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
  const isBottleneckItem = useCallback(
    (item: any, sourceMode?: string) => {
      const resolvedSourceMode = sourceMode || getItemSourceMode(item);
      return bottleneckLookup.has(getFocusItemKey(item, resolvedSourceMode));
    },
    [bottleneckLookup, getFocusItemKey, getItemSourceMode],
  );
  const getDatasetForMode = useCallback(
    (mode: string) => {
      if (mode === 'focus') return focusDataset;
      if (mode === 'bottleneck') return bottleneckDataset;
      const isKanaMode =
        KANA_VARIANT_OPTIONS.hiragana.includes(mode as any) ||
        KANA_VARIANT_OPTIONS.katakana.includes(mode as any);
      if (engModeEnabled && isKanaMode) {
        return ENGLISH_ALPHABET_QUIZ;
      }
      return getQuizDataset(mode);
    },
    [bottleneckDataset, engModeEnabled, focusDataset],
  );
  const normalizeFocusEntryList = useCallback(
    (items: Array<{ key?: string; sourceMode: string; item: any }>) => {
      const seen = new Set<string>();
      return (Array.isArray(items) ? items : []).reduce<Array<{ key: string; sourceMode: string; item: any }>>((acc, entry) => {
        if (!entry || !entry.item || !entry.sourceMode) return acc;
        const item = normalizeStoredFocusItem({
          id: entry.item.id,
          kana: entry.item.kana,
          answers: entry.item.answers,
          onyomi: entry.item.onyomi,
          kunyomi: entry.item.kunyomi,
        }, entry.sourceMode);
        if (!item?.kana && !item?.id) return acc;
        const sourceMode = normalizeFocusSourceModeForItem(entry.sourceMode, item);
        if (!sourceMode || sourceMode === 'focus' || sourceMode === 'bottleneck') return acc;
        const key = getFocusItemKey(item, sourceMode);
        const logicalKey = `${sourceMode}:${item.kana || item.id}`;
        if (seen.has(key) || seen.has(logicalKey)) return acc;
        seen.add(key);
        seen.add(logicalKey);
        acc.push({ key, sourceMode, item });
        return acc;
      }, []);
    },
    [getFocusItemKey],
  );
  const saveFocusedItems = useCallback(async (itemsOrUpdater: any) => {
    const rawNext = typeof itemsOrUpdater === 'function'
      ? itemsOrUpdater(focusedItemsRef.current)
      : itemsOrUpdater;
    const next = normalizeFocusEntryList(rawNext);
    focusedItemsRef.current = next;
    setFocusedItems(next);
    await AsyncStorage.setItem(QUIZ_FOCUS_STORAGE_KEY, JSON.stringify(next));
    return next;
  }, [normalizeFocusEntryList]);
  const saveBottleneckItems = useCallback(async (itemsOrUpdater: any) => {
    const rawNext = typeof itemsOrUpdater === 'function'
      ? itemsOrUpdater(bottleneckItemsRef.current)
      : itemsOrUpdater;
    const next = normalizeFocusEntryList(rawNext);
    bottleneckItemsRef.current = next;
    setBottleneckItems(next);
    await AsyncStorage.setItem(QUIZ_BOTTLENECK_STORAGE_KEY, JSON.stringify(next));
    return next;
  }, [normalizeFocusEntryList]);
  const toggleFocusedItem = useCallback(
    async (item: any, sourceMode?: string) => {
      try {
        const requestedSourceMode = sourceMode || getItemSourceMode(item);
        const plainItem = normalizeStoredFocusItem({
          id: item.__focusOriginalId || item.id,
          kana: item.kana,
          answers: Array.isArray(item.answers) ? item.answers : [],
          onyomi: Array.isArray(item.onyomi) ? item.onyomi : [],
          kunyomi: Array.isArray(item.kunyomi) ? item.kunyomi : [],
        }, requestedSourceMode);
        const resolvedSourceMode = normalizeFocusSourceModeForItem(requestedSourceMode, plainItem);
        const key = getFocusItemKey(plainItem, resolvedSourceMode);
        const matchesItem = (entry: any) =>
          entry?.key === key ||
          (
            normalizeFocusSourceModeForItem(entry?.sourceMode, entry?.item) === resolvedSourceMode &&
            entry?.item?.kana &&
            plainItem?.kana &&
            entry.item.kana === plainItem.kana
          );
        const existing = focusedItemsRef.current.some(matchesItem);
        const next = existing
          ? focusedItemsRef.current.filter(entry => !matchesItem(entry))
          : [...focusedItemsRef.current, { key, sourceMode: resolvedSourceMode, item: plainItem }];
        await saveFocusedItems(next);
        // Focus leaderboard session is tied to the current focus set; reset it whenever the set changes.
        setSessionLeaderboard(prev => prev.filter(entry => !isFocusModeKey(entry.mode)));
        setLastRecordUpdate(prev => (prev && isFocusModeKey(prev.mode) ? null : prev));
        setLoadedSaveProfileId(null);
      } catch (err) {
        console.error('Failed to toggle Focus item:', err);
      }
    },
    [getFocusItemKey, getItemSourceMode, saveFocusedItems],
  );
  const toggleBottleneckItem = useCallback(
    async (item: any, sourceMode?: string) => {
      try {
        const requestedSourceMode = sourceMode || getItemSourceMode(item);
        const plainItem = normalizeStoredFocusItem({
          id: item.__focusOriginalId || item.id,
          kana: item.kana,
          answers: Array.isArray(item.answers) ? item.answers : [],
          onyomi: Array.isArray(item.onyomi) ? item.onyomi : [],
          kunyomi: Array.isArray(item.kunyomi) ? item.kunyomi : [],
        }, requestedSourceMode);
        const resolvedSourceMode = normalizeFocusSourceModeForItem(requestedSourceMode, plainItem);
        const key = getFocusItemKey(plainItem, resolvedSourceMode);
        const matchesItem = (entry: any) =>
          entry?.key === key ||
          (
            normalizeFocusSourceModeForItem(entry?.sourceMode, entry?.item) === resolvedSourceMode &&
            entry?.item?.kana &&
            plainItem?.kana &&
            entry.item.kana === plainItem.kana
          );
        const existing = bottleneckItemsRef.current.some(matchesItem);
        const next = existing
          ? bottleneckItemsRef.current.filter(entry => !matchesItem(entry))
          : [...bottleneckItemsRef.current, { key, sourceMode: resolvedSourceMode, item: plainItem }];
        await saveBottleneckItems(next);
        setLoadedSaveProfileId(null);
      } catch (err) {
        console.error('Failed to toggle Bottleneck item:', err);
      }
    },
    [getFocusItemKey, getItemSourceMode, saveBottleneckItems],
  );

  const isJlptMode = isJlptQuizMode(quizMode);
  const isFocusMode = quizMode === 'focus';
  const isBottleneckMode = quizMode === 'bottleneck';
  const isFocusFamilyMode = isFocusMode || isBottleneckMode;
  const shouldShowJlptModeControls = (isJlptMode || isFocusFamilyMode) && !engModeEnabled;
  const isJlptJapaneseInputMode = !engModeEnabled && isJlptMode && jlptReadingMode === 'jp_on_kun_kanji';
  const isJlptEnglishMode = isJlptMode && (engModeEnabled || isJlptEnglishTranslateMode(jlptReadingMode));
  const isKanjiStudyMode = isJlptMode || isFocusFamilyMode;
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
    quizRoundFinalizedRef.current = false;
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
        const cleaned = normalizeFocusEntryList(parsed);
        focusedItemsRef.current = cleaned;
        setFocusedItems(cleaned);
        await AsyncStorage.setItem(QUIZ_FOCUS_STORAGE_KEY, JSON.stringify(cleaned));
      } catch (err) {
        console.error('Failed to load focus items:', err);
      }
    };
    void loadFocusedItems();
  }, [normalizeFocusEntryList]);

  useEffect(() => {
    const loadBottleneckItems = async () => {
      try {
        const stored = await AsyncStorage.getItem(QUIZ_BOTTLENECK_STORAGE_KEY);
        if (!stored) return;
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return;
        const cleaned = normalizeFocusEntryList(parsed);
        bottleneckItemsRef.current = cleaned;
        setBottleneckItems(cleaned);
        await AsyncStorage.setItem(QUIZ_BOTTLENECK_STORAGE_KEY, JSON.stringify(cleaned));
      } catch (err) {
        console.error('Failed to load Bottleneck items:', err);
      }
    };
    void loadBottleneckItems();
  }, [normalizeFocusEntryList]);

  useEffect(() => {
    if (!isFocusFamilyMode) return;
    const nextDataset = quizMode === 'bottleneck' ? bottleneckDataset : focusDataset;
    setQuizItems(
      shuffleQuiz(nextDataset).map(entry => ({
        ...entry,
      })),
    );
    setAnswers({});
    setIsRunning(false);
    setHasFinished(false);
    quizRoundFinalizedRef.current = false;
    setFinishReason(null);
    setCompletionTimeMs(null);
    setQuizBackspaceCount(0);
    quizBackspacePenaltyWordIdsRef.current.clear();
    setLastRecordUpdate(null);
    setRemainingSeconds(timerMinutes * 60);
    remainingSecondsRef.current = timerMinutes * 60;
    timerDeadlineMsRef.current = null;
  }, [bottleneckDataset, focusDataset, isFocusFamilyMode, quizMode]);

  useEffect(() => {
    if (!shouldShowJlptModeControls) {
      setIsJlptModeDropdownOpen(false);
      setOpenJlptSetDropdownBase(null);
    }
  }, [shouldShowJlptModeControls]);

  useEffect(() => {
    if (quizFamily !== 'kana') {
      setOpenKanaDropdownBase(null);
    }
  }, [quizFamily]);

  useEffect(() => {
    if (quizView !== 'leaderboard') {
      setIsLeaderboardTimerDropdownOpen(false);
    }
  }, [quizView]);

  useEffect(() => {
    remainingSecondsRef.current = remainingSeconds;
  }, [remainingSeconds]);

  useEffect(() => {
    if (quizMode === 'focus' && leaderboardScope !== 'session') {
      setLeaderboardScope('session');
    }
  }, [leaderboardScope, quizMode]);

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

  const normalizeLeaderboardEntry = useCallback((item: any) => {
    const modeKey = normalizeStoredQuizModeKey(item?.mode || QUIZ_MODES[0].value);
    const normalizedTimerMinutes = normalizeLeaderboardTimerMinutes(item?.timerMinutes);
    const normalizedScoreType = normalizeLeaderboardScoreType(item?.scoreType);
    return {
      ...item,
      mode: modeKey,
      finishReason: item?.finishReason || 'complete',
      timerMinutes: normalizedTimerMinutes,
      scoreType: normalizedScoreType === 'off' ? undefined : normalizedScoreType,
    };
  }, []);

  const limitLeaderboardPerMode = useCallback(
    (items: Array<{ mode: string; timeMs: number; score: number; total: number; date: number; finishReason?: 'complete' | 'time' | 'stopped'; timerMinutes?: number }>) => {
      const seen = new Set<string>();
      return items
        .filter(item => item && typeof item === 'object' && typeof item.mode === 'string')
        .map(item => normalizeLeaderboardEntry(item))
        .filter(item => {
          const key = createLeaderboardEntryIdentity(item);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    },
    [normalizeLeaderboardEntry],
  );

  const persistAllTimeLeaderboard = useCallback(
    async (entries: any[]) => {
      const normalized = limitLeaderboardPerMode(entries).filter(item => !isFocusModeKey(item.mode) && !isBottleneckModeKey(item.mode));
      const serialized = JSON.stringify(normalized);
      setLeaderboard(normalized);
      await Promise.all([
        AsyncStorage.setItem(QUIZ_LEADERBOARD_STORAGE_KEY, serialized),
        AsyncStorage.setItem(QUIZ_LEADERBOARD_BACKUP_STORAGE_KEY, serialized),
        setExtensionStorageItem(QUIZ_LEADERBOARD_STORAGE_KEY, serialized),
        setExtensionStorageItem(QUIZ_LEADERBOARD_BACKUP_STORAGE_KEY, serialized),
      ]);
      return normalized;
    },
    [limitLeaderboardPerMode],
  );

  const readPersistedAllTimeLeaderboard = useCallback(async () => {
    const [stored, extensionStored, backupStored, extensionBackupStored] = await Promise.all([
      AsyncStorage.getItem(QUIZ_LEADERBOARD_STORAGE_KEY),
      getExtensionStorageItem(QUIZ_LEADERBOARD_STORAGE_KEY),
      AsyncStorage.getItem(QUIZ_LEADERBOARD_BACKUP_STORAGE_KEY),
      getExtensionStorageItem(QUIZ_LEADERBOARD_BACKUP_STORAGE_KEY),
    ]);
    return limitLeaderboardPerMode([
      ...parseLeaderboardStoragePayload(stored),
      ...parseLeaderboardStoragePayload(extensionStored),
      ...parseLeaderboardStoragePayload(backupStored),
      ...parseLeaderboardStoragePayload(extensionBackupStored),
    ]).filter(item => !isFocusModeKey(item.mode) && !isBottleneckModeKey(item.mode));
  }, [limitLeaderboardPerMode]);

  const buildLeaderboardIndex = useCallback(
    (entries: Array<{ mode: string; timeMs: number; score: number; total: number; date: number; finishReason?: 'complete' | 'time' | 'stopped'; timerMinutes?: number; scoreType?: string }>) => {
      const allByBucket: Record<string, { time: any[]; score: any[] }> = {};
      const allByModeTimer: Record<string, { time: any[]; score: any[] }> = {};
      const todayByBucket: Record<string, { time: any[]; score: any[] }> = {};
      const todayByModeTimer: Record<string, { time: any[]; score: any[] }> = {};

      entries.forEach(item => {
        const normalizedEntry = normalizeLeaderboardEntry(item);
        const bucketKey = createLeaderboardBucketKey(normalizedEntry.mode, normalizedEntry.timerMinutes, normalizedEntry.scoreType);
        const modeTimerKey = createLeaderboardModeTimerKey(normalizedEntry.mode, normalizedEntry.timerMinutes);
        const isTodayEntry = formatDateKey(new Date(normalizedEntry.date)) === todayKey;

        if (!allByBucket[bucketKey]) allByBucket[bucketKey] = { time: [], score: [] };
        if (!allByModeTimer[modeTimerKey]) allByModeTimer[modeTimerKey] = { time: [], score: [] };
        allByBucket[bucketKey].time.push(normalizedEntry);
        allByBucket[bucketKey].score.push(normalizedEntry);
        allByModeTimer[modeTimerKey].time.push(normalizedEntry);
        allByModeTimer[modeTimerKey].score.push(normalizedEntry);

        if (isTodayEntry) {
          if (!todayByBucket[bucketKey]) todayByBucket[bucketKey] = { time: [], score: [] };
          if (!todayByModeTimer[modeTimerKey]) todayByModeTimer[modeTimerKey] = { time: [], score: [] };
          todayByBucket[bucketKey].time.push(normalizedEntry);
          todayByBucket[bucketKey].score.push(normalizedEntry);
          todayByModeTimer[modeTimerKey].time.push(normalizedEntry);
          todayByModeTimer[modeTimerKey].score.push(normalizedEntry);
        }
      });

      const sortCollections = (collection: Record<string, { time: any[]; score: any[] }>) => {
        Object.values(collection).forEach(bucket => {
          bucket.time.sort(compareLeaderboardEntriesByTime);
          bucket.score.sort(compareLeaderboardEntriesByScore);
        });
        return collection;
      };

      return {
        allByBucket: sortCollections(allByBucket),
        allByModeTimer: sortCollections(allByModeTimer),
        todayByBucket: sortCollections(todayByBucket),
        todayByModeTimer: sortCollections(todayByModeTimer),
      };
    },
    [compareLeaderboardEntriesByScore, compareLeaderboardEntriesByTime, normalizeLeaderboardEntry, todayKey],
  );

  const leaderboardIndex = useMemo(() => buildLeaderboardIndex(leaderboard), [buildLeaderboardIndex, leaderboard]);
  const sessionLeaderboardIndex = useMemo(() => buildLeaderboardIndex(sessionLeaderboard), [buildLeaderboardIndex, sessionLeaderboard]);

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const [persistedEntries, legacySnapshotsRaw] = await Promise.all([
          readPersistedAllTimeLeaderboard(),
          AsyncStorage.getItem(QUIZ_LEADERBOARD_SNAPSHOTS_STORAGE_KEY),
        ]);
        const parseLegacySnapshotEntries = (raw: string | null) => {
          if (!raw) return [];
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed)
            ? parsed.flatMap(snapshot => Array.isArray(snapshot?.leaderboard) ? snapshot.leaderboard : [])
            : [];
        };
        const merged = limitLeaderboardPerMode([
          ...persistedEntries,
          ...parseLegacySnapshotEntries(legacySnapshotsRaw),
        ]).filter(item => !isFocusModeKey(item.mode) && !isBottleneckModeKey(item.mode));

        if (merged.length > 0) {
          await persistAllTimeLeaderboard(merged);
        }
      } catch (err) {
        console.error('Failed to load leaderboard:', err);
      }
    };
    loadLeaderboard();
  }, [limitLeaderboardPerMode, persistAllTimeLeaderboard, readPersistedAllTimeLeaderboard]);

  const normalizeSaveProfiles = useCallback(
    (rawProfiles: any) =>
      normalizeSaveProfilesPayload(rawProfiles, {
        isFocusModeKey,
        limitLeaderboardPerMode,
        normalizeStoredFocusItem,
      }),
    [limitLeaderboardPerMode],
  );

  const persistSaveProfiles = useCallback(async (next: any[]) => {
    setSaveProfiles(next);
    await AsyncStorage.setItem(QUIZ_SAVE_PROFILES_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const resetFocusNoteFolders = useCallback((folders: any[], preferredId?: string) => {
    const nextFolders = Array.isArray(folders) && folders.length > 0
      ? folders
      : [buildFocusNoteFolderPayload({ title: 'General' })];
    const nextActiveId = preferredId && nextFolders.some(folder => folder.id === preferredId)
      ? preferredId
      : nextFolders[0].id;
    setFocusNoteFolders(nextFolders);
    setActiveFocusNoteFolderId(nextActiveId);
  }, []);

  const updateActiveFocusNoteText = useCallback((notes: string) => {
    const targetId = activeFocusNoteFolder?.id || focusNoteFolders[0]?.id;
    setFocusNoteFolders(prev => {
      if (!targetId) {
        return [buildFocusNoteFolderPayload({ title: 'General', notes })];
      }
      return prev.map(folder =>
        folder.id === targetId
          ? { ...folder, notes, updatedAt: Date.now() }
          : folder,
      );
    });
  }, [activeFocusNoteFolder?.id, focusNoteFolders]);

  const updateActiveFocusNoteFolderTitle = useCallback((title: string) => {
    const targetId = activeFocusNoteFolder?.id || focusNoteFolders[0]?.id;
    setFocusNoteFolders(prev =>
      prev.map(folder =>
        folder.id === targetId
          ? { ...folder, title: title.slice(0, 80), updatedAt: Date.now() }
          : folder,
      ),
    );
  }, [activeFocusNoteFolder?.id, focusNoteFolders]);

  const addFocusNoteFolder = useCallback(() => {
    const folder = buildFocusNoteFolderPayload({ title: `Folder ${focusNoteFolders.length + 1}` });
    setFocusNoteFolders(prev => [...prev, folder].slice(0, 60));
    setActiveFocusNoteFolderId(folder.id);
  }, [focusNoteFolders.length]);

  const deleteActiveFocusNoteFolder = useCallback(() => {
    const targetId = activeFocusNoteFolder?.id;
    if (!targetId) return;
    if (focusNoteFolders.length <= 1) {
      const folder = buildFocusNoteFolderPayload({ title: 'General' });
      resetFocusNoteFolders([folder], folder.id);
      return;
    }

    const nextFolders = focusNoteFolders.filter(folder => folder.id !== targetId);
    resetFocusNoteFolders(nextFolders, nextFolders[0]?.id);
  }, [activeFocusNoteFolder?.id, focusNoteFolders, resetFocusNoteFolders]);

  useEffect(() => {
    const loadSaveProfiles = async () => {
      try {
        const [profilesRaw, legacyLeaderboardRaw, legacyFocusRaw] = await Promise.all([
          AsyncStorage.getItem(QUIZ_SAVE_PROFILES_STORAGE_KEY),
          AsyncStorage.getItem(QUIZ_LEADERBOARD_SNAPSHOTS_STORAGE_KEY),
          AsyncStorage.getItem(QUIZ_FOCUS_SNAPSHOTS_STORAGE_KEY),
        ]);

        if (profilesRaw) {
          const parsed = JSON.parse(profilesRaw);
          const normalized = normalizeSaveProfiles(parsed);
          setSaveProfiles(normalized);
          const normalizedSerialized = JSON.stringify(normalized);
          if (normalizedSerialized !== profilesRaw) {
            await AsyncStorage.setItem(QUIZ_SAVE_PROFILES_STORAGE_KEY, normalizedSerialized);
          }
          return;
        }

        const migrated = extractSaveProfilesFromImport(
          {
            leaderboardSnapshots: legacyLeaderboardRaw ? JSON.parse(legacyLeaderboardRaw) : [],
            focusSnapshots: legacyFocusRaw ? JSON.parse(legacyFocusRaw) : [],
          },
          {
            isFocusModeKey,
            limitLeaderboardPerMode,
            normalizeStoredFocusItem,
          },
        );

        setSaveProfiles(migrated);
        if (migrated.length > 0) {
          await AsyncStorage.setItem(QUIZ_SAVE_PROFILES_STORAGE_KEY, JSON.stringify(migrated));
        }
      } catch (err) {
        console.error('Failed to load save profiles:', err);
      }
    };
    void loadSaveProfiles();
  }, [limitLeaderboardPerMode, normalizeSaveProfiles]);

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
        version: 2,
        type: LEADERBOARD_EXPORT_TYPE,
        exportedAt: new Date().toISOString(),
        storageKey: QUIZ_LEADERBOARD_STORAGE_KEY,
        leaderboard: limitLeaderboardPerMode(leaderboard).filter(entry => !isFocusModeKey(entry.mode) && !isBottleneckModeKey(entry.mode)),
        sessionLeaderboard: limitLeaderboardPerMode(sessionLeaderboard).filter(entry => !isFocusModeKey(entry.mode) && !isBottleneckModeKey(entry.mode)),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const stamp = formatDateKey(new Date()).replace(/-/g, '');
      anchor.href = url;
      anchor.download = `tensai-leaderboard-${stamp}${LEADERBOARD_FILE_EXTENSION}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export leaderboard:', err);
      Alert.alert('Export failed', 'Could not export leaderboard data.');
    }
  }, [leaderboard, limitLeaderboardPerMode, sessionLeaderboard]);

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
      input.accept = `application/json,.json,${LEADERBOARD_FILE_EXTENSION}`;
      input.style.display = 'none';

      input.onchange = async () => {
        try {
          const file = input.files?.[0];
          if (!file) return;
          const text = await file.text();
          const parsed = JSON.parse(text);
          const entryLike = (entry: any) => entry && typeof entry === 'object' && typeof entry.mode === 'string';
          const profileLike = (entry: any) => entry && typeof entry === 'object' && (Array.isArray(entry.focusItems) || Array.isArray(entry.leaderboard) || Array.isArray(entry.sessionLeaderboard));
          const extractFromProfiles = (profiles: any[]) => profiles.flatMap(profile => Array.isArray(profile?.leaderboard) ? profile.leaderboard : []);
          const extractSessionFromProfiles = (profiles: any[]) => profiles.flatMap(profile => Array.isArray(profile?.sessionLeaderboard) ? profile.sessionLeaderboard : []);
          const rawLeaderboard = Array.isArray(parsed)
            ? parsed.some(entryLike)
              ? parsed
              : extractFromProfiles(parsed.filter(profileLike))
            : Array.isArray(parsed?.leaderboard)
              ? parsed.leaderboard
              : Array.isArray(parsed?.profiles)
                ? extractFromProfiles(parsed.profiles)
                : Array.isArray(parsed?.leaderboardSnapshots)
                  ? parsed.leaderboardSnapshots.flatMap((snapshot: any) => Array.isArray(snapshot?.leaderboard) ? snapshot.leaderboard : [])
                  : [];
          const rawSessionLeaderboard = Array.isArray(parsed?.sessionLeaderboard)
            ? parsed.sessionLeaderboard
            : Array.isArray(parsed?.profiles)
              ? extractSessionFromProfiles(parsed.profiles)
              : Array.isArray(parsed?.leaderboardSnapshots)
                ? parsed.leaderboardSnapshots.flatMap((snapshot: any) => Array.isArray(snapshot?.sessionLeaderboard) ? snapshot.sessionLeaderboard : [])
                : [];

          const normalizedLeaderboard = limitLeaderboardPerMode(rawLeaderboard)
            .filter(entry => !isFocusModeKey(entry.mode) && !isBottleneckModeKey(entry.mode));
          const normalizedSession = limitLeaderboardPerMode(rawSessionLeaderboard)
            .filter(entry => !isFocusModeKey(entry.mode) && !isBottleneckModeKey(entry.mode));

          if (normalizedLeaderboard.length === 0 && normalizedSession.length === 0) {
            Alert.alert('Import failed', 'The selected file does not contain any leaderboard entries.');
            return;
          }

          await persistAllTimeLeaderboard(normalizedLeaderboard);
          setSessionLeaderboard(prev => [
            ...prev.filter(entry => isFocusModeKey(entry.mode)),
            ...normalizedSession,
          ]);
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
  }, [limitLeaderboardPerMode, persistAllTimeLeaderboard]);

  const saveLeaderboardEntry = useCallback(async (entry: { mode: string; timeMs: number; score: number; total: number; date: number; finishReason: 'complete' | 'time' | 'stopped'; timerMinutes?: number; scoreType?: string }) => {
    try {
      if (isBottleneckModeKey(entry.mode)) {
        return null;
      }
      const isFocusEntry = isFocusModeKey(entry.mode);
      const normalizedEntry = {
        ...entry,
        timerMinutes: normalizeLeaderboardTimerMinutes(entry.timerMinutes),
      };
      const todayKey = formatDateKey(new Date());
      const currentSessionEntries = Array.isArray(sessionLeaderboard) ? sessionLeaderboard : [];
      let nextSessionLeaderboard: any[] = currentSessionEntries;
      if (isFocusEntry) {
        const nonFocusEntries = currentSessionEntries.filter(item => !isFocusModeKey(item.mode) && !isBottleneckModeKey(item.mode));
        const focusEntries = currentSessionEntries.filter(item => isFocusModeKey(item.mode));
        const nextFocusEntries = limitLeaderboardPerMode([...focusEntries, normalizedEntry]).filter(item => isFocusModeKey(item.mode));
        nextSessionLeaderboard = [...nonFocusEntries, ...nextFocusEntries];
      } else {
        const focusEntries = currentSessionEntries.filter(item => isFocusModeKey(item.mode));
        const nonFocusEntries = currentSessionEntries.filter(item => !isFocusModeKey(item.mode) && !isBottleneckModeKey(item.mode));
        const sessionToday = nonFocusEntries.filter(item => formatDateKey(new Date(item.date)) === todayKey);
        const normalizedSessionEntries = limitLeaderboardPerMode([...sessionToday, normalizedEntry]).filter(item => !isFocusModeKey(item.mode) && !isBottleneckModeKey(item.mode));
        const nextSession = normalizedSessionEntries.filter(item => formatDateKey(new Date(item.date)) === todayKey);
        nextSessionLeaderboard = [...focusEntries, ...nextSession];
      }
      setSessionLeaderboard(nextSessionLeaderboard);

      // Focus mode participates only in Current Session leaderboard (no persisted all-time storage).
      if (isFocusEntry) {
        return null;
      }

      const persistedEntries = await readPersistedAllTimeLeaderboard();
      const currentEntries = limitLeaderboardPerMode([
        ...persistedEntries,
        ...(Array.isArray(leaderboard) ? leaderboard : []),
      ]).filter(item => !isFocusModeKey(item.mode) && !isBottleneckModeKey(item.mode));
      const normalizedScoreType = normalizeLeaderboardScoreType(normalizedEntry.scoreType);
      const currentModeEntries = currentEntries
        .filter(item => normalizeStoredQuizModeKey(item?.mode) === normalizedEntry.mode)
        .filter(item => normalizeLeaderboardTimerMinutes(item?.timerMinutes) === normalizedEntry.timerMinutes)
        .filter(item => normalizeLeaderboardScoreType(item?.scoreType) === normalizedScoreType)
        .map(item => ({ ...item, finishReason: item.finishReason || 'complete', timerMinutes: normalizeLeaderboardTimerMinutes(item?.timerMinutes), scoreType: normalizeLeaderboardScoreType(item?.scoreType) === 'off' ? undefined : normalizeLeaderboardScoreType(item?.scoreType) }))
        .sort(compareLeaderboardEntriesByTime);
      const previousTop = currentModeEntries.length ? currentModeEntries[0] : null;
      const updated = [...currentEntries, normalizedEntry];
      const nextLeaderboard = await persistAllTimeLeaderboard(updated);
      const updatedModeEntries = nextLeaderboard
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
  }, [compareLeaderboardEntriesByTime, leaderboard, limitLeaderboardPerMode, persistAllTimeLeaderboard, readPersistedAllTimeLeaderboard, sessionLeaderboard]);

  const buildCurrentSaveProfile = useCallback(
    (overrides?: Partial<{ id: string; name: string; createdAt: number }>) =>
      buildSaveProfilePayload({
        id: overrides?.id,
        name: overrides?.name ?? saveProfileName.trim(),
        createdAt: overrides?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        focusItems: focusedItems.map(item => ({
          key: item.key,
          sourceMode: item.sourceMode,
          item: item.item,
        })),
        bottleneckItems: bottleneckItems.map(item => ({
          key: item.key,
          sourceMode: item.sourceMode,
          item: item.item,
        })),
        focusLeaderboard: limitLeaderboardPerMode(
          sessionLeaderboard.filter(entry => isFocusModeKey(entry.mode)),
        ),
        leaderboard: [],
        sessionLeaderboard: [],
        notes: focusProfileNotes,
        noteFolders: focusNoteFolders,
      }),
    [bottleneckItems, focusNoteFolders, focusProfileNotes, focusedItems, limitLeaderboardPerMode, saveProfileName, sessionLeaderboard],
  );

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

  const exportSaveProfilesData = useCallback(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      Alert.alert('Unavailable', 'Focus profile export is only available in the web/extension view.');
      return;
    }
    try {
      const payload = buildSaveProfilesExportPayload(saveProfiles);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const stamp = formatDateKey(new Date()).replace(/-/g, '');
      anchor.href = url;
      anchor.download = `tensai-focus-profiles-${stamp}${SAVE_PROFILES_FILE_EXTENSION}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export focus profiles:', err);
      Alert.alert('Export failed', 'Could not export Focus profiles.');
    }
  }, [saveProfiles]);

  const importSaveProfilesData = useCallback(async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      Alert.alert('Unavailable', 'Focus profile import is only available in the web/extension view.');
      return;
    }

    try {
      const shouldReplace = window.confirm('Importing Focus profiles will replace all saved Focus and Bottleneck profile data. Continue?');
      if (!shouldReplace) return;

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = `application/json,.json,${SAVE_PROFILES_FILE_EXTENSION}`;
      input.style.display = 'none';

      input.onchange = async () => {
        try {
          const file = input.files?.[0];
          if (!file) return;
          const text = await file.text();
          const parsed = JSON.parse(text);
          const importedProfiles = extractSaveProfilesFromImport(parsed, {
            isFocusModeKey,
            limitLeaderboardPerMode,
            normalizeStoredFocusItem,
          });

          if (importedProfiles.length === 0) {
            Alert.alert('Import failed', 'The selected file does not contain any Focus profiles.');
            return;
          }

          const focusOnlyProfiles = importedProfiles.map(profile => buildSaveProfilePayload({
            id: profile.id,
            name: profile.name,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
            focusItems: profile.focusItems,
            bottleneckItems: profile.bottleneckItems,
            focusLeaderboard: profile.focusLeaderboard,
            leaderboard: [],
            sessionLeaderboard: [],
            notes: profile.notes,
            noteFolders: profile.noteFolders,
          }));

          await persistSaveProfiles(focusOnlyProfiles);
          setLoadedSaveProfileId(null);
          resetFocusNoteFolders([], undefined);

          Alert.alert('Import complete', `Loaded ${focusOnlyProfiles.length} Focus profiles.`);
        } catch (err) {
          console.error('Failed to import focus profiles:', err);
          Alert.alert('Import failed', 'The selected file is not a valid Focus profile export.');
        } finally {
          if (input.parentNode) {
            input.parentNode.removeChild(input);
          }
        }
      };

      document.body.appendChild(input);
      input.click();
    } catch (err) {
      console.error('Failed to open focus profile import picker:', err);
      Alert.alert('Import failed', 'Could not open file picker.');
    }
  }, [limitLeaderboardPerMode, persistSaveProfiles, resetFocusNoteFolders]);

  const createSaveProfile = useCallback(async () => {
    const name = saveProfileName.trim();
    if (!name) {
      Alert.alert('Name required', 'Enter a name for the Focus profile.');
      return;
    }
    const profile = buildCurrentSaveProfile({ name });
    const next = [profile, ...saveProfiles].slice(0, 200);
    try {
      await persistSaveProfiles(next);
      setLoadedSaveProfileId(profile.id);
      setSaveProfileName('');
    } catch (err) {
      console.error('Failed to save Focus profile:', err);
      Alert.alert('Save failed', 'Could not save the Focus profile.');
    }
  }, [buildCurrentSaveProfile, persistSaveProfiles, saveProfileName, saveProfiles]);

  const updateSaveProfile = useCallback(async (profileId: string) => {
    const targetProfile = saveProfiles.find(item => item.id === profileId);
    if (!targetProfile) {
      Alert.alert('Update failed', 'That Focus profile no longer exists.');
      return;
    }

    const confirmed = await confirmAction(
      'Update Focus Profile',
      `Overwrite "${targetProfile.name}" with the current Focus entries, Bottleneck entries, and Focus leaderboard times?`,
    );
    if (!confirmed) return;

    const nextProfiles = saveProfiles.map(profile =>
      profile.id === profileId
        ? buildCurrentSaveProfile({
            id: profile.id,
            name: profile.name,
            createdAt: profile.createdAt,
          })
        : profile,
    );

    try {
      await persistSaveProfiles(nextProfiles);
      setLoadedSaveProfileId(profileId);
    } catch (err) {
      console.error('Failed to update Focus profile:', err);
      Alert.alert('Update failed', 'Could not update the Focus profile.');
    }
  }, [buildCurrentSaveProfile, confirmAction, persistSaveProfiles, saveProfiles]);

  const loadSaveProfile = useCallback(async (profile: {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    focusItems: any[];
    bottleneckItems: any[];
    focusLeaderboard: any[];
    leaderboard: any[];
    sessionLeaderboard: any[];
    notes: string;
    noteFolders: any[];
  }) => {
    try {
      const cleanedProfile = normalizeSaveProfiles([profile])[0];
      if (!cleanedProfile) {
        Alert.alert('Load failed', 'The selected Focus profile is invalid.');
        return;
      }

      const cleaned = await saveFocusedItems(cleanedProfile.focusItems);
      const cleanedBottleneck = await saveBottleneckItems(cleanedProfile.bottleneckItems || []);

      const restoredFocusLeaderboard = limitLeaderboardPerMode(
        cleanedProfile.focusLeaderboard.filter(entry => isFocusModeKey(entry?.mode || '')),
      );

      setSessionLeaderboard(prev => [
        ...prev.filter(entry => !isFocusModeKey(entry.mode) && !isBottleneckModeKey(entry.mode)),
        ...restoredFocusLeaderboard,
      ]);
      setLoadedSaveProfileId(cleanedProfile.id);
      resetFocusNoteFolders(cleanedProfile.noteFolders || [], cleanedProfile.noteFolders?.[0]?.id);
      setIsLeaderboardEditMode(false);

      if (quizMode === 'focus' || quizMode === 'bottleneck') {
        const nextEntries = quizMode === 'bottleneck' ? cleanedBottleneck : cleaned;
        setQuizItems(
          shuffleQuiz(
            nextEntries.map(entry => ({
              ...entry.item,
              id: entry.key,
              __focusSourceMode: entry.sourceMode,
              __focusOriginalId: entry.item.id,
            })),
          ),
        );
        setAnswers({});
        setHasFinished(false);
        quizRoundFinalizedRef.current = false;
        setFinishReason(null);
        setCompletionTimeMs(null);
        setQuizBackspaceCount(0);
        quizBackspacePenaltyWordIdsRef.current.clear();
      }
      setIsSaveManagerOpen(false);
    } catch (err) {
      console.error('Failed to load Focus profile:', err);
      Alert.alert('Load failed', 'Could not load the Focus profile.');
    }
  }, [limitLeaderboardPerMode, normalizeSaveProfiles, quizMode, resetFocusNoteFolders, saveBottleneckItems, saveFocusedItems]);

  const deleteSaveProfile = useCallback(async (profileId: string) => {
    try {
      await persistSaveProfiles(saveProfiles.filter(item => item.id !== profileId));
      if (loadedSaveProfileId === profileId) {
        setLoadedSaveProfileId(null);
        resetFocusNoteFolders([], undefined);
      }
    } catch (err) {
      console.error('Failed to delete Focus profile:', err);
      Alert.alert('Delete failed', 'Could not delete the Focus profile.');
    }
  }, [loadedSaveProfileId, persistSaveProfiles, resetFocusNoteFolders, saveProfiles]);

  const saveFocusNotesToLoadedProfile = useCallback(async () => {
    if (!loadedSaveProfileId) {
      Alert.alert('No Focus profile loaded', 'Create or load a Focus profile before saving notes.');
      return;
    }

    const nextProfiles = saveProfiles.map(profile =>
      profile.id === loadedSaveProfileId
        ? buildSaveProfilePayload({
            ...profile,
            updatedAt: Date.now(),
            notes: focusProfileNotes,
            noteFolders: focusNoteFolders,
          })
        : profile,
    );

    try {
      await persistSaveProfiles(nextProfiles);
    } catch (err) {
      console.error('Failed to save Focus profile notes:', err);
      Alert.alert('Save failed', 'Could not save notes to the loaded Focus profile.');
    }
  }, [focusNoteFolders, focusProfileNotes, loadedSaveProfileId, persistSaveProfiles, saveProfiles]);

  const getEntryIdentity = useCallback(
    (entry: { mode: string; timeMs: number; score: number; total: number; date: number; finishReason?: 'complete' | 'time' | 'stopped'; timerMinutes?: number; typemasterQueueMode?: string; scoreType?: string }) =>
      createLeaderboardEntryIdentity(entry),
    [],
  );

  const deleteLeaderboardEntry = useCallback(
    async (target: { mode: string; timeMs: number; score: number; total: number; date: number; finishReason?: 'complete' | 'time' | 'stopped' }) => {
      const targetKey = getEntryIdentity(target);
      try {
        const nextLeaderboard = leaderboard.filter(entry => getEntryIdentity(entry) !== targetKey);
        await persistAllTimeLeaderboard(nextLeaderboard);
        setSessionLeaderboard(prev => prev.filter(entry => getEntryIdentity(entry) !== targetKey));
      } catch (err) {
        console.error('Failed to delete leaderboard entry:', err);
      }
    },
    [getEntryIdentity, leaderboard, persistAllTimeLeaderboard],
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

  const persistCurrentAnalysisState = useCallback((overrides: Partial<{ enabled: boolean; sessionStartedAt: number | null; entries: any[] }> = {}) => {
    persistAnalysisPayload({
      enabled: overrides.enabled ?? analysisEnabled,
      sessionStartedAt: overrides.sessionStartedAt ?? analysisSessionStartedAtRef.current,
      entries: overrides.entries ?? analysisEntriesRef.current,
    });
  }, [analysisEnabled, persistAnalysisPayload]);

  const startAnalysisSessionIfNeeded = useCallback(() => {
    if (!analysisEnabled) return null;
    if (analysisSessionStartedAtRef.current) return analysisSessionStartedAtRef.current;
    const startedAt = Date.now();
    analysisSessionStartedAtRef.current = startedAt;
    setAnalysisSessionStartedAt(startedAt);
    setAnalysisElapsedNow(startedAt);
    persistCurrentAnalysisState({ sessionStartedAt: startedAt });
    return startedAt;
  }, [analysisEnabled, persistCurrentAnalysisState]);

  const setAnalysisEnabledAndPersist = useCallback((enabled: boolean) => {
    setAnalysisEnabled(enabled);
    persistCurrentAnalysisState({ enabled });
  }, [persistCurrentAnalysisState]);

  const resetAnalysisSession = useCallback(() => {
    const confirmed = Platform.OS === 'web'
      ? (typeof window !== 'undefined' ? window.confirm('Clear the current analysis session?') : false)
      : true;
    if (!confirmed) return;
    analysisSessionStartedAtRef.current = null;
    analysisEntriesRef.current = [];
    setAnalysisSessionStartedAt(null);
    setAnalysisEntries([]);
    setActiveAnalysisGraphKey('');
    setAnalysisElapsedNow(Date.now());
    persistCurrentAnalysisState({ sessionStartedAt: null, entries: [] });
  }, [persistCurrentAnalysisState]);

  const buildAnalysisLabels = useCallback((gameType: string, modeKey: string, bottleneckSnapshot?: { itemCount: number; signature: string }, queueMode?: string, scoreType?: string) => {
    const isBottleneck = isBottleneckModeKey(modeKey);
    const normalizedMode = normalizeStoredQuizModeKey(modeKey);
    const gameLabel = gameType === 'typemaster'
      ? 'TypeMaster'
      : gameType === 'endless'
        ? 'Endless'
        : 'Quiz';
    const modeLabel = gameType === 'typemaster'
      ? getLeaderboardModeDisplayLabel({ mode: normalizedMode, typemasterQueueMode: queueMode })
      : getQuizModeLabel(normalizedMode);
    const scoreKey = scoreType || 'score';
    const bottleneckKey = isBottleneck ? `:${bottleneckSnapshot?.signature || 'empty'}` : '';
    const queueKey = gameType === 'typemaster' ? `:${queueMode || DEFAULT_TYPEMASTER_QUEUE_MODE}` : '';
    const graphKey = `analysis:${gameType}:${normalizedMode}:${scoreKey}${queueKey}${bottleneckKey}`;
    const graphLabel = isBottleneck
      ? `${gameLabel} - Bottleneck (${bottleneckSnapshot?.itemCount || 0} items, ${bottleneckSnapshot?.signature || 'empty'})`
      : modeLabel;
    return {
      graphKey,
      graphLabel,
      displayLabel: isBottleneck ? graphLabel : modeLabel,
    };
  }, []);

  const recordAnalysisRound = useCallback((round: {
    gameType: 'quiz' | 'endless' | 'typemaster';
    mode: string;
    score: number;
    total: number;
    timeMs: number;
    date: number;
    finishReason: 'complete' | 'time' | 'stopped';
    timerMinutes?: number;
    scoreType?: string;
    scoreLabel?: string;
    typemasterQueueMode?: string;
    items?: any[];
  }) => {
    if (!analysisEnabled) return;
    const startedAt = analysisSessionStartedAtRef.current;
    if (!startedAt) return;
    const bottleneckSnapshot = isBottleneckModeKey(round.mode)
      ? createAnalysisBottleneckSnapshot(round.items || getDatasetForMode(quizMode))
      : null;
    const labels = buildAnalysisLabels(round.gameType, round.mode, bottleneckSnapshot || undefined, round.typemasterQueueMode, round.scoreType);
    const entry = {
      id: `analysis-${round.date}-${round.gameType}-${createStableHash(`${round.mode}:${round.score}:${round.timeMs}:${analysisEntriesRef.current.length}`)}`,
      sessionStartedAt: startedAt,
      sessionElapsedMs: Math.max(0, round.date - startedAt),
      gameType: round.gameType,
      mode: normalizeStoredQuizModeKey(round.mode),
      graphKey: labels.graphKey,
      graphLabel: labels.graphLabel,
      displayLabel: labels.displayLabel,
      score: Math.round(Number(round.score) || 0),
      total: Math.round(Number(round.total) || 0),
      timeMs: Math.max(0, Number(round.timeMs) || 0),
      date: round.date,
      finishReason: round.finishReason,
      timerMinutes: normalizeLeaderboardTimerMinutes(round.timerMinutes),
      scoreType: round.scoreType,
      scoreLabel: round.scoreLabel || 'Score',
      typemasterQueueMode: round.typemasterQueueMode,
      bottleneckSignature: bottleneckSnapshot?.signature,
      bottleneckItemCount: bottleneckSnapshot?.itemCount || 0,
    };
    setAnalysisEntries(prev => {
      const next = [...prev, entry].sort((a, b) => a.date - b.date);
      analysisEntriesRef.current = next;
      persistCurrentAnalysisState({ entries: next });
      return next;
    });
    setActiveAnalysisGraphKey(prev => prev || entry.graphKey);
  }, [analysisEnabled, buildAnalysisLabels, getDatasetForMode, persistCurrentAnalysisState, quizMode]);

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
      if (hasFinished || quizRoundFinalizedRef.current) return;
      quizRoundFinalizedRef.current = true;
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
      const analysisScore = leaderboardScoresEnabled ? finalGamepoints : finalCorrectCharCount;
      const analysisTotal = leaderboardScoresEnabled
        ? (isStudyScoreMode ? STUDY_SCORE_MAX : SPEEDRUN_SCORE_MAX)
        : totalCharCount;

      setCompletionTimeMs(elapsedMs);
      setIsQuizScoreHidden(false);
      setRemainingSeconds(remainingSecondsAtFinish);
      remainingSecondsRef.current = remainingSecondsAtFinish;
      setHasFinished(true);
      setIsRunning(false);
      setIsQuizPaused(false);
      setFinishReason(reason);
      timerDeadlineMsRef.current = null;

      recordAnalysisRound({
        gameType: 'quiz',
        mode: activeModeKey,
        score: analysisScore,
        total: analysisTotal,
        date: now,
        timeMs: elapsedMs,
        finishReason: reason,
        timerMinutes,
        scoreType: leaderboardScoresEnabled ? (isStudyScoreMode ? 'study_points' : 'speedrun_points') : undefined,
        scoreLabel: activeQuizLeaderboardLabel,
        items: quizItems,
      });

      if (isBottleneckMode) {
        return;
      }

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
    [activeModeKey, activeQuizLeaderboardLabel, activeQuizLeaderboardScoreType, answers, calculateCorrectAnswers, calculateCorrectCharacterCount, calculateSpeedrunQuizGamepoints, calculateStudyQuizGamepoints, hasFinished, isBottleneckMode, isStudyScoreMode, leaderboardScoresEnabled, quizBackspaceCount, quizItems, recordAnalysisRound, saveLeaderboardEntry, timerMinutes],
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
      Alert.alert(
        quizMode === 'bottleneck' ? 'Bottleneck list is empty' : 'Focus list is empty',
        quizMode === 'bottleneck'
          ? 'Add items to Bottleneck by clicking and holding a prompt in Quiz or TypeMaster.'
          : 'Add items to Focus by clicking a prompt in Quiz or TypeMaster.',
      );
      return;
    }
    setQuizItems(shuffleQuiz(dataset));
    setAnswers({});
    setHasFinished(false);
    quizRoundFinalizedRef.current = false;
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
    quizRoundFinalizedRef.current = false;
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
    if (hasFinished || quizRoundFinalizedRef.current || (!isRunning && !isQuizPaused)) return;
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
      Alert.alert(
        quizMode === 'bottleneck' ? 'Bottleneck list is empty' : 'Focus list is empty',
        quizMode === 'bottleneck'
          ? 'Add items to Bottleneck by clicking and holding a prompt in Quiz or TypeMaster.'
          : 'Add items to Focus by clicking a prompt in Quiz or TypeMaster.',
      );
      return;
    }
    startAnalysisSessionIfNeeded();
    endlessQueueRef.current = new CharacterQueue(dataset);

    // Initialize with 3 characters spread across the screen
    const initialChars = endlessQueueRef.current.getNext(3);
    const startStamp = Date.now();
    const initialVisibleChars = initialChars.map((item, index) => ({
      id: `${item.id}-${startStamp}-${index}`,
      item,
      position: 100 + (index * 40), // Start off-screen to the right, spaced out
    }));
    commitEndlessVisibleChars(initialVisibleChars);
    setEndlessVisibleChars(initialVisibleChars);

    setEndlessRuntime({ isRunning: true, isPaused: false, hasFinished: false, score: 0 });
    endlessStopQueuedRef.current = false;
    setEndlessScore(0);
    setEndlessCurrentInput('');
    setEndlessIsRunning(true);
    setIsEndlessPaused(false);
    setEndlessHasFinished(false);
    endlessRoundFinalizedRef.current = false;
    setRemainingSeconds(timerMinutes * 60);
    remainingSecondsRef.current = timerMinutes * 60;
    timerDeadlineMsRef.current = Date.now() + timerMinutes * 60 * 1000;

    // Focus input field
    setTimeout(() => {
      if (endlessInputRef.current && typeof endlessInputRef.current.focus === 'function') {
        endlessInputRef.current.focus();
      }
    }, 100);
  }, [commitEndlessVisibleChars, getDatasetForMode, quizMode, setEndlessRuntime, startAnalysisSessionIfNeeded, timerMinutes]);

  const resetEndlessToSetup = useCallback(() => {
    if (endlessAnimationRef.current) {
      cancelAnimationFrame(endlessAnimationRef.current);
      endlessAnimationRef.current = null;
    }
    setEndlessIsRunning(false);
    setIsEndlessPaused(false);
    setEndlessHasFinished(false);
    endlessRoundFinalizedRef.current = false;
    setEndlessRuntime({ isRunning: false, isPaused: false, hasFinished: false, score: 0 });
    endlessStopQueuedRef.current = false;
    setEndlessScore(0);
    setEndlessCurrentInput('');
    commitEndlessVisibleChars([]);
    setEndlessVisibleChars([]);
    setRemainingSeconds(timerMinutes * 60);
    remainingSecondsRef.current = timerMinutes * 60;
    timerDeadlineMsRef.current = null;
  }, [commitEndlessVisibleChars, setEndlessRuntime, timerMinutes]);

  const pauseEndlessMode = useCallback(() => {
    const runtime = endlessRuntimeRef.current;
    if (!runtime.isRunning || runtime.hasFinished) return;
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
    setEndlessRuntime({ isRunning: false, isPaused: true });
    setEndlessIsRunning(false);
    setIsEndlessPaused(true);
    timerDeadlineMsRef.current = null;
  }, [setEndlessRuntime]);

  const resumeEndlessMode = useCallback(() => {
    const runtime = endlessRuntimeRef.current;
    if (!runtime.isPaused || runtime.hasFinished) return;
    const startSeconds = remainingSecondsRef.current > 0 ? remainingSecondsRef.current : timerMinutes * 60;
    timerDeadlineMsRef.current = Date.now() + startSeconds * 1000;
    setEndlessRuntime({ isRunning: true, isPaused: false });
    endlessStopQueuedRef.current = false;
    setEndlessIsRunning(true);
    setIsEndlessPaused(false);
    setTimeout(() => {
      if (endlessInputRef.current && typeof endlessInputRef.current.focus === 'function') {
        endlessInputRef.current.focus();
      }
    }, 0);
  }, [setEndlessRuntime, timerMinutes]);

  const stopEndlessMode = useCallback((reason: 'time' | 'stopped' = 'stopped') => {
    const runtime = endlessRuntimeRef.current;
    if (runtime.hasFinished || endlessRoundFinalizedRef.current || (!runtime.isRunning && !runtime.isPaused)) return;
    endlessRoundFinalizedRef.current = true;
    setEndlessRuntime({ isRunning: false, isPaused: false, hasFinished: true });
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
    const remainingSecondsAtFinish = reason === 'time' ? 0 : Math.ceil(remainingMs / 1000);
    setRemainingSeconds(remainingSecondsAtFinish);
    remainingSecondsRef.current = remainingSecondsAtFinish;
    timerDeadlineMsRef.current = null;
    const now = Date.now();
    recordAnalysisRound({
      gameType: 'endless',
      mode: endlessModeKey,
      score: runtime.score,
      total: runtime.score,
      date: now,
      timeMs: completionTimeMs,
      finishReason: reason,
      timerMinutes,
      scoreLabel: 'Characters',
      items: getDatasetForMode(quizMode),
    });
    void saveLeaderboardEntry({
      mode: endlessModeKey,
      timeMs: completionTimeMs,
      score: runtime.score,
      total: runtime.score,
      date: now,
      finishReason: reason,
      timerMinutes,
    });
  }, [activeModeKey, getDatasetForMode, quizMode, recordAnalysisRound, saveLeaderboardEntry, setEndlessRuntime, timerMinutes]);

  const handleEndlessInput = useCallback(
    (text: string) => {
      if (!endlessRuntimeRef.current.isRunning) return;

      setEndlessCurrentInput(text);

      // Check answer and update state in a single operation
      setEndlessVisibleChars(prev => {
        if (prev.length === 0) return prev;
        const current = getEndlessCharsWithCurrentPositions(prev);

        // Get the leftmost character (the one the user should type)
        const targetChar = current[0];
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
          const nextScore = endlessRuntimeRef.current.score + 1;
          setEndlessRuntime({ score: nextScore });
          setEndlessScore(nextScore);

          // Get new character from queue
          let newChar = null;
          if (endlessQueueRef.current) {
            const newChars = endlessQueueRef.current.getNext(1);
            if (newChars.length > 0) {
              // Find the rightmost character's position
              const updated = current.slice(1);
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
          const updated = current.slice(1);
          endlessStopQueuedRef.current = false;
          return commitEndlessVisibleChars(newChar ? [...updated, newChar] : updated);
        }

        return prev; // No change if answer is incorrect
      });
    },
    [
      commitEndlessVisibleChars,
      getEndlessCharsWithCurrentPositions,
      getAcceptedAnswersForItem,
      setEndlessRuntime,
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

    let lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const animate = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const deltaTime = Math.min((now - lastTime) / 1000, 0.05); // clamp tab-switch and GC stalls
      lastTime = now;

      // Move characters directly on the host nodes. React state only changes on game events.
      const chars = endlessVisibleCharsRef.current;
      for (let i = 0; i < chars.length; i += 1) {
        const char = chars[i];
        const nextPosition = (endlessPositionsRef.current[char.id] ?? char.position) - (20 * deltaTime);
        endlessPositionsRef.current[char.id] = nextPosition;
        applyEndlessCharPosition(char.id, nextPosition);

        if (i === 0 && nextPosition < -10 && !endlessStopQueuedRef.current) {
          endlessStopQueuedRef.current = true;
          stopEndlessMode('stopped');
          return;
        }
      }

      endlessAnimationRef.current = requestAnimationFrame(animate);
    };

    endlessAnimationRef.current = requestAnimationFrame(animate);

    return () => {
      if (endlessAnimationRef.current) {
        cancelAnimationFrame(endlessAnimationRef.current);
        endlessAnimationRef.current = null;
      }
    };
  }, [applyEndlessCharPosition, endlessIsRunning, stopEndlessMode]);

  // Endless mode timer
  useEffect(() => {
    if (!endlessIsRunning) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const deadlineMs = timerDeadlineMsRef.current;
      if (!deadlineMs) return;

      const remaining = Math.max(0, Math.floor((deadlineMs - now) / 1000));
      if (remainingSecondsRef.current !== remaining) {
        remainingSecondsRef.current = remaining;
        setRemainingSeconds(remaining);
      }

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
      Alert.alert(
        quizMode === 'bottleneck' ? 'Bottleneck list is empty' : 'Focus list is empty',
        quizMode === 'bottleneck'
          ? 'Add items to Bottleneck by clicking and holding a prompt in Quiz or TypeMaster.'
          : 'Add items to Focus by clicking a prompt in Quiz or TypeMaster.',
      );
      return;
    }
    startAnalysisSessionIfNeeded();
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
    setTypemasterRuntime({ isRunning: true, isPaused: false, hasFinished: false, score: 0 });
    setTypemasterCurrentInput('');
    setTypemasterBurstCursor(0);
    setTypemasterIsRunning(true);
    setIsTypemasterPaused(false);
    setTypemasterHasFinished(false);
    typemasterRoundFinalizedRef.current = false;
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
  }, [getDatasetForMode, quizMode, setTypemasterRuntime, startAnalysisSessionIfNeeded, timerMinutes]);

  const resetTypemasterToSetup = useCallback(() => {
    setTypemasterIsRunning(false);
    setIsTypemasterPaused(false);
    setTypemasterHasFinished(false);
    typemasterRoundFinalizedRef.current = false;
    setTypemasterRuntime({ isRunning: false, isPaused: false, hasFinished: false, score: 0 });
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
  }, [setTypemasterRuntime, timerMinutes]);

  const pauseTypemasterMode = useCallback(() => {
    const runtime = typemasterRuntimeRef.current;
    if (!runtime.isRunning || runtime.hasFinished) return;
    const remainingMs = timerDeadlineMsRef.current
      ? Math.max(0, timerDeadlineMsRef.current - Date.now())
      : Math.max(0, remainingSecondsRef.current * 1000);
    const nextSeconds = Math.ceil(remainingMs / 1000);
    typemasterTimerWasArmedRef.current = Boolean(timerDeadlineMsRef.current);
    setRemainingSeconds(nextSeconds);
    remainingSecondsRef.current = nextSeconds;
    setTypemasterRuntime({ isRunning: false, isPaused: true });
    setTypemasterIsRunning(false);
    setIsTypemasterPaused(true);
    timerDeadlineMsRef.current = null;
  }, [setTypemasterRuntime]);

  const resumeTypemasterMode = useCallback(() => {
    const runtime = typemasterRuntimeRef.current;
    if (!runtime.isPaused || runtime.hasFinished) return;
    if (typemasterTimerWasArmedRef.current) {
      const startSeconds = remainingSecondsRef.current > 0 ? remainingSecondsRef.current : timerMinutes * 60;
      timerDeadlineMsRef.current = Date.now() + startSeconds * 1000;
    } else {
      timerDeadlineMsRef.current = null;
    }
    setTypemasterRuntime({ isRunning: true, isPaused: false });
    setTypemasterIsRunning(true);
    setIsTypemasterPaused(false);
    setTimeout(() => {
      if (typemasterInputRef.current && typeof typemasterInputRef.current.focus === 'function') {
        typemasterInputRef.current.focus();
      }
    }, 0);
  }, [setTypemasterRuntime, timerMinutes]);

  const stopTypemasterMode = useCallback((reason: 'time' | 'stopped' = 'stopped') => {
    const runtime = typemasterRuntimeRef.current;
    if (runtime.hasFinished || typemasterRoundFinalizedRef.current || (!runtime.isRunning && !runtime.isPaused)) return;
    typemasterRoundFinalizedRef.current = true;
    setTypemasterRuntime({ isRunning: false, isPaused: false, hasFinished: true });
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
    const remainingSecondsAtFinish = reason === 'time' ? 0 : Math.ceil(remainingMs / 1000);
    setRemainingSeconds(remainingSecondsAtFinish);
    remainingSecondsRef.current = remainingSecondsAtFinish;
    timerDeadlineMsRef.current = null;
    typemasterTimerWasArmedRef.current = false;
    const now = Date.now();
    const entry = {
      mode: typemasterModeKey,
      timeMs: completionTimeMs,
      score: runtime.score,
      total: runtime.score,
      date: now,
      finishReason: reason,
      timerMinutes,
      typemasterQueueMode,
    };
    recordAnalysisRound({
      gameType: 'typemaster',
      mode: typemasterModeKey,
      score: runtime.score,
      total: runtime.score,
      date: now,
      timeMs: completionTimeMs,
      finishReason: reason,
      timerMinutes,
      typemasterQueueMode,
      scoreLabel: 'Characters',
      items: getDatasetForMode(quizMode),
    });
    saveLeaderboardEntry(entry).then(result => {
      if (result) {
        setLastRecordUpdate({ mode: entry.mode, ...result });
      }
    });
  }, [activeModeKey, getDatasetForMode, quizMode, recordAnalysisRound, saveLeaderboardEntry, setTypemasterRuntime, timerMinutes, typemasterQueueMode]);

  const armTypemasterTimer = useCallback(() => {
    if (!typemasterRuntimeRef.current.isRunning || timerDeadlineMsRef.current) return;
    const startSeconds = remainingSecondsRef.current > 0 ? remainingSecondsRef.current : timerMinutes * 60;
    timerDeadlineMsRef.current = Date.now() + startSeconds * 1000;
    typemasterTimerWasArmedRef.current = true;
    // Kick the visible countdown immediately so the timer appears to start on first input.
    const nextRemaining = Math.max(0, Math.ceil((timerDeadlineMsRef.current - Date.now()) / 1000));
    setRemainingSeconds(nextRemaining);
    remainingSecondsRef.current = nextRemaining;
  }, [timerMinutes]);

  const handleTypemasterInput = useCallback(
    (text: string) => {
      if (!typemasterRuntimeRef.current.isRunning) return;

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
          const nextScore = typemasterRuntimeRef.current.score + 1;
          setTypemasterRuntime({ score: nextScore });
          setTypemasterScore(nextScore);

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
      typemasterQueueMode,
      typemasterBurstCursor,
      getAcceptedAnswersForItem,
      usesJapaneseInputForItem,
      armTypemasterTimer,
      setTypemasterRuntime,
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
      if (remainingSecondsRef.current !== remaining) {
        remainingSecondsRef.current = remaining;
        setRemainingSeconds(remaining);
      }

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

  const scrollFocusedAnswerIfNearViewportEnd = useCallback((target?: HTMLInputElement | null) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !target) return;

    if (typeof target.scrollLeft === 'number') {
      target.scrollLeft = 0;
    }

    if (typeof target.getBoundingClientRect !== 'function') return;
    const rect = target.getBoundingClientRect();
    const viewportHeight = window.innerHeight || (typeof document !== 'undefined' ? document.documentElement?.clientHeight || 0 : 0);
    if (!viewportHeight) return;

    const lowerTriggerY = viewportHeight * 0.74;
    if (rect.bottom <= lowerTriggerY) return;

    const findScrollParent = (node: HTMLElement | null) => {
      let current = node?.parentElement || null;
      const body = typeof document !== 'undefined' ? document.body : null;
      while (current && current !== body) {
        const style = window.getComputedStyle(current);
        const overflowY = style.overflowY || style.overflow;
        const canScroll = current.scrollHeight > current.clientHeight + 12;
        if (canScroll && /(auto|scroll)/.test(overflowY)) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    };

    const scrollParent = findScrollParent(target);
    const jumpDistance = Math.max(Math.round(viewportHeight * 0.58), Math.round(rect.height * 7));
    if (scrollParent) {
      const maxTop = scrollParent.scrollHeight - scrollParent.clientHeight;
      const nextTop = Math.min(maxTop, scrollParent.scrollTop + jumpDistance);
      if (nextTop > scrollParent.scrollTop) {
        scrollParent.scrollTo({ top: nextTop, behavior: 'smooth' });
      }
      return;
    }

    window.scrollBy({ top: jumpDistance, behavior: 'smooth' });
  }, []);

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
        startAnalysisSessionIfNeeded();
        setIsRunning(true);
      }
      setAnswers(prev => {
        if (prev[id] === nextText) return prev;
        const next = { ...prev, [id]: nextText };
        const currentAnswerIsCorrect = !hasFinished && isCorrectAnswer(id, nextText);
        if (currentAnswerIsCorrect) {
          focusNextAnswer(id, next);
        }
        if (currentAnswerIsCorrect) {
          const allCorrect = quizItems.every(item => isCorrectAnswer(item.id, next[item.id] || ''));
          if (allCorrect) {
            finalizeQuiz('complete', next);
          }
        }
        return next;
      });
    },
    [finalizeQuiz, focusNextAnswer, hasFinished, isCorrectAnswer, isJlptJapaneseInputMode, isQuizPaused, isRunning, quizItems, startAnalysisSessionIfNeeded, timerMinutes],
  );

  const columns = useMemo(() => {
    return buildColumnBuckets(quizItems, columnCount);
  }, [columnCount, quizItems]);
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
  const focusLeaderboardSaveNotice = loadedSaveProfileId
    ? 'Focus leaderboard positions are part of the loaded Focus profile. Use Update Loaded Focus Profile after you change the set or improve times.'
    : 'Focus leaderboard positions can be stored in a Focus profile from Settings > Save Manager.';
  const activeFocusSnapshotName = loadedSaveProfileId
    ? (saveProfiles.find(profile => profile.id === loadedSaveProfileId)?.name || 'Unnamed save profile')
    : null;
  const focusNotesDraftTitle = activeFocusSnapshotName || saveProfileName.trim() || `${getQuizModeLabel(activeModeKey)} Focus Draft`;
  const activeLeaderboardModeLabel = getQuizModeLabel(activeLeaderboardModeKey);
  const activeLeaderboardIndex = leaderboardScope === 'session' ? sessionLeaderboardIndex : leaderboardIndex;
  const leaderboardPrimaryRankKey: 'time' | 'score' = leaderboardScoresEnabled ? 'score' : 'time';
  const getLeaderboardSourceEntries = useCallback(
    (
      entries: Array<{ mode: string; timerMinutes?: number; scoreType?: string }>,
      modeKey: string,
      useModeTimerIndex: boolean,
      scoreType?: string,
    ) =>
      isBottleneckModeKey(modeKey)
        ? []
        : entries.filter(entry => {
        if (normalizeStoredQuizModeKey(entry.mode) !== normalizeStoredQuizModeKey(modeKey)) {
          return false;
        }
        if (useModeTimerIndex) {
          return true;
        }
        return normalizeLeaderboardScoreType(entry.scoreType) === normalizeLeaderboardScoreType(scoreType);
      }),
    [],
  );
  const selectLeaderboardEntries = useCallback(
    (
      entries: Array<any>,
      rankKey: 'time' | 'score',
      timerFilter: 'all' | 'dynamic',
    ) => {
      const filtered = timerFilter === 'all'
        ? entries
        : entries.filter(entry => normalizeLeaderboardTimerMinutes(entry.timerMinutes) === normalizeLeaderboardTimerMinutes(timerMinutes));
      return [...filtered]
        .sort(rankKey === 'score' ? compareLeaderboardEntriesByScore : compareLeaderboardEntriesByTime)
        .slice(0, 10);
    },
    [compareLeaderboardEntriesByScore, compareLeaderboardEntriesByTime, timerMinutes],
  );
  const scopedLeaderboardEntries = leaderboardScope === 'session' ? sessionLeaderboard : leaderboard;
  const activeLeaderboardUsesModeTimer = isTypeMasterModeKey(activeLeaderboardModeKey) || isEndlessModeKey(activeLeaderboardModeKey) || isFocusModeKey(activeLeaderboardModeKey);
  const activeLeaderboardSourceEntries = useMemo(
    () => getLeaderboardSourceEntries(scopedLeaderboardEntries, activeLeaderboardModeKey, activeLeaderboardUsesModeTimer, activeQuizLeaderboardScoreType),
    [activeLeaderboardModeKey, activeLeaderboardUsesModeTimer, activeQuizLeaderboardScoreType, getLeaderboardSourceEntries, scopedLeaderboardEntries],
  );
  const getLeaderboardTimerOptions = useCallback((_entries: Array<{ timerMinutes?: number }>) => LEADERBOARD_TIMER_FILTER_OPTIONS, []);
  const activeLeaderboardTimerOptions = useMemo(() => getLeaderboardTimerOptions(activeLeaderboardSourceEntries), [activeLeaderboardSourceEntries, getLeaderboardTimerOptions]);
  const activeLeaderboard = useMemo(
    () => selectLeaderboardEntries(activeLeaderboardSourceEntries, leaderboardPrimaryRankKey, leaderboardTimerFilter),
    [activeLeaderboardSourceEntries, leaderboardPrimaryRankKey, leaderboardTimerFilter, selectLeaderboardEntries],
  );
  const completedModeLabel = getQuizModeLabel(activeModeKey);
  const typemasterModeKey = getTypeMasterModeKey(activeModeKey);
  const isBottleneckTypemasterMode = isBottleneckModeKey(typemasterModeKey);
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
  const canStopQuiz = (isRunning || isQuizPaused) && !hasFinished;
  const canStopEndless = (endlessIsRunning || isEndlessPaused) && !endlessHasFinished;
  const canStopTypemaster = (typemasterIsRunning || isTypemasterPaused) && !typemasterHasFinished;
  const quizPrimaryActionLabel = hasFinished ? 'Play Again' : isRunning ? 'Pause Quiz' : isQuizPaused ? 'Resume Quiz' : 'Play Quiz';
  const endlessPrimaryActionLabel = endlessHasFinished ? 'Play Again' : endlessIsRunning ? 'Pause Endless' : isEndlessPaused ? 'Resume Endless' : 'Play Endless';
  const typemasterPrimaryActionLabel = typemasterHasFinished ? 'Play Again' : typemasterIsRunning ? 'Pause TypeMaster' : isTypemasterPaused ? 'Resume TypeMaster' : 'Play TypeMaster';
  const isTimerAdjustmentLocked =
    isRunning ||
    isQuizPaused ||
    endlessIsRunning ||
    isEndlessPaused ||
    typemasterIsRunning ||
    isTypemasterPaused;
  const renderTimerAdjuster = (timerDisplay: string, expired: boolean = false) => (
    <View style={styles.quizTimerControl}>
      <Pressable
        style={[styles.quizTimerStepperButton, isTimerAdjustmentLocked && styles.quizTimerStepperButtonDisabled]}
        onPress={() => adjustCustomMinutes(-1)}
        disabled={isTimerAdjustmentLocked}
      >
        <Text style={styles.quizTimerStepperLabel}>-</Text>
      </Pressable>
      <View style={styles.quizTimerReadout}>
        <Text style={styles.quizStatLabel}>Timer</Text>
        <Text style={[styles.quizStatValueTimer, expired && styles.quizTimerValueExpired]}>
          {timerDisplay}
        </Text>
      </View>
      <Pressable
        style={[styles.quizTimerStepperButton, isTimerAdjustmentLocked && styles.quizTimerStepperButtonDisabled]}
        onPress={() => adjustCustomMinutes(1)}
        disabled={isTimerAdjustmentLocked}
      >
        <Text style={styles.quizTimerStepperLabel}>+</Text>
      </Pressable>
    </View>
  );
  const activeFamilyModes = getQuizModesForFamily(quizFamily);
  const displayedFamilyModes = quizFamily === 'jlpt'
    ? activeFamilyModes.filter(option => ![...JLPT_N4_VARIANT_VALUES.slice(1), ...JLPT_N3_VARIANT_VALUES.slice(1)].includes(option.value))
    : quizFamily === 'kana'
      ? engModeEnabled
        ? activeFamilyModes.filter(option => option.value === 'hiragana')
        : activeFamilyModes.filter(option => option.value !== 'hiragana_dakuten' && option.value !== 'katakana_dakuten')
      : activeFamilyModes;
  const activeKanaVariant = quizMode.startsWith('katakana') ? (KANA_VARIANT_OPTIONS.katakana.includes(quizMode) ? quizMode : 'katakana') : (KANA_VARIANT_OPTIONS.hiragana.includes(quizMode) ? quizMode : 'hiragana');
  const activeJlptN3Variant = JLPT_N3_VARIANT_VALUES.includes(quizMode) ? quizMode : JLPT_N3_VARIANT_VALUES[0];
  const promptColumnLabel = isFocusFamilyMode
    ? 'Prompt'
    : isJlptJapaneseInputMode
      ? 'Romaji Reading'
      : isKanjiStudyMode
        ? (engModeEnabled ? 'Vocabulary' : 'Kanji')
        : (engModeEnabled ? 'Alphabet' : 'Kana');
  const answerColumnLabel = isFocusFamilyMode
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
  const answerPlaceholder = isFocusFamilyMode
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
  const completedLeaderboardSourceEntries = useMemo(
    () => getLeaderboardSourceEntries(scopedLeaderboardEntries, activeModeKey, false, activeQuizLeaderboardScoreType),
    [activeModeKey, activeQuizLeaderboardScoreType, getLeaderboardSourceEntries, scopedLeaderboardEntries],
  );
  const completedLeaderboardTimerOptions = useMemo(() => getLeaderboardTimerOptions(completedLeaderboardSourceEntries), [completedLeaderboardSourceEntries, getLeaderboardTimerOptions]);
  const completedModeLeaderboard = useMemo(
    () => selectLeaderboardEntries(completedLeaderboardSourceEntries, leaderboardPrimaryRankKey, leaderboardTimerFilter),
    [completedLeaderboardSourceEntries, leaderboardPrimaryRankKey, leaderboardTimerFilter, selectLeaderboardEntries],
  );
  const typemasterCompletedLeaderboardSourceEntries = useMemo(
    () => getLeaderboardSourceEntries(scopedLeaderboardEntries, typemasterModeKey, true),
    [getLeaderboardSourceEntries, scopedLeaderboardEntries, typemasterModeKey],
  );
  const typemasterCompletedLeaderboardTimerOptions = useMemo(() => getLeaderboardTimerOptions(typemasterCompletedLeaderboardSourceEntries), [getLeaderboardTimerOptions, typemasterCompletedLeaderboardSourceEntries]);
  const typemasterCompletedModeLeaderboard = useMemo(
    () => selectLeaderboardEntries(typemasterCompletedLeaderboardSourceEntries, leaderboardPrimaryRankKey, leaderboardTimerFilter),
    [leaderboardPrimaryRankKey, leaderboardTimerFilter, selectLeaderboardEntries, typemasterCompletedLeaderboardSourceEntries],
  );
  const getLeaderboardTimerFilterDisplay = (options: Array<{ value: string; label: string }>) =>
    options.find(option => option.value === leaderboardTimerFilter)?.label || 'All';
  const activeLeaderboardGameLabel = (LEADERBOARD_GAME_OPTIONS.find(option => option.value === leaderboardGameType) || LEADERBOARD_GAME_OPTIONS[0]).label;
  const activeLeaderboardTimerDisplay = getLeaderboardTimerFilterDisplay(activeLeaderboardTimerOptions);
  const completedLeaderboardTimerDisplay = getLeaderboardTimerFilterDisplay(completedLeaderboardTimerOptions);
  const typemasterCompletedLeaderboardTimerDisplay = getLeaderboardTimerFilterDisplay(typemasterCompletedLeaderboardTimerOptions);
  const currentLeaderboardTimerOptions = quizView === 'leaderboard'
    ? activeLeaderboardTimerOptions
    : quizView === 'typemaster' && typemasterHasFinished
      ? typemasterCompletedLeaderboardTimerOptions
      : hasFinished
        ? completedLeaderboardTimerOptions
        : activeLeaderboardTimerOptions;
  useEffect(() => {
    if (leaderboardTimerFilter === 'all' || leaderboardTimerFilter === 'dynamic') return;
    const exists = currentLeaderboardTimerOptions.some(option => option.value === leaderboardTimerFilter);
    if (!exists) {
      setLeaderboardTimerFilter('all');
    }
  }, [currentLeaderboardTimerOptions, leaderboardTimerFilter]);
  const analysisGroups = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; entries: any[] }>();
    const visibleAnalysisEntries = analysisEntries.filter(entry =>
      analysisGameType === 'typemaster'
        ? entry.gameType === 'typemaster'
        : entry.gameType !== 'typemaster',
    );
    visibleAnalysisEntries.forEach(entry => {
      const key = entry.graphKey || 'analysis:unknown';
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: entry.graphLabel || entry.displayLabel || 'Analysis',
          entries: [],
        });
      }
      groups.get(key)?.entries.push(entry);
    });
    return Array.from(groups.values())
      .map(group => ({
        ...group,
        entries: group.entries.sort((a, b) => a.date - b.date),
      }))
      .sort((a, b) => {
        const latestA = a.entries[a.entries.length - 1]?.date || 0;
        const latestB = b.entries[b.entries.length - 1]?.date || 0;
        return latestB - latestA;
      });
  }, [analysisEntries, analysisGameType]);
  const activeAnalysisGroup = analysisGroups.find(group => group.key === activeAnalysisGraphKey) || analysisGroups[0] || null;
  const analysisSessionElapsedMs = analysisSessionStartedAt
    ? Math.max(0, analysisElapsedNow - analysisSessionStartedAt)
    : 0;
  const analysisChart = useMemo(() => {
    const entries = activeAnalysisGroup?.entries || [];
    const width = 760;
    const height = 300;
    const padLeft = 56;
    const padRight = 22;
    const padTop = 24;
    const padBottom = 44;
    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;
    const maxElapsed = Math.max(1, ...entries.map(entry => Number(entry.sessionElapsedMs) || 0));
    const maxScore = Math.max(1, ...entries.map(entry => Number(entry.score) || 0));
    const scaledMaxScore = Math.ceil(maxScore * 1.08);
    const points = entries.map((entry, index) => {
      const x = entries.length === 1
        ? padLeft + plotWidth / 2
        : padLeft + ((Number(entry.sessionElapsedMs) || 0) / maxElapsed) * plotWidth;
      const y = padTop + plotHeight - ((Number(entry.score) || 0) / scaledMaxScore) * plotHeight;
      return { entry, index, x, y };
    });
    return {
      width,
      height,
      padLeft,
      padTop,
      padBottom,
      plotWidth,
      plotHeight,
      maxElapsed,
      scaledMaxScore,
      points,
      polyline: points.map(point => `${point.x},${point.y}`).join(' '),
    };
  }, [activeAnalysisGroup]);

  useEffect(() => {
    if (!analysisGroups.length) {
      if (activeAnalysisGraphKey) setActiveAnalysisGraphKey('');
      return;
    }
    if (!activeAnalysisGraphKey || !analysisGroups.some(group => group.key === activeAnalysisGraphKey)) {
      setActiveAnalysisGraphKey(analysisGroups[0].key);
    }
  }, [activeAnalysisGraphKey, analysisGroups]);

  const exportActiveAnalysisGraph = useCallback(() => {
    if (!activeAnalysisGroup || activeAnalysisGroup.entries.length === 0) {
      Alert.alert('Analysis export', 'No analysis graph is available to export.');
      return;
    }
    if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof window === 'undefined') {
      Alert.alert('Analysis export', 'Graph export is available on web.');
      return;
    }
    const width = 900;
    const height = 460;
    const padLeft = 70;
    const padTop = 76;
    const padRight = 34;
    const padBottom = 62;
    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;
    const entries = activeAnalysisGroup.entries;
    const maxElapsed = Math.max(1, ...entries.map(entry => Number(entry.sessionElapsedMs) || 0));
    const maxScore = Math.max(1, ...entries.map(entry => Number(entry.score) || 0));
    const scaledMaxScore = Math.ceil(maxScore * 1.08);
    const points = entries.map(entry => {
      const x = entries.length === 1
        ? padLeft + plotWidth / 2
        : padLeft + ((Number(entry.sessionElapsedMs) || 0) / maxElapsed) * plotWidth;
      const y = padTop + plotHeight - ((Number(entry.score) || 0) / scaledMaxScore) * plotHeight;
      return { entry, x, y };
    });
    const pointString = points.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
    const circles = points.map(point =>
      `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="4.5" fill="#38bdf8" stroke="#0f172a" stroke-width="2"><title>${escapeXml(`${point.entry.scoreLabel}: ${point.entry.score} at ${formatAnalysisDuration(point.entry.sessionElapsedMs)}`)}</title></circle>`,
    ).join('');
    const labels = points.map((point, index) => index % Math.max(1, Math.ceil(points.length / 8)) === 0
      ? `<text x="${point.x.toFixed(2)}" y="${height - 22}" fill="#94a3b8" font-size="12" text-anchor="middle">${escapeXml(formatAnalysisDuration(point.entry.sessionElapsedMs))}</text>`
      : '').join('');
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#0b1220"/>
  <text x="${padLeft}" y="34" fill="#f8fafc" font-size="22" font-weight="700">${escapeXml(activeAnalysisGroup.label)}</text>
  <text x="${padLeft}" y="56" fill="#94a3b8" font-size="13">${escapeXml(`${entries.length} runs | exported ${new Date().toLocaleString()}`)}</text>
  <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + plotHeight}" stroke="#334155" stroke-width="1"/>
  <line x1="${padLeft}" y1="${padTop + plotHeight}" x2="${padLeft + plotWidth}" y2="${padTop + plotHeight}" stroke="#334155" stroke-width="1"/>
  <text x="22" y="${padTop + 6}" fill="#94a3b8" font-size="12">${scaledMaxScore}</text>
  <text x="22" y="${padTop + plotHeight}" fill="#94a3b8" font-size="12">0</text>
  <polyline points="${pointString}" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  ${circles}
  ${labels}
</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = document.createElement('img');
    image.onload = () => {
      try {
        const scale = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const context = canvas.getContext('2d');
        if (!context) {
          Alert.alert('Analysis export', 'Could not prepare JPEG export.');
          return;
        }
        context.scale(scale, scale);
        context.fillStyle = '#0b1220';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        const anchor = document.createElement('a');
        anchor.href = canvas.toDataURL('image/jpeg', 0.94);
        anchor.download = `tensai-analysis-${createStableHash(activeAnalysisGroup.key)}.jpeg`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      } catch (error) {
        console.error('Failed to export analysis graph as JPEG:', error);
        Alert.alert('Analysis export', 'Could not export the graph as JPEG.');
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      Alert.alert('Analysis export', 'Could not render the graph for JPEG export.');
    };
    image.src = url;
  }, [activeAnalysisGroup]);

  const activeJlptN4Variant = JLPT_N4_VARIANT_VALUES.includes(quizMode) ? quizMode : JLPT_N4_VARIANT_VALUES[0];
  const shouldShowLeaderboardGamepoints = leaderboardScoresEnabled;
  const renderLeaderboardTimerFilter = (options: Array<{ value: string; label: string }>, compact = false) => {
    const label = options.find(option => option.value === leaderboardTimerFilter)?.label || 'All';
    return (
    <View
      style={[styles.quizDropdownWrap, compact && styles.quizLeaderboardTimerDropdown]}
      onTouchStart={event => event.stopPropagation()}
    >
      {compact ? null : <Text style={styles.quizDropdownLabel}>Leaderboard Timer</Text>}
      <Pressable
        style={[styles.quizDropdownTrigger, compact && styles.quizLeaderboardToolbarSelect]}
        onPress={() => setIsLeaderboardTimerDropdownOpen(prev => !prev)}
      >
        <Text style={styles.quizDropdownTriggerText}>{label}</Text>
        <Text style={styles.quizDropdownTriggerChevron}>{isLeaderboardTimerDropdownOpen ? '▲' : '▼'}</Text>
      </Pressable>
      {isLeaderboardTimerDropdownOpen ? (
        <View style={styles.quizDropdownMenu}>
          {options.map(option => {
            const selected = option.value === leaderboardTimerFilter;
            return (
              <Pressable
                key={`leaderboard-timer-${option.value}`}
                style={[styles.quizDropdownMenuItem, selected && styles.quizDropdownMenuItemActive]}
                onPress={() => {
                  setLeaderboardTimerFilter(option.value as 'all' | 'dynamic');
                  setIsLeaderboardTimerDropdownOpen(false);
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
    );
  };
  const renderLeaderboardToolbarButton = (
    key: string,
    label: string,
    selected: boolean,
    onPress: () => void,
  ) => (
    <Pressable
      key={key}
      style={[styles.quizLeaderboardToolbarButton, selected && styles.quizLeaderboardToolbarButtonActive]}
      onPress={onPress}
    >
      <Text style={[styles.quizLeaderboardToolbarButtonLabel, selected && styles.quizLeaderboardToolbarButtonLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
  const renderLeaderboardToolbar = (
    timerOptions: Array<{ value: string; label: string }>,
    scopeOptions: Array<{ value: string; label: string }>,
    showGameType: boolean,
  ) => (
    <View
      style={styles.quizLeaderboardHeaderToolbar}
      onTouchStart={event => event.stopPropagation()}
    >
      {showGameType ? (
        <View style={styles.quizLeaderboardToolbarGroup}>
          {LEADERBOARD_GAME_OPTIONS.map(option =>
            renderLeaderboardToolbarButton(
              `leaderboard-game-${option.value}`,
              option.label,
              option.value === leaderboardGameType,
              () => setLeaderboardGameType(option.value),
            ),
          )}
        </View>
      ) : null}
      <View style={styles.quizLeaderboardToolbarGroup}>
        {renderLeaderboardTimerFilter(timerOptions, true)}
      </View>
      <View style={styles.quizLeaderboardToolbarGroup}>
        {scopeOptions.map(option =>
          renderLeaderboardToolbarButton(
            `leaderboard-scope-${option.value}`,
            option.label,
            option.value === leaderboardScope,
            () => setLeaderboardScope(option.value),
          ),
        )}
      </View>
      <Pressable
        style={[styles.quizLeaderboardToolbarButton, styles.quizLeaderboardToolbarEditButton, isLeaderboardEditMode && styles.quizLeaderboardToolbarButtonActive]}
        onPress={() => setIsLeaderboardEditMode(prev => !prev)}
      >
        <Text style={[styles.quizLeaderboardToolbarButtonLabel, isLeaderboardEditMode && styles.quizLeaderboardToolbarButtonLabelActive]}>
          {isLeaderboardEditMode ? 'Done' : 'Edit'}
        </Text>
      </Pressable>
    </View>
  );
  const renderLeaderboardEntries = (entries: any[]) => (
    <View style={styles.quizLeaderboardList}>
      {entries.map((entry, index) => (
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
  );
  const closeQuizDropdownMenus = () => {
    setIsJlptModeDropdownOpen(false);
    setOpenJlptSetDropdownBase(null);
    setOpenKanaDropdownBase(null);
    setIsLeaderboardTimerDropdownOpen(false);
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
    quizRoundFinalizedRef.current = false;
    endlessRoundFinalizedRef.current = false;
    typemasterRoundFinalizedRef.current = false;
    setEndlessRuntime({ isRunning: false, isPaused: false, hasFinished: false });
    setTypemasterRuntime({ isRunning: false, isPaused: false, hasFinished: false });
    endlessStopQueuedRef.current = false;
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

  const focusNotesPanelTranslateX = resolvedFocusNotesAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });
  const focusNotesPanelOpacity = resolvedFocusNotesAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const handleFocusNotesResizeStart = useCallback(
    (event: any) => {
      if (Platform.OS !== 'web' || typeof document === 'undefined') return;
      event?.preventDefault?.();
      event?.stopPropagation?.();

      const startX = Number(event?.clientX ?? event?.nativeEvent?.clientX ?? 0);
      const startWidth = clampFocusNotesWidth(focusNotesPanelWidth);
      let latestWidth = startWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        latestWidth = clampFocusNotesWidth(startWidth + moveEvent.clientX - startX);
        setFocusNotesPanelWidth(latestWidth);
      };
      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        onFocusNotesResizeEnd(latestWidth);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [focusNotesPanelWidth, onFocusNotesResizeEnd, setFocusNotesPanelWidth],
  );

  return (
    <View style={styles.quizNotesStage}>
      <ScrollView
        style={styles.quizScroll}
        contentContainerStyle={styles.quizContent}
        onTouchStart={() => {
          if (isJlptModeDropdownOpen || openJlptSetDropdownBase || openKanaDropdownBase) {
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
          <View style={styles.quizNavMeta}>
            <Pressable
              accessibilityLabel="Toggle Focus notes"
              accessibilityRole="button"
              style={[styles.quizNotesToggle, isFocusNotesOpen && styles.quizNotesToggleActive]}
              onPress={() => setIsFocusNotesOpen(prev => !prev)}
            >
              <PencilNoteIcon active={isFocusNotesOpen} />
            </Pressable>
            <Text style={styles.quizNavVersion}>v1.4</Text>
          </View>
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
                        setOpenJlptSetDropdownBase(null);
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
                        setOpenJlptSetDropdownBase(prev => (prev === value ? null : value));
                      }}
                    >
                      <Text
                        style={[
                          styles.quizSubNavTabText,
                          styles.quizSplitTabChevron,
                          isN4Selected && styles.quizSubNavTabTextActive,
                        ]}
                      >
                        {openJlptSetDropdownBase === value ? '▲' : '▼'}
                      </Text>
                    </Pressable>
                    {openJlptSetDropdownBase === value ? (
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
              if (value === 'jlpt_n3') {
                const isN3Selected = JLPT_N3_VARIANT_VALUES.includes(quizMode);
                return (
                  <View
                    key="jlpt-n3-split"
                    style={styles.quizSplitTabGroup}
                    onTouchStart={event => event.stopPropagation()}
                  >
                    <Pressable
                      style={[
                        styles.quizSubNavTab,
                        styles.quizSplitTabMain,
                        isN3Selected && styles.quizSubNavTabActive,
                      ]}
                      onPress={() => selectQuizMode(activeJlptN3Variant)}
                    >
                      <Text style={[styles.quizSubNavTabText, isN3Selected && styles.quizSubNavTabTextActive]}>
                        N3
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.quizSubNavTab,
                        styles.quizSplitTabToggle,
                        isN3Selected && styles.quizSplitTabToggleActive,
                      ]}
                      onPress={() => {
                        if (isRunning) return;
                        setIsJlptModeDropdownOpen(false);
                        setOpenJlptSetDropdownBase(prev => (prev === value ? null : value));
                      }}
                    >
                      <Text
                        style={[
                          styles.quizSubNavTabText,
                          styles.quizSplitTabChevron,
                          isN3Selected && styles.quizSubNavTabTextActive,
                        ]}
                      >
                        {openJlptSetDropdownBase === value ? '▲' : '▼'}
                      </Text>
                    </Pressable>
                    {openJlptSetDropdownBase === value ? (
                      <View style={styles.quizSplitTabMenu}>
                        {JLPT_N3_VARIANT_VALUES.map(variantValue => {
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
                  setOpenJlptSetDropdownBase(null);
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
                          quizRoundFinalizedRef.current = false;
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
            renderTimerAdjuster(formatTimer(remainingSeconds), hasFinished || endlessHasFinished || typemasterHasFinished)
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
            renderTimerAdjuster(formatTimer(timerMinutes * 60))
          ) : quizView === 'analysis' ? (
            null
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
              <View style={styles.quizActionButtonsRow}>
                {quizView === 'endless' ? (
                  <>
                    <Pressable
                      style={styles.quizPlayButton}
                      onPress={endlessIsRunning ? pauseEndlessMode : isEndlessPaused ? resumeEndlessMode : endlessHasFinished ? resetEndlessToSetup : startEndlessMode}
                    >
                      <Text style={styles.quizPlayButtonLabel}>{endlessPrimaryActionLabel}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.quizStopButton, !canStopEndless && styles.quizStopButtonDisabled]}
                      onPress={() => stopEndlessMode('stopped')}
                      disabled={!canStopEndless}
                    >
                      <Text style={[styles.quizStopButtonLabel, !canStopEndless && styles.quizStopButtonLabelDisabled]}>Stop</Text>
                    </Pressable>
                  </>
                ) : quizView === 'typemaster' ? (
                  <>
                    <Pressable
                      style={styles.quizPlayButton}
                      onPress={typemasterIsRunning ? pauseTypemasterMode : isTypemasterPaused ? resumeTypemasterMode : typemasterHasFinished ? resetTypemasterToSetup : startTypemasterMode}
                    >
                      <Text style={styles.quizPlayButtonLabel}>{typemasterPrimaryActionLabel}</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.quizStopButton, !canStopTypemaster && styles.quizStopButtonDisabled]}
                      onPress={() => stopTypemasterMode('stopped')}
                      disabled={!canStopTypemaster}
                    >
                      <Text style={[styles.quizStopButtonLabel, !canStopTypemaster && styles.quizStopButtonLabelDisabled]}>Stop</Text>
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
                    <Pressable
                      style={[styles.quizStopButton, !canStopQuiz && styles.quizStopButtonDisabled]}
                      onPress={stopQuiz}
                      disabled={!canStopQuiz}
                    >
                      <Text style={[styles.quizStopButtonLabel, !canStopQuiz && styles.quizStopButtonLabelDisabled]}>Stop</Text>
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
                    {!isBottleneckTypemasterMode && lastRecordUpdate && lastRecordUpdate.mode === typemasterModeKey ? (
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
                  {isBottleneckTypemasterMode ? (
                    <View style={styles.quizFinishLeaderboardPanelWide}>
                      <Text style={styles.quizLeaderboardEmpty}>Bottleneck runs are not saved to leaderboards.</Text>
                    </View>
                  ) : (
                  <View style={styles.quizFinishLeaderboardPanelWide}>
                    <View style={styles.quizLeaderboard}>
                      <View style={styles.quizLeaderboardHeaderRow}>
                        <Text style={styles.quizLeaderboardTitle}>{typemasterCompletedModeLabel} Leaderboard ({typemasterCompletedLeaderboardTimerDisplay}, {typemasterCompletedScopeLabel})</Text>
                        <View style={styles.quizLeaderboardScopeTabs}>
                          {renderLeaderboardTimerFilter(typemasterCompletedLeaderboardTimerOptions, true)}
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
                      {typemasterCompletedModeLeaderboard.length > 0
                        ? renderLeaderboardEntries(typemasterCompletedModeLeaderboard)
                        : <Text style={styles.quizLeaderboardEmpty}>No {typemasterCompletedScopeLabel.toLowerCase()} entries for this mode.</Text>}
                    </View>
                  </View>
                  )}
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
                    {renderTimerAdjuster(formatTimer(remainingSeconds))}
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
                        const isFocusedChar = isFocusedItem(char.item);
                        const isBottleneckChar = isBottleneckItem(char.item);
                        const charColor = isBottleneckChar ? '#020617' : isTyped ? '#64748b' : '#ffffff';
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
                            backgroundColor: isBottleneckChar ? '#eff6ff' : isFocusedChar ? '#334155' : '#1e293b',
                            borderWidth: 2,
                            borderColor: isBottleneckChar ? '#bfdbfe' : isFocusedChar ? '#93c5fd' : '#475569',
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
                              if (suppressNextFocusPressRef.current) {
                                suppressNextFocusPressRef.current = false;
                                return;
                              }
                              void toggleFocusedItem(char.item);
                            }}
                            onLongPress={() => {
                              suppressNextFocusPressRef.current = true;
                              void toggleBottleneckItem(char.item);
                            }}
                            delayLongPress={350}
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
                    {renderTimerAdjuster(formatTimer(remainingSeconds))}
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
                      ref={node => {
                        if (node) {
                          endlessCharRefs.current[char.id] = node;
                          applyEndlessCharPosition(char.id, endlessPositionsRef.current[char.id] ?? char.position);
                        } else {
                          delete endlessCharRefs.current[char.id];
                        }
                      }}
                      style={{
                        position: 'absolute',
                        left: `${char.position}%`,
                        top: '50%',
                        willChange: 'left',
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
        ) : quizView === 'analysis' ? (
          <View style={styles.quizFinishCard}>
            <View style={[styles.quizFinishHeader, styles.quizLeaderboardTopHeader]}>
              <View style={styles.quizLeaderboardHeaderText}>
                <Text style={styles.quizFinishTitle}>Analysis</Text>
                <Text style={styles.quizFinishSubtitle}>
                  {analysisEnabled
                    ? analysisSessionStartedAt
                      ? `Session time ${formatAnalysisDuration(analysisSessionElapsedMs)}`
                      : 'Analysis armed. First played round starts the session timer.'
                    : 'Analysis paused.'}
                </Text>
              </View>
              <View style={styles.analysisHeaderActions}>
                <View style={styles.quizLeaderboardToolbarGroup}>
                  {LEADERBOARD_GAME_OPTIONS.map(option =>
                    renderLeaderboardToolbarButton(
                      `analysis-game-${option.value}`,
                      option.label,
                      option.value === analysisGameType,
                      () => setAnalysisGameType(option.value),
                    ),
                  )}
                </View>
                <Pressable
                  style={[styles.analysisToggleButton, analysisEnabled && styles.analysisToggleButtonActive]}
                  onPress={() => setAnalysisEnabledAndPersist(!analysisEnabled)}
                >
                  <Text style={[styles.analysisToggleButtonLabel, analysisEnabled && styles.analysisToggleButtonLabelActive]}>
                    {analysisEnabled ? 'Analysis On' : 'Analysis Off'}
                  </Text>
                </Pressable>
                <Pressable style={styles.quizLeaderboardToolbarButton} onPress={exportActiveAnalysisGraph}>
                  <Text style={styles.quizLeaderboardToolbarButtonLabel}>Export JPEG</Text>
                </Pressable>
                <Pressable style={styles.quizLeaderboardToolbarButton} onPress={resetAnalysisSession}>
                  <Text style={styles.quizLeaderboardToolbarButtonLabel}>Reset</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.analysisSummaryGrid}>
              <View style={styles.quizFinishStat}>
                <Text style={styles.quizFinishStatLabel}>Runs Logged</Text>
                <Text style={styles.quizFinishStatValue}>{analysisEntries.length}</Text>
              </View>
              <View style={styles.quizFinishStat}>
                <Text style={styles.quizFinishStatLabel}>Graphs</Text>
                <Text style={styles.quizFinishStatValue}>{analysisGroups.length}</Text>
              </View>
              <View style={styles.quizFinishStat}>
                <Text style={styles.quizFinishStatLabel}>Session</Text>
                <Text style={styles.quizFinishStatValue}>
                  {analysisSessionStartedAt ? formatAnalysisDuration(analysisSessionElapsedMs) : '0:00'}
                </Text>
              </View>
            </View>

            {analysisGroups.length > 0 ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.analysisGraphTabsScroll}
                  contentContainerStyle={styles.analysisGraphTabs}
                >
                  {analysisGroups.map(group => {
                    const selected = group.key === activeAnalysisGroup?.key;
                    return (
                      <Pressable
                        key={group.key}
                        style={[styles.analysisGraphTab, selected && styles.analysisGraphTabActive]}
                        onPress={() => setActiveAnalysisGraphKey(group.key)}
                      >
                        <Text style={[styles.analysisGraphTabLabel, selected && styles.analysisGraphTabLabelActive]} numberOfLines={1}>
                          {group.label}
                        </Text>
                        <Text style={styles.analysisGraphTabMeta}>{group.entries.length} runs</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View style={styles.analysisChartPanel}>
                  <View style={styles.analysisChartHeader}>
                    <Text style={styles.quizLeaderboardTitle}>{activeAnalysisGroup?.label || 'Analysis Graph'}</Text>
                    <Text style={styles.analysisChartMeta}>
                      {activeAnalysisGroup?.entries.length || 0} runs | max {analysisChart.scaledMaxScore}
                    </Text>
                  </View>
                  <Svg
                    width="100%"
                    height={analysisChart.height}
                    viewBox={`0 0 ${analysisChart.width} ${analysisChart.height}`}
                  >
                    <Line
                      x1={analysisChart.padLeft}
                      y1={analysisChart.padTop}
                      x2={analysisChart.padLeft}
                      y2={analysisChart.padTop + analysisChart.plotHeight}
                      stroke="#334155"
                      strokeWidth="1"
                    />
                    <Line
                      x1={analysisChart.padLeft}
                      y1={analysisChart.padTop + analysisChart.plotHeight}
                      x2={analysisChart.padLeft + analysisChart.plotWidth}
                      y2={analysisChart.padTop + analysisChart.plotHeight}
                      stroke="#334155"
                      strokeWidth="1"
                    />
                    {[0.25, 0.5, 0.75].map(mark => (
                      <Line
                        key={`analysis-grid-${mark}`}
                        x1={analysisChart.padLeft}
                        y1={analysisChart.padTop + analysisChart.plotHeight * mark}
                        x2={analysisChart.padLeft + analysisChart.plotWidth}
                        y2={analysisChart.padTop + analysisChart.plotHeight * mark}
                        stroke="#1e293b"
                        strokeWidth="1"
                      />
                    ))}
                    <SvgText x={10} y={analysisChart.padTop + 6} fill="#94a3b8" fontSize="12">
                      {analysisChart.scaledMaxScore}
                    </SvgText>
                    <SvgText x={22} y={analysisChart.padTop + analysisChart.plotHeight} fill="#94a3b8" fontSize="12">
                      0
                    </SvgText>
                    {analysisChart.polyline ? (
                      <Polyline
                        points={analysisChart.polyline}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}
                    {analysisChart.points.map(point => (
                      <Circle
                        key={point.entry.id}
                        cx={point.x}
                        cy={point.y}
                        r="5"
                        fill="#38bdf8"
                        stroke="#0f172a"
                        strokeWidth="2"
                      />
                    ))}
                    {analysisChart.points.map((point, index) => (
                      index % Math.max(1, Math.ceil(analysisChart.points.length / 5)) === 0 ? (
                        <SvgText
                          key={`analysis-label-${point.entry.id}`}
                          x={point.x}
                          y={analysisChart.height - 12}
                          fill="#94a3b8"
                          fontSize="11"
                          textAnchor="middle"
                        >
                          {formatAnalysisDuration(point.entry.sessionElapsedMs)}
                        </SvgText>
                      ) : null
                    ))}
                  </Svg>
                  <View style={styles.analysisRunList}>
                    {(activeAnalysisGroup?.entries || []).slice(-8).reverse().map(entry => (
                      <View key={entry.id} style={styles.analysisRunRow}>
                        <Text style={styles.analysisRunLabel} numberOfLines={1}>{entry.displayLabel}</Text>
                        <Text style={styles.analysisRunValue}>{entry.score.toLocaleString()}</Text>
                        <Text style={styles.analysisRunMeta}>{formatAnalysisDuration(entry.sessionElapsedMs)}</Text>
                        <Text style={styles.analysisRunMeta}>{formatMilliseconds(entry.timeMs)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.quizFinishLeaderboardPanelWide}>
                <Text style={styles.quizLeaderboardEmpty}>No analysis runs logged yet.</Text>
              </View>
            )}
          </View>
        ) : quizView === 'leaderboard' ? (
          <View style={styles.quizFinishCard}>
            <View style={[styles.quizFinishHeader, styles.quizLeaderboardTopHeader]}>
              <View style={styles.quizLeaderboardHeaderText}>
                <Text style={styles.quizFinishTitle}>{activeLeaderboardModeLabel} Leaderboard</Text>
                <Text style={styles.quizFinishSubtitle}>
                  {activeLeaderboardGameLabel} / {activeLeaderboardTimerDisplay} / {activeScopeLabel}
                </Text>
              </View>
              {renderLeaderboardToolbar(activeLeaderboardTimerOptions, activeLeaderboardScopeOptions, true)}
            </View>

            <View style={styles.quizFinishLeaderboardPanel}>
              <View style={styles.quizLeaderboard}>
                <View style={styles.quizLeaderboardHeaderRow}>
                  <Text style={styles.quizLeaderboardTitle}>Entries ({activeLeaderboardTimerDisplay}, {activeScopeLabel})</Text>
                </View>
                {isFocusModeKey(activeLeaderboardModeKey) && leaderboardScope === 'session' ? (
                  <Text style={styles.quizFinishSubtitle}>{focusLeaderboardSaveNotice}</Text>
                ) : null}
                {activeLeaderboard.length > 0
                  ? renderLeaderboardEntries(activeLeaderboard)
                  : <Text style={styles.quizLeaderboardEmpty}>No {activeScopeLabel.toLowerCase()} entries for this mode.</Text>}
              </View>
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
                {!isBottleneckMode && finishReason === 'complete' && lastRecordUpdate && lastRecordUpdate.mode === activeModeKey && normalizeLeaderboardScoreType(lastRecordUpdate.scoreType) === activeQuizLeaderboardScoreType ? (
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

              {isBottleneckMode ? (
                <View style={styles.quizFinishLeaderboardPanelWide}>
                  <Text style={styles.quizLeaderboardEmpty}>Bottleneck runs are not saved to leaderboards.</Text>
                </View>
              ) : (
              <View style={styles.quizFinishLeaderboardPanelWide}>
                <View style={styles.quizLeaderboard}>
                  <View style={styles.quizLeaderboardHeaderRow}>
                    <Text style={styles.quizLeaderboardTitle}>{completedModeLabel} Leaderboard ({completedLeaderboardTimerDisplay}, {completedScopeLabel})</Text>
                    <View style={styles.quizLeaderboardScopeTabs}>
                      {renderLeaderboardTimerFilter(completedLeaderboardTimerOptions, true)}
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
                  {completedModeLeaderboard.length > 0
                    ? renderLeaderboardEntries(completedModeLeaderboard)
                    : <Text style={styles.quizLeaderboardEmpty}>No {completedScopeLabel.toLowerCase()} entries for this mode.</Text>}
                </View>
              </View>
              )}
            </View>
          </View>
        ) : (
          columns.map((column, columnIndex) => (
            <View key={`quiz-column-${columnIndex}`} style={styles.quizTable}>
              <View style={styles.quizTableHeader}>
                <Text style={styles.quizTableHeaderLabel}>{promptColumnLabel}</Text>
                <Text style={styles.quizTableHeaderLabel}>{answerColumnLabel}</Text>
              </View>
              <View style={[styles.quizTableBody, isFocusFamilyMode && styles.quizTableBodyTopAligned]}>
                {column.map(item => (
                  <View key={item.id} style={styles.quizTableRowItem}>
                    <View
                      style={[
                        styles.quizKanaCell,
                        isJlptJapaneseInputMode && styles.quizKanaCellWide,
                        engModeEnabled && styles.quizKanaCellEnglish,
                        isFocusedItem(item) && styles.quizKanaCellFocused,
                        isBottleneckItem(item) && styles.quizKanaCellBottleneck,
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
                            if (suppressNextFocusPressRef.current) {
                              suppressNextFocusPressRef.current = false;
                              return;
                            }
                            void toggleFocusedItem(item);
                          }}
                          onLongPress={() => {
                            if (quizPromptHidden) return;
                            suppressNextFocusPressRef.current = true;
                            void toggleBottleneckItem(item);
                          }}
                          delayLongPress={350}
                        >
                          <Text
                            style={[
                              styles.quizKanaText,
                              isJlptJapaneseInputMode && styles.quizKanaTextWide,
                              engModeEnabled && styles.quizKanaTextEnglish,
                              engModeEnabled && isEnglishAlphabetMode && styles.quizKanaTextEnglishAlphabet,
                              isBottleneckItem(item) && !quizPromptHidden && styles.quizKanaTextBottleneck,
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
                        scrollFocusedAnswerIfNearViewportEnd(target);
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

      <Animated.View
        pointerEvents={isFocusNotesOpen ? 'auto' : 'none'}
        style={[
          styles.focusNotesPanel,
          { width: focusNotesPanelWidth },
          {
            opacity: focusNotesPanelOpacity,
            transform: [{ translateX: focusNotesPanelTranslateX }],
          },
        ]}
      >
        <View style={styles.focusNotesHeader}>
          <View style={styles.focusNotesTitleGroup}>
            <Text style={styles.focusNotesTitle}>Notes</Text>
            <Text style={styles.focusNotesProfileLabel} numberOfLines={1}>
              {focusNotesDraftTitle}
            </Text>
          </View>
          <Pressable style={styles.focusNotesCloseButton} onPress={() => setIsFocusNotesOpen(false)}>
            <Text style={styles.focusNotesCloseLabel}>x</Text>
          </Pressable>
        </View>
        <View style={styles.focusNotesFolderBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.focusNotesFolderScroll}
            contentContainerStyle={styles.focusNotesFolderList}
          >
            {focusNoteFolders.map(folder => {
              const selected = activeFocusNoteFolder?.id === folder.id;
              return (
                <Pressable
                  key={folder.id}
                  style={[styles.focusNotesFolderChip, selected && styles.focusNotesFolderChipActive]}
                  onPress={() => setActiveFocusNoteFolderId(folder.id)}
                >
                  <Text
                    style={[styles.focusNotesFolderChipLabel, selected && styles.focusNotesFolderChipLabelActive]}
                    numberOfLines={1}
                  >
                    {(folder.title || '').trim() || 'Untitled'}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable style={styles.focusNotesFolderAddButton} onPress={addFocusNoteFolder}>
            <Text style={styles.focusNotesFolderAddLabel}>+</Text>
          </Pressable>
        </View>
        <View style={styles.focusNotesFolderTitleRow}>
          <TextInput
            style={styles.focusNotesFolderTitleInput}
            value={activeFocusNoteFolder?.title || ''}
            onChangeText={updateActiveFocusNoteFolderTitle}
            placeholder="Folder title"
            placeholderTextColor="#64748b"
          />
          <Pressable style={styles.focusNotesFolderDeleteButton} onPress={deleteActiveFocusNoteFolder}>
            <Text style={styles.focusNotesFolderDeleteLabel}>Delete</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.focusNotesInput}
          value={focusProfileNotes}
          onChangeText={updateActiveFocusNoteText}
          multiline
          textAlignVertical="top"
          placeholder="Write notes for this folder..."
          placeholderTextColor="#64748b"
        />
        <View style={styles.focusNotesFooter}>
          <Text style={styles.focusNotesMeta}>
            {focusNoteFolders.length} folders | {focusNotesTotalChars} chars
          </Text>
          <Pressable style={styles.focusNotesSaveButton} onPress={() => void saveFocusNotesToLoadedProfile()}>
            <Text style={styles.focusNotesSaveButtonLabel}>Save</Text>
          </Pressable>
        </View>
        <View
          style={styles.focusNotesResizeHandle}
          onMouseDown={handleFocusNotesResizeStart}
        >
          <View style={styles.focusNotesResizeHandleRail} />
        </View>
      </Animated.View>

      <Modal
        animationType="none"
        transparent
        visible={isSaveManagerOpen}
        onRequestClose={() => setIsSaveManagerOpen(false)}
      >
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
                    <Text style={styles.saveManagerSummaryValue}>{saveProfiles.length}</Text>
                    <Text style={styles.saveManagerSummaryLabel}>Focus profiles</Text>
                  </View>
                  <View style={styles.saveManagerSummaryCard}>
                    <Text style={styles.saveManagerSummaryValue}>{focusedItems.length}</Text>
                    <Text style={styles.saveManagerSummaryLabel}>Current Focus items</Text>
                  </View>
                  <View style={styles.saveManagerSummaryCard}>
                    <Text style={styles.saveManagerSummaryValue}>{bottleneckItems.length}</Text>
                    <Text style={styles.saveManagerSummaryLabel}>Current Bottleneck items</Text>
                  </View>
                  <View style={styles.saveManagerSummaryCard}>
                    <Text style={styles.saveManagerSummaryValue}>{leaderboard.length}</Text>
                    <Text style={styles.saveManagerSummaryLabel}>All-time leaderboard entries</Text>
                  </View>
                </View>
                <View style={styles.saveManagerActionRow}>
                  <View style={styles.saveManagerActionInfo}>
                    <Text style={styles.saveManagerSectionEyebrow}>Focus Backup</Text>
                    <Text style={styles.calendarNoteSource}>{`Export or import Focus and Bottleneck profiles as *${SAVE_PROFILES_FILE_EXTENSION}`}</Text>
                  </View>
                  <View style={styles.saveManagerButtonRow}>
                    <Pressable style={[styles.stageSecondaryButton, styles.saveManagerTopActionButton]} onPress={exportSaveProfilesData}>
                      <Text style={styles.stageSecondaryLabel}>Export Focus</Text>
                    </Pressable>
                    <Pressable style={[styles.stageSecondaryButton, styles.saveManagerTopActionButton]} onPress={() => void importSaveProfilesData()}>
                      <Text style={styles.stageSecondaryLabel}>Import Focus</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.saveManagerActionRow}>
                  <View style={styles.saveManagerActionInfo}>
                    <Text style={styles.saveManagerSectionEyebrow}>Leaderboard Backup</Text>
                    <Text style={styles.calendarNoteSource}>{`Export or import all-time leaderboard data as *${LEADERBOARD_FILE_EXTENSION}`}</Text>
                  </View>
                  <View style={styles.saveManagerButtonRow}>
                    <Pressable style={[styles.stageSecondaryButton, styles.saveManagerTopActionButton]} onPress={exportLeaderboardData}>
                      <Text style={styles.stageSecondaryLabel}>Export Leaderboard</Text>
                    </Pressable>
                    <Pressable style={[styles.stageSecondaryButton, styles.saveManagerTopActionButton]} onPress={() => void importLeaderboardData()}>
                      <Text style={styles.stageSecondaryLabel}>Import Leaderboard</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={styles.saveManagerBody}>
                <View style={styles.saveManagerComposePane}>
                  <View style={styles.saveManagerGuideCard}>
                    <Text style={styles.saveManagerSectionEyebrow}>Profile model</Text>
                    <Text style={styles.saveManagerPaneTitle}>Save Focus profiles separately</Text>
                    <View style={styles.saveManagerGuideList}>
                      <Text style={styles.saveManagerGuideStep}>Each Focus profile stores Focus items, Bottleneck items, notes, and Focus-mode leaderboard times.</Text>
                      <Text style={styles.saveManagerGuideStep}>Profiles are only changed when you explicitly create, update, import, delete, or save notes.</Text>
                      <Text style={styles.saveManagerGuideStep}>Leaderboard backups are exported, imported, and persisted separately.</Text>
                    </View>
                  </View>

                  <View style={styles.saveManagerPaneCard}>
                    <Text style={styles.saveManagerSectionEyebrow}>Current state</Text>
                    <Text style={styles.saveManagerPaneTitle}>Create or update a Focus profile</Text>
                    <Text style={styles.saveManagerPaneSubtitle}>Capture the current Focus, Bottleneck, notes, and Focus-mode times in one named profile.</Text>
                    <TextInput
                      style={styles.calendarInput}
                      placeholder="Profile name (e.g. Week 2 JLPT rebuild)"
                      placeholderTextColor="#94A3B8"
                      value={saveProfileName}
                      onChangeText={setSaveProfileName}
                    />
                    <Text style={styles.saveManagerMetaText}>Current Focus items: {focusedItems.length}</Text>
                    <Text style={styles.saveManagerMetaText}>Current Bottleneck items: {bottleneckItems.length}</Text>
                    <Text style={styles.saveManagerMetaText}>
                      Current Focus leaderboard entries: {sessionLeaderboard.filter(entry => isFocusModeKey(entry.mode)).length}
                    </Text>
                    <Text style={styles.saveManagerMetaText}>
                      Current note folders: {focusNoteFolders.length} | Notes: {focusNotesTotalChars} chars
                    </Text>
                    <Text style={styles.saveManagerMetaText}>
                      Persistent leaderboard entries: {leaderboard.filter(entry => !isFocusModeKey(entry.mode) && !isBottleneckModeKey(entry.mode)).length}
                    </Text>
                    <Text style={styles.saveManagerMetaText}>
                      {activeFocusSnapshotName ? `Loaded Focus profile: ${activeFocusSnapshotName}` : 'No Focus profile is currently loaded.'}
                    </Text>
                    <Pressable style={[styles.stagePrimaryButton, styles.saveManagerPrimaryButton]} onPress={() => void createSaveProfile()}>
                      <Text style={styles.stagePrimaryLabel}>Create Focus Profile</Text>
                    </Pressable>
                    {loadedSaveProfileId ? (
                      <Pressable style={[styles.stageSecondaryButton, styles.saveManagerPrimaryButton]} onPress={() => void updateSaveProfile(loadedSaveProfileId)}>
                        <Text style={styles.stageSecondaryLabel}>Update Loaded Focus Profile</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <View style={styles.saveManagerListPane}>
                  <View style={styles.saveManagerListHeader}>
                    <Text style={styles.saveManagerPaneTitle}>Focus profiles</Text>
                    <Text style={styles.saveManagerMetaText}>{`${saveProfiles.length} saved`}</Text>
                  </View>
                  <ScrollView style={styles.saveManagerListScroll} contentContainerStyle={styles.saveManagerListContent}>
                    {saveProfiles.length === 0 ? (
                      <Text style={styles.calendarNoteEmpty}>No Focus profiles yet.</Text>
                    ) : (
                      saveProfiles.map(profile => (
                        <View key={profile.id} style={styles.saveManagerEntryCard}>
                          <View style={styles.saveManagerEntryHeader}>
                            <View style={styles.saveManagerEntryInfo}>
                              <Text style={styles.calendarNoteBadge}>{profile.name}</Text>
                              <Text style={styles.noteListDate}>
                                Created {formatLeaderboardDateTime(profile.createdAt)} | Updated {formatLeaderboardDateTime(profile.updatedAt)}
                              </Text>
                            </View>
                            {loadedSaveProfileId === profile.id ? (
                              <Text style={styles.saveManagerActiveTag}>Loaded</Text>
                            ) : null}
                          </View>
                          <Text style={styles.calendarNoteSource}>
                            Focus items: {profile.focusItems.length} | Bottleneck items: {(profile.bottleneckItems || []).length} | Focus times: {profile.focusLeaderboard.length} | Note folders: {(profile.noteFolders || []).length} | Notes: {(profile.noteFolders || []).reduce((total, folder) => total + (folder.notes || '').length, 0)} chars
                          </Text>
                          <View style={styles.saveManagerEntryActions}>
                            <Pressable style={[styles.saveManagerEntryButton, styles.saveManagerEntryButtonPrimary]} onPress={() => void loadSaveProfile(profile)}>
                              <Text style={styles.saveManagerEntryButtonLabel}>Load Focus</Text>
                            </Pressable>
                            <Pressable style={styles.saveManagerEntryButton} onPress={() => void updateSaveProfile(profile.id)}>
                              <Text style={styles.saveManagerEntryButtonLabel}>Update</Text>
                            </Pressable>
                            <Pressable style={styles.saveManagerEntryDeleteButton} onPress={() => void deleteSaveProfile(profile.id)}>
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
      </Modal>
    </View>
  );
}

const MemoizedKanaQuizView = React.memo(KanaQuizView);

