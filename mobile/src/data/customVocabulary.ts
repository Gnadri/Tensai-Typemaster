export type CustomVocabularyItem = {
  id: string;
  kana: string;
  reading: string;
  answers: string[];
  meanings: string[];
  onyomi?: string[];
  kunyomi?: string[];
};

// Whole-word readings: these are vocabulary, rather than individual kanji readings.
export const CUSTOM_C1_COLOURS: CustomVocabularyItem[] = [
  { id: 'custom_c1_colours_iro', kana: '色', reading: 'いろ', answers: ['iro'], meanings: ['colour', 'color'] },
  { id: 'custom_c1_colours_aka', kana: '赤', reading: 'あか', answers: ['aka'], meanings: ['red'] },
  { id: 'custom_c1_colours_ao', kana: '青', reading: 'あお', answers: ['ao'], meanings: ['blue'] },
  { id: 'custom_c1_colours_kiiro', kana: '黄色', reading: 'きいろ', answers: ['kiiro'], meanings: ['yellow'] },
  { id: 'custom_c1_colours_midori', kana: '緑', reading: 'みどり', answers: ['midori'], meanings: ['green'] },
  { id: 'custom_c1_colours_kuro', kana: '黒', reading: 'くろ', answers: ['kuro'], meanings: ['black'] },
  { id: 'custom_c1_colours_shiro', kana: '白', reading: 'しろ', answers: ['shiro'], meanings: ['white'] },
  { id: 'custom_c1_colours_chairo', kana: '茶色', reading: 'ちゃいろ', answers: ['chairo'], meanings: ['brown'] },
  { id: 'custom_c1_colours_murasaki', kana: '紫', reading: 'むらさき', answers: ['murasaki'], meanings: ['purple'] },
  { id: 'custom_c1_colours_pinku', kana: 'ピンク', reading: 'ピンク', answers: ['pinku'], meanings: ['pink'] },
  { id: 'custom_c1_colours_orenji', kana: 'オレンジ', reading: 'オレンジ', answers: ['orenji'], meanings: ['orange'] },
  { id: 'custom_c1_colours_haiiro', kana: '灰色', reading: 'はいいろ', answers: ['haiiro'], meanings: ['grey', 'gray'] },
  { id: 'custom_c1_colours_kiniro', kana: '金色', reading: 'きんいろ', answers: ['kiniro', 'konjiki'], meanings: ['gold', 'golden'] },
  { id: 'custom_c1_colours_giniro', kana: '銀色', reading: 'ぎんいろ', answers: ['giniro'], meanings: ['silver'] },
  { id: 'custom_c1_colours_mizuiro', kana: '水色', reading: 'みずいろ', answers: ['mizuiro'], meanings: ['light blue'] },
  { id: 'custom_c1_colours_koniro', kana: '紺色', reading: 'こんいろ', answers: ['koniro'], meanings: ['navy blue', 'navy'] },
  { id: 'custom_c1_colours_momoiro', kana: '桃色', reading: 'ももいろ', answers: ['momoiro'], meanings: ['pink', 'peach pink'] },
  { id: 'custom_c1_colours_kimidori', kana: '黄緑', reading: 'きみどり', answers: ['kimidori'], meanings: ['yellow green'] },
  { id: 'custom_c1_colours_beeju', kana: 'ベージュ', reading: 'ベージュ', answers: ['beeju', 'beju'], meanings: ['beige'] },
  { id: 'custom_c1_colours_toumei', kana: '透明', reading: 'とうめい', answers: ['toumei', 'tomei'], onyomi: ['toumei', 'tomei'], meanings: ['transparent', 'transparency'] },
  { id: 'custom_c1_colours_niji', kana: '虹', reading: 'にじ', answers: ['niji'], meanings: ['rainbow'] },
  { id: 'custom_c1_colours_shikisai', kana: '色彩', reading: 'しきさい', answers: ['shikisai'], onyomi: ['shikisai'], meanings: ['colour', 'color', 'colouring', 'coloring'] },
  { id: 'custom_c1_colours_koi', kana: '濃い', reading: 'こい', answers: ['koi'], kunyomi: ['koi'], meanings: ['dark', 'deep', 'intense'] },
  { id: 'custom_c1_colours_usui', kana: '薄い', reading: 'うすい', answers: ['usui'], kunyomi: ['usui'], meanings: ['light', 'pale', 'faint'] },
  { id: 'custom_c1_colours_karafuru', kana: 'カラフル', reading: 'カラフル', answers: ['karafuru'], meanings: ['colourful', 'colorful'] },
];

