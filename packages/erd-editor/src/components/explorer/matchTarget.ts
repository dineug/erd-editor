import {
  type ErdTarget,
  showErdTargetAction$,
} from '@/components/erd/goToErdTarget';
import type { EngineContext } from '@/engine/context';
import type { GeneratorAction } from '@/engine/generator.actions';
import { FocusType } from '@/engine/modules/editor/state';
import type { RootState } from '@/engine/state';
import type { Column, Table } from '@/internal-types';
import {
  FindField,
  type FindMatch,
  isTableLogicalName,
} from '@/utils/find-replace';
import { textInRange } from '@/utils/validation';

/**
 * Where on the ERD canvas a match's text is edited: its table, column cell,
 * memo or table group, with the match, which a cell too wide is scrolled to
 * by. An index goes to its table, a logical name to the cell the view draws.
 */
export function toErdTarget(match: FindMatch): ErdTarget {
  const { field, id, tableId, text, start, end } = match;
  const range = { text, start, end };

  switch (field) {
    case FindField.tableName:
      return { kind: 'table', tableId, focusType: FocusType.tableName, range };
    case FindField.tableComment:
      return {
        kind: 'table',
        tableId,
        focusType: FocusType.tableComment,
        range,
      };
    case FindField.columnName:
      return {
        kind: 'column',
        tableId,
        columnId: id,
        focusType: FocusType.columnName,
        range,
      };
    case FindField.columnComment:
      return {
        kind: 'column',
        tableId,
        columnId: id,
        focusType: FocusType.columnComment,
        range,
      };
    case FindField.memo:
      return { kind: 'memo', memoId: id };
    case FindField.indexName:
      return { kind: 'table', tableId };
    case FindField.tableGroupName:
      return { kind: 'tableGroup', tableGroupId: id };
    case FindField.logicalName:
      return isTableLogicalName(match)
        ? {
            kind: 'table',
            tableId,
            focusType: FocusType.tableLogicalName,
            range,
          }
        : {
            kind: 'column',
            tableId,
            columnId: id,
            focusType: FocusType.columnLogicalName,
            range,
          };
  }
}

type TextKey = 'name' | 'comment' | 'logicalName';
type WidthKey = 'widthName' | 'widthComment' | 'widthLogicalName';

/** The text a field holds on its table or column and the width measured for it. */
const TEXT_WIDTH: Partial<Record<FindField, readonly [TextKey, WidthKey]>> = {
  [FindField.tableName]: ['name', 'widthName'],
  [FindField.columnName]: ['name', 'widthName'],
  [FindField.tableComment]: ['comment', 'widthComment'],
  [FindField.columnComment]: ['comment', 'widthComment'],
  [FindField.logicalName]: ['logicalName', 'widthLogicalName'],
};

/**
 * The state as a jump measures it once a replacement is in: the field holding
 * the new text at the width its reducer gives it, a name a logical name derives
 * left as it was. A memo, an index or a group name sizes no table.
 */
export function withReplacement(
  state: RootState,
  { toWidth }: EngineContext,
  match: FindMatch,
  value: string
): RootState {
  const { field, id, tableId } = match;
  const { collections } = state;
  const { tableEntities, tableColumnEntities } = collections;
  const table = tableEntities[tableId];
  const column = tableColumnEntities[id];
  const onTable =
    field === FindField.tableName ||
    field === FindField.tableComment ||
    isTableLogicalName(match);
  const fieldWidth = TEXT_WIDTH[field];
  if (!fieldWidth || !table || (!onTable && !column)) {
    return state;
  }

  const [text, width] = fieldWidth;
  const edit = <T extends Table | Column>(entity: T): T => ({
    ...entity,
    [text]: value,
    ui: { ...entity.ui, [width]: textInRange(toWidth(value)) },
  });

  // A table's size is cached by the table and keyed on none of its columns'
  // widths, so a column's new text gives its table a fresh object as well.
  return {
    ...state,
    collections: {
      ...collections,
      tableEntities: {
        ...tableEntities,
        [tableId]: onTable ? edit(table) : { ...table },
      },
      tableColumnEntities: onTable
        ? tableColumnEntities
        : { ...tableColumnEntities, [id]: edit(column) },
    },
  };
}

/**
 * The jump Replace makes to the next match, in the replacement's own dispatch.
 * A batch is read against the state before it, so the jump measures the table
 * the replacement widens or narrows from what the replacement writes.
 */
export const showNextMatchAction$ = (
  next: FindMatch,
  replaced: FindMatch,
  value: string
): GeneratorAction =>
  function* (state, ctx) {
    // Only the table a replacement writes in changes its size.
    const measured =
      next.tableId === replaced.tableId
        ? withReplacement(state, ctx, replaced, value)
        : state;
    yield* showErdTargetAction$(toErdTarget(next))(measured, ctx);
  };
