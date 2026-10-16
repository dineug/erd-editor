const SEPARATORS = ['-', '_'] as const;

const hasCase = (text: string) => text.toUpperCase() !== text.toLowerCase();

/** The separator both texts split into as many pieces by, where only one of the two does. */
function pieceSeparator(matched: string, replacement: string): string | null {
  const splits = SEPARATORS.filter(
    separator =>
      matched.includes(separator) &&
      replacement.includes(separator) &&
      matched.split(separator).length === replacement.split(separator).length
  );
  return splits.length === 1 ? splits[0] : null;
}

/** One piece cased after one: all upper, all lower, or by its first letter. */
function caseLike(matched: string, replacement: string): string {
  if (!matched || !replacement || !hasCase(matched)) return replacement;
  if (matched === matched.toUpperCase()) return replacement.toUpperCase();
  if (matched === matched.toLowerCase()) return replacement.toLowerCase();

  const [first] = matched;
  if (!hasCase(first)) return replacement;

  const [lead] = replacement;
  const rest = replacement.slice(lead.length);
  return first === first.toUpperCase()
    ? lead.toUpperCase() + rest
    : lead.toLowerCase() + rest;
}

/**
 * The replacement cased the way the text it replaces is, as VS Code's Preserve
 * Case does: all upper, all lower or by the first letter, and piece by piece
 * across the hyphens or the underscores both split into as many pieces by.
 *
 * @example
 * preserveCase('USER_ID', 'account_key'); // 'ACCOUNT_KEY'
 */
export function preserveCase(matched: string, replacement: string): string {
  const separator = pieceSeparator(matched, replacement);
  if (!separator) return caseLike(matched, replacement);

  const pieces = matched.split(separator);
  return replacement
    .split(separator)
    .map((piece, index) => caseLike(pieces[index], piece))
    .join(separator);
}
