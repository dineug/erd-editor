import { query } from '@dineug/erd-editor-schema';
import { cloneDeep, isEmpty, omit } from 'lodash-es';
import { nanoid } from 'nanoid';

import { ColumnOption } from '@/constants/schema';
import { GeneratorAction } from '@/engine/generator.actions';
import {
  changeMemoColorAction,
  moveMemoAction,
} from '@/engine/modules/memo/atom.actions';
import { removeMemoAction$ } from '@/engine/modules/memo/generator.actions';
import {
  changeTableColorAction,
  moveTableAction,
  sortTableAction,
} from '@/engine/modules/table/atom.actions';
import { removeTableAction$ } from '@/engine/modules/table/generator.actions';
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
  moveColumnAction,
} from '@/engine/modules/table-column/atom.actions';
import {
  addColumnAction$,
  removeColumnAction$,
} from '@/engine/modules/table-column/generator.actions';
import { bHas } from '@/utils/bit';
import { calcMemoHeight, calcMemoWidth } from '@/utils/calcMemo';
import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';
import { isOverlapPosition, Rect } from '@/utils/dragSelect';
import { schemaSQLParserToSchemaJson } from '@/utils/schema-sql-parser';

import {
  clearAction,
  dragstartColumnAction,
  drawEndRelationshipAction,
  drawStartAddRelationshipAction,
  drawStartRelationshipAction,
  focusColumnAction,
  focusMoveTableAction,
  focusTableEndAction,
  initialClearAction,
  initialLoadJsonAction,
  loadJsonAction,
  selectAction,
  unselectAllAction,
} from './atom.actions';
import { FocusType, MoveKey, SelectType } from './state';
import {
  isColumns,
  isLastColumn,
  isLastRowColumn,
  isLastTable,
  isTableFocusType,
} from './utils/focus';

type SelectTypeIds = {
  tableIds: string[];
  memoIds: string[];
};

const CENTER_BOX_SIZE = 15;

function getSelectTypeIds(
  selectedMap: Record<string, SelectType>
): SelectTypeIds {
  return Object.entries(selectedMap).reduce<SelectTypeIds>(
    (acc, [id, type]) => {
      if (type === SelectType.table) {
        acc.tableIds.push(id);
      } else if (type === SelectType.memo) {
        acc.memoIds.push(id);
      }

      return acc;
    },
    { tableIds: [], memoIds: [] }
  );
}

export const loadJsonAction$ = (value: string): GeneratorAction =>
  function* () {
    yield clearAction();
    yield loadJsonAction({ value });
  };

export const initialLoadJsonAction$ = (value: string): GeneratorAction =>
  function* () {
    yield initialClearAction();
    yield initialLoadJsonAction({ value });
  };

export const moveAllAction$ = (
  movementX: number,
  movementY: number
): GeneratorAction =>
  function* ({ editor: { selectedMap }, settings: { zoomLevel } }) {
    const { tableIds, memoIds } = getSelectTypeIds(selectedMap);
    const newMovementX = movementX / zoomLevel;
    const newMovementY = movementY / zoomLevel;

    if (tableIds.length) {
      yield moveTableAction({
        ids: tableIds,
        movementX: newMovementX,
        movementY: newMovementY,
      });
    }

    if (memoIds.length) {
      yield moveMemoAction({
        ids: memoIds,
        movementX: newMovementX,
        movementY: newMovementY,
      });
    }
  };

export const removeSelectedAction$ = (): GeneratorAction =>
  function* () {
    yield removeTableAction$();
    yield removeMemoAction$();
  };

export const dragSelectAction$ = (dragRect: Rect): GeneratorAction =>
  function* (state) {
    const {
      doc: { tableIds, memoIds },
      collections,
    } = state;

    const selectedMap: Record<string, SelectType> = {
      ...query(collections)
        .collection('tableEntities')
        .selectByIds(tableIds)
        .reduce<Record<string, SelectType>>((acc, table) => {
          const width = calcTableWidths(table, state).width;
          const height = calcTableHeight(table);
          const x = table.ui.x + width / 2 - CENTER_BOX_SIZE;
          const y = table.ui.y + height / 2 - CENTER_BOX_SIZE;

          if (
            isOverlapPosition(dragRect, {
              x,
              y,
              w: CENTER_BOX_SIZE,
              h: CENTER_BOX_SIZE,
            })
          ) {
            acc[table.id] = SelectType.table;
          }

          return acc;
        }, {}),
      ...query(collections)
        .collection('memoEntities')
        .selectByIds(memoIds)
        .reduce<Record<string, SelectType>>((acc, memo) => {
          const width = calcMemoWidth(memo);
          const height = calcMemoHeight(memo);
          const x = memo.ui.x + width / 2 - CENTER_BOX_SIZE;
          const y = memo.ui.y + height / 2 - CENTER_BOX_SIZE;

          if (
            isOverlapPosition(dragRect, {
              x,
              y,
              w: CENTER_BOX_SIZE,
              h: CENTER_BOX_SIZE,
            })
          ) {
            acc[memo.id] = SelectType.memo;
          }

          return acc;
        }, {}),
    };

    yield unselectAllAction$();

    if (!isEmpty(selectedMap)) {
      yield selectAction(selectedMap);
    }
  };

export const unselectAllAction$ = (): GeneratorAction =>
  function* () {
    yield unselectAllAction();
    yield focusTableEndAction();
  };

