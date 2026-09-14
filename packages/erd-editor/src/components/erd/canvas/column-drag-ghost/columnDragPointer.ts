import { observable } from '@dineug/r-html';

import { COLUMN_HEIGHT } from '@/constants/layout';
import type { RootState } from '@/engine/state';
import type { Point, Table } from '@/internal-types';
import { getColumnRect, getTableRect } from '@/konva/scene/metrics';
import { sceneKeyOf } from '@/konva/scene/viewFreeze';

/**
 * The pointer a column drag holds, in canvas units: where it is, where it took
 * the rows it carries, and whether a drop target is under it right now.
 */
export type ColumnDragPointer = {
  x: number;
  y: number;
  /** The pointer's offset from the top left of the rows it carries. */
  grabX: number;
  grabY: number;
  over: boolean;
};

/**
 * Keyed like the entity drag, by editor id and source, so two editors on a
 * page draw only their own. Scene state that no action carries, so the ghost
 * it draws never reaches the document, the history or a peer.
 */
const state = observable({
  pointers: {} as Record<string, ColumnDragPointer>,
});

/**
 * Takes hold of the rows a drag carries at the press on one of them. The ghost
 * stacks them in drag order, so the pressed row sits that many rows down it.
 */
export function beginColumnDragPointer(
  root: RootState,
  table: Table,
  press: Point,
  { columnId, columnIds }: { columnId: string; columnIds: string[] }
): void {
  const row = getColumnRect(root, table, table.columnIds.indexOf(columnId));
  const stackIndex = Math.max(columnIds.indexOf(columnId), 0);

  state.pointers[sceneKeyOf(root, 'document')] = {
    ...press,
    grabX: press.x - getTableRect(root, table).x,
    grabY: press.y - row.y + stackIndex * COLUMN_HEIGHT,
    over: true,
  };
}

/** Follows the pointer of a drag that began, and ignores one that never did. */
export function moveColumnDragPointer(
  root: RootState,
  { x, y }: Point,
  over: boolean
): void {
  const pointer = state.pointers[sceneKeyOf(root, 'document')];
  if (!pointer) return;

  pointer.x = x;
  pointer.y = y;
  pointer.over = over;
}

export function endColumnDragPointer(root: RootState): void {
  Reflect.deleteProperty(state.pointers, sceneKeyOf(root, 'document'));
}

/** Reads the pointer through the observable, so a render tracks it. */
export function getColumnDragPointer(
  root: RootState
): ColumnDragPointer | null {
  return state.pointers[sceneKeyOf(root, 'document')] ?? null;
}
