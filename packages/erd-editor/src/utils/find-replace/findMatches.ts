import { query } from '@dineug/erd-editor-schema';

import type { ActionType } from '@/engine/actions';
import { RootState } from '@/engine/state';
import { ValuesType } from '@/internal-types';

import { Matcher } from './matcher';

export const FindField = {
  tableName: 'tableName',
  tableComment: 'tableComment',
  columnName: 'columnName',
  columnComment: 'columnComment',
  memo: 'memo',
} as const;
export type FindField = ValuesType<typeof FindField>;
export const FindFieldList: ReadonlyArray<FindField> = Object.values(FindField);

export type FindMatch = {
  field: FindField;
  /** The entity holding the text: a table, a column or a memo. */
  id: string;
  /** The table of a table or column field; empty for a memo. */
  tableId: string;
  /** Where the field stands in the walk, so a match keeps its place when its text changes. */
  slot: number;
  text: string;
  start: number;
  end: number;
};

type Field = Omit<FindMatch, 'start' | 'end'>;

/**
 * What changes a text the search reads, or which fields it walks: the actions
 * a search on screen runs again on. A hover, a selection or a scroll changes
 * none, and a slow pattern would stall the tab on every one of them.
 */
export const FindTextActionTypes: ReadonlyArray<ActionType> = [
  'table.add',
  'table.remove',
  'table.changeName',
  'table.changeComment',
  'table.sort',
  'column.add',
  'column.remove',
  'column.changeName',
  'column.changeComment',
  'column.move',
  'memo.add',
  'memo.remove',
  'memo.changeValue',
  'editor.loadJson',
  'editor.clear',
  'editor.initialLoadJson',
  'editor.initialClear',
  'editor.validationIds',
];

/**
 * Every text field the fields given cover, in document order: each table's
 * name and comment, then its columns' names and comments, then the memos.
 * The walk reads the live id lists, since a removed entity keeps its record.
 */
export function walkFields(
  { doc, collections }: RootState,
  fields: ReadonlyArray<FindField>
): Field[] {
  const has = new Set(fields);
  const result: Field[] = [];
  const push = (field: Omit<Field, 'slot'>) => {
    result.push({ ...field, slot: result.length });
  };
  const columnCollection = query(collections).collection('tableColumnEntities');
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds);

  for (const table of tables) {
    const tableId = table.id;

    has.has(FindField.tableName) &&
      push({
        field: FindField.tableName,
        id: tableId,
        tableId,
        text: table.name,
      });
    has.has(FindField.tableComment) &&
      push({
        field: FindField.tableComment,
        id: tableId,
        tableId,
        text: table.comment,
      });

    if (!has.has(FindField.columnName) && !has.has(FindField.columnComment)) {
      continue;
    }

    for (const column of columnCollection.selectByIds(table.columnIds)) {
      has.has(FindField.columnName) &&
        push({
          field: FindField.columnName,
          id: column.id,
          tableId,
          text: column.name,
        });
      has.has(FindField.columnComment) &&
        push({
          field: FindField.columnComment,
          id: column.id,
          tableId,
          text: column.comment,
        });
    }
  }

  if (has.has(FindField.memo)) {
    const memos = query(collections)
      .collection('memoEntities')
      .selectByIds(doc.memoIds);

    for (const memo of memos) {
      push({
        field: FindField.memo,
        id: memo.id,
        tableId: '',
        text: memo.value,
      });
    }
  }

  return result;
}

/**
 * Every occurrence the matcher finds in the fields given, one entry each, in
 * document order.
 *
 * @example
 * findMatches(store.state, matcher, [FindField.columnName]);
 */
export function findMatches(
  state: RootState,
  matcher: Matcher,
  fields: ReadonlyArray<FindField> = FindFieldList
): FindMatch[] {
  return findMatchesBefore(state, matcher, fields, Infinity) as FindMatch[];
}

/**
 * The same search under a time budget, or null once the clock has passed the
 * deadline at the end of a field: a pattern too slow for the document stops
 * at a field boundary, though one field it is in the middle of runs to its end.
 */
export function findMatchesBefore(
  state: RootState,
  matcher: Matcher,
  fields: ReadonlyArray<FindField>,
  deadline: number
): FindMatch[] | null {
  const matches: FindMatch[] = [];

  for (const field of walkFields(state, fields)) {
    if (!field.text) continue;

    for (const { start, end } of matcher.find(field.text)) {
      matches.push({ ...field, start, end });
    }
    if (performance.now() > deadline) return null;
  }

  return matches;
}

/**
 * The matches as they will stand once the field a match was found in holds a
 * new value, before the store has it: that field searched again in the value,
 * every other one as it was, since no other text moves.
 */
export function rematchField(
  matches: ReadonlyArray<FindMatch>,
  matcher: Matcher,
  changed: FindMatch,
  value: string
): FindMatch[] {
  const found = matcher.find(value).map(({ start, end }) => ({
    ...changed,
    text: value,
    start,
    end,
  }));

  return [
    ...matches.filter(match => match.slot < changed.slot),
    ...found,
    ...matches.filter(match => match.slot > changed.slot),
  ];
}

/**
 * The match a search goes on to once the text before a point has been dealt
 * with: the first one past the offset in the slot given, or in a later slot,
 * wrapping to the first. Minus one when there is none.
 */
export function indexAfter(
  matches: ReadonlyArray<FindMatch>,
  slot: number,
  offset: number
): number {
  if (!matches.length) return -1;

  const index = matches.findIndex(
    match => match.slot > slot || (match.slot === slot && match.start >= offset)
  );
  return index === -1 ? 0 : index;
}