export const focusMoveTableAction$ = (
  moveKey: MoveKey,
  shiftKey: boolean
): GeneratorAction =>
  function* (state) {
    const {
      editor: { focusTable },
    } = state;
    if (!focusTable) return;

    if (
      moveKey === MoveKey.Tab &&
      !shiftKey &&
      ((isTableFocusType(focusTable.focusType) &&
        isLastTable(state) &&
        !isColumns(state)) ||
        (!isTableFocusType(focusTable.focusType) &&
          isLastColumn(state) &&
          isLastRowColumn(state)))
    ) {
      yield addColumnAction$(focusTable.tableId);
    } else {
      yield focusMoveTableAction({ moveKey, shiftKey });
    }
  };

export const drawStartRelationshipAction$ = (
  relationshipType: number
): GeneratorAction =>
  function* ({ editor }) {
    if (editor.drawRelationship?.relationshipType === relationshipType) {
      yield drawEndRelationshipAction();
    } else {
      yield drawStartRelationshipAction({ relationshipType });
    }
  };

export const drawStartAddRelationshipAction$ = (
  tableId: string
): GeneratorAction =>
  function* ({ collections }) {
    const table = query(collections)
      .collection('tableEntities')
      .selectById(tableId);
    if (!table) return;

    const columns = query(collections)
      .collection('tableColumnEntities')
      .selectByIds(table.columnIds);

    if (
      !columns.some(column => bHas(column.options, ColumnOption.primaryKey))
    ) {
      const columnId = nanoid();
      yield addColumnAction({
        tableId,
        id: columnId,
      });
      yield changeColumnPrimaryKeyAction({
        tableId,
        id: columnId,
        value: true,
      });
      yield focusColumnAction({
        tableId,
        columnId,
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      });
    }

    yield drawStartAddRelationshipAction({ tableId });
  };

export const changeColorAllAction$ = (color: string): GeneratorAction =>
  function* ({ editor: { selectedMap }, collections }) {
    const { tableIds, memoIds } = getSelectTypeIds(selectedMap);
    const tables = query(collections)
      .collection('tableEntities')
      .selectByIds(tableIds);
    const memos = query(collections)
      .collection('memoEntities')
      .selectByIds(memoIds);

    yield tables.map(table =>
      changeTableColorAction({ id: table.id, color, prevColor: table.ui.color })
    );
    yield memos.map(memo =>
      changeMemoColorAction({ id: memo.id, color, prevColor: memo.ui.color })
    );
  };

export const loadSchemaSQLAction$ = (value: string): GeneratorAction =>
  function* ({ settings }, ctx) {
    yield loadJsonAction$(
      schemaSQLParserToSchemaJson(value, ctx, schema => {
        schema.settings = {
          ...schema.settings,
          ...omit(cloneDeep(settings), [
            'width',
            'height',
            'scrollTop',
            'scrollLeft',
            'zoomLevel',
          ]),
        };
        return schema;
      })
    );
    yield sortTableAction();
  };

export const dragstartColumnAction$ = ($mod: boolean): GeneratorAction =>
  function* ({ editor: { focusTable } }) {
    if (!focusTable || !focusTable.columnId) return;

    yield dragstartColumnAction({
      tableId: focusTable.tableId,
      columnIds: $mod ? [...focusTable.selectColumnIds] : [focusTable.columnId],
    });
  };

export const dragoverColumnAction$ = (
  targetId: string,
  targetTableId: string
): GeneratorAction =>
  function* ({ editor: { draggableColumn }, collections }) {
    if (!draggableColumn || draggableColumn.columnIds.length === 0) {
      return;
    }

    const { tableId, columnIds } = draggableColumn;
    const tableCollection = query(collections).collection('tableEntities');
    const table = tableCollection.selectById(tableId);
    if (!table) return;

    if (targetTableId === tableId) {
      const index = table.columnIds.indexOf(columnIds[0]);
      if (index === -1) return;

      const targetIndex = table.columnIds.indexOf(targetId);
      if (targetIndex === -1) return;

      const actions = columnIds.map(id =>
        moveColumnAction({ tableId, id, targetId })
      );

      if (index < targetIndex) {
        actions.reverse();
      }

      yield actions;
      return;
    }

    const targetTable = tableCollection.selectById(targetTableId);
    if (!targetTable) return;

    const columns = query(collections)
      .collection('tableColumnEntities')
      .selectByIds(columnIds);
    if (columns.length === 0) return;

    yield removeColumnAction$(tableId, columnIds);
    const newColumnIds = columns.map(() => nanoid());

    for (let i = 0; i < columns.length; i++) {
      const column = columns[i];
      const newColumnId = newColumnIds[i];
      const payload = {
        id: newColumnId,
        tableId: targetTableId,
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
        changeColumnPrimaryKeyAction({
          ...payload,
          value: bHas(column.options, ColumnOption.primaryKey),
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
        moveColumnAction({
          ...payload,
          targetId,
        }),
        focusColumnAction({
          tableId: targetTableId,
          columnId: newColumnId,
          focusType: FocusType.columnName,
          $mod: true,
          shiftKey: false,
        }),
      ];
    }

    yield dragstartColumnAction({
      tableId: targetTableId,
      columnIds: newColumnIds,
    });
  };

export const actions$ = {
  loadJsonAction$,
  initialLoadJsonAction$,
  moveAllAction$,
  removeSelectedAction$,
  dragSelectAction$,
  unselectAllAction$,
  focusMoveTableAction$,
  drawStartRelationshipAction$,
  drawStartAddRelationshipAction$,
  changeColorAllAction$,
  loadSchemaSQLAction$,
  dragstartColumnAction$,
  dragoverColumnAction$,
};
