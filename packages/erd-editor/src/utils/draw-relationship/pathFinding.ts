import { Direction } from '@/constants/schema';
import { Point, Relationship, RelationshipPoint } from '@/internal-types';
import {
  CIRCLE_HEIGHT,
  getRoute,
  getStubSlots,
  Line,
  LINE_HEIGHT,
  LINE_SIZE,
  PATH_LINE_HEIGHT,
  PathLine,
  PathPoint,
  RelationshipPath,
  ROUTE_CHAMFER,
} from '@/utils/draw-relationship';
import { chamferPolyline } from '@/utils/draw-relationship/chamfer';
import {
  clampStub,
  facingGap,
  isHorizontal,
  stubFor,
} from '@/utils/draw-relationship/stub';

export function getRelationshipPath(
  relationship: Relationship
): RelationshipPath {
  const { start, end } = relationship;
  const [startSlot, endSlot] = getStubSlots(relationship);
  const gap = facingGap(start, end);

  return {
    path: getPath(
      start,
      end,
      clampStub(stubFor(startSlot), gap),
      clampStub(stubFor(endSlot), gap),
      getRoute(relationship)
    ),
    line: getLine(start, end),
  };
}

function getPath(
  start: Relationship['start'],
  end: Relationship['end'],
  startStub: number,
  endStub: number,
  route: Point[] | undefined
): RelationshipPath['path'] {
  const line: PathLine = {
    start: {
      x1: start.x,
      y1: start.y,
      x2: start.x,
      y2: start.y,
    },
    end: {
      x1: end.x,
      y1: end.y,
      x2: end.x,
      y2: end.y,
    },
  };
  const path: PathPoint = {
    M: { x: 0, y: 0 },
    L: { x: 0, y: 0 },
    Q: { x: 0, y: 0 },
    d() {
      if (start.tableId === end.tableId) {
        return [
          [
            { x: this.M.x, y: this.M.y },
            { x: this.L.x, y: this.L.y },
          ],
        ];
      }

      const polyline =
        route && route.length > 1
          ? route
          : twoBend(this.M, this.L, start.direction);

      return toSegments(chamferPolyline(polyline, ROUTE_CHAMFER));
    },
  };

  let change = 1;
  if (
    start.direction === Direction.left ||
    start.direction === Direction.right
  ) {
    if (start.direction === Direction.left) {
      change *= -1;
    }
    line.start.x2 = start.x + change * startStub;
    line.start.x1 += change * PATH_LINE_HEIGHT;
    path.M.x = line.start.x2;
    path.M.y = start.y;
  } else if (
    start.direction === Direction.top ||
    start.direction === Direction.bottom
  ) {
    if (start.direction === Direction.top) {
      change *= -1;
    }
    line.start.y2 = start.y + change * startStub;
    line.start.y1 += change * PATH_LINE_HEIGHT;
    path.M.x = start.x;
    path.M.y = line.start.y2;
  }

  change = 1;
  if (end.direction === Direction.left || end.direction === Direction.right) {
    if (end.direction === Direction.left) {
      change *= -1;
    }
    line.end.x2 = end.x + change * endStub;
    line.end.x1 += change * PATH_LINE_HEIGHT;
    path.L.x = line.end.x2;
    path.L.y = end.y;
  } else if (
    end.direction === Direction.top ||
    end.direction === Direction.bottom
  ) {
    if (end.direction === Direction.top) {
      change *= -1;
    }
    line.end.y2 = end.y + change * endStub;
    line.end.y1 += change * PATH_LINE_HEIGHT;
    path.L.x = end.x;
    path.L.y = line.end.y2;
  }

  return {
    line,
    path,
  };
}

