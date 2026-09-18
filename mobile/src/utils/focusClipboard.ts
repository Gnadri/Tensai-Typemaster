type FocusCharacter = { id?: string; kana?: string };

export const MAX_FOCUS_CLIPBOARD_LENGTH = 50_000;

const normalizeCharacter = (value: string) => value.trim().normalize('NFC');

/** Keep the existing desktop Copy Focus format: one unique prompt per line. */
export const formatFocusClipboard = (items: readonly FocusCharacter[]) =>
  [...new Set(items.map(item => normalizeCharacter(item.kana || '')).filter(Boolean))]
    .join('\n');

/** Resolve pasted prompts against the built-in lessons, preserving their answers. */
export function parseFocusClipboard<T extends FocusCharacter>(
  text: string,
  catalog: readonly { value: string; dataset: readonly T[] }[],
  existingItems: readonly FocusCharacter[] = [],
) {
  if (!text.trim()) {
    throw new Error('Paste Focus characters first. Copy Focus from either app to get a compatible list.');
  }
  if (text.length > MAX_FOCUS_CLIPBOARD_LENGTH) {
    throw new Error('This list is too long. Paste up to 50,000 characters at a time.');
  }

  const lookup = new Map<string, { key: string; sourceMode: string; item: T }>();
  for (const mode of catalog) {
    if (mode.value === 'focus' || mode.value === 'bottleneck') continue;
    for (const item of mode.dataset) {
      const character = normalizeCharacter(item.kana || '');
      if (character && !lookup.has(character)) {
        lookup.set(character, {
          key: `${mode.value}:${item.id || character}`,
          sourceMode: mode.value,
          item,
        });
      }
    }
  }

  const tokens = text.normalize('NFC').trim().split(/[\s,;\u3001\uff0c\uff1b]+/u).filter(Boolean);
  if (!tokens.length) throw new Error('Paste at least one Focus character.');
  const unknown: string[] = [];
  const characters: string[] = [];
  for (const token of tokens) {
    if (lookup.has(token)) {
      characters.push(token);
      continue;
    }
    // Also accept a run of known characters without separators.
    const parts = Array.from(token);
    if (parts.every(part => lookup.has(part))) characters.push(...parts);
    else unknown.push(token);
  }
  if (unknown.length) {
    const preview = [...new Set(unknown)].slice(0, 5).map(token => token.slice(0, 24)).join(', ');
    throw new Error(`Unrecognized Focus characters: ${preview}. Use characters from the app's lessons. Nothing was imported.`);
  }

  const seen = new Set(existingItems.map(item => normalizeCharacter(item.kana || '')).filter(Boolean));
  const entries: Array<{ key: string; sourceMode: string; item: T }> = [];
  let duplicateCount = 0;
  for (const character of characters) {
    if (seen.has(character)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(character);
    entries.push(lookup.get(character)!);
  }
  return { entries, duplicateCount, totalCount: characters.length };
}
