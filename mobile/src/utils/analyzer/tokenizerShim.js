import { Platform } from 'react-native';

let cachedSegmenter;

const normalizeToken = (token, index, text) => {
  if (token && typeof token === 'object') {
    const surface = token.surface ?? token.text ?? '';
    const start = Number.isFinite(token.start) ? token.start : index;
    const end = Number.isFinite(token.end) ? token.end : Math.min(text.length, start + surface.length || 1);

    return {
      surface,
      start,
      end,
      partOfSpeech: token.partOfSpeech ?? token.pos ?? null,
      reading: token.reading ?? null,
    };
  }

  const surface = String(token ?? text[index] ?? '');
  return {
    surface,
    start: index,
    end: Math.min(text.length, index + surface.length || 1),
    partOfSpeech: null,
    reading: null,
  };
};

const getSegmenter = (locale = 'ja') => {
  if (!cachedSegmenter && typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    try {
      cachedSegmenter = new Intl.Segmenter(locale, { granularity: 'word' });
    } catch (error) {
      console.warn('[tokenizerShim] Failed to create Intl.Segmenter fallback', error);
    }
  }

  return cachedSegmenter ?? null;
};

const tokenizeWithSegmenter = (text, locale) => {
  const segmenter = getSegmenter(locale);
  if (!segmenter) {
    return null;
  }

  const segments = segmenter.segment(text);
  const tokens = [];

  for (const segment of segments) {
    if (!segment.isWordLike || !segment.segment) {
      continue;
    }

    tokens.push(
      normalizeToken(
        {
          surface: segment.segment,
          start: segment.index,
          end: segment.index + segment.segment.length,
        },
        tokens.length,
        text,
      ),
    );
  }

  return tokens;
};

const tokenizeByCodePoint = (text) => {
  const tokens = [];
  let index = 0;

  for (const char of Array.from(text)) {
    tokens.push(
      normalizeToken(
        {
          surface: char,
          start: index,
          end: index + char.length,
        },
        tokens.length,
        text,
      ),
    );
    index += char.length;
  }

  return tokens;
};

export const isNativeTokenizerAvailable = false;

export const ensureTokenizerReady = async () => {
  // Nothing to initialize for the JS fallbacks.
  return false;
};

export const tokenize = async (text, options = {}) => {
  if (typeof text !== 'string') {
    throw new TypeError('tokenize() expects the first argument to be a string');
  }

  if (!text.length) {
    return [];
  }

  const locale = options.locale || 'ja';

  const segmenterTokens = tokenizeWithSegmenter(text, locale);
  if (segmenterTokens?.length) {
    return segmenterTokens;
  }

  return tokenizeByCodePoint(text);
};

export default {
  tokenize,
  ensureTokenizerReady,
  isNativeTokenizerAvailable,
};
