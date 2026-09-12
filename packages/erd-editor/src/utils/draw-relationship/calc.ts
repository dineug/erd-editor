import { ShowMode } from '@/engine/modules/editor/state';
import { getSourceView } from '@/engine/modules/editor/view';
import { RootState } from '@/engine/state';
import { Point, Table } from '@/internal-types';
import { getTablePoint, getVisibleColumnIds } from '@/konva/scene/viewLayout';
import {
  calcTableHeight,
  calcTableWidths,
  calcViewTableWidths,
  getWidthGeneration,
} from '@/utils/calcTable';
import { ObjectPoint } from '@/utils/draw-relationship';
import type {
  GeometrySource,
  ViewSource,
} from '@/utils/draw-relationship/geometrySource';

type TableSize = { key: string; width: number; height: number };

/**
 * Table box sizes, held across relationship sorts, a slot per source so a view
 * over the document does not evict what the document measured. Deliberately
 * outside calcTableWidths: render paths call that inside an r-html observer, and memoising there drops the column dependencies.
 */
const tableSizeCaches: Record<GeometrySource, WeakMap<Table, TableSize>> = {
  document: new WeakMap(),
  flow: new WeakMap(),
};

/** A size's cache key, and the measure taken only when the key misses. */
type PendingSize = { key: string; measure: () => TableSize };

function tableSize(
  state: RootState,
  table: Table,
  source: GeometrySource
): TableSize {
  const cache = tableSizeCaches[source];
  const pending =
    source === 'document'
      ? documentTableSize(state, table)
      : viewTableSize(state, table, source);
  const cached = cache.get(table);
  if (cached?.key === pending.key) return cached;

  const size = pending.measure();
  cache.set(table, size);
  return size;
}

/**
 * Column widths are not in the key, reading them all is the cost being
 * avoided. The width generation stands in for them, which is why every
 * non-move action bumps it.
 */
function documentTableSize(state: RootState, table: Table): PendingSize {
  const { settings } = state;
  const key = `${getWidthGeneration()}|${settings.show}|${settings.maxWidthComment}|${table.ui.widthName}|${table.ui.widthComment}|${table.columnIds.length}`;

  return {
    key,
    measure: () => ({
      key,
      width: calcTableWidths(table, state).width,
      height: calcTableHeight(table),
    }),
  };
}

/**
 * Keyed on what a view draws and none of the settings only the document shows,
 * so a show bit toggled under a view neither remeasures it nor makes its scene
 * an observer of the bit. With no view open every row shows, as under allFields, and the two share a key.
 */
function viewTableSize(
  state: RootState,
  table: Table,
  source: ViewSource
): PendingSize {
  const showMode = getSourceView(state, source)?.showMode ?? ShowMode.allFields;
  const columnIds = getVisibleColumnIds(state, table, source);
  const key = `${getWidthGeneration()}|${table.ui.widthName}|${table.columnIds.length}|${showMode}|${columnIds.length}`;

  return {
    key,
    measure: () => ({
      key,
      width: calcViewTableWidths(table, state, columnIds).width,
      height: calcTableHeight(table, columnIds.length, source),
    }),
  };
}

/**
 * The box and the four edge midpoints the sort anchors against, at the point
 * and the size the source given draws the table at.
 */
export function tableToObjectPoint(
  state: RootState,
  table: Table,
  source: GeometrySource = 'document'
): ObjectPoint {
  const { width, height } = tableSize(state, table, source);
  const { x, y } = getTablePoint(state, table, source);
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
