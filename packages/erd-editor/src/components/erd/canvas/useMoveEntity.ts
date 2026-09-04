import { useAppContext } from '@/components/appContext';
import { tryStartAltDragDuplicate } from '@/components/erd/canvas/altDragDuplicate';
import {
  beginEntityDrag,
  endEntityDrag,
} from '@/components/erd/canvas/entityDrag';
import { hasKindAncestor } from '@/components/erd/canvas/sceneKind';
import type { ScenePointerEvent } from '@/components/erd/canvas/sceneTokens';
import { moveAllAction$ } from '@/engine/modules/editor/generator.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { selectMemoAction$ } from '@/engine/modules/memo/generator.actions';
import { selectTableAction$ } from '@/engine/modules/table/generator.actions';
import type { Ctx } from '@/internal-types';
import { drag$, DragMove } from '@/utils/globalEventObservable';
import { isMod } from '@/utils/keyboard-shortcut';

export type MoveEntityOptions = {
  /** Read late, because repeat hands a component a new entity in place. */
  entityId: () => string;
  selectType: SelectType;
  /** The scene kinds a drag never starts from, as closest read their classes. */
  blockedKinds: readonly string[];
};

/**
 * The pointer start every draggable entity shares: select it, hand an Alt drag
 * to the duplicate ghost, and otherwise move the whole selection with the
 * pointer. Only the entity kind and the blocked areas differ between them.
 */
export function useMoveEntity(ctx: Ctx, options: MoveEntityOptions) {
  const app = useAppContext(ctx);

  const handleMove = ({ event, movementX, movementY }: DragMove) => {
    event.type === 'mousemove' && event.preventDefault();
    const { store } = app.value;
    store.dispatch(moveAllAction$(movementX, movementY));
  };

  const onMoveStart = (event: ScenePointerEvent) => {
    if (!event?.target) return;

    const { store } = app.value;
    const entityId = options.entityId();
    const canDrag = !hasKindAncestor(event.target, options.blockedKinds);

    // move$ is not share()d and mutates module-global prevX/prevY, so
    // a second concurrent drag$ subscriber always reads movementX === 0.
    if (
      canDrag &&
      tryStartAltDragDuplicate(
        app.value,
        event.evt,
        entityId,
        options.selectType
      )
    ) {
      return;
    }

    const $mod = isMod(event.evt);

    store.dispatch(
      options.selectType === SelectType.memo
        ? selectMemoAction$(entityId, $mod)
        : selectTableAction$(entityId, $mod)
    );

    if (canDrag) {
      beginEntityDrag();
      drag$.subscribe({ next: handleMove, complete: endEntityDrag });
    }
  };

  return {
    onMoveStart,
  };
}
