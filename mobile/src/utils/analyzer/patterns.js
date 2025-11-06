// JLPT levels and ordering
export const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
export const ORDER = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };

// Storage key used by App.jsx (so imports won't fail)
export const STORAGE_KEY = "jlpt_builder_state_v2";

// Particle variety regex (used by analyzer)
export const PARTICLE_REGEX =
  /は|(?<![一-龯ぁ-ゟ゠ゞァ-ヿ])が(?!た|っ|る)|を|に|で|へ|と|も|から|まで|より|ので|のに|けど|そして|しかし|それで|それに|また/g;

// JLPT Grammar Patterns (curated, lightweight)
// level: 1=N5 … 5=N1
// weight: contribution when used at/under target level
// maxHits: cap repeat scoring per pattern
export const PATTERNS = [
  // N5
  { level: 1, name: "です／ます", re: /(です|ます)(?!か)/g, weight: 6, maxHits: 2, tip: "丁寧形を使う" },
  { level: 1, name: "疑問 〜か", re: /か(?:(?:。|！|？|\?|$))/g, weight: 5, maxHits: 1, tip: "文末に か" },
  { level: 1, name: "所有 の", re: /[一-龯ぁ-ゟ゠ゞァ-ヿ]\s*の\s*[一-龯ぁ-ゟ゠ゞァ-ヿ]/g, weight: 4, maxHits: 2 },
  { level: 1, name: "希望 〜たい", re: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]{2,}たい(です)?/gu, weight: 5, maxHits: 1 },
  { level: 1, name: "接続 〜て", re: /[てで](?=[一-龯ぁ-ゟ゠ゞァ-ヿ])/g, weight: 3, maxHits: 3 },
  { level: 1, name: "理由 〜から", re: /から/g, weight: 4, maxHits: 2 },

  // N4
  { level: 2, name: "並列 〜たり〜たり", re: /たり[一-龯ぁ-ゟ゠ゞァ-ヿ]{0,6}たり/g, weight: 7, maxHits: 1 },
  { level: 2, name: "同時 〜ながら", re: /ながら/g, weight: 5, maxHits: 1 },
  { level: 2, name: "引用 〜と思う", re: /と思[うい]/g, weight: 5, maxHits: 2 },
  { level: 2, name: "推量 〜かもしれない", re: /かもしれない/g, weight: 6, maxHits: 1 },
  { level: 2, name: "否定手段 〜ないで", re: /ないで/g, weight: 5, maxHits: 1 },
  { level: 2, name: "理由 〜ので", re: /ので/g, weight: 5, maxHits: 2 },
  { level: 2, name: "比較 より／ほど", re: /(より|ほど)/g, weight: 4, maxHits: 2 },

  // N3
  { level: 3, name: "目的/結果 〜ように", re: /ように(する|なる)?/g, weight: 6, maxHits: 2 },
  { level: 3, name: "完了/残念 〜てしまう", re: /てしま[うった]/g, weight: 6, maxHits: 1 },
  { level: 3, name: "受身/可能/使役", re: /(られる|させる)(?=(?:。|、|[一-龯ぁ-ゟ゠ゞァ-ヿ]))/g, weight: 7, maxHits: 2 },
  { level: 3, name: "推定 〜らしい/みたい", re: /(らしい|みたい)/g, weight: 5, maxHits: 2 },
  { level: 3, name: "当然 〜はずだ", re: /はずだ/g, weight: 5, maxHits: 1 },
  { level: 3, name: "原因 〜おかげで/せいで", re: /(おかげで|せいで)/g, weight: 5, maxHits: 1 },

  // N2
  { level: 4, name: "同時 〜つつ", re: /つつ/g, weight: 7, maxHits: 1 },
  { level: 4, name: "確信 〜に違いない", re: /に違いない/g, weight: 8, maxHits: 1 },
  { level: 4, name: "悪結果 〜かねない", re: /かねない/g, weight: 8, maxHits: 1 },
  { level: 4, name: "範囲拡張 〜に限らず", re: /に限らず/g, weight: 7, maxHits: 1 },
  { level: 4, name: "程度 〜にすぎない", re: /にすぎない/g, weight: 7, maxHits: 1 },
  { level: 4, name: "傾向 〜一方だ", re: /一方だ/g, weight: 7, maxHits: 1 },
  { level: 4, name: "条件後 〜上で", re: /上で/g, weight: 6, maxHits: 1 },
  { level: 4, name: "議論 〜をめぐって", re: /をめぐって/g, weight: 7, maxHits: 1 },

  // N1
  { level: 5, name: "不要 〜までもない", re: /までもない/g, weight: 9, maxHits: 1 },
  { level: 5, name: "不適 〜にたえない", re: /にたえない/g, weight: 9, maxHits: 1 },
  { level: 5, name: "目的 〜んがため", re: /んがため(に)?/g, weight: 10, maxHits: 1 },
  { level: 5, name: "特別 〜とあって", re: /とあって/g, weight: 9, maxHits: 1 },
  { level: 5, name: "列挙 〜であれ…であれ", re: /であれ.*であれ/g, weight: 10, maxHits: 1 },
  { level: 5, name: "不可能 〜べくもない", re: /べくもない/g, weight: 10, maxHits: 1 },
  { level: 5, name: "部分否定 〜ないものでもない", re: /ないものでもない/g, weight: 10, maxHits: 1 },
  { level: 5, name: "兼用 〜かたがた", re: /かたがた/g, weight: 9, maxHits: 1 },
  { level: 5, name: "過剰反応 〜には当たらない", re: /には当たらない/g, weight: 9, maxHits: 1 },
  { level: 5, name: "理由 〜ゆえに", re: /ゆえに/g, weight: 9, maxHits: 1 },
];
