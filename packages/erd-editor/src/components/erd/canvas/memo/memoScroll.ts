import {
  getMemoLineHeightPx,
  layoutMemoLines,
} from '@/components/erd/canvas/memo/memoText';
import type { Editor } from '@/engine/modules/editor/state';
import type { Memo } from '@/internal-types';

/**
 * The furthest a memo body scrolls: what its folded lines overrun the box by,
 * in body px. A body the box holds whole has nowhere to go, which is where a
 * textarea of the same box stops too.
 *
 * @example
 * const max = getMemoScrollMax(memo);
 */
export function getMemoScrollMax(memo: Memo): number {
  const lines = layoutMemoLines(memo.value, memo.ui.width).length;

  return Math.max(0, lines * getMemoLineHeightPx() - memo.ui.height);
}

/**
 * A scroll pulled into the travel the body allows. The value, the width and
 * the height can all change under a stored scroll, so the clamp runs where the
 * scroll is read rather than where it was written.
 *
 * @example
 * const next = clampMemoScrollTop(memo, scrollTop + event.deltaY);
 */
export function clampMemoScrollTop(memo: Memo, scrollTop: number): number {
  return Math.min(Math.max(0, scrollTop), getMemoScrollMax(memo));
}

/**
 * How far down its body the scene shows a memo from. A memo nothing has
 * scrolled starts on its first line, as every memo always did.
 *
 * @example
 * const scrollTop = getMemoScrollTop(store.state.editor, memo);
 */
export function getMemoScrollTop(editor: Editor, memo: Memo): number {
  return clampMemoScrollTop(memo, editor.memoScrollTopMap[memo.id] ?? 0);
}
