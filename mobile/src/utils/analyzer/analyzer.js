import { PATTERNS, ORDER, PARTICLE_REGEX } from './patterns';
import { tokenize as kuTokenize } from './kuromoji';

const CONNECTIVE_PARTICLES = new Set([
  'て', 'で', 'が', 'けど', 'けれど', 'ので', 'し', 'から', 'と', 'たり', 'ながら', 'のに', 'とか', 'つつ',
]);

const SENTENCE_PARTICLE_WHITELIST = new Set(['ね', 'な', 'よ', 'よね', 'か', 'かな', 'ぞ', 'ぜ', 'さ', 'でしょう', 'だよ']);

const PARTICLE_COMBO_WHITELIST = new Set([
  'では', 'には', 'として', 'までは', 'からは', 'でも', 'ので', 'のに', 'とも', 'たり', 'とは', 'への', 'にも',
]);

const MAX_VOCAB_COLLECTIVE_BONUS = 50;

export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export function countKanji(s) {
  return (String(s).match(/[\u4E00-\u9FFF]/g) || []).length;
}

export function countCharsJP(s) {
  return (String(s).match(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/gu) || []).length;
}

export function analyzeSentence(input, level, mode = 'sentence', targetKanji = [], vocabEnabled = false) {
  const text = String(input || '').trim();
  if (!text) return baseAnalyze('', level, mode, null, targetKanji, vocabEnabled);
  return baseAnalyze(text, level, mode, null, targetKanji, vocabEnabled);
}

export async function analyzeSentenceAsync(input, level, mode = 'sentence', targetKanji = [], vocabEnabled = false) {
  const text = String(input || '').trim();
  if (!text) return baseAnalyze('', level, mode, null, targetKanji, vocabEnabled);

  let tokens = null;
  try {
    tokens = await kuTokenize(text);
  } catch (_) {
    tokens = null;
  }

  return baseAnalyze(text, level, mode, tokens, targetKanji, vocabEnabled);
}

function baseAnalyze(text, level, mode, tokens, targetKanji, vocabEnabled) {
  const lvl = ORDER[level] || 1;
  const strictOverlevel = mode === 'story';

  let points = 0;
  const hits = [];
  const over = [];

  for (const pattern of PATTERNS) {
    const matches = text.match(pattern.re) || [];
    if (!matches.length) continue;

    const count = Math.min(matches.length, pattern.maxHits || 1);
    const value = count * pattern.weight;

    if (pattern.level <= lvl) {
      points += value;
      hits.push({ name: pattern.name, count, worth: value, level: pattern.level });
    } else {
      const penalty = strictOverlevel ? Math.min(value * 0.8, 12) : 0;
      points -= penalty;
      over.push({ name: pattern.name, count, penalty, level: pattern.level });
    }
  }

  const particleInfo = scoreParticles(text, tokens);
  points += particleInfo.particleBonus;

  const clauseJoins = scoreClauses(text, tokens, mode);

  const charCount = countCharsJP(text);
  const kanji = countKanji(text);

  let complexity = 0;
  complexity += Math.min(charCount / 6, 10);
  complexity += Math.min(clauseJoins * 3.5, 14);

  const kanjiCapByLevel = [0, 6, 9, 12, 15, 18][lvl];
  complexity += Math.min(kanji * 1.2, kanjiCapByLevel);

  const levelComplexityCap = [0, 22, 26, 30, 34, 38][lvl];
  complexity = Math.min(complexity, levelComplexityCap);
  points += complexity;

  const vocabInfo = scoreVocab(text, targetKanji, vocabEnabled);
  points += vocabInfo.bonus;

  const mistakeInfo = evaluateMistakes(text, tokens, mode);
  points -= mistakeInfo.totalPenalty;

  if (mode === 'story') {
    const narrativeBonus = Math.min(Math.max(charCount - 32, 0) * 0.4, 12);
    points += narrativeBonus;
  }

  if (/[A-Za-z]/.test(text)) points -= 4;
  if (text.length && text.length < 4) points -= 3;

  let rawScore = points;
  if (mode === 'sentence') {
    rawScore = points * 1.15 + 8;
  }

  let score = clamp(Math.round(rawScore), 0, 100);
  if (mode === 'story') {
    const flowBonus = Math.min(clauseJoins * 1.2, 8);
    score = clamp(score + Math.round(flowBonus), 0, 100);
  }

  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D';

  const inLevel = PATTERNS.filter(p => p.level <= lvl);
  const usedNames = new Set(hits.map(h => h.name));
  const suggestions = inLevel
    .filter(p => !usedNames.has(p.name))
    .slice(0, 4)
    .map(p => `Add ${p.name}${p.tip ? ' (' + p.tip + ')' : ''}`);

  return {
    mode,
    score,
    grade,
    hits: hits.sort((a, b) => b.worth - a.worth),
    over,
    particleBonus: particleInfo.particleBonus,
    uniqueParticles: particleInfo.uniqueParticles,
    charCount,
    kanji,
    clauseJoins,
    complexity: Math.round(complexity),
    penalties: mistakeInfo.issues,
    penaltyTotal: mistakeInfo.totalPenalty,
    vocab: vocabInfo,
    suggestions,
    tokens: Array.isArray(tokens) ? tokens : [],
  };
}

