import { getData } from '@/core/helper';
import { SIZE_TABLE_BORDER, SIZE_TABLE_PADDING } from '@/core/layout';
import { DrawRelationship } from '@@types/engine/store/editor.state';
import {
  Direction,
  Point,
  Relationship,
  RelationshipPoint,
} from '@@types/engine/store/relationship.state';
import { Table } from '@@types/engine/store/table.state';

const TABLE_PADDING = (SIZE_TABLE_PADDING + SIZE_TABLE_BORDER) * 2;
const PATH_HEIGHT = 30;
const PATH_END_HEIGHT = PATH_HEIGHT + 20;
const PATH_LINE_HEIGHT = 35;
const LINE_SIZE = 10;
const LINE_HEIGHT = 16;
const CIRCLE_HEIGHT = 26;
const directions: Direction[] = ['top', 'bottom', 'left', 'right'];

interface PointToPoint {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Circle {
  cx: number;
  cy: number;
}

export interface Coordinate {
  width: number;
  height: number;
  top: Point;
  bottom: Point;
  left: Point;
  right: Point;
  lt: Point;
  rt: Point;
  lb: Point;
  rb: Point;
}

export type PathPoint = {
  M: Point;
  L: Point;
  Q: Point;
  d(): Array<[Point, Point]>;
};

interface Path {
  M: Point;
  L: Point;
  Q: Point;

  d(): string;
}

interface PathLine {
  start: PointToPoint;
  end: PointToPoint;
}

interface Line {
  start: {
    base: PointToPoint;
    base2: PointToPoint;
    center: PointToPoint;
    center2: PointToPoint;
  };
  end: {
    base: PointToPoint;
    base2: PointToPoint;
    left: PointToPoint;
    center: PointToPoint;
    center2: PointToPoint;
    right: PointToPoint;
  };
}

export interface RelationshipPath {
  path: { path: PathPoint; line: PathLine };
  line: { line: Line; circle: Circle; startCircle: Circle };
}

interface DrawPathLine {
  start: PointToPoint;
}

interface DrawLine {
  start: {
    base: PointToPoint;
    base2: PointToPoint;
    center: PointToPoint;
    center2: PointToPoint;
  };
}

export interface DrawPath {
  path: { path: Path; line: DrawPathLine };
  line: DrawLine;
}

interface RelationshipGraph {
  table: Table;
  coordinate: Coordinate;
  top: Relationship[];
  bottom: Relationship[];
  left: Relationship[];
  right: Relationship[];
}

interface RelationshipOrder {
  start: RelationshipPoint;
  end: RelationshipPoint;
  distance: number;
}

interface RelationshipMarginPoint {
  xArray: number[];
  yArray: number[];
}

export function getCoordinate(table: Table): Coordinate {
  const width = table.width() + TABLE_PADDING;
  const height = table.height() + TABLE_PADDING;
  const ui = table.ui;
  return {
    width,
    height,
    top: {
      x: ui.left + width / 2,
      y: ui.top,
    },
    bottom: {
      x: ui.left + width / 2,
      y: ui.top + height,
    },
    left: {
      x: ui.left,
      y: ui.top + height / 2,
    },
    right: {
      x: ui.left + width,
      y: ui.top + height / 2,
    },
    lt: {
      x: ui.left,
      y: ui.top,
    },
    rt: {
      x: ui.left + width,
      y: ui.top,
    },
    lb: {
      x: ui.left,
      y: ui.top + height,
    },
    rb: {
      x: ui.left + width,
      y: ui.top + height,
    },
  };
}

const getDistance = (a: Point, b: Point) =>
  Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));

const directionFilter = (key: string) => directions.includes(key as any);

