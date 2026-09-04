import { round } from 'es-toolkit/compat';

import { GeneratorAction } from '@/engine/generator.actions';
import { RootState } from '@/engine/state';
import { toScenePoint, toScreenPoint } from '@/konva/scene/viewport';
import { zoomLevelInRange } from '@/utils/validation';

import {
  changeZoomLevelAction,
  scrollToAction,
  streamScrollToAction,
  streamZoomLevelAction,
} from './atom.actions';

/**
 * How far the scroll has to travel for the scene point under the middle of the
 * screen to stay under it, solved with the placement the scene is drawn at. The
 * ratio it replaces was exact only while the zoom being left was 1.
 */
function getMovementScrollTo(
  {
    editor: { viewport },
    settings: { scrollLeft, scrollTop, zoomLevel, width, height },
  }: RootState,
  nextZoomLevel: number
) {
  const transform = { width, height, scrollLeft, scrollTop, zoomLevel };
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

export const changeZoomLevelAction$ = (value: number): GeneratorAction =>
  function* (state) {
    const {
      settings: { scrollLeft, scrollTop },
    } = state;
    const nextZoomLevel = zoomLevelInRange(value);
    const { movementX, movementY } = getMovementScrollTo(state, nextZoomLevel);

    yield changeZoomLevelAction({ value });
    yield scrollToAction({
      scrollLeft: scrollLeft + movementX,
      scrollTop: scrollTop + movementY,
    });
  };

export const streamZoomLevelAction$ = (value: number): GeneratorAction =>
  function* (state) {
    const {
      settings: { zoomLevel },
    } = state;
    const nextZoomLevel = zoomLevelInRange(zoomLevel + value);
    const { movementX, movementY } = getMovementScrollTo(state, nextZoomLevel);

    yield streamZoomLevelAction({ value });
    yield streamScrollToAction({
      movementX,
      movementY,
    });
  };

export const actions$ = {
  changeZoomLevelAction$,
  streamZoomLevelAction$,
};
