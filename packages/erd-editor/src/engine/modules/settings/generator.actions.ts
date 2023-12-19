import { round } from 'lodash-es';

import { GeneratorAction } from '@/engine/generator.actions';
import { RootState } from '@/engine/state';
import { getZoomViewport } from '@/utils/dragSelect';
import { zoomLevelInRange } from '@/utils/validation';

import {
  changeZoomLevelAction,
  scrollToAction,
  streamScrollToAction,
  streamZoomLevelAction,
} from './atom.actions';

function getMovementScrollTo(
  {
    editor: { viewport },
    settings: { scrollLeft, scrollTop, zoomLevel, width, height },
  }: RootState,
  nextZoomLevel: number
) {
  const zoomViewport = getZoomViewport(width, height, zoomLevel);
  const nextZoomViewport = getZoomViewport(width, height, nextZoomLevel);
  const x = (zoomViewport.w - nextZoomViewport.w) / 2;
  const y = (zoomViewport.h - nextZoomViewport.h) / 2;
  const centerX = width / 2;
  const centerY = height / 2;
  const viewportCenterX = scrollLeft * -1 + viewport.width / 2;
  const viewportCenterY = scrollTop * -1 + viewport.height / 2;
  const centerXRatio = (centerX - viewportCenterX) / centerX;
  const centerYRatio = (centerY - viewportCenterY) / centerY;
  const movementX = round(-1 * x * centerXRatio, 4);
  const movementY = round(-1 * y * centerYRatio, 4);

  return { movementX, movementY };
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