function getDrawDirection(draw: DrawRelationship): Direction {
  let direction: Direction = 'bottom';
  if (!draw.start) return direction;

  const start = getCoordinate(draw.start.table);
  let min = getDistance(start.bottom, draw.end);
  draw.start.x = start.bottom.x;
  draw.start.y = start.bottom.y;

  Object.keys(start)
    .filter(directionFilter)
    .forEach(key => {
      const k = key as Direction;
      const temp = getDistance(start[k], draw.end);
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
  direction: Direction,
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
    if (direction === 'left' || direction === 'right') {
      if (direction === 'left') {
        change *= -1;
      }
      line.start.x2 = draw.start.x + change * PATH_END_HEIGHT;
      line.start.x1 += change * PATH_LINE_HEIGHT;
      path.M.x = line.start.x2;
      path.M.y = draw.start.y;
    } else if (direction === 'top' || direction === 'bottom') {
      if (direction === 'top') {
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

function getDrawLine(direction: Direction, draw: DrawRelationship): DrawLine {
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
  if (direction === 'left' || direction === 'right') {
    if (direction === 'left') {
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
  } else if (direction === 'top' || direction === 'bottom') {
    if (direction === 'top') {
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

export function getDraw(draw: DrawRelationship): DrawPath {
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

  const direction = getDrawDirection(draw);
  drawPath.path = getDrawPath(direction, draw);
  drawPath.line = getDrawLine(direction, draw);

  return drawPath;
}

const getRelationshipGraph = (graphs: RelationshipGraph[], table: Table) =>
  graphs.find(graph => graph.table.id === table.id);

function getDirection(
  start: Coordinate,
  end: Coordinate,
  relationship: Relationship
): { start: Direction; end: Direction } {
  const direction: { start: Direction; end: Direction } = {
    start: 'bottom',
    end: 'bottom',
  };
  let min = getDistance(start.bottom, end.bottom);
  relationship.start.x = start.bottom.x;
  relationship.start.y = start.bottom.y;
  relationship.end.x = end.bottom.x;
  relationship.end.y = end.bottom.y;

  Object.keys(start)
    .filter(directionFilter)
    .forEach(key => {
      Object.keys(end)
        .filter(directionFilter)
        .forEach(key2 => {
          const k = key as Direction;
          const k2 = key2 as Direction;
          const temp = getDistance(start[k], end[k2]);
          if (min <= temp) return;

          min = temp;
          direction.start = k;
          direction.end = k2;
          relationship.start.x = start[k].x;
          relationship.start.y = start[k].y;
          relationship.end.x = end[k2].x;
          relationship.end.y = end[k2].y;
        });
    });
  return direction;
}

function relationshipOverlayPoint(
  direction: Direction,
  graph: RelationshipGraph
): RelationshipMarginPoint {
  const len = graph[direction].length;
  const margin = {
    x: graph.coordinate.width / len,
    y: graph.coordinate.height / len,
  };
  const padding = {
    x: margin.x / 2,
    y: margin.y / 2,
  };
  const xArray: number[] = [];
  const yArray: number[] = [];

  if (direction === 'left' || direction === 'right') {
    let sum = graph.coordinate.lt.y - padding.y;
    for (let i = 0; i < len; i++) {
      sum += margin.y;
      yArray.push(sum);
    }
  } else if (direction === 'top' || direction === 'bottom') {
    let sum = graph.coordinate.lt.x - padding.x;
    for (let i = 0; i < len; i++) {
      sum += margin.x;
      xArray.push(sum);
    }
  }
  return {
    xArray,
    yArray,
  };
}

const sortDistance = (a: RelationshipOrder, b: RelationshipOrder) =>
  a.distance - b.distance;

function relationshipOverlayOrder(
  direction: Direction,
  table: Table,
  relationships: Relationship[]
): RelationshipOrder[] {
  const startPoints: RelationshipPoint[] = [];
  const endPoints: RelationshipPoint[] = [];
  const isX = direction === 'top' || direction === 'bottom';

  relationships.forEach(relationship => {
    if (relationship.start.tableId === relationship.end.tableId) {
      // self relationship
      if (direction === 'top') {
        startPoints.push(relationship.start);
        endPoints.push(relationship.end);
      } else if (direction === 'right') {
        startPoints.push(relationship.end);
        endPoints.push(relationship.start);
      }
    } else if (relationship.start.tableId === table.id) {
      startPoints.push(relationship.start);
      endPoints.push(relationship.end);
    } else {
      startPoints.push(relationship.end);
      endPoints.push(relationship.start);
    }
  });

  const distances: RelationshipOrder[] = [];
  endPoints.forEach((endPoint, index) => {
    distances.push({
      start: startPoints[index],
      end: endPoints[index],
      distance: isX ? endPoint.x : endPoint.y,
    });
  });

  return distances.sort(sortDistance);
}

function relationshipOverlayFirstCheck(
  direction: Direction,
  order: RelationshipOrder,
  point: RelationshipMarginPoint
): boolean {
  let result = true;
  if (direction === 'left' || direction === 'right') {
    result =
      getDistance({ x: order.start.x, y: point.yArray[0] }, order.end) <
      getDistance(
        { x: order.start.x, y: point.yArray[point.yArray.length - 1] },
        order.end
      );
  } else if (direction === 'top' || direction === 'bottom') {
    result =
      getDistance({ x: point.xArray[0], y: order.start.y }, order.end) <
      getDistance(
        { x: point.xArray[point.xArray.length - 1], y: order.start.y },
        order.end
      );
  }
  return result;
}

function relationshipOverlaySort(
  direction: Direction,
  graph: RelationshipGraph
) {
  const point = relationshipOverlayPoint(direction, graph);
  let distances = relationshipOverlayOrder(
    direction,
    graph.table,
    graph[direction]
  );

  if (direction === 'left' || direction === 'right') {
    point.yArray.forEach((y, index) => {
      distances[index].start.y = y;
    });
  } else if (direction === 'top' || direction === 'bottom') {
    point.xArray.forEach((x, index) => {
      distances[index].start.x = x;
    });
  }
}

export function relationshipSort(
  tables: Table[],
  relationships: Relationship[]
) {
  const graphs: RelationshipGraph[] = [];

  relationships.forEach(relationship => {
    if (!relationship.visible) return;

    const tableStart = getData(tables, relationship.start.tableId);
    const tableEnd = getData(tables, relationship.end.tableId);

    if (tableStart && tableEnd) {
      if (relationship.start.tableId === relationship.end.tableId) {
        relationship.start.direction = 'top';
        relationship.end.direction = 'right';
        const graph = getRelationshipGraph(graphs, tableStart);

        if (graph) {
          relationship.start.x = graph.coordinate.rt.x - 20;
          relationship.start.y = graph.coordinate.rt.y;
          relationship.end.x = graph.coordinate.rt.x;
          relationship.end.y = graph.coordinate.rt.y + 20;
          graph.top.push(relationship);
          graph.right.push(relationship);
        } else {
          const coordinate = getCoordinate(tableStart);
          relationship.start.x = coordinate.rt.x - 20;
          relationship.start.y = coordinate.rt.y;
          relationship.end.x = coordinate.rt.x;
          relationship.end.y = coordinate.rt.y + 20;
          graphs.push({
            table: tableStart,
            coordinate,
            top: [relationship],
            bottom: [],
            left: [],
            right: [relationship],
          });
        }
      } else {
        const coordinateStart = getCoordinate(tableStart);
        const coordinateEnd = getCoordinate(tableEnd);
        const direction = getDirection(
          coordinateStart,
          coordinateEnd,
          relationship
        );
        const graphStart = getRelationshipGraph(graphs, tableStart);
        const graphEnd = getRelationshipGraph(graphs, tableEnd);
        relationship.start.direction = direction.start;
        relationship.end.direction = direction.end;

        if (graphStart) {
          graphStart[direction.start].push(relationship);
        } else {
          const graph: RelationshipGraph = {
            table: tableStart,
            coordinate: coordinateStart,
            top: [],
            bottom: [],
            left: [],
            right: [],
          };
          graph[direction.start].push(relationship);
          graphs.push(graph);
        }
        if (graphEnd) {
          graphEnd[direction.end].push(relationship);
        } else {
          const graph: RelationshipGraph = {
            table: tableEnd,
            coordinate: coordinateEnd,
            top: [],
            bottom: [],
            left: [],
            right: [],
          };
          graph[direction.end].push(relationship);
          graphs.push(graph);
        }
      }
    }
  });

  graphs.forEach(graph => {
    directions.forEach(value => {
      const direction = value as Direction;
      const len = graph[direction].length;
      if (len < 2) return;

      relationshipOverlaySort(direction, graph);
    });
  });
}

function getPath(
  start: RelationshipPoint,
  end: RelationshipPoint
): { path: PathPoint; line: PathLine } {
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
      const distanceX = this.M.x - this.L.x;
      const distanceY = this.M.y - this.L.y;
      const distanceHalfX = distanceX / 2;
      const distanceHalfY = distanceY / 2;
      const isAxisX = Math.abs(distanceY) <= Math.abs(distanceX);
      const subDistance = isAxisX
        ? Math.abs(distanceHalfY)
        : Math.abs(distanceHalfX);

      const add = createAdd(subDistance);
      const addLeft = add(true);
      const addRight = add(false);

      const addX1 = addLeft(distanceX);
      const addY1 = addLeft(distanceY);
      const addX2 = addRight(distanceX);
      const addY2 = addRight(distanceY);

      const x1 = isAxisX ? this.M.x - distanceHalfX + addX1 : this.M.x;
      const y1 = isAxisX ? this.M.y : this.M.y - distanceHalfY + addY1;
      const x2 = isAxisX ? this.L.x + distanceHalfX + addX2 : this.L.x;
      const y2 = isAxisX ? this.L.y : this.L.y + distanceHalfY + addY2;

      return [
        [
          { x: this.M.x, y: this.M.y },
          { x: x1, y: y1 },
        ],
        [
          { x: x1, y: y1 },
          { x: x2, y: y2 },
        ],
        [
          { x: x2, y: y2 },
          { x: this.L.x, y: this.L.y },
        ],
      ];
    },
  };

  let change = 1;
  if (start.direction === 'left' || start.direction === 'right') {
    if (start.direction === 'left') {
      change *= -1;
    }
    line.start.x2 = start.x + change * PATH_END_HEIGHT;
    line.start.x1 += change * PATH_LINE_HEIGHT;
    path.M.x = line.start.x2;
    path.M.y = start.y;
  } else if (start.direction === 'top' || start.direction === 'bottom') {
    if (start.direction === 'top') {
      change *= -1;
    }
    line.start.y2 = start.y + change * PATH_END_HEIGHT;
    line.start.y1 += change * PATH_LINE_HEIGHT;
    path.M.x = start.x;
    path.M.y = line.start.y2;
  }

  change = 1;
  if (end.direction === 'left' || end.direction === 'right') {
    if (end.direction === 'left') {
      change *= -1;
    }
    line.end.x2 = end.x + change * PATH_END_HEIGHT;
    line.end.x1 += change * PATH_LINE_HEIGHT;
    path.L.x = line.end.x2;
    path.L.y = end.y;
  } else if (end.direction === 'top' || end.direction === 'bottom') {
    if (end.direction === 'top') {
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
  if (start.direction === 'left' || start.direction === 'right') {
    if (start.direction === 'left') {
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
  } else if (start.direction === 'top' || start.direction === 'bottom') {
    if (start.direction === 'top') {
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
  if (end.direction === 'left' || end.direction === 'right') {
    if (end.direction === 'left') {
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
  } else if (end.direction === 'top' || end.direction === 'bottom') {
    if (end.direction === 'top') {
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

export function getRelationshipPath(
  relationship: Relationship
): RelationshipPath {
  return {
    path: getPath(relationship.start, relationship.end),
    line: getLine(relationship.start, relationship.end),
  };
}

function createAdd(value: number) {
  return (leftNegativeMul: boolean) => (distance: number) =>
    distance < 0
      ? (leftNegativeMul ? -1 : 1) * value
      : (leftNegativeMul ? 1 : -1) * value;
}
