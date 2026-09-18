import { round } from 'es-toolkit/compat';

import { GeneratorAction } from '@/engine/generator.actions';
import {
  viewChangeZoomLevelAction,
  viewScrollToAction,
  viewStreamScrollToAction,
  viewStreamZoomLevelAction,
} from '@/engine/modules/editor/view.actions';
import { RootState } from '@/engine/state';
import { Point } from '@/internal-types';
import {
  getZoomTransform,
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
 * How far the scroll has to travel for the scene point given to land under the
 * screen point given once the zoom changes, solved with the placement given.
 */
function getMovementToPlace(
  transform: SceneTransform,
  nextZoomLevel: number,
  scene: Point,
  screen: Point
) {
  const landed = toScreenPoint(
    { ...transform, zoomLevel: nextZoomLevel },
    scene
  );

  return {
    movementX: round(screen.x - landed.x, 4),
    movementY: round(screen.y - landed.y, 4),
  };
}

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

  return getMovementToPlace(
    transform,
    nextZoomLevel,
    toScenePoint(transform, center),
    center
  );
}

/** The origin it adds the movement to is the one getMovementScrollTo solved against. */
export const changeZoomLevelAction$ = (
  value: number,
  source?: GeometrySource
): GeneratorAction =>
  function* (state) {
    const transform = getZoomTransform(state, source);
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
    const transform = getZoomTransform(state, source);
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

export type PinchZoom = {
  /** The zoom the pinch has reached, which the store rounds as it lands. */
  zoomLevel: number;
  /** Where the pinch is centred now, in the scene box. */
  screen: Point;
  /** The scene point the pinch holds, else the one under screen. */
  scene?: Point;
};

/**
 * A step of a pinch: the zoom it has reached, with the scene point it holds put
 * under where it is centred now, so two fingers zoom about their midpoint and
 * pan as it travels. Streamed, so a whole pinch is one undo entry as a wheel is.
 */
export const pinchZoomAction$ = (
  { zoomLevel, screen, scene }: PinchZoom,
  source?: GeometrySource
): GeneratorAction =>
  function* (state) {
    const transform = getZoomTransform(state, source);
    const nextZoomLevel = zoomLevelInRange(zoomLevel);
    const value = round(nextZoomLevel - transform.zoomLevel, 2);
    const movement = getMovementToPlace(
      transform,
      nextZoomLevel,
      scene ?? toScenePoint(transform, screen),
      screen
    );

    const kind = source && source !== 'document' ? source : null;

    // Only what moved, so a pinch that stands still pushes no undo entry.
    if (value !== 0) {
      yield kind
        ? viewStreamZoomLevelAction({ value, kind })
        : streamZoomLevelAction({ value });
    }
    if (movement.movementX !== 0 || movement.movementY !== 0) {
      yield kind
        ? viewStreamScrollToAction({ ...movement, kind })
        : streamScrollToAction(movement);
    }
  };

export const actions$ = {
  changeZoomLevelAction$,
  streamZoomLevelAction$,
};
