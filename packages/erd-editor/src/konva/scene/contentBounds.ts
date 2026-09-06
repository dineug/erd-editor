import { query } from '@dineug/erd-editor-schema';

import { RootState } from '@/engine/state';
import { getMemoRect, getTableRect, type Rect } from '@/konva/scene/metrics';

/** The smallest box holding both. */
export function unionRect(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);

  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

/** A table and the point it is about to be moved to, named before the move is dispatched. */
export type TableMove = { id: string; x: number; y: number };

/**
 * The box every table and memo of the document fits inside, in scene units, or
 * null for a document holding none. Computed afresh on every call: the state is
 * one mutable proxy written in place, so a cache keyed on it never sees a move.
 */
export function getContentRect(state: RootState): Rect | null {
  return getContentRectAfter(state, []);
}

/**
 * One box per table and memo, each table at the point named for it. The reader
 * that asks which entity is nearest needs them apart, where the box below folds
 * them together, and both are the same pass over the document.
 */
export function getContentRects(
  state: RootState,
  moves: ReadonlyArray<TableMove> = []
): Rect[] {
  const { doc, collections } = state;
  const moved = new Map(moves.map(move => [move.id, move]));
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds);
  const memos = query(collections)
    .collection('memoEntities')
    .selectByIds(doc.memoIds);

  return [
    ...tables.map(table => {
      const move = moved.get(table.id);

      return move
        ? getTableRect(state, {
            ...table,
            ui: { ...table.ui, x: move.x, y: move.y },
          })
        : getTableRect(state, table);
    }),
    ...memos.map(getMemoRect),
  ];
}

/**
 * The content rect as it will stand once each table named is at its point. The
 * placement centres the view on where its tables land in the very dispatch that
 * moves them, so it has to know the box before any reducer has run.
 */
export function getContentRectAfter(
  state: RootState,
  moves: ReadonlyArray<TableMove>
): Rect | null {
  const boxes = getContentRects(state, moves);

  return boxes.length ? boxes.reduce(unionRect) : null;
}
