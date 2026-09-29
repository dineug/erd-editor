import { ValuesType } from '@/internal-types';

export const PaletteScope = {
  tables: 'tables',
  columns: 'columns',
  text: 'text',
  help: 'help',
} as const;
export type PaletteScope = ValuesType<typeof PaletteScope>;

export type PalettePrefix = {
  prefix: string;
  scope: PaletteScope;
  label: string;
  description: string;
};

/** The characters that, typed first, narrow the palette to one kind of row, in the order its hint lists them. */
export const PALETTE_PREFIXES: ReadonlyArray<PalettePrefix> = [
  {
    prefix: '#',
    scope: PaletteScope.tables,
    label: 'Tables',
    description: 'Go to a table by its name',
  },
  {
    prefix: '@',
    scope: PaletteScope.columns,
    label: 'Columns',
    description: 'Go to a column by its name, or by table.column',
  },
  {
    prefix: '"',
    scope: PaletteScope.text,
    label: 'Comments & memos',
    description: 'Search table comments, column comments and memos',
  },
  {
    prefix: '?',
    scope: PaletteScope.help,
    label: 'Help',
    description: 'List the prefixes that narrow the search',
  },
];

export type PaletteQuery = {
  /** The kind of row the prefix asks for, or null with no prefix, which lists the commands. */
  scope: PaletteScope | null;
  /** What is searched for, without the prefix, the space after it or the table part. */
  keyword: string;
  /** The table part of a column search, the text before its first dot; null when it has no dot. */
  table: string | null;
};

/** What a Japanese or Chinese IME types for a prefix character, read as the character it stands for. */
const WIDE_PREFIXES: Readonly<Record<string, string>> = {
  '＃': '#',
  '＠': '@',
  '＂': '"',
  '“': '"',
  '”': '"',
  '？': '?',
};

/** The dot a column search splits on, and the full stops those IMEs type for it. */
const TABLE_DOT = /[.．。]/;

/** The quote a free text search may close on, typed plain or by those IMEs. */
const CLOSING_QUOTE = /["＂“”]$/;

const scopeOf = (value: string) => {
  const head = value.charAt(0);
  const prefix = WIDE_PREFIXES[head] ?? head;
  return PALETTE_PREFIXES.find(found => found.prefix === prefix);
};

/** The label the palette shows beside its input while a prefix narrows the list. */
export const scopeLabel = (scope: PaletteScope): string =>
  PALETTE_PREFIXES.find(prefix => prefix.scope === scope)?.label ?? '';

/** What follows a prefix, trimmed; a free text search may close on the quote it opened with. */
const readRest = (rest: string, scope: PaletteScope): string =>
  scope === PaletteScope.text
    ? rest.trim().replace(CLOSING_QUOTE, '').trim()
    : rest.trim();

/**
 * Reads what is typed into the palette: a prefix counts only as the first
 * character past any space, in its full-width form too, a space may follow it,
 * and a column search splits on its first dot.
 *
 * @example
 * parsePaletteQuery('@users.em'); // { scope: 'columns', keyword: 'em', table: 'users' }
 * parsePaletteQuery('"login email"'); // { scope: 'text', keyword: 'login email', table: null }
 */
export function parsePaletteQuery(value: string): PaletteQuery {
  // A space typed before a prefix never hides it: read as a keyword, it would
  // be offered to the prefix rows, which type a second prefix before it.
  const typed = value.trimStart();
  const found = scopeOf(typed);
  if (!found) return { scope: null, keyword: typed.trimEnd(), table: null };

  const { scope } = found;
  // Every prefix, full-width or not, is one character.
  const rest = readRest(typed.slice(1), scope);
  const dot = scope === PaletteScope.columns ? rest.search(TABLE_DOT) : -1;

  return dot === -1
    ? { scope, keyword: rest, table: null }
    : {
        scope,
        keyword: rest.slice(dot + 1).trim(),
        table: rest.slice(0, dot).trim(),
      };
}
