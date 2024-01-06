import { query } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { arrayHas, nanoid } from '@dineug/shared';

import { ColumnOption, ColumnType } from '@/constants/schema';
import { GeneratorAction } from '@/engine/generator.actions';
import {
  drawEndRelationshipAction,
  focusColumnAction,
  focusTableAction,
  focusTableEndAction,
  selectAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import { drawStartAddRelationshipAction$ } from '@/engine/modules/editor/generator.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { isTableFocusType } from '@/engine/modules/editor/utils/focus';
import { removeIndexAction } from '@/engine/modules/index/atom.actions';
import {
  addRelationshipAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import {
  addColumnAction,
  changeColumnAutoIncrementAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
  changeColumnUniqueAction,
} from '@/engine/modules/table-column/atom.actions';
import { Column } from '@/internal-types';
import { nextPoint, nextZIndex } from '@/utils';
import { bHas } from '@/utils/bit';
import { getShowColumnOrder } from '@/utils/table-clipboard';

import {
  addTableAction,
  changeZIndexAction,
  removeTableAction,
} from './atom.actions';

export const addTableAction$ = (): GeneratorAction =>
  function* ({ settings, doc: { tableIds, memoIds }, collections }) {
    const tables = query(collections)
      .collection('tableEntities')
      .selectByIds(tableIds);
    const memos = query(collections)
      .collection('memoEntities')
      .selectByIds(memoIds);
    const point = nextPoint(settings, tables, memos);
    const id = nanoid();

    yield unselectAllAction();
    yield selectAction({ [id]: SelectType.table });
    yield addTableAction({
      id,
      ui: {
        ...point,
        zIndex: nextZIndex(tables, memos),
      },
    });
    yield focusTableAction({ tableId: id });
  };

export const removeTableAction$ = (id?: string): GeneratorAction =>
  function* ({
    doc: { relationshipIds, indexIds },
    editor: { selectedMap },
    collections,
  }) {
    const relationships = query(collections)
      .collection('relationshipEntities')
      .selectByIds(relationshipIds);
    const indexes = query(collections)
      .collection('indexEntities')
      .selectByIds(indexIds);

    if (id) {
      const removeRelationships = relationships.filter(
        ({ start, end }) => start.tableId === id || end.tableId === id
      );
      const removeIndexes = indexes.filter(({ tableId }) => tableId === id);

      for (const { id } of removeIndexes) {
        yield removeIndexAction({ id });
      }
      for (const { id } of removeRelationships) {
        yield removeRelationshipAction({ id });
      }
      yield removeTableAction({ id });

      return;
    }

    const selectedTableIds = Object.entries(selectedMap)
      .filter(([, type]) => type === SelectType.table)
      .map(([id]) => id);
    const hasTableIds = arrayHas(selectedTableIds);
    const removeRelationships = relationships.filter(
      ({ start, end }) => hasTableIds(start.tableId) || hasTableIds(end.tableId)
    );
    const removeIndexes = indexes.filter(({ tableId }) => hasTableIds(tableId));

    for (const { id } of removeIndexes) {
      yield removeIndexAction({ id });
    }
    for (const { id } of removeRelationships) {
      yield removeRelationshipAction({ id });
    }
    for (const id of selectedTableIds) {
      yield removeTableAction({ id });
    }
  };

export const selectTableAction$ = (
  id: string,
  $mod: boolean
): GeneratorAction =>
  function* ({
    doc: { tableIds, memoIds },
    collections,
    editor: { drawRelationship },
  }) {
    const tableCollection = query(collections).collection('tableEntities');
    const tables = tableCollection.selectByIds(tableIds);
    const memos = query(collections)
      .collection('memoEntities')
      .selectByIds(memoIds);

    if (!$mod) {
      yield unselectAllAction();
    }

    yield selectAction({ [id]: SelectType.table });
    yield changeZIndexAction({ id, zIndex: nextZIndex(tables, memos) });
    yield focusTableAction({ tableId: id });

    if (!drawRelationship) return;

    if (drawRelationship.start) {
      const startTable = tableCollection.selectById(
        drawRelationship.start.tableId
      );
      const endTable = tableCollection.selectById(id);
      if (!startTable || !endTable) return;

      const startColumns = query(collections)
        .collection('tableColumnEntities')
        .selectByIds(startTable.columnIds)
        .filter(({ options }) => bHas(options, ColumnOption.primaryKey));
      if (!startColumns.length) return;

      const endColumnIds = startColumns.map(() => nanoid());

      for (let i = 0; i < startColumns.length; i++) {
        const startColumn = startColumns[i];
        const endColumnId = endColumnIds[i];
        const payload = {
          id: endColumnId,
          tableId: endTable.id,
        };

        yield [
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
      }

      yield addRelationshipAction({
        id: nanoid(),
        relationshipType: drawRelationship.relationshipType,
        start: {
          tableId: startTable.id,
          columnIds: startColumns.map(({ id }) => id),
        },
        end: {
          tableId: endTable.id,
          columnIds: endColumnIds,
        },
      });
      yield drawEndRelationshipAction();
    } else {
      yield drawStartAddRelationshipAction$(id);
    }
  };

export const pasteTableAction$ = (columns: Column[]): GeneratorAction =>
  function* ({
    editor: { selectedMap, focusTable },
    settings: { show, columnOrder },
    collections,
  }) {
    const isFit = focusTable && !isTableFocusType(focusTable.focusType);
    const selectedTableIds = Object.entries(selectedMap)
      .filter(([, type]) => type === SelectType.table)
      .map(([id]) => id)
      .filter(id => (isFit ? id !== focusTable?.tableId : true));

    for (const tableId of selectedTableIds) {
      for (const column of columns) {
        const id = nanoid();
        const payload = {
          id,
          tableId,
        };

        yield [
          addColumnAction(payload),
          changeColumnNameAction({
            ...payload,
            value: column.name,
          }),
          changeColumnDataTypeAction({
            ...payload,
            value: column.dataType,
          }),
          changeColumnDefaultAction({
            ...payload,
            value: column.default,
          }),
          changeColumnCommentAction({
            ...payload,
            value: column.comment,
          }),
          changeColumnNotNullAction({
            ...payload,
            value: bHas(column.options, ColumnOption.notNull),
          }),
          changeColumnUniqueAction({
            ...payload,
            value: bHas(column.options, ColumnOption.unique),
          }),
          changeColumnAutoIncrementAction({
            ...payload,
            value: bHas(column.options, ColumnOption.autoIncrement),
          }),
        ];
      }
    }

    if (!focusTable || !isFit) return;

    const table = query(collections)
      .collection('tableEntities')
      .selectById(focusTable.tableId);
    if (!table) return;

    const columnIds = table.columnIds.filter(
      arrayHas(focusTable.selectColumnIds)
    );
    if (columnIds.length === 0) return;

    const additionalColumnIds = table.columnIds.slice(
      table.columnIds.indexOf(columnIds[columnIds.length - 1]) + 1
    );
    const columnIdsRange = [...columnIds, ...additionalColumnIds];
    const showColumnOrder = getShowColumnOrder(show, columnOrder);

    yield focusTableEndAction();

    for (let i = 0; i < columnIdsRange.length; i++) {
      const columnId = columnIdsRange[i];
      const column = columns[i];
      if (!column) break;

      const payload = {
        id: columnId,
        tableId: table.id,
      };

      yield [
        ...(showColumnOrder
          .map(columnType => {
            switch (columnType) {
              case ColumnType.columnName:
                return changeColumnNameAction({
                  ...payload,
                  value: column.name,
                });
              case ColumnType.columnDataType:
                return changeColumnDataTypeAction({
                  ...payload,
                  value: column.dataType,
                });
              case ColumnType.columnDefault:
                return changeColumnDefaultAction({
                  ...payload,
                  value: column.default,
                });
              case ColumnType.columnComment:
                return changeColumnCommentAction({
                  ...payload,
                  value: column.comment,
                });
              case ColumnType.columnAutoIncrement:
                return changeColumnAutoIncrementAction({
                  ...payload,
                  value: bHas(column.options, ColumnOption.autoIncrement),
                });
              case ColumnType.columnUnique:
                return changeColumnUniqueAction({
                  ...payload,
                  value: bHas(column.options, ColumnOption.unique),
                });
              case ColumnType.columnNotNull:
                return changeColumnNotNullAction({
                  ...payload,
                  value: bHas(column.options, ColumnOption.notNull),
                });
              default:
                return null;
            }
          })
          .filter(Boolean) as AnyAction[]),
        focusColumnAction({
          tableId: table.id,
          columnId: columnId,
          focusType: focusTable.focusType,
          $mod: true,
          shiftKey: false,
        }),
      ];
    }

    const addColumns = columns.slice(columnIdsRange.length);

    for (const column of addColumns) {
      const id = nanoid();
      const payload = {
        id,
        tableId: table.id,
      };

      yield [
        addColumnAction(payload),
        ...(showColumnOrder
          .map(columnType => {
            switch (columnType) {
              case ColumnType.columnName:
                return changeColumnNameAction({
                  ...payload,
                  value: column.name,
                });
              case ColumnType.columnDataType:
                return changeColumnDataTypeAction({
                  ...payload,
                  value: column.dataType,
                });
              case ColumnType.columnDefault:
                return changeColumnDefaultAction({
                  ...payload,
                  value: column.default,
                });
              case ColumnType.columnComment:
                return changeColumnCommentAction({
                  ...payload,
                  value: column.comment,
                });
              case ColumnType.columnAutoIncrement:
                return changeColumnAutoIncrementAction({
                  ...payload,
                  value: bHas(column.options, ColumnOption.autoIncrement),
                });
              case ColumnType.columnUnique:
                return changeColumnUniqueAction({
                  ...payload,
                  value: bHas(column.options, ColumnOption.unique),
                });
              case ColumnType.columnNotNull:
                return changeColumnNotNullAction({
                  ...payload,
                  value: bHas(column.options, ColumnOption.notNull),
                });
              default:
                return null;
            }
          })
          .filter(Boolean) as AnyAction[]),
        focusColumnAction({
          tableId: table.id,
          columnId: id,
          focusType: focusTable.focusType,
          $mod: true,
          shiftKey: false,
        }),
      ];
    }
  };

export const actions$ = {
  addTableAction$,
  removeTableAction$,
  selectTableAction$,
  pasteTableAction$,
};
