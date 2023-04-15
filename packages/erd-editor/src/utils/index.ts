import { START_ADD, START_X, START_Y } from '@/constants/layout';
import {
  Memo,
  MemoEntities,
  Point,
  Settings,
  Table,
  TableEntities,
} from '@/internal-types';

export { v4 as uuid } from 'uuid';

const toZIndex = (data: Table | Memo) => data.ui.zIndex;

export const nextZIndex = (
  tableEntities: TableEntities,
  memoEntities: MemoEntities
) =>
  Math.max(
    1,
    ...Object.values(tableEntities).map(toZIndex),
    ...Object.values(memoEntities).map(toZIndex)
  ) + 1;

const isSamePoint = (a: Point) => (b: Point) => a.y === b.y && a.x === b.x;

export function nextPoint(
  { scrollLeft, scrollTop }: Settings,
  tableEntities: TableEntities,
  memoEntities: MemoEntities
): Point {
  const point: Point = {
    x: START_X - scrollLeft,
    y: START_Y - scrollTop,
  };

  const points = [
    ...Object.values(tableEntities),
    ...Object.values(memoEntities),
  ].map(({ ui }) => ui);

  while (points.some(isSamePoint(point))) {
    point.x += START_ADD;
    point.y += START_ADD;
  }

  return point;
}
