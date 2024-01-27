import { SIZE_MENUBAR_HEIGHT } from '@/core/layout';
import { Store } from '@@types/engine/store';
import { Viewport } from '@@types/engine/store/editor.state';
import { Point } from '@@types/engine/store/relationship.state';

interface PointToPoint {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function getOverlapPosition(
  dragRect: Rect,
  rect: Rect
): PointToPoint | null {
  if (
    dragRect.x > rect.x + rect.w ||
    dragRect.x + dragRect.w < rect.x ||
    dragRect.y > rect.y + rect.h ||
    dragRect.y + dragRect.h < rect.y
  )
    return null;

  const target: PointToPoint = { x1: 0, y1: 0, x2: 0, y2: 0 };
  target.x1 = Math.max(dragRect.x, rect.x);
  target.y1 = Math.max(dragRect.y, rect.y);
  target.x2 = Math.min(dragRect.x + dragRect.w, rect.x + rect.w) - rect.x;
  target.y2 = Math.min(dragRect.y + dragRect.h, rect.y + rect.h) - rect.y;

  return target;
}

export function getZoomViewport(
  width: number,
  height: number,
  zoomLevel: number
): Rect {
  const viewport: Rect = { x: 0, y: 0, w: 0, h: 0 };

  viewport.w = width * zoomLevel;
  viewport.h = height * zoomLevel;
  viewport.x = (width - viewport.w) / 2;
  viewport.y = (height - viewport.h) / 2;

  return viewport;
}

export const getAbsolutePosition = (
  overlapPosition: PointToPoint,
  zoomViewport: Rect,
  zoomLevel: number
): PointToPoint => ({
  x1: (overlapPosition.x1 - zoomViewport.x) / zoomLevel,
  y1: (overlapPosition.y1 - zoomViewport.y) / zoomLevel,
  x2: overlapPosition.x2 / zoomLevel,
  y2: overlapPosition.y2 / zoomLevel,
});

export function getViewport(store: Store): Viewport {
  return {
    width: store.editorState.viewport.width,
    height: store.editorState.viewport.height - SIZE_MENUBAR_HEIGHT,
  };
}

export function getAbsoluteZoomPoint(
  { x, y }: Point,
  width: number,
  height: number,
  zoomLevel: number
) {
  const zoomViewport = getZoomViewport(width, height, zoomLevel);
  const zoomX = x * zoomLevel;
  const zoomY = y * zoomLevel;
  const absoluteZoomX = zoomViewport.x + zoomX;
  const absoluteZoomY = zoomViewport.y + zoomY;

  return { x: absoluteZoomX, y: absoluteZoomY };
}

export function getAbsolutePoint(
  point: Point,
  width: number,
  height: number,
  zoomLevel: number
): Point {
  const { x, y } = point;
  const { x: absoluteZoomX, y: absoluteZoomY } = getAbsoluteZoomPoint(
    point,
    width,
    height,
    zoomLevel
  );
  const diffZoomX = (x - absoluteZoomX) / zoomLevel;
  const diffZoomY = (y - absoluteZoomY) / zoomLevel;
  const absoluteX = x + diffZoomX;
  const absoluteY = y + diffZoomY;

  return { x: absoluteX, y: absoluteY };
}