function getLine(
  start: RelationshipPoint,
  end: RelationshipPoint
): RelationshipPath['line'] {
  const line: Line = {
    start: {
      base: {
        x1: start.x,
        y1: start.y,
        x2: start.x,
        y2: start.y,
      },
      base2: {
        x1: start.x,
        y1: start.y,
        x2: start.x,
        y2: start.y,
      },
      center: {
        x1: start.x,
        y1: start.y,
        x2: start.x,
        y2: start.y,
      },
      center2: {
        x1: start.x,
        y1: start.y,
        x2: start.x,
        y2: start.y,
      },
    },
    end: {
      base: {
        x1: end.x,
        y1: end.y,
        x2: end.x,
        y2: end.y,
      },
      base2: {
        x1: end.x,
        y1: end.y,
        x2: end.x,
        y2: end.y,
      },
      left: {
        x1: end.x,
        y1: end.y,
        x2: end.x,
        y2: end.y,
      },
      center: {
        x1: end.x,
        y1: end.y,
        x2: end.x,
        y2: end.y,
      },
      center2: {
        x1: end.x,
        y1: end.y,
        x2: end.x,
        y2: end.y,
      },
      right: {
        x1: end.x,
        y1: end.y,
        x2: end.x,
        y2: end.y,
      },
    },
  };
  const circle = {
    cx: end.x,
    cy: end.y,
  };
  const startCircle = {
    cx: start.x,
    cy: start.y,
  };

  let change = 1;
  if (
    start.direction === Direction.left ||
    start.direction === Direction.right
  ) {
    if (start.direction === Direction.left) {
      change *= -1;
    }
    line.start.base.x1 = line.start.base.x2 += change * LINE_HEIGHT;
    line.start.base2.x1 = line.start.base2.x2 +=
      change * (LINE_SIZE + LINE_HEIGHT);
    line.start.center.x1 = line.start.base.x1;
    line.start.base.y1 -= LINE_SIZE;
    line.start.base.y2 += LINE_SIZE;
    line.start.base2.y1 -= LINE_SIZE;
    line.start.base2.y2 += LINE_SIZE;
    line.start.center2.x1 += change * PATH_LINE_HEIGHT;

    startCircle.cx += change * CIRCLE_HEIGHT;
  } else if (
    start.direction === Direction.top ||
    start.direction === Direction.bottom
  ) {
    if (start.direction === Direction.top) {
      change *= -1;
    }
    line.start.base.y1 = line.start.base.y2 += change * LINE_HEIGHT;
    line.start.base2.y1 = line.start.base2.y2 +=
      change * (LINE_SIZE + LINE_HEIGHT);
    line.start.center.y1 = line.start.base.y1;
    line.start.base.x1 -= LINE_SIZE;
    line.start.base.x2 += LINE_SIZE;
    line.start.base2.x1 -= LINE_SIZE;
    line.start.base2.x2 += LINE_SIZE;
    line.start.center2.y1 += change * PATH_LINE_HEIGHT;

    startCircle.cy += change * CIRCLE_HEIGHT;
  }

  change = 1;
  if (end.direction === Direction.left || end.direction === Direction.right) {
    if (end.direction === Direction.left) {
      change *= -1;
    }
    line.end.base.x1 = line.end.base.x2 += change * LINE_HEIGHT;
    line.end.base2.x1 = line.end.base2.x2 += change * (LINE_SIZE + LINE_HEIGHT);
    line.end.center.x1 =
      line.end.left.x1 =
      line.end.right.x1 =
        line.end.base.x1;
    line.end.base.y1 -= LINE_SIZE;
    line.end.base.y2 += LINE_SIZE;
    line.end.base2.y1 -= LINE_SIZE;
    line.end.base2.y2 += LINE_SIZE;
    line.end.left.y2 += LINE_SIZE;
    line.end.right.y2 -= LINE_SIZE;
    line.end.center2.x1 += change * PATH_LINE_HEIGHT;

    circle.cx += change * CIRCLE_HEIGHT;
  } else if (
    end.direction === Direction.top ||
    end.direction === Direction.bottom
  ) {
    if (end.direction === Direction.top) {
      change *= -1;
    }
    line.end.base.y1 = line.end.base.y2 += change * LINE_HEIGHT;
    line.end.base2.y1 = line.end.base2.y2 += change * (LINE_SIZE + LINE_HEIGHT);
    line.end.center.y1 =
      line.end.left.y1 =
      line.end.right.y1 =
        line.end.base.y1;
    line.end.base.x1 -= LINE_SIZE;
    line.end.base.x2 += LINE_SIZE;
    line.end.base2.x1 -= LINE_SIZE;
    line.end.base2.x2 += LINE_SIZE;
    line.end.left.x2 += LINE_SIZE;
    line.end.right.x2 -= LINE_SIZE;
    line.end.center2.y1 += change * PATH_LINE_HEIGHT;

    circle.cy += change * CIRCLE_HEIGHT;
  }

  return {
    line,
    circle,
    startCircle,
  };
}

/**
 * The routing polyline as one d, so a connector is a single element whatever the
 * router and the corner cuts made of it. The segments are contiguous by
 * construction, so each contributes its far end and nothing else.
 */
export function toPathD(segments: Array<[Point, Point]>) {
  if (!segments.length) return '';

  const [[first]] = segments;
  let d = `M${round(first.x)} ${round(first.y)}`;
  for (const [, end] of segments) {
    d += `L${round(end.x)} ${round(end.y)}`;
  }

  return d;
}

/** Two decimals, well under the half pixel every geometry test works to. */
function round(value: number) {
  return Math.round(value * 100) / 100;
}

function toSegments(points: Point[]): Array<[Point, Point]> {
  const segments: Array<[Point, Point]> = [];
  for (let index = 1; index < points.length; index++) {
    segments.push([points[index - 1], points[index]]);
  }
  return segments;
}

/**
 * What a relationship is drawn as before its first sort, which is the only time
 * it has no route: the same shape routeOrthogonal falls back to. Deriving it
 * any other way put a diagonal on screen that no corner had been cut from.
 */
function twoBend(m: Point, l: Point, direction: number): Point[] {
  if (isHorizontal(direction)) {
    if (Math.abs(m.y - l.y) < 0.5) return [m, l];
    const middle = (m.x + l.x) / 2;
    return [m, { x: middle, y: m.y }, { x: middle, y: l.y }, l];
  }

  if (Math.abs(m.x - l.x) < 0.5) return [m, l];
  const middle = (m.y + l.y) / 2;
  return [m, { x: m.x, y: middle }, { x: l.x, y: middle }, l];
}
