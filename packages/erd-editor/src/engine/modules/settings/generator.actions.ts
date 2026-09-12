import { round } from 'es-toolkit/compat';

import { GeneratorAction } from '@/engine/generator.actions';
import {
  viewChangeZoomLevelAction,
  viewScrollToAction,
  viewStreamScrollToAction,
  viewStreamZoomLevelAction,
} from '@/engine/modules/editor/view.actions';
import { RootState } from '@/engine/state';
import {
  getActiveTransform,
  getSceneTransform,
  type SceneTransform,
  toScenePoint,
  toScreenPoint,
} from '@/konva/scene/viewport';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import { zoomLevelInRange } from '@/utils/validation';

import {
  changeZoomLevelAction,
  scrollToAction,
  streamScrollToAction,
  streamZoomLevelAction,
} from './atom.actions';

/**
 * The placement a zoom is solved against and lands in: the scene named, so a
 * view scene zooms the view it draws whichever is active; with no scene named,
 * the active view's else the document's, which is where the redirect sends the yield.
 */
const transformOf = (
  state: RootState,
  source: GeometrySource | undefined
): SceneTransform =>
  source ? getSceneTransform(state, source) : getActiveTransform(state);

/**
 * How far the scroll has to travel for the scene point under the middle of the
 * screen to stay under it, solved with the placement given.
 */
function getMovementScrollTo(
  state: RootState,
  transform: SceneTransform,
  nextZoomLevel: number
) {
  const { viewport } = state.editor;
  const center = { x: viewport.width / 2, y: viewport.height / 2 };
  const anchor = toScenePoint(transform, center);
  const screen = toScreenPoint(
    { ...transform, zoomLevel: nextZoomLevel },
    anchor
  );

  return {
    movementX: round(center.x - screen.x, 4),
    movementY: round(center.y - screen.y, 4),
  };
}

/** The origin it adds the movement to is the one getMovementScrollTo solved against. */
export const changeZoomLevelAction$ = (
  value: number,
  source?: GeometrySource
): GeneratorAction =>
  function* (state) {
    const transform = transformOf(state, source);
    const { originX, originY } = transform;
    const nextZoomLevel = zoomLevelInRange(value);
    const { movementX, movementY } = getMovementScrollTo(
      state,
      transform,
      nextZoomLevel
    );
    const origin = {
      originX: originX + movementX,
      originY: originY + movementY,
    };

    if (source && source !== 'document') {
      yield viewChangeZoomLevelAction({ value, kind: source });
      yield viewScrollToAction({ ...origin, kind: source });
      return;
    }

    yield changeZoomLevelAction({ value });
    yield scrollToAction(origin);
  };

export const streamZoomLevelAction$ = (
  value: number,
  source?: GeometrySource
): GeneratorAction =>
  function* (state) {
    const transform = transformOf(state, source);
    const nextZoomLevel = zoomLevelInRange(transform.zoomLevel + value);
    const movement = getMovementScrollTo(state, transform, nextZoomLevel);

    if (source && source !== 'document') {
      yield viewStreamZoomLevelAction({ value, kind: source });
      yield viewStreamScrollToAction({ ...movement, kind: source });
      return;
    }

    yield streamZoomLevelAction({ value });
    yield streamScrollToAction(movement);
  };

export const actions$ = {
  changeZoomLevelAction$,
  streamZoomLevelAction$,
};
