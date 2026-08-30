import { RootState } from '@/engine/state';
import { Point, Table } from '@/internal-types';
import {
  calcTableHeight,
  calcTableWidths,
  getWidthGeneration,
} from '@/utils/calcTable';
import { ObjectPoint } from '@/utils/draw-relationship';

type TableSize = { key: string; width: number; height: number };

/**
 * Table box sizes, held across relationship sorts. Deliberately outside
 * calcTableWidths: component render paths call that from inside an r-html
 * observer, and memoising the column reads there drops their dependencies.
 */
const tableSizeCache = new WeakMap<Table, TableSize>();

function tableSize(state: RootState, table: Table): TableSize {
  const { settings } = state;
  // Column widths are not in the key — reading them all is the cost being
  // avoided. The width generation stands in for them, which is why every
  // non-move action bumps it.
  const key = `${getWidthGeneration()}|${settings.show}|${settings.maxWidthComment}|${table.ui.widthName}|${table.ui.widthComment}|${table.columnIds.length}`;

  const cached = tableSizeCache.get(table);
  if (cached?.key === key) return cached;

  const size: TableSize = {
    key,
    width: calcTableWidths(table, state).width,
    height: calcTableHeight(table),
  };
  tableSizeCache.set(table, size);
  return size;
}

export function tableToObjectPoint(
  state: RootState,
  table: Table
): ObjectPoint {
  const { width, height } = tableSize(state, table);
  const { x, y } = table.ui;
  return {
    width,
    height,
    top: {
      x: x + width / 2,
      y,
    },
    bottom: {
      x: x + width / 2,
      y: y + height,
    },
    left: {
      x,
      y: y + height / 2,
    },
    right: {
      x: x + width,
      y: y + height / 2,
    },
    lt: {
      x,
      y,
    },
    rt: {
      x: x + width,
      y,
    },
    lb: {
      x,
      y: y + height,
    },
    rb: {
      x: x + width,
      y: y + height,
    },
  };
}

export function euclideanDistance(a: Point, b: Point) {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

export function manhattanDistance(a: Point, b: Point) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
