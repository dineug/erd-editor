import { Direction } from '@/constants/schema';
import { Relationship, RelationshipPoint } from '@/internal-types';
import {
  Circle,
  CIRCLE_HEIGHT,
  Line,
  LINE_HEIGHT,
  LINE_SIZE,
  Path,
  PATH_END_HEIGHT,
  PATH_LINE_HEIGHT,
  PathLine,
  RelationshipPath,
} from '@/utils/draw-relationship';

export function getRelationshipPath(
  relationship: Relationship
): RelationshipPath {
  return {
    path: getPath(relationship.start, relationship.end),
    line: getLine(relationship.start, relationship.end),
  };
}

function getPath(
  start: RelationshipPoint,
  end: RelationshipPoint
): { path: Path; line: PathLine } {
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
  const path: Path = {
    M: { x: 0, y: 0 },
    L: { x: 0, y: 0 },
    Q: { x: 0, y: 0 },
    d(): string {
      return `M ${this.M.x} ${this.M.y} L ${this.L.x} ${this.L.y}`;
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
    line.start.x2 = start.x + change * PATH_END_HEIGHT;
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
    line.start.y2 = start.y + change * PATH_END_HEIGHT;
    line.start.y1 += change * PATH_LINE_HEIGHT;
    path.M.x = start.x;
    path.M.y = line.start.y2;
  }

  change = 1;
  if (end.direction === Direction.left || end.direction === Direction.right) {
    if (end.direction === Direction.left) {
      change *= -1;
    }
    line.end.x2 = end.x + change * PATH_END_HEIGHT;
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
    line.end.y2 = end.y + change * PATH_END_HEIGHT;
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
): { line: Line; circle: Circle; startCircle: Circle } {
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
    line.start.center2.x1 += change * (LINE_HEIGHT + LINE_HEIGHT + 3);

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
    line.start.center2.y1 += change * (LINE_HEIGHT + LINE_HEIGHT + 3);

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
    line.end.center2.x1 += change * (LINE_HEIGHT + LINE_HEIGHT + 3);

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
    line.end.center2.y1 += change * (LINE_HEIGHT + LINE_HEIGHT + 3);

    circle.cy += change * CIRCLE_HEIGHT;
  }

  return {
    line,
    circle,
    startCircle,
  };
}
