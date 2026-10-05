import { query } from '@dineug/erd-editor-schema';
import { last } from 'es-toolkit';
import { nanoid } from 'nanoid';

import { ColumnOption } from '@/constants/schema';
import { GeneratorAction } from '@/engine/generator.actions';
import {
  focusColumnAction,
  focusTableAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType, SelectType } from '@/engine/modules/editor/state';
import { getRemoveFirstColumnId } from '@/engine/modules/editor/utils/focus';
import { removeIndexAction } from '@/engine/modules/index/atom.actions';
import { removeRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { arrayHas } from '@/utils/arrayHas';
import { bHas } from '@/utils/bit';

import { ChangeColumnValuePayload } from './actions';
import {
  addColumnAction,
  changeColumnAutoIncrementAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
  changeColumnUniqueAction,
  removeColumnAction,
} from './atom.actions';
import { getDataTypeSyncColumns } from './utils/dataType';

export const isToggleColumnTypes = arrayHas<FocusType>([
  FocusType.columnNotNull,
  FocusType.columnUnique,
  FocusType.columnAutoIncrement,
]);

export const isChangeColumnTypes = arrayHas<FocusType>([
  FocusType.columnName,
  FocusType.columnDataType,
  FocusType.columnDefault,
  FocusType.columnComment,
]);

export const addColumnAction$ = (tableId?: string): GeneratorAction =>
  function* ({ editor: { selectedMap } }) {
    if (tableId) {
      const id = nanoid();
      yield addColumnAction({
        id,
        tableId,
      });
      yield focusColumnAction({
        tableId,
        columnId: id,
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      });
      return;
    }

    const addColumnActions = Object.entries(selectedMap)
      .filter(([, type]) => type === SelectType.table)
      .map(([tableId]) => ({ tableId, id: nanoid() }));

    for (const payload of addColumnActions) {
      yield addColumnAction(payload);
    }

    const lastAction = last(addColumnActions);

    if (lastAction) {
      yield focusColumnAction({
        tableId: lastAction.tableId,
        columnId: lastAction.id,
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      });
    }
  };

export const removeColumnAction$ = (
  tableId: string,
  columnIds: string[]
): GeneratorAction =>
  function* (state) {
    const {
      doc: { relationshipIds, indexIds },
      editor: { focusTable },
      collections,
    } = state;

    if (focusTable?.columnId) {
      const columnId = getRemoveFirstColumnId(state, columnIds);

      if (columnId) {
        yield focusColumnAction({
          tableId: focusTable.tableId,
          columnId,
          focusType: focusTable.focusType,
          $mod: false,
          shiftKey: false,
        });
      } else {
        yield focusTableAction({
          tableId: focusTable.tableId,
          focusType: FocusType.tableName,
        });
      }
    }

    const hasColumnIds = arrayHas(columnIds);
    const relationships = query(collections)
      .collection('relationshipEntities')
      .selectByIds(relationshipIds)
      .filter(
        ({ start, end }) =>
          (start.tableId === tableId && start.columnIds.some(hasColumnIds)) ||
          (end.tableId === tableId && end.columnIds.some(hasColumnIds))
      );
    const indexes = query(collections)
      .collection('indexEntities')
      .selectByIds(indexIds)
      .filter(
        index =>
          index.tableId === tableId &&
          query(collections)
            .collection('indexColumnEntities')
            .selectByIds(index.indexColumnIds)
            .map(({ columnId }) => columnId)
            .some(hasColumnIds)
      );

    for (const { id } of indexes) {
      yield removeIndexAction({ id });
    }
    for (const { id } of relationships) {
      yield removeRelationshipAction({ id });
    }
    for (const columnId of columnIds) {
      yield removeColumnAction({
        id: columnId,
        tableId,
      });
    }
  };

export const toggleColumnValueAction$ = (
  focusType: FocusType,
  tableId: string,
  columnId: string
): GeneratorAction =>
  function* ({ collections }) {
    if (!isToggleColumnTypes(focusType)) {
      return;
    }

    const column = query(collections)
      .collection('tableColumnEntities')
      .selectById(columnId);
    if (!column) return;

    switch (focusType) {
      case FocusType.columnNotNull:
        yield changeColumnNotNullAction({
          id: columnId,
          tableId,
          value: !bHas(column.options, ColumnOption.notNull),
        });
        break;
      case FocusType.columnUnique:
        yield changeColumnUniqueAction({
          id: columnId,
          tableId,
          value: !bHas(column.options, ColumnOption.unique),
        });
        break;
      case FocusType.columnAutoIncrement:
        yield changeColumnAutoIncrementAction({
          id: columnId,
          tableId,
          value: !bHas(column.options, ColumnOption.autoIncrement),
        });
        break;
    }
  };

export const changeColumnDataTypeAction$ = (
  payload: ChangeColumnValuePayload
): GeneratorAction =>
  function* (state) {
    const {
      settings: { relationshipDataTypeSync },
    } = state;
    let payloads: ChangeColumnValuePayload[] = [payload];

    if (relationshipDataTypeSync) {
      payloads = getDataTypeSyncColumns([payload], state);
    }

    yield payloads.map(changeColumnDataTypeAction);
  };

export const changeColumnValueAction$ = (
  focusType: FocusType,
  tableId: string,
  columnId: string,
  value: string
): GeneratorAction =>
  function* ({ collections }) {
    if (!isChangeColumnTypes(focusType)) {
      return;
    }

    const column = query(collections)
      .collection('tableColumnEntities')
      .selectById(columnId);
    if (!column) return;

    const payload = {
      id: columnId,
      tableId,
      value,
    };

    switch (focusType) {
      case FocusType.columnName:
        yield changeColumnNameAction(payload);
        break;
      case FocusType.columnDataType:
        yield changeColumnDataTypeAction$(payload);
        break;
      case FocusType.columnDefault:
        yield changeColumnDefaultAction(payload);
        break;
      case FocusType.columnComment:
        yield changeColumnCommentAction(payload);
        break;
    }
  };

/**
 * Makes every named column still in the table a primary key, or none once all
 * are, and no other; it sends no relationship action, and none for a column
 * already there, as its undo records the negation.
 */
export const changeColumnsPrimaryKeyAction$ = (
  tableId: string,
  columnIds: string[]
): GeneratorAction =>
  function* ({ collections }) {
    const table = query(collections)
      .collection('tableEntities')
      .selectById(tableId);
    if (!table) return;

    // A removed column keeps its entity, which a selection can still name.
    const columns = query(collections)
      .collection('tableColumnEntities')
      .selectByIds(columnIds.filter(arrayHas(table.columnIds)));
    const isPrimaryKey = ({ options }: { options: number }) =>
      bHas(options, ColumnOption.primaryKey);
    const value = !columns.every(isPrimaryKey);

    yield columns
      .filter(column => isPrimaryKey(column) !== value)
      .map(({ id }) => changeColumnPrimaryKeyAction({ tableId, id, value }));
  };

/** Toggles one column's primary key, the rule above over a single column. */
export const changeColumnPrimaryKeyAction$ = (
  tableId: string,
  columnId: string
): GeneratorAction => changeColumnsPrimaryKeyAction$(tableId, [columnId]);

export const actions$ = {
  addColumnAction$,
  removeColumnAction$,
  toggleColumnValueAction$,
  changeColumnDataTypeAction$,
  changeColumnValueAction$,
  changeColumnPrimaryKeyAction$,
  changeColumnsPrimaryKeyAction$,
};