export const CUSTOM_C1_2_CALENDAR: CustomVocabularyItem[] = [
  { id: 'custom_c1_2_calendar_monday', kana: '月曜日', reading: 'げつようび', answers: ['getsuyoubi', 'getsuyobi'], meanings: ['Monday'] },
  { id: 'custom_c1_2_calendar_tuesday', kana: '火曜日', reading: 'かようび', answers: ['kayoubi', 'kayobi'], meanings: ['Tuesday'] },
  { id: 'custom_c1_2_calendar_wednesday', kana: '水曜日', reading: 'すいようび', answers: ['suiyoubi', 'suiyobi'], meanings: ['Wednesday'] },
  { id: 'custom_c1_2_calendar_thursday', kana: '木曜日', reading: 'もくようび', answers: ['mokuyoubi', 'mokuyobi'], meanings: ['Thursday'] },
  { id: 'custom_c1_2_calendar_friday', kana: '金曜日', reading: 'きんようび', answers: ['kinyoubi', 'kinyobi'], meanings: ['Friday'] },
  { id: 'custom_c1_2_calendar_saturday', kana: '土曜日', reading: 'どようび', answers: ['doyoubi', 'doyobi'], meanings: ['Saturday'] },
  { id: 'custom_c1_2_calendar_sunday', kana: '日曜日', reading: 'にちようび', answers: ['nichiyoubi', 'nichiyobi'], meanings: ['Sunday'] },
  { id: 'custom_c1_2_calendar_january', kana: '一月', reading: 'いちがつ', answers: ['ichigatsu'], meanings: ['January'] },
  { id: 'custom_c1_2_calendar_february', kana: '二月', reading: 'にがつ', answers: ['nigatsu'], meanings: ['February'] },
  { id: 'custom_c1_2_calendar_march', kana: '三月', reading: 'さんがつ', answers: ['sangatsu'], meanings: ['March'] },
  { id: 'custom_c1_2_calendar_april', kana: '四月', reading: 'しがつ', answers: ['shigatsu'], meanings: ['April'] },
  { id: 'custom_c1_2_calendar_may', kana: '五月', reading: 'ごがつ', answers: ['gogatsu'], meanings: ['May'] },
  { id: 'custom_c1_2_calendar_june', kana: '六月', reading: 'ろくがつ', answers: ['rokugatsu'], meanings: ['June'] },
  { id: 'custom_c1_2_calendar_july', kana: '七月', reading: 'しちがつ', answers: ['shichigatsu', 'nanagatsu'], meanings: ['July'] },
  { id: 'custom_c1_2_calendar_august', kana: '八月', reading: 'はちがつ', answers: ['hachigatsu'], meanings: ['August'] },
  { id: 'custom_c1_2_calendar_september', kana: '九月', reading: 'くがつ', answers: ['kugatsu'], meanings: ['September'] },
  { id: 'custom_c1_2_calendar_october', kana: '十月', reading: 'じゅうがつ', answers: ['juugatsu', 'jugatsu'], meanings: ['October'] },
  { id: 'custom_c1_2_calendar_november', kana: '十一月', reading: 'じゅういちがつ', answers: ['juuichigatsu', 'juichigatsu'], meanings: ['November'] },
  { id: 'custom_c1_2_calendar_december', kana: '十二月', reading: 'じゅうにがつ', answers: ['juunigatsu', 'junigatsu'], meanings: ['December'] },
  { id: 'custom_c1_2_calendar_calendar', kana: 'カレンダー', reading: 'カレンダー', answers: ['karendaa', 'karenda'], meanings: ['calendar'] },
  { id: 'custom_c1_2_calendar_weekday', kana: '曜日', reading: 'ようび', answers: ['youbi', 'yobi'], meanings: ['day of the week'] },
  { id: 'custom_c1_2_calendar_week', kana: '週', reading: 'しゅう', answers: ['shuu', 'shu'], meanings: ['week'] },
  { id: 'custom_c1_2_calendar_month', kana: '月', reading: 'つき', answers: ['tsuki'], meanings: ['month', 'moon'] },
  { id: 'custom_c1_2_calendar_year', kana: '年', reading: 'とし', answers: ['toshi', 'nen'], meanings: ['year'] },
  { id: 'custom_c1_2_calendar_today', kana: '今日', reading: 'きょう', answers: ['kyou', 'kyo'], meanings: ['today'] },
];

export const CUSTOM_SECTIONS = ['C1', 'C2', 'C3', 'C4', 'C5'] as const;

export const CUSTOM_QUIZ_MODES = [
  { value: 'custom_c1_colours', label: 'C1-1 Colours', tabLabel: 'C1-1 Colours', family: 'custom', section: 'C1', dataset: CUSTOM_C1_COLOURS },
  { value: 'custom_c1_2_calendar', label: 'C1-2 Calendar', tabLabel: 'C1-2 Calendar', family: 'custom', section: 'C1', dataset: CUSTOM_C1_2_CALENDAR },
  ...CUSTOM_SECTIONS.slice(1).map(section => ({
    value: `custom_${section.toLowerCase()}`,
    label: section,
    tabLabel: section,
    family: 'custom',
    section,
    dataset: [] as CustomVocabularyItem[],
  })),
];

export const isCustomQuizMode = (mode: string) => mode.startsWith('custom_');
