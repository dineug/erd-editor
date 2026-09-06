type PointToPoint = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function isOverlapPosition(dragRect: Rect, rect: Rect): boolean {
  return !(
    dragRect.x > rect.x + rect.w ||
    dragRect.x + dragRect.w < rect.x ||
    dragRect.y > rect.y + rect.h ||
    dragRect.y + dragRect.h < rect.y
  );
}

export function getOverlapPosition(
  dragRect: Rect,
  rect: Rect
): PointToPoint | null {
  if (!isOverlapPosition(dragRect, rect)) return null;

  const target: PointToPoint = { x1: 0, y1: 0, x2: 0, y2: 0 };
  target.x1 = Math.max(dragRect.x, rect.x);
  target.y1 = Math.max(dragRect.y, rect.y);
  target.x2 = Math.min(dragRect.x + dragRect.w, rect.x + rect.w) - rect.x;
  target.y2 = Math.min(dragRect.y + dragRect.h, rect.y + rect.h) - rect.y;

  return target;
}
