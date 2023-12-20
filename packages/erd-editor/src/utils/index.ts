import { camelCase, range, upperFirst } from 'lodash-es';

import { START_ADD, START_X, START_Y } from '@/constants/layout';
import { EntityMeta, Memo, Point, Settings, Table } from '@/internal-types';
import { getAbsolutePoint } from '@/utils/dragSelect';

const toZIndex = (data: Table | Memo) => data.ui.zIndex;

export const nextZIndex = (tables: Table[], memos: Memo[]) =>
  Math.max(1, ...tables.map(toZIndex), ...memos.map(toZIndex)) + 1;

const isSamePoint = (a: Point) => (b: Point) => a.y === b.y && a.x === b.x;

export function nextPoint(
  { width, height, zoomLevel, scrollLeft, scrollTop }: Settings,
  tables: Table[],
  memos: Memo[]
): Point {
  const point = getAbsolutePoint(
    {
      x: START_X - scrollLeft,
      y: START_Y - scrollTop,
    },
    width,
    height,
    zoomLevel
  );

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
  const now = Date.now();
  return {
    updateAt: now,
    createAt: now,
  };
}

export function safeRange(a: number, b: number) {
  return a < b ? range(a, b + 1) : range(b, a + 1);
}

export function pascalCase(value?: string) {
  return upperFirst(camelCase(value));
}
