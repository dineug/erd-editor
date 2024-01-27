import { round } from 'lodash-es';

import { getViewport, getZoomViewport } from '@/core/helper/dragSelect.helper';
import {
  moveCanvas,
  movementCanvas,
  movementZoomCanvas,
  zoomCanvas,
} from '@/engine/command/canvas.cmd.helper';
import { zoomBalanceRange } from '@/engine/store/helper/canvas.helper';
import { Store } from '@@types/engine/store';

function zoomLevelInRange(zoom: number) {
  return round(zoomBalanceRange(zoom), 2);
}

function getMovementScrollTo(store: Store, nextZoomLevel: number) {
  const viewport = getViewport(store);
  const {
    canvasState: { width, height, zoomLevel, scrollLeft, scrollTop },
  } = store;

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

export function* movementZoomCanvas$(store: Store, value: number) {
  const nextZoomLevel = zoomLevelInRange(store.canvasState.zoomLevel + value);
  const { movementX, movementY } = getMovementScrollTo(store, nextZoomLevel);

  yield movementZoomCanvas(value);
  yield movementCanvas(movementX, movementY);
}

export function* zoomCanvas$(store: Store, value: number) {
  const nextZoomLevel = zoomLevelInRange(value);
  const { movementX, movementY } = getMovementScrollTo(store, nextZoomLevel);
  const { scrollTop, scrollLeft } = store.canvasState;

  yield zoomCanvas(value);
  yield moveCanvas(scrollTop + movementY, scrollLeft + movementX);
}
