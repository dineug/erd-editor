import { AnyAction } from '@dineug/r-html';

import {
  addColumnAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
} from '@/engine/modules/table-column/atom.actions';
import { Column } from '@/internal-types';

/**
 * Adds a NOT NULL copy of each start column to the end table under the id at
 * the same index of endColumnIds, carrying its name, data type, default and
 * comment. The caller owns the ids because the relationship needs them too.
 */
export const toForeignKeyActions = (
  startColumns: Column[],
  endTableId: string,
  endColumnIds: string[]
): AnyAction[] =>
  startColumns.flatMap((startColumn, index) => {
    const payload = {
      id: endColumnIds[index],
      tableId: endTableId,
    };

    return [
      addColumnAction(payload),
      changeColumnNotNullAction({
        ...payload,
        value: true,
      }),
      changeColumnNameAction({
        ...payload,
        value: startColumn.name,
      }),
      changeColumnDataTypeAction({
        ...payload,
        value: startColumn.dataType,
      }),
      changeColumnDefaultAction({
        ...payload,
        value: startColumn.default,
      }),
      changeColumnCommentAction({
        ...payload,
        value: startColumn.comment,
      }),
    ];
  });
