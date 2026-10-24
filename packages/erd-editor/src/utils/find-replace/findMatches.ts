import { query } from '@dineug/erd-editor-schema';

import type { ActionType } from '@/engine/actions';
import { RootState } from '@/engine/state';
import { ValuesType } from '@/internal-types';
import { isMemoShown } from '@/utils/memo';
import { isTableGroupShown } from '@/utils/tableGroup';
import { getTableIndexIds } from '@/utils/tableKeys';
import { orderByNameASC } from '@/utils/tableName';

import { Matcher } from './matcher';

export const FindField = {
  tableName: 'tableName',
  tableComment: 'tableComment',
  columnName: 'columnName',
  columnComment: 'columnComment',
  memo: 'memo',
  indexName: 'indexName',
  tableGroupName: 'tableGroupName',
  logicalName: 'logicalName',
} as const;
export type FindField = ValuesType<typeof FindField>;
export const FindFieldList: ReadonlyArray<FindField> = Object.values(FindField);

/**
 * The kinds of text Find and Replace first opens on, the names alone of
 * tables, columns, indexes and table groups and the logical names (owner
 * decisions): a comment or memo is prose a rename should not reach unasked.
 */
export const DEFAULT_FIND_FIELDS: ReadonlyArray<FindField> = Object.freeze([
  FindField.tableName,
  FindField.columnName,
  FindField.indexName,
  FindField.tableGroupName,
  FindField.logicalName,
]);

export type FindMatch = {
  field: FindField;
  /** The entity holding the text: a table, a column, an index, a table group or a memo. */
  id: string;
  /** The table of a table, column or index field; empty for a memo or a table group. */
  tableId: string;
  /** Where the field stands in the walk, so a match keeps its place when its text changes. */
  slot: number;
  text: string;
  start: number;
  end: number;
};

type Field = Omit<FindMatch, 'start' | 'end'>;

/**
 * Whether a logical name field is a table's, which bears its table's id as
 * its own, rather than a column's: the one field kind both of them hold.
 */
export const isTableLogicalName = ({
  field,
  id,
  tableId,
}: Pick<FindMatch, 'field' | 'id' | 'tableId'>): boolean =>
  field === FindField.logicalName && id === tableId;

/**
 * What changes a text the search reads, or which fields it walks: the actions
 * a search on screen runs again on. A hover, a selection or a scroll changes
 * none, and a slow pattern would stall the tab on every one of them.
 */
export const FindTextActionTypes: ReadonlyArray<ActionType> = [
  'table.add',
  'table.remove',
  'table.changeName',
  'table.changeLogicalName',
  'table.changeComment',
  'table.sort',
  'column.add',
  'column.remove',
  'column.changeName',
  'column.changeLogicalName',
  'column.changeComment',
  'column.move',
  'memo.add',
  'memo.remove',
  'memo.changeValue',
  'index.add',
  'index.remove',
  'index.changeName',
  'tableGroup.add',
  'tableGroup.remove',
  'tableGroup.changeName',
  // Hiding or showing the memos or the groups takes them out of the walk or
  // brings them back.
  'settings.changeShow',
  'editor.loadJson',
  'editor.clear',
  'editor.initialLoadJson',
  'editor.initialClear',
];

/**
 * The order a walk takes the tables and the table groups in. A search on the
 * tree reads them by name; a run of Replace presses keeps the order it began
 * with, so a rename that moves a table in the name order is not met again.
 */
export type FieldOrder = {
  tableIds: ReadonlyArray<string>;
  tableGroupIds: ReadonlyArray<string>;
};

/** The tables and the table groups by name, as the tree lists them, ties in document order. */
export function treeOrderOf({ doc, collections }: RootState): FieldOrder {
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds)
    .sort(orderByNameASC);
  const groups = query(collections)
    .collection('tableGroupEntities')
    .selectByIds(doc.tableGroupIds)
    .sort(orderByNameASC);

  return {
    tableIds: tables.map(({ id }) => id),
    tableGroupIds: groups.map(({ id }) => id),
  };
}

/** The live entities in the order given, those it has not met after them by name; with no order, as they are. */
function inOrder<T extends { id: string; name: string }>(
  live: T[],
  order?: ReadonlyArray<string>
): T[] {
  if (!order) return live;

  const byId = new Map(live.map(entity => [entity.id, entity]));
  const known = new Set(order);
  const kept = order.flatMap(id => byId.get(id) ?? []);
  const added = live.filter(({ id }) => !known.has(id)).sort(orderByNameASC);
  return [...kept, ...added];
}

/**
 * Every text field the fields given cover: each table's logical name, name
 * and comment, its columns' alike and its index names, then the table groups'
 * names and the memos, in document order or in the order given.
 */
export function walkFields(
  state: RootState,
  fields: ReadonlyArray<FindField>,
  order?: FieldOrder
): Field[] {
  const { doc, collections } = state;
  const has = new Set(fields);
  const result: Field[] = [];
  const push = (field: Omit<Field, 'slot'>) => {
    result.push({ ...field, slot: result.length });
  };
  const columnCollection = query(collections).collection('tableColumnEntities');
  const indexCollection = query(collections).collection('indexEntities');
  const tables = inOrder(
    query(collections).collection('tableEntities').selectByIds(doc.tableIds),
    order?.tableIds
  );
  const walksColumns =
    has.has(FindField.columnName) ||
    has.has(FindField.columnComment) ||
    has.has(FindField.logicalName);

  // A logical name comes before its name, so a Replace All that writes both
  // writes the name last and the name derived from the new logical name
  // gives way to the one the replacement writes, as a rename by hand does.
  for (const table of tables) {
    const tableId = table.id;

    has.has(FindField.logicalName) &&
      push({
        field: FindField.logicalName,
        id: tableId,
        tableId,
        text: table.logicalName,
      });
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

    const columns = walksColumns
      ? columnCollection.selectByIds(table.columnIds)
      : [];
    for (const column of columns) {
      has.has(FindField.logicalName) &&
        push({
          field: FindField.logicalName,
          id: column.id,
          tableId,
          text: column.logicalName,
        });
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

    const indexes = has.has(FindField.indexName)
      ? indexCollection.selectByIds(getTableIndexIds(state, tableId))
      : [];
    for (const index of indexes) {
      push({
        field: FindField.indexName,
        id: index.id,
        tableId,
        text: index.name,
      });
    }
  }

  // Hidden groups and memos are found and replaced no more than they are seen.
  if (has.has(FindField.tableGroupName) && isTableGroupShown(state)) {
    const groups = inOrder(
      query(collections)
        .collection('tableGroupEntities')
        .selectByIds(doc.tableGroupIds),
      order?.tableGroupIds
    );

    for (const group of groups) {
      push({
        field: FindField.tableGroupName,
        id: group.id,
        tableId: '',
        text: group.name,
      });
    }
  }

  if (has.has(FindField.memo) && isMemoShown(state)) {
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
 * document order or in the order given.
 *
 * @example
 * findMatches(store.state, matcher, [FindField.columnName]);
 */
export function findMatches(
  state: RootState,
  matcher: Matcher,
  fields: ReadonlyArray<FindField> = FindFieldList,
  order?: FieldOrder
): FindMatch[] {
  return walkFields(state, fields, order).flatMap(field =>
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
  run: ReplaceRun | null,
  order?: FieldOrder
): ReplaceRun | null {
  if (!run) return null;

  const found = walkFields(state, fields, order).find(
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
