import { formatFocusClipboard, parseFocusClipboard } from '../mobile/src/utils/focusClipboard';

const catalog = [
  { value: 'hiragana', dataset: [{ id: 'ka', kana: 'か', answers: ['ka'] }, { id: 'ga', kana: 'が', answers: ['ga'] }] },
  { value: 'katakana', dataset: [{ id: 'ka', kana: 'カ', answers: ['ka'] }] },
  { value: 'jlpt_n5', dataset: [{ id: 'sun', kana: '日', answers: ['nichi'], onyomi: ['ニチ'] }, { id: 'moon', kana: '月', answers: ['getsu'] }] },
  { value: 'jlpt_n4', dataset: [{ id: 'sun-again', kana: '日', answers: ['jitsu'] }, { id: 'japan', kana: '日本', answers: ['nihon'] }] },
];

describe('Focus clipboard transfer', () => {
  it('round-trips the existing desktop newline format and preserves canonical readings', () => {
    const text = formatFocusClipboard([catalog[0].dataset[0], catalog[1].dataset[0], catalog[2].dataset[0]]);
    expect(text).toBe('か\nカ\n日');
    const result = parseFocusClipboard(text, catalog);
    expect(result.entries.map(entry => entry.sourceMode)).toEqual(['hiragana', 'katakana', 'jlpt_n5']);
    expect(result.entries[2].item).toEqual(catalog[2].dataset[0]);
    expect(result.entries[2].key).toBe('jlpt_n5:sun');
  });

  it('handles CRLF, pasted lists, contiguous characters, and decomposed dakuten', () => {
    const result = parseFocusClipboard('\uFEFFか\r\nカ、日月;か\u3099', catalog);
    expect(result.entries.map(entry => entry.item.kana)).toEqual(['か', 'カ', '日', '月', 'が']);
  });

  it('matches a whole known compound before splitting into individual characters', () => {
    expect(parseFocusClipboard('日本', catalog).entries[0].item.answers).toEqual(['nihon']);
  });

  it('does not duplicate existing or repeated prompts, including another lesson source', () => {
    const existing = [{ kana: '日' }];
    const result = parseFocusClipboard('日\n日\nカ\nカ', catalog, existing);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].item.kana).toBe('カ');
    expect(result.duplicateCount).toBe(3);
    expect(existing).toEqual([{ kana: '日' }]);
    expect(formatFocusClipboard([{ kana: '日' }, { kana: '日' }, {}])).toBe('日');
  });

  it('rejects unknown input as a whole without changing existing Focus items', () => {
    const existing = [{ kana: '月' }];
    expect(() => parseFocusClipboard('か\nnot-a-prompt', catalog, existing)).toThrow('Nothing was imported');
    expect(existing).toEqual([{ kana: '月' }]);
  });

  it('rejects empty, delimiter-only, and oversized clipboard contents', () => {
    expect(() => parseFocusClipboard(' \r\n', catalog)).toThrow('Paste Focus characters first');
    expect(() => parseFocusClipboard(',;、', catalog)).toThrow('at least one');
    expect(() => parseFocusClipboard('日'.repeat(50_001), catalog)).toThrow('too long');
  });
});