function scoreParticles(text, tokens) {
  if (Array.isArray(tokens) && tokens.length > 0) {
    const parts = tokens
      .filter(t => t && t.pos === '助詞')
      .map(t => (t.basic_form && t.basic_form !== '*' ? t.basic_form : t.surface_form));
    const unique = Array.from(new Set(parts));
    return {
      uniqueParticles: unique,
      particleBonus: Math.min(unique.length, 6) * 3,
    };
  }

  const matches = text.match(PARTICLE_REGEX) || [];
  const unique = Array.from(new Set(matches));
  return {
    uniqueParticles: unique,
    particleBonus: Math.min(unique.length, 6) * 3,
  };
}

function scoreClauses(text, tokens, mode) {
  let joins = 0;

  if (Array.isArray(tokens) && tokens.length > 0) {
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token) continue;
      const base = token.basic_form && token.basic_form !== '*' ? token.basic_form : token.surface_form;

      if (token.pos === '助詞' && CONNECTIVE_PARTICLES.has(base)) joins++;

      if ((token.surface_form === 'て' || token.surface_form === 'で') && tokens[i + 1]) {
        const next = tokens[i + 1];
        const nextBase = next.basic_form && next.basic_form !== '*' ? next.basic_form : next.surface_form;
        if (nextBase === 'いる') joins++;
      }
    }
    joins += (text.match(/、/g) || []).length;
  } else {
    const connectiveRegex = /(て|で|が|けど|けれど|ので|し|から|と|たり|ながら|のに|とか|つつ)/g;
    joins += (text.match(connectiveRegex) || []).length;
    joins += (text.match(/、/g) || []).length;
  }

  if (mode === 'story') {
    joins += Math.min(Math.floor(Math.max(text.length - 40, 0) / 20), 4);
  }

  return joins;
}

function scoreVocab(text, targetKanji, vocabEnabled) {
  const targets = Array.isArray(targetKanji)
    ? Array.from(new Set(targetKanji.filter(k => typeof k === 'string' && k.length === 1)))
    : [];

  if (!targets.length) {
    return { bonus: 0, targets: 0, used: [], missing: [], total: 0 };
  }

  const present = new Set(Array.from(text));
  const used = targets.filter(k => present.has(k));
  const missing = targets.filter(k => !present.has(k));
  const usedCount = used.length;

  if (!vocabEnabled || usedCount === 0) {
    return {
      bonus: 0,
      targets: targets.length,
      used,
      missing,
      total: 0,
    };
  }

  const perTargetShare = targets.length
    ? Math.max(6, Math.round(MAX_VOCAB_COLLECTIVE_BONUS / Math.max(targets.length, 1)))
    : MAX_VOCAB_COLLECTIVE_BONUS;

  let collectiveBonus = perTargetShare * usedCount;

  if (usedCount === targets.length) {
    collectiveBonus += 10;
  }

  collectiveBonus = Math.min(collectiveBonus, MAX_VOCAB_COLLECTIVE_BONUS);
  const distributedBonus = collectiveBonus / usedCount;

  return {
    bonus: distributedBonus,
    targets: targets.length,
    used,
    missing,
    total: collectiveBonus,
  };
}

function evaluateMistakes(text, tokens, mode) {
  const issues = [];

  if (!Array.isArray(tokens) || tokens.length === 0) {
    if (/て$|で$/.test(text)) {
      issues.push({ code: 'dangling-te', message: 'Sentence ends with 「〜て／〜で」; clause appears incomplete.', penalty: 4 });
    }
    return applyPenaltyCompounding(issues, mode);
  }

  const lastToken = tokens[tokens.length - 1];
  const lastBase = lastToken && lastToken.basic_form && lastToken.basic_form !== '*' ? lastToken.basic_form : lastToken.surface_form;
  if (lastToken && lastToken.pos === '助詞' && !SENTENCE_PARTICLE_WHITELIST.has(lastBase)) {
    issues.push({ code: 'ending-particle', message: `Sentence ends with particle 「${lastToken.surface_form}」`, penalty: 6 });
  }

  let particleRun = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    if (token.pos === '助詞') {
      particleRun += 1;
      if (particleRun > 1) {
        const prev = tokens[i - 1];
        const combo = `${prev.surface_form}${token.surface_form}`;
        if (!PARTICLE_COMBO_WHITELIST.has(combo)) {
          issues.push({ code: 'double-particle', message: `Unexpected particle sequence 「${combo}」`, penalty: 5 });
        }
      }
    } else {
      particleRun = 0;
    }

    if (token.surface_form === 'て' || token.surface_form === 'で') {
      const next = tokens[i + 1];
      const nextIsVerb = next && (next.pos === '動詞' || next.pos === '助動詞');
      if (!nextIsVerb) {
        issues.push({ code: 'dangling-te', message: 'Clause ending 「〜て／〜で」 without continuation.', penalty: 4 });
      }
    }
  }

  const hasPolite = tokens.some(t => t && t.basic_form === 'ます');
  const hasPlainCopula = tokens.some(t => t && (t.basic_form === 'だ' || t.surface_form === 'だ'));
  if (hasPolite && hasPlainCopula) {
    issues.push({ code: 'mixed-register', message: 'Mixing polite (〜ます) and plain (〜だ) forms.', penalty: 5 });
  }

  return applyPenaltyCompounding(issues, mode);
}

function applyPenaltyCompounding(rawIssues, mode) {
  if (rawIssues.length === 0) {
    return { totalPenalty: 0, issues: [] };
  }

  const factor = mode === 'story' ? 1.18 : 1.35;
  const sorted = [...rawIssues].sort((a, b) => b.penalty - a.penalty);

  let total = 0;
  const compounded = sorted.map((issue, index) => {
    const applied = Math.round(issue.penalty * Math.pow(factor, index));
    total += applied;
    return { ...issue, appliedPenalty: applied };
  });

  return { totalPenalty: total, issues: compounded };
}
