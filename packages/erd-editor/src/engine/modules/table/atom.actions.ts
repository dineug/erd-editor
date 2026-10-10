import { query } from '@dineug/erd-editor-schema';
import { createAction } from '@dineug/r-html';
import { round } from 'es-toolkit/compat';

import {
  TABLE_GROUP_PADDING,
  TABLE_SORT_MARGIN,
  TABLE_SORT_START,
} from '@/constants/layout';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import { type Rect, unionRect } from '@/konva/scene/metrics';
import { arrayHas } from '@/utils/arrayHas';
import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';
import { createTable } from '@/utils/collection/table.entity';
import { getTableGroupId, padRect } from '@/utils/tableGroup';
import { canvasSizeInRange, textInRange } from '@/utils/validation';

import { ActionMap, ActionType, ReducerType } from './actions';

export const addTableAction = createAction<
  ActionMap[typeof ActionType.addTable]
>(ActionType.addTable);

const addTable: ReducerType<typeof ActionType.addTable> = (
  { doc, collections, lww },
  { payload: { id, ui }, version },
  { clock }
) => {
  const safeVersion = version ?? clock.getVersion();
  query(collections)
    .collection('tableEntities')
    .addOne(createTable({ id, ui }))
    .addOperator(lww, safeVersion, id, () => {
      if (!arrayHas(doc.tableIds)(id)) {
        doc.tableIds.push(id);
      }
    });
};

export const moveTableAction = createAction<
  ActionMap[typeof ActionType.moveTable]
>(ActionType.moveTable);

const moveTable: ReducerType<typeof ActionType.moveTable> = (
  { collections },
  { payload: { ids, movementX, movementY } }
) => {
  const collection = query(collections).collection('tableEntities');
  for (const id of ids) {
    collection.getOrCreate(id, id => createTable({ id }));
  }

  collection.updateMany(ids, table => {
    table.ui.x = round(table.ui.x + movementX, 4);
    table.ui.y = round(table.ui.y + movementY, 4);
  });
};

export const moveToTableAction = createAction<
  ActionMap[typeof ActionType.moveToTable]
>(ActionType.moveToTable);

const moveToTable: ReducerType<typeof ActionType.moveToTable> = (
  { collections },
  { payload: { id, x, y } }
) => {
  const collection = query(collections).collection('tableEntities');
  collection.getOrCreate(id, id => createTable({ id }));

  collection.updateOne(id, table => {
    table.ui.x = x;
    table.ui.y = y;
  });
};

export const removeTableAction = createAction<
  ActionMap[typeof ActionType.removeTable]
>(ActionType.removeTable);

const removeTable: ReducerType<typeof ActionType.removeTable> = (
  { doc, collections, lww },
  { payload: { id }, version },
  { clock }
) => {
  const safeVersion = version ?? clock.getVersion();
  query(collections)
    .collection('tableEntities')
    .removeOperator(lww, safeVersion, id, () => {
      const index = doc.tableIds.indexOf(id);
      if (index !== -1) {
        doc.tableIds.splice(index, 1);
      }
    });
};

export const changeTableNameAction = createAction<
  ActionMap[typeof ActionType.changeTableName]
>(ActionType.changeTableName);

const changeTableName: ReducerType<typeof ActionType.changeTableName> = (
  { collections, lww },
  { payload: { id, value }, version },
  { toWidth, clock }
) => {
  const safeVersion = version ?? clock.getVersion();
  const collection = query(collections).collection('tableEntities');
  collection.getOrCreate(id, id => createTable({ id }));

  collection.replaceOperator(lww, safeVersion, id, 'name', () => {
    collection.updateOne(id, table => {
      table.name = value;
      table.ui.widthName = textInRange(toWidth(value));
    });
  });
};

export const changeTableCommentAction = createAction<
  ActionMap[typeof ActionType.changeTableComment]
>(ActionType.changeTableComment);

const changeTableComment: ReducerType<typeof ActionType.changeTableComment> = (
  { collections, lww },
  { payload: { id, value }, version },
  { toWidth, clock }
) => {
  const safeVersion = version ?? clock.getVersion();
  const collection = query(collections).collection('tableEntities');
  collection.getOrCreate(id, id => createTable({ id }));

  collection.replaceOperator(lww, safeVersion, id, 'comment', () => {
    collection.updateOne(id, table => {
      table.comment = value;
      table.ui.widthComment = textInRange(toWidth(value));
    });
  });
};

export const changeTableColorAction = createAction<
  ActionMap[typeof ActionType.changeTableColor]
>(ActionType.changeTableColor);

const changeTableColor: ReducerType<typeof ActionType.changeTableColor> = (
  { collections, lww },
  { payload: { id, color }, version },
  { clock }
) => {
  const safeVersion = version ?? clock.getVersion();
  const collection = query(collections).collection('tableEntities');
  collection.getOrCreate(id, id => createTable({ id }));

  collection.replaceOperator(lww, safeVersion, id, 'ui.color', () => {
    collection.updateOne(id, table => {
      table.ui.color = color;
    });
  });
};

export const changeTableGroupAction = createAction<
  ActionMap[typeof ActionType.changeTableGroup]
>(ActionType.changeTableGroup);

/**
 * Puts a table in the group the value names, or in none for ''. One register
 * per table, so of two peers placing one table the later write wins.
 */
const changeTableGroup: ReducerType<typeof ActionType.changeTableGroup> = (
  { collections, lww },
  { payload: { id, value }, version },
  { clock }
) => {
  const safeVersion = version ?? clock.getVersion();
  const collection = query(collections).collection('tableEntities');
  collection.getOrCreate(id, id => createTable({ id }));

  collection.replaceOperator(lww, safeVersion, id, 'groupId', () => {
    collection.updateOne(id, table => {
      table.groupId = value;
    });
  });
};

