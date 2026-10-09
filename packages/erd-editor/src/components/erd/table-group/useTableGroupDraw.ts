import { observable, type Ref } from '@dineug/r-html';
import { Subscription } from 'rxjs';

import type { AppContext } from '@/components/appContext';
import { addTableGroupAndRename } from '@/components/erd/table-group/tableGroupName';
import {
  CLICK_DRAG_MIN_MOVE,
  TABLE_GROUP_DEFAULT_HEIGHT,
  TABLE_GROUP_DEFAULT_WIDTH,
  TABLE_GROUP_MIN_HEIGHT,
  TABLE_GROUP_MIN_WIDTH,
} from '@/constants/layout';
import { changeDrawTableGroupAction } from '@/engine/modules/editor/atom.actions';
import { addTableGroupAction$ } from '@/engine/modules/table-group/generator.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import type { Point } from '@/internal-types';
import type { Rect } from '@/konva/scene/metrics';
import { getSceneTransform, toScenePoint } from '@/konva/scene/viewport';
import {
  editorRootOf,
  isMouseEvent,
  suppressSelection,
} from '@/utils/domEvent';
import { drag$ } from '@/utils/globalEventObservable';

export type TableGroupDrawOptions = {
  /** The editor whose store the group lands in. */
  app: () => AppContext;
  /** The box the scene hangs in, which the draw is measured against. */
  root: Ref<HTMLDivElement>;
};

const clientPointOf = (event: MouseEvent | TouchEvent): Point =>
  isMouseEvent(event)
    ? { x: event.clientX, y: event.clientY }
    : { x: event.touches[0].clientX, y: event.touches[0].clientY };

/**
 * The draw mode's gesture: from a press on the canvas, a box the travel spans,
 * never under the least a group takes at the zoom, which the release adds as a
 * group. A release with no travel adds a default-size group at the press.
 *
 * @example
 * const draw = useTableGroupDraw({ app: () => app.value, root });
 * draw.start(event);
 */
export function useTableGroupDraw({ app, root }: TableGroupDrawOptions) {
  // The box shown while the pointer travels, in the root's own pixels.
  const state = observable({ draft: null as Rect | null });
  const { addUnsubscribe } = useUnmounted();
  let subscription: Subscription | null = null;

  const pointIn = ({ x, y }: Point): Point => {
    const rect = root.value.getBoundingClientRect();
    return { x: x - rect.x, y: y - rect.y };
  };

  const transformOf = () => getSceneTransform(app().store.state, 'document');

  /** The box from the press to the pointer, or null short of a drag. */
  const draftOf = (from: Point, to: Point): Rect | null => {
    const travel = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
    if (travel < CLICK_DRAG_MIN_MOVE) return null;

    const { zoomLevel } = transformOf();
    return {
      x: Math.min(from.x, to.x),
      y: Math.min(from.y, to.y),
      width: Math.max(
        Math.abs(to.x - from.x),
        TABLE_GROUP_MIN_WIDTH * zoomLevel
      ),
      height: Math.max(
        Math.abs(to.y - from.y),
        TABLE_GROUP_MIN_HEIGHT * zoomLevel
      ),
    };
  };

  /** The group's rect in scene units: the draft's, or the default size at the press. */
  const sceneRectOf = (from: Point, draft: Rect | null): Rect => {
    const transform = transformOf();
    const origin = toScenePoint(transform, draft ?? from);
    const width = draft
      ? Math.max(draft.width / transform.zoomLevel, TABLE_GROUP_MIN_WIDTH)
      : TABLE_GROUP_DEFAULT_WIDTH;
    const height = draft
      ? Math.max(draft.height / transform.zoomLevel, TABLE_GROUP_MIN_HEIGHT)
      : TABLE_GROUP_DEFAULT_HEIGHT;

    return {
      x: Math.round(origin.x),
      y: Math.round(origin.y),
      width: Math.round(width),
      height: Math.round(height),
    };
  };

  const stop = () => {
    subscription?.unsubscribe();
    subscription = null;
    state.draft = null;
  };

  /** Whether the mode still holds: Escape, a tab switch or readonly ends it while the pointer travels. */
  const isArmed = () => {
    const { store } = app();
    return store.state.editor.drawTableGroup && !store.getReadonly();
  };

  const end = (from: Point, draft: Rect | null) => {
    stop();
    if (!isArmed()) return;

    const { store } = app();
    const rect = sceneRectOf(from, draft);
    store.dispatchSync(changeDrawTableGroupAction({ value: false }));
    addTableGroupAndRename(store, addTableGroupAction$(rect));
  };

  const start = (event: MouseEvent | TouchEvent) => {
    stop();

    const from = pointIn(clientPointOf(event));
    let draft: Rect | null = null;

    subscription = drag$.subscribe({
      next: ({ event: move, x, y }) => {
        if (move.type === 'mousemove') move.preventDefault();
        if (!isArmed()) {
          stop();
          return;
        }

        draft = draftOf(from, pointIn({ x, y }));
        state.draft = draft;
      },
      complete: () => end(from, draft),
    });
    // Before the first move, as a pan does: a native drag the press grows into
    // would eat the release this ends on.
    subscription.add(suppressSelection(editorRootOf(root.value)));
  };

  addUnsubscribe(stop);

  return { state, start };
}
