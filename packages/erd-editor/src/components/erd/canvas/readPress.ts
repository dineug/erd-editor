import { query } from '@dineug/erd-editor-schema';
import { observable, type Ref } from '@dineug/r-html';
import { type Subscription, takeUntil, tap } from 'rxjs';

import type { AppContext } from '@/components/appContext';
import { type SceneHit, sceneHit } from '@/components/erd/hitTest';
import { setRelationshipHighlights } from '@/components/erd/relationshipHighlight';
import { CLICK_DRAG_MIN_MOVE } from '@/constants/layout';
import { unselectAllAction$ } from '@/engine/modules/editor/generator.actions';
import { streamScrollToAction } from '@/engine/modules/settings/atom.actions';
import type { RootState } from '@/engine/state';
import {
  isMainButtonPress,
  isMouseEvent,
  suppressSelection,
} from '@/utils/domEvent';
import { type DragMove, move$, moveEnd$ } from '@/utils/globalEventObservable';

export type ViewPressOptions = {
  /** The view's own app, whose store a press pans and whose editor id it lights in. */
  app: AppContext;
  /** The view's root, whose text a pan keeps from being selected. */
  root: Ref<HTMLDivElement>;
  /** The stage container, the one part of the view a press pans and lights from. */
  canvas: Ref<HTMLDivElement>;
  /** Whether a pinch takes the press, a second finger's, which then never pans. */
  pinches: (event: MouseEvent | TouchEvent) => boolean;
  /**
   * Whether a finger pans before the root holds the focus, as on a root that
   * holds every touch from the start; false if unset, leaving it to the page.
   */
  pansBeforeFocus?: boolean;
};

export type ViewPress = {
  /** Whether a pan has travelled past a click, which the root shows a grabbing cursor for. */
  state: { panning: boolean };
  /** A press on the view's root: a pan, and a light set or put out where it stood still. */
  handlePress: (event: MouseEvent | TouchEvent) => void;
  /** The entity the pointer came onto: a table lights its relationships while it is there. */
  handleHover: (hit: SceneHit | null) => void;
  /** Puts out what a press and the pointer lit, for a document that replaces the one they stood on. */
  reset: () => void;
  destroy: () => void;
};

/** The relationships either end of which stands on the table, in the document's order. */
export function tableRelationshipIds(
  { doc, collections }: RootState,
  tableId: string
): string[] {
  return query(collections)
    .collection('relationshipEntities')
    .selectByIds(doc.relationshipIds)
    .filter(
      ({ start, end }) => start.tableId === tableId || end.tableId === tableId
    )
    .map(({ id }) => id);
}

/**
 * The press rule of the read-only view and a readonly ERD tab: a main press, and
 * a finger once the root holds the focus or at once with pansBeforeFocus, pans;
 * one held still drops a jump's selection and lights a relationship or a table's.
 */
export function createViewPress({
  app,
  root,
  canvas,
  pinches,
  pansBeforeFocus = false,
}: ViewPressOptions): ViewPress {
  const state = observable({ panning: false });
  // What a still press lit and what the pointer rests on, kept apart so the
  // pointer leaving a table puts out its own light and never the pressed one.
  let pinned: string[] = [];
  let hovered: string[] = [];
  let hoveredTableId: string | null = null;
  let pan: Subscription | null = null;

  const light = () => {
    setRelationshipHighlights(app.store.state.editor.id, [
      ...pinned,
      ...hovered,
    ]);
  };

  const lightsOf = (hit: SceneHit | null): string[] => {
    if (hit?.kind === 'table') {
      return tableRelationshipIds(app.store.state, hit.id);
    }
    return hit?.kind === 'relationship' ? [hit.id] : [];
  };

  const handleHover = (hit: SceneHit | null) => {
    const tableId = hit?.kind === 'table' ? hit.id : null;
    if (tableId === hoveredTableId) return;

    hoveredTableId = tableId;
    hovered = tableId ? tableRelationshipIds(app.store.state, tableId) : [];
    light();
  };

  /** Whether the view holds the focus, before which a finger is the page's. */
  const holdsFocus = () => Boolean(root.value?.matches(':focus-within'));

  /**
   * A press held still gives the view the focus a touch Konva prevented never
   * would, as a click's own default does, without scrolling the page to it.
   */
  const takeFocus = () => {
    if (!holdsFocus()) root.value?.focus({ preventScroll: true });
  };

  const handleStill = (hit: SceneHit | null) => {
    takeFocus();
    app.store.dispatch(unselectAllAction$());
    pinned = lightsOf(hit);
    light();
  };

  const reset = () => {
    pinned = [];
    hovered = [];
    hoveredTableId = null;
    light();
  };

  const endPan = () => {
    pan?.unsubscribe();
    pan = null;
    state.panning = false;
  };

  const handlePress = (event: MouseEvent | TouchEvent) => {
    const target = event.target;
    const $canvas = canvas.value;
    if (!(target instanceof Node) || !$canvas?.contains(target)) return;

    // A second finger is a pinch's: the pan the first one started ends with no
    // light, since the fingers lifting off would read as a press held still.
    if (pinches(event)) {
      endPan();
      return;
    }
    if (!isMainButtonPress(event)) return;

    // Konva resolved the press as it dispatched it, before the move re-renders.
    const hit = sceneHit($canvas, event);
    // A finger before the focus is the page's, which may scroll for it: it pans
    // nothing, and it is a tap only once lifted, since the browser cancels the
    // one it takes for a scroll. A root that holds every touch leaves none to it.
    const pans = isMouseEvent(event) || pansBeforeFocus || holdsFocus();
    let travel = 0;
    let lifted = false;

    endPan();
    const until$ = moveEnd$.pipe(
      tap(({ type }) => {
        lifted = type === 'touchend';
      })
    );
    const subscription = move$.pipe(takeUntil(until$)).subscribe({
      next: ({ event: move, movementX, movementY }: DragMove) => {
        move.type === 'mousemove' && move.preventDefault();
        if (movementX === 0 && movementY === 0) return;

        travel += Math.abs(movementX) + Math.abs(movementY);
        if (!pans) return;
        if (travel >= CLICK_DRAG_MIN_MOVE) state.panning = true;
        app.store.dispatch(streamScrollToAction({ movementX, movementY }));
      },
      complete: () => {
        state.panning = false;
        if (travel < CLICK_DRAG_MIN_MOVE && (pans || lifted)) handleStill(hit);
      },
    });

    subscription.add(suppressSelection(root.value));
    pan = subscription;
  };

  return { state, handlePress, handleHover, reset, destroy: endPan };
}
