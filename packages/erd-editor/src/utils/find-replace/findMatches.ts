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
  return walkFields(state, fields).flatMap(field =>
    field.text
      ? matcher.find(field.text).map(({ start, end }) => ({
          ...field,
          start,
          end,
        }))
      : []
  );
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

/**
 * Where a run of Replace presses began, and whether it has since gone past the
 * last match to the first. Its field is known by entity, with the text the run
 * left there, since a slot shifts and an undo or a peer may write over that text.
 */
export type ReplaceRun = Pick<FindMatch, 'field' | 'id' | 'slot' | 'start'> & {
  text: string;
  wrapped: boolean;
};

/**
 * A run as the document stands now, its field's slot found again, since a
 * table added or removed before it moves that, or null once the field is gone
 * or holds a text the run did not leave, after an undo or a peer's edit say.
 */
export function resumeRun(
  state: RootState,
  fields: ReadonlyArray<FindField>,
  run: ReplaceRun | null
): ReplaceRun | null {
  if (!run) return null;

  const found = walkFields(state, fields).find(
    ({ field, id }) => field === run.field && id === run.id
  );
  return found?.text === run.text ? { ...run, slot: found.slot } : null;
}

const precedes = (match: FindMatch, slot: number, offset: number) =>
  match.slot < slot || (match.slot === slot && match.start < offset);

/**
 * Where a Replace goes on to once it has written value in place of a match:
 * the first match past what it wrote, wrapping to the first, or minus one once
 * the run has wrapped and come back to where it began, which it would replace again.
 */
export function nextReplace(
  after: ReadonlyArray<FindMatch>,
  match: FindMatch,
  value: string,
  run: ReplaceRun | null
): { index: number; run: ReplaceRun } {
  const grown = value.length - match.text.length;
  const offset = match.end + grown;
  const began: ReplaceRun = run ?? { ...match, wrapped: false };
  const inField = began.slot === match.slot;
  // A replacement before where the run began moves that place with its text.
  const start =
    inField && match.start < began.start ? began.start + grown : began.start;

  const index = indexAfter(after, match.slot, offset);
  const next = after[index];
  const wrapped =
    began.wrapped || (next !== undefined && precedes(next, match.slot, offset));
  const back =
    wrapped && next !== undefined && !precedes(next, began.slot, start);

  return {
    index: back ? -1 : index,
    run: {
      field: began.field,
      id: began.id,
      slot: began.slot,
      start,
      text: inField ? value : began.text,
      wrapped,
    },
  };
}