export const changeZIndexAction = createAction<
  ActionMap[typeof ActionType.changeZIndex]
>(ActionType.changeZIndex);

const changeZIndex: ReducerType<typeof ActionType.changeZIndex> = (
  { collections },
  { payload: { id, zIndex } }
) => {
  const collection = query(collections).collection('tableEntities');
  collection.getOrCreate(id, id => createTable({ id }));

  collection.updateOne(id, table => {
    table.ui.zIndex = zIndex;
  });
};

export const sortTableAction = createAction<
  ActionMap[typeof ActionType.sortTable]
>(ActionType.sortTable);

/** One cell of the sort's rows, at the size it draws, and how it is put at a corner. */
type SortCell = {
  width: number;
  height: number;
  place: (x: number, y: number) => void;
};

/**
 * Puts cells in rows from the start corner, each the margin wider and taller
 * than it draws, a row wrapping before the cell that would cross the width;
 * the first row starts rowHeight tall, which only a cell too wide for any meets.
 */
function placeInRows(
  cells: SortCell[],
  start: number,
  width: number,
  rowHeight: number
): void {
  let widthSum = start;
  let currentHeight = start;
  let maxHeight = rowHeight;

  cells.forEach(cell => {
    const cellWidth = cell.width + TABLE_SORT_MARGIN;
    const cellHeight = cell.height + TABLE_SORT_MARGIN;

    if (widthSum + cellWidth > width) {
      currentHeight += maxHeight;
      maxHeight = 0;
      widthSum = start;
    }

    if (maxHeight < cellHeight) {
      maxHeight = cellHeight;
    }

    cell.place(widthSum, currentHeight);
    widthSum += cellWidth;
  });
}

const tableCell = (state: RootState, table: Table): SortCell => ({
  width: calcTableWidths(table, state).width,
  height: calcTableHeight(table),
  place: (x, y) => {
    table.ui.x = x;
    table.ui.y = y;
  },
});

/**
 * The width the sort wraps its rows at: a hundred per table, inside the
 * canvas bounds, the size an importer gave the canvas it laid its tables on.
 */
const sortWidth = ({ doc }: RootState) =>
  canvasSizeInRange(doc.tableIds.length * 100);

/**
 * A group's members in rows of their own inside its box, the members' bounds
 * and the padding, which becomes the group's rect where the cell is put. The
 * rows wrap so that the box fits the sort width beside the start corner.
 */
function groupCell(
  state: RootState,
  groupId: string,
  members: SortCell[]
): SortCell {
  const rects: Rect[] = [];
  placeInRows(
    members.map((member, index) => ({
      ...member,
      place: (x, y) => {
        rects[index] = { x, y, width: member.width, height: member.height };
      },
    })),
    0,
    sortWidth(state) - TABLE_SORT_START - TABLE_GROUP_PADDING * 2,
    0
  );
  const box = padRect(rects.reduce(unionRect));

  return {
    width: box.width,
    height: box.height,
    place: (x, y) => {
      members.forEach((member, index) =>
        member.place(x + rects[index].x - box.x, y + rects[index].y - box.y)
      );
      query(state.collections)
        .collection('tableGroupEntities')
        .updateOne(groupId, group => {
          group.ui.x = x;
          group.ui.y = y;
          group.ui.width = box.width;
          group.ui.height = box.height;
        });
    },
  };
}

/**
 * The tables as the sort's cells: one in no group alone, and the members of a
 * group gathered in one cell where its first member comes, so a group stays
 * together. A document with no group gets one cell per table, as it always did.
 */
function toSortCells(state: RootState, tables: Table[]): SortCell[] {
  const membersByGroup = new Map<string, SortCell[]>();
  const order: Array<SortCell | string> = [];

  tables.forEach(table => {
    const cell = tableCell(state, table);
    const groupId = getTableGroupId(state, table);
    const members = groupId ? membersByGroup.get(groupId) : undefined;

    if (!groupId) {
      order.push(cell);
    } else if (members) {
      members.push(cell);
    } else {
      membersByGroup.set(groupId, [cell]);
      order.push(groupId);
    }
  });

  return order.map(cell =>
    typeof cell === 'string'
      ? groupCell(state, cell, membersByGroup.get(cell)!)
      : cell
  );
}

const sortTable: ReducerType<typeof ActionType.sortTable> = state => {
  const { doc, collections } = state;
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds);

  tables.sort((a, b) => a.columnIds.length - b.columnIds.length);

  placeInRows(
    toSortCells(state, tables),
    TABLE_SORT_START,
    sortWidth(state),
    TABLE_SORT_START
  );
};

export const tableReducers = {
  [ActionType.addTable]: addTable,
  [ActionType.moveTable]: moveTable,
  [ActionType.moveToTable]: moveToTable,
  [ActionType.removeTable]: removeTable,
  [ActionType.changeTableName]: changeTableName,
  [ActionType.changeTableComment]: changeTableComment,
  [ActionType.changeTableColor]: changeTableColor,
  [ActionType.changeTableGroup]: changeTableGroup,
  [ActionType.changeZIndex]: changeZIndex,
  [ActionType.sortTable]: sortTable,
};

export const actions = {
  addTableAction,
  moveTableAction,
  moveToTableAction,
  removeTableAction,
  changeTableNameAction,
  changeTableCommentAction,
  changeTableColorAction,
  changeTableGroupAction,
  changeZIndexAction,
  sortTableAction,
};
