import type { Ref } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { tryStartAltDragDuplicate } from '@/components/erd/canvas/altDragDuplicate';
import {
  beginEntityDrag,
  endEntityDrag,
} from '@/components/erd/canvas/entityDrag';
import { hasKindAncestor } from '@/components/erd/canvas/sceneKind';
import type { ScenePointerEvent } from '@/components/erd/canvas/sceneTokens';
import { CLICK_DRAG_MIN_MOVE } from '@/constants/layout';
import { moveAllAction$ } from '@/engine/modules/editor/generator.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { selectMemoAction$ } from '@/engine/modules/memo/generator.actions';
import { selectTableAction$ } from '@/engine/modules/table/generator.actions';
import type { Ctx } from '@/internal-types';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import { drag$, DragMove } from '@/utils/globalEventObservable';
import { isMod } from '@/utils/keyboard-shortcut';

export type MoveEntityOptions = {
  /** Read late, because repeat hands a component a new entity in place. */
  entityId: () => string;
  selectType: SelectType;
  /** The scene kinds a drag never starts from in the scene pressed, as closest read their classes. */
  blockedKinds: (source: GeometrySource) => readonly string[];
  /**
   * The kinds whose press is a click as well: the drag waits for the pointer
   * to travel before it lifts the entity into the drag layer, which takes it
   * off the hit canvas, so a click or a double click there lands where it pressed.
   */
  clickKinds?: (source: GeometrySource) => readonly string[];
  /**
   * The scene the component already stands in, handed down rather than read
   * again here, so a leaf pays for one context subscription and not two.
   */
  source: Ref<GeometrySource>;
};

/**
 * The pointer start every draggable entity shares: select it, hand an Alt drag
 * to the duplicate ghost, and otherwise move the whole selection with the
 * pointer. Only the entity kind and the blocked areas differ between them.
 */
export function useMoveEntity(ctx: Ctx, options: MoveEntityOptions) {
  const app = useAppContext(ctx);

  const handleMove =
    (source: GeometrySource) =>
    ({ event, movementX, movementY }: DragMove) => {
      event.type === 'mousemove' && event.preventDefault();
      const { store } = app.value;
      store.dispatch(moveAllAction$(movementX, movementY, source));
    };

  const onMoveStart = (event: ScenePointerEvent) => {
    if (!event?.target) return;

    const { store } = app.value;
    const entityId = options.entityId();
    const source = options.source.value;
    const canDrag = !hasKindAncestor(
      event.target,
      options.blockedKinds(source)
    );

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

    // A press on something already selected keeps the rest of the selection,
    // so a group moves as one under a plain drag; a press on anything else
    // collapses to it, which is the rule the alt drag duplicate reads too.
    const keepSelection =
      isMod(event.evt) || Boolean(store.state.editor.selectedMap[entityId]);

    store.dispatch(
      options.selectType === SelectType.memo
        ? selectMemoAction$(entityId, keepSelection)
        : selectTableAction$(entityId, keepSelection)
    );

    if (!canDrag) return;

    const move = handleMove(source);
    let begun = false;
    let pendingX = 0;
    let pendingY = 0;

    // The scene this drag holds and moves is the one the press landed in: a
    // view's drag freezes the view's origin and moves the view's placement,
    // the document's its own, and the same source releases it at the drop.
    const begin = () => {
      begun = true;
      beginEntityDrag(store.state, source);
    };

    if (!hasKindAncestor(event.target, options.clickKinds?.(source) ?? [])) {
      begin();
    }

    // The gesture belongs to the pointer, not to this component: the press
    // raises the entity's z-index and the scene rebuilds the node it started
    // on, so the subscription outlives it and a finalizer lets the view go.
    drag$
      .subscribe(drag => {
        if (begun) return move(drag);

        drag.event.type === 'mousemove' && drag.event.preventDefault();
        pendingX += drag.movementX;
        pendingY += drag.movementY;
        if (Math.abs(pendingX) + Math.abs(pendingY) < CLICK_DRAG_MIN_MOVE) {
          return;
        }

        begin();
        move({ ...drag, movementX: pendingX, movementY: pendingY });
      })
      .add(() => begun && endEntityDrag(store.state, source));
  };

  return {
    onMoveStart,
  };
}
