import { RootState } from '@/engine/state';
import { Point, Table } from '@/internal-types';
import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';
import { ObjectPoint } from '@/utils/draw-relationship';

export function tableToObjectPoint(
  state: RootState,
  table: Table
): ObjectPoint {
  const width = calcTableWidths(table, state).width;
  const height = calcTableHeight(table);
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
