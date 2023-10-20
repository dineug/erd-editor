import { DateTime } from 'luxon';

import { START_ADD, START_X, START_Y } from '@/constants/layout';
import { EntityMeta, Memo, Point, Settings, Table } from '@/internal-types';

export { v4 as uuid } from 'uuid';

const toZIndex = (data: Table | Memo) => data.ui.zIndex;

export const nextZIndex = (tables: Table[], memos: Memo[]) =>
  Math.max(1, ...tables.map(toZIndex), ...memos.map(toZIndex)) + 1;

const isSamePoint = (a: Point) => (b: Point) => a.y === b.y && a.x === b.x;

export function nextPoint(
  { scrollLeft, scrollTop }: Settings,
  tables: Table[],
  memos: Memo[]
): Point {
  const point: Point = {
    x: START_X - scrollLeft,
    y: START_Y - scrollTop,
  };

  const points = [...tables, ...memos].map(({ ui }) => ui);

  while (points.some(isSamePoint(point))) {
    point.x += START_ADD;
    point.y += START_ADD;
  }

  return point;
}

export const toList = <T>(
  ids: string[],
  entities: Record<string, T>
): Array<T> => ids.map(id => entities[id]).filter(Boolean);

export function getDefaultEntityMeta(): EntityMeta {
  const now = DateTime.now().toISO() ?? '';
  return {
    updateAt: now,
    createAt: now,
  };
}
