import {
  type ErdTarget,
  showErdTargetAction$,
} from '@/components/erd/goToErdTarget';
import type { EngineContext } from '@/engine/context';
import type { GeneratorAction } from '@/engine/generator.actions';
import { FocusType } from '@/engine/modules/editor/state';
import type { RootState } from '@/engine/state';
import type { Column, Table } from '@/internal-types';
import { FindField, type FindMatch } from '@/utils/find-replace';
import { textInRange } from '@/utils/validation';

/**
 * Where on the ERD canvas the text of a match is edited: its table, its column
 * cell or its memo, with the match itself, which a cell too wide for the
 * canvas is scrolled to by.
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
  }
}

/**
 * The state as a jump measures it once a replacement is in: the field holding
 * the new text at the width its reducer gives it. A memo's text sizes nothing,
 * and a table or column the document no longer holds is left as it is.
 */
export function withReplacement(
  state: RootState,
  { toWidth }: EngineContext,
  { field, id, tableId }: FindMatch,
  value: string
): RootState {
  const { collections } = state;
  const { tableEntities, tableColumnEntities } = collections;
  const table = tableEntities[tableId];
  const column = tableColumnEntities[id];
  const onTable =
    field === FindField.tableName || field === FindField.tableComment;
  if (field === FindField.memo || !table || (!onTable && !column)) {
    return state;
  }

  const [text, width] =
    field === FindField.tableName || field === FindField.columnName
      ? (['name', 'widthName'] as const)
      : (['comment', 'widthComment'] as const);
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
 *
 * @param covered How far in from the left edge the panel hides the canvas.
 */
export const showNextMatchAction$ = (
  next: FindMatch,
  replaced: FindMatch,
  value: string,
  covered: number
): GeneratorAction =>
  function* (state, ctx) {
    // Only the table a replacement writes in changes its size.
    const measured =
      next.tableId === replaced.tableId
        ? withReplacement(state, ctx, replaced, value)
        : state;
    yield* showErdTargetAction$(toErdTarget(next), covered)(measured, ctx);
  };
