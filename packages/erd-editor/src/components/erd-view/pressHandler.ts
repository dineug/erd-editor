import { query } from '@dineug/erd-editor-schema';
import { observable, type Ref } from '@dineug/r-html';
import type { Subscription } from 'rxjs';

import type { AppContext } from '@/components/appContext';
import { type SceneHit, sceneHit } from '@/components/erd/hitTest';
import { setRelationshipHighlights } from '@/components/erd/relationshipHighlight';
import { CLICK_DRAG_MIN_MOVE } from '@/constants/layout';
import { unselectAllAction$ } from '@/engine/modules/editor/generator.actions';
import { streamScrollToAction } from '@/engine/modules/settings/atom.actions';
import type { RootState } from '@/engine/state';
import { isMainButtonPress, suppressSelection } from '@/utils/domEvent';
import { drag$, type DragMove } from '@/utils/globalEventObservable';

export type ViewPressOptions = {
  /** The view's own app, whose store a press pans and whose editor id it lights in. */
  app: AppContext;
  /** The view's root, whose text a pan keeps from being selected. */
  root: Ref<HTMLDivElement>;
  /** The stage container, the one part of the view a press pans and lights from. */
  canvas: Ref<HTMLDivElement>;
  /** Whether a pinch takes the press, a second finger's, which then never pans. */
  pinches: (event: MouseEvent | TouchEvent) => boolean;
};

export type ViewPress = {
  /** Whether a pan has travelled past a click, which the root shows a grabbing cursor for. */
  state: { panning: boolean };
  /** A press on the view's root: a pan, and a light set or put out where it stood still. */
  handlePress: (event: MouseEvent | TouchEvent) => void;
  /** The entity the pointer came onto: a table lights its relationships while it is there. */
  handleHover: (hit: SceneHit | null) => void;
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
 * The read-only view's press rule. A main press or a finger pans wherever it
 * lands, and one that stays still takes the selection a jump left and lights
 * what it landed on: a table's relationships, a relationship, or nothing.
 */
export function createViewPress({
  app,
  root,
  canvas,
  pinches,
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

  const handleStill = (hit: SceneHit | null) => {
    app.store.dispatch(unselectAllAction$());
    pinned = lightsOf(hit);
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
    let travel = 0;

    endPan();
    const subscription = drag$.subscribe({
      next: ({ event: move, movementX, movementY }: DragMove) => {
        move.type === 'mousemove' && move.preventDefault();
        if (movementX === 0 && movementY === 0) return;

        travel += Math.abs(movementX) + Math.abs(movementY);
        if (travel >= CLICK_DRAG_MIN_MOVE) state.panning = true;
        app.store.dispatch(streamScrollToAction({ movementX, movementY }));
      },
      complete: () => {
        state.panning = false;
        if (travel < CLICK_DRAG_MIN_MOVE) handleStill(hit);
      },
    });

    subscription.add(suppressSelection(root.value));
    pan = subscription;
  };

  return { state, handlePress, handleHover, destroy: endPan };
}
