import { query } from '@dineug/erd-editor-schema';

import { RootState } from '@/engine/state';

import { FindField, FindMatch } from './findMatches';

export const FindFieldLabel: Record<FindField, string> = {
  [FindField.tableName]: 'Table',
  [FindField.tableComment]: 'Table comment',
  [FindField.columnName]: 'Column',
  [FindField.columnComment]: 'Column comment',
  [FindField.memo]: 'Memo',
};

const nameOf = (name: string | undefined) => name?.trim() || 'unnamed';

/**
 * Where a match sits, as a reader finds it on the canvas: the table, or the
 * table and column, and nothing for a memo, which has no name.
 */
export function locationOf(
  { collections }: RootState,
  { field, id, tableId }: FindMatch
): string {
  if (field === FindField.memo) return '';

  const table = query(collections)
    .collection('tableEntities')
    .selectById(tableId);
  const tableName = nameOf(table?.name);
  if (field === FindField.tableName || field === FindField.tableComment) {
    return tableName;
  }

  const column = query(collections)
    .collection('tableColumnEntities')
    .selectById(id);
  return `${tableName}.${nameOf(column?.name)}`;
}

/** Whether a cut at the offset falls between a high and a low surrogate. */
const splitsPair = (text: string, at: number) =>
  /[\uD800-\uDBFF]/.test(text.charAt(at - 1)) &&
  /[\uDC00-\uDFFF]/.test(text.charAt(at));

export type Snippet = {
  text: string;
  start: number;
  end: number;
};

/**
 * The part of a long text a result row has room for, on one line, with the
 * match inside it: from the start of a word some way before it, then as much
 * after as fits. The range given back is the match's place within the excerpt.
 */
export function snippetOf(
  { text, start, end }: Pick<FindMatch, 'text' | 'start' | 'end'>,
  before = 24,
  length = 96
): Snippet {
  let from = Math.max(0, Math.min(start - before, text.length - length));
  // A cut inside a word reads as a typo, so it moves up to the next one.
  const space = from > 0 ? text.slice(from, start).search(/\s/) : -1;
  if (space !== -1) from += space + 1;

  let to = Math.min(text.length, Math.max(end, from + length));
  // A cut between the halves of a surrogate pair widens to the whole
  // character, unless the match itself starts or ends there.
  if (from < start && splitsPair(text, from)) from -= 1;
  if (to > end && splitsPair(text, to)) to += 1;
  const lead = from > 0 ? '…' : '';
  const trail = to < text.length ? '…' : '';
  const excerpt = text.slice(from, to).replace(/\s/g, ' ');

  return {
    text: `${lead}${excerpt}${trail}`,
    start: start - from + lead.length,
    end: end - from + lead.length,
  };
}
