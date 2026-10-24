import { toErdTarget } from '@/components/erd/erdTarget';
import { showErdTargetAction$ } from '@/components/erd/goToErdTarget';
import type { EngineContext } from '@/engine/context';
import type { GeneratorAction } from '@/engine/generator.actions';
import type { RootState } from '@/engine/state';
import type { Column, Table } from '@/internal-types';
import {
  FindField,
  type FindMatch,
  isTableLogicalName,
} from '@/utils/find-replace';
import { textInRange } from '@/utils/validation';

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
