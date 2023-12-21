import { query } from '@dineug/erd-editor-schema';

import { DrawRelationship } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import {
  DirectionName,
  DirectionNameList,
  DrawLine,
  DrawPath,
  DrawPathLine,
  LINE_HEIGHT,
  LINE_SIZE,
  Path,
  PATH_END_HEIGHT,
  PATH_LINE_HEIGHT,
} from '@/utils/draw-relationship';
import {
  euclideanDistance,
  tableToObjectPoint,
} from '@/utils/draw-relationship/calc';

export function getDraw(state: RootState, draw: DrawRelationship): DrawPath {
  const drawPath: DrawPath = {
    path: {
      path: {
        M: { x: 0, y: 0 },
        L: { x: 0, y: 0 },
        Q: { x: 0, y: 0 },
        d(): string {
          return `M ${this.M.x} ${this.M.y} L ${this.L.x} ${this.L.y}`;
        },
      },
      line: {
        start: {
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 0,
        },
      },
    },
    line: {
      start: {
        base: {
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 0,
        },
        base2: {
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 0,
        },
        center: {
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 0,
        },
        center2: {
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 0,
        },
      },
    },
  };
  if (!draw.start) return drawPath;

  const direction = getDrawDirection(state, draw);
  drawPath.path = getDrawPath(direction, draw);
  drawPath.line = getDrawLine(direction, draw);

  return drawPath;
}

function getDrawDirection(
  state: RootState,
  draw: DrawRelationship
): DirectionName {
  let direction: DirectionName = DirectionName.bottom;
  if (!draw.start) return direction;

  const table = query(state.collections)
    .collection('tableEntities')
    .selectById(draw.start.tableId);
  if (!table) return direction;

  const start = tableToObjectPoint(state, table);
  let min = euclideanDistance(start.bottom, draw.end);
  draw.start.x = start.bottom.x;
  draw.start.y = start.bottom.y;

  DirectionNameList.forEach(key => {
    const k = key as DirectionName;
    const temp = euclideanDistance(start[k], draw.end);
    if (min <= temp) return;

    min = temp;
    direction = k;
    if (!draw.start) return;

    draw.start.x = start[k].x;
    draw.start.y = start[k].y;
  });

  return direction;
}

function getDrawPath(
  direction: DirectionName,
  draw: DrawRelationship
): { path: Path; line: DrawPathLine } {
  const line: DrawPathLine = {
    start: {
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
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

  if (draw.start) {
    line.start.x1 = draw.start.x;
    line.start.y1 = draw.start.y;
    line.start.x2 = draw.start.x;
    line.start.y2 = draw.start.y;

    let change = 1;
    if (direction === DirectionName.left || direction === DirectionName.right) {
      if (direction === DirectionName.left) {
        change *= -1;
      }
      line.start.x2 = draw.start.x + change * PATH_END_HEIGHT;
      line.start.x1 += change * PATH_LINE_HEIGHT;
      path.M.x = line.start.x2;
      path.M.y = draw.start.y;
    } else if (
      direction === DirectionName.top ||
      direction === DirectionName.bottom
    ) {
      if (direction === DirectionName.top) {
        change *= -1;
      }
      line.start.y2 = draw.start.y + change * PATH_END_HEIGHT;
      line.start.y1 += change * PATH_LINE_HEIGHT;
      path.M.x = draw.start.x;
      path.M.y = line.start.y2;
    }
  }
  path.L.x = draw.end.x;
  path.L.y = draw.end.y;

  return {
    path,
    line,
  };
}

function getDrawLine(
  direction: DirectionName,
  draw: DrawRelationship
): DrawLine {
  const line: DrawLine = {
    start: {
      base: {
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
      },
      base2: {
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
      },
      center: {
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
      },
      center2: {
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
      },
    },
  };
  if (!draw.start) return line;

  line.start.base.x1 =
    line.start.base2.x1 =
    line.start.center.x1 =
    line.start.center2.x1 =
      draw.start.x;
  line.start.base.x2 =
    line.start.base2.x2 =
    line.start.center.x2 =
    line.start.center2.x2 =
      draw.start.x;
  line.start.base.y1 =
    line.start.base2.y1 =
    line.start.center.y1 =
    line.start.center2.y1 =
      draw.start.y;
  line.start.base.y2 =
    line.start.base2.y2 =
    line.start.center.y2 =
    line.start.center2.y2 =
      draw.start.y;

  let change = 1;
  if (direction === DirectionName.left || direction === DirectionName.right) {
    if (direction === DirectionName.left) {
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
  } else if (
    direction === DirectionName.top ||
    direction === DirectionName.bottom
  ) {
    if (direction === DirectionName.top) {
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
  }

  return line;
}
