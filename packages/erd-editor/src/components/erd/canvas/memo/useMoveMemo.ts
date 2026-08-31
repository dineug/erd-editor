import { useMoveEntity } from '@/components/erd/canvas/useMoveEntity';
import { SelectType } from '@/engine/modules/editor/state';
import { Ctx, Memo } from '@/internal-types';

/**
 * Where a memo drag never starts. The colour bar opens the picker, the value is
 * an edit surface, the icon is a button and a sash resizes the box, so each of
 * the four owns the gesture that lands on it.
 */
const BLOCKED_KINDS = ['memo-header-color', 'memo-textarea', 'icon', 'sash'];

export function useMoveMemo(ctx: Ctx, props: { memo: Memo }) {
  return useMoveEntity(ctx, {
    entityId: () => props.memo.id,
    selectType: SelectType.memo,
    blockedKinds: BLOCKED_KINDS,
  });
}
