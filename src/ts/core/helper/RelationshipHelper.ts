import { SIZE_TABLE_PADDING } from "../Layout";
import {
  Relationship,
  RelationshipPoint,
  Direction,
} from "../store/Relationship";
import { Table } from "../store/Table";
import { DrawRelationship } from "../store/Editor";
import { getData } from "../Helper";

// ==================== UI Handler ===================
const TABLE_PADDING = SIZE_TABLE_PADDING * 2;
const PATH_HEIGHT = 40;
const PATH_END_HEIGHT = PATH_HEIGHT + 20;
const PATH_LINE_HEIGHT = 35;
const LINE_SIZE = 10;
const LINE_HEIGHT = 15;
const CIRCLE_HEIGHT = 26;
const directions = ["top", "bottom", "left", "right"];

export interface Point {
  x: number;
  y: number;
}

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
  start: PointToPoint;
  end: {
    base: PointToPoint;
    left: PointToPoint;
    center: PointToPoint;
    right: PointToPoint;
  };
}

export interface RelationshipPath {
  path: { path: Path; line: PathLine };
  line: { line: Line; circle: Circle };
}

interface DrawLine {
  start: PointToPoint;
}

export interface DrawPath {
  path: { path: Path; line: DrawLine };
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
  point: RelationshipPoint;
  distance: number;
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

function directionFilter(key: string) {
  return key === "left" || key === "right" || key === "top" || key === "bottom";
}

function getDrawDirection(draw: DrawRelationship): Direction {
  let direction = Direction.bottom;
  const table = getData;
  if (draw.start) {
    const start = getCoordinate(draw.start.table);
    let min =
      Math.pow(Math.abs(start.bottom.x - draw.end.x), 2) +
      Math.pow(Math.abs(start.bottom.y - draw.end.y), 2);
    draw.start.x = start.bottom.x;
    draw.start.y = start.bottom.y;

    Object.keys(start)
      .filter(directionFilter)
      .forEach((key) => {
        const k = key as Direction;
        const temp =
          Math.pow(Math.abs(start[k].x - draw.end.x), 2) +
          Math.pow(Math.abs(start[k].y - draw.end.y), 2);
        if (min > temp) {
          min = temp;
          direction = k;
          if (draw.start) {
            draw.start.x = start[k].x;
            draw.start.y = start[k].y;
          }
        }
      });
  }
  return direction;
}

function getDrawPath(
  direction: Direction,
  draw: DrawRelationship
): { path: Path; line: DrawLine } {
  const line: DrawLine = {
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
    if (direction === Direction.left || direction === Direction.right) {
      if (direction === Direction.left) {
        change *= -1;
      }
      line.start.x2 = draw.start.x + change * PATH_HEIGHT;
      path.M.x = line.start.x2;
      path.M.y = draw.start.y;
    } else if (direction === Direction.top || direction === Direction.bottom) {
      if (direction === Direction.top) {
        change *= -1;
      }
      line.start.y2 = draw.start.y + change * PATH_HEIGHT;
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
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
    },
  };

  if (draw.start) {
    line.start.x1 = draw.start.x;
    line.start.y1 = draw.start.y;
    line.start.x2 = draw.start.x;
    line.start.y2 = draw.start.y;

    let change = 1;
    if (direction === Direction.left || direction === Direction.right) {
      if (direction === Direction.left) {
        change *= -1;
      }
      line.start.x1 = line.start.x2 += change * LINE_HEIGHT;
      line.start.y1 -= LINE_SIZE;
      line.start.y2 += LINE_SIZE;
    } else if (direction === Direction.top || direction === Direction.bottom) {
      if (direction === Direction.top) {
        change *= -1;
      }
      line.start.y1 = line.start.y2 += change * LINE_HEIGHT;
      line.start.x1 -= LINE_SIZE;
      line.start.x2 += LINE_SIZE;
    }
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
        x1: 0,
        y1: 0,
        x2: 0,
        y2: 0,
      },
    },
  };

  if (draw.start) {
    const direction = getDrawDirection(draw);
    drawPath.path = getDrawPath(direction, draw);
    drawPath.line = getDrawLine(direction, draw);
  }

  return drawPath;
}

function getRelationshipGraph(
  graphs: RelationshipGraph[],
  table: Table
): RelationshipGraph | null {
  let target: RelationshipGraph | null = null;
  for (const graph of graphs) {
    if (graph.table.id === table.id) {
      target = graph;
      break;
    }
  }
  return target;
}

function getDirection(
  start: Coordinate,
  end: Coordinate,
  relationship: Relationship
): { start: Direction; end: Direction } {
  const direction = {
    start: Direction.bottom,
    end: Direction.bottom,
  };
  let min =
    Math.pow(Math.abs(start.bottom.x - end.bottom.x), 2) +
    Math.pow(Math.abs(start.bottom.y - end.bottom.y), 2);
  relationship.start.x = start.bottom.x;
  relationship.start.y = start.bottom.y;
  relationship.end.x = end.bottom.x;
  relationship.end.y = end.bottom.y;

  Object.keys(start)
    .filter(directionFilter)
    .forEach((key) => {
      Object.keys(end)
        .filter(directionFilter)
        .forEach((key2) => {
          const k = key as Direction;
          const k2 = key2 as Direction;
          const temp =
            Math.pow(Math.abs(start[k].x - end[k2].x), 2) +
            Math.pow(Math.abs(start[k].y - end[k2].y), 2);

          if (min > temp) {
            min = temp;
            direction.start = k;
            direction.end = k2;
            relationship.start.x = start[k].x;
            relationship.start.y = start[k].y;
            relationship.end.x = end[k2].x;
            relationship.end.y = end[k2].y;
          }
        });
    });
  return direction;
}

function relationshipOverlayPoint(
  direction: Direction,
  graph: RelationshipGraph
): { xArray: number[]; yArray: number[] } {
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

  if (direction === Direction.left || direction === Direction.right) {
    let sum = graph.coordinate.lt.y - padding.y;
    for (let i = 0; i < len; i++) {
      sum += margin.y;
      yArray.push(sum);
    }
  } else if (direction === Direction.top || direction === Direction.bottom) {
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

function sortDistance(a: RelationshipOrder, b: RelationshipOrder) {
  return a.distance - b.distance;
}

function relationshipOverlayOrder(
  direction: Direction,
  table: Table,
  relationships: Relationship[]
): RelationshipOrder[] {
  const startPoints: RelationshipPoint[] = [];
  const endPoints: RelationshipPoint[] = [];

  relationships.forEach((relationship) => {
    if (relationship.start.tableId === relationship.end.tableId) {
      // self relationship
      if (direction === Direction.top) {
        startPoints.push(relationship.start);
        endPoints.push(relationship.end);
      } else if (direction === Direction.right) {
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

  const start: Point = {
    x: startPoints[0].x,
    y: startPoints[0].y,
  };
  const distances: RelationshipOrder[] = [];
  endPoints.forEach((endPoint, index) => {
    if (startPoints[index].tableId === endPoint.tableId) {
      // self relationship
      distances.push({
        point: startPoints[index],
        distance:
          Math.pow(Math.abs(start.x - endPoint.x), 2) +
          Math.pow(Math.abs(start.y - endPoint.y), 2),
      });
    } else if (direction === Direction.left || direction === Direction.right) {
      distances.push({
        point: startPoints[index],
        distance: Math.abs(start.y - endPoint.y),
      });
    } else if (direction === Direction.top || direction === Direction.bottom) {
      distances.push({
        point: startPoints[index],
        distance: Math.abs(start.x - endPoint.x),
      });
    }
  });
  distances.sort(sortDistance);
  return distances;
}

function relationshipOverlaySort(
  direction: Direction,
  graph: RelationshipGraph
) {
  const point = relationshipOverlayPoint(direction, graph);
  const distances = relationshipOverlayOrder(
    direction,
    graph.table,
    graph[direction]
  );

  if (direction === Direction.left || direction === Direction.right) {
    point.yArray.forEach((y, index) => {
      distances[index].point.y = y;
    });
  } else if (direction === Direction.top || direction === Direction.bottom) {
    point.xArray.forEach((x, index) => {
      distances[index].point.x = x;
    });
  }
}

export function relationshipSort(
  tables: Table[],
  relationships: Relationship[]
) {
  const graphs: RelationshipGraph[] = [];

  relationships.forEach((relationship) => {
    const tableStart = getData(tables, relationship.start.tableId);
    const tableEnd = getData(tables, relationship.end.tableId);

    if (tableStart && tableEnd) {
      if (relationship.start.tableId === relationship.end.tableId) {
        relationship.start.direction = Direction.top;
        relationship.end.direction = Direction.right;
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

  graphs.forEach((graph) => {
    directions.forEach((value) => {
      const direction = value as Direction;
      const len = graph[direction].length;
      if (len >= 2) {
        relationshipOverlaySort(direction, graph);
      }
    });
  });
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
    line.start.x2 = start.x + change * PATH_HEIGHT;
    path.M.x = line.start.x2;
    path.M.y = start.y;
  } else if (
    start.direction === Direction.top ||
    start.direction === Direction.bottom
  ) {
    if (start.direction === Direction.top) {
      change *= -1;
    }
    line.start.y2 = start.y + change * PATH_HEIGHT;
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
): { line: Line; circle: Circle } {
  const line: Line = {
    start: {
      x1: start.x,
      y1: start.y,
      x2: start.x,
      y2: start.y,
    },
    end: {
      base: {
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

  let change = 1;
  if (
    start.direction === Direction.left ||
    start.direction === Direction.right
  ) {
    if (start.direction === Direction.left) {
      change *= -1;
    }
    line.start.x1 = line.start.x2 += change * LINE_HEIGHT;
    line.start.y1 -= LINE_SIZE;
    line.start.y2 += LINE_SIZE;
  } else if (
    start.direction === Direction.top ||
    start.direction === Direction.bottom
  ) {
    if (start.direction === Direction.top) {
      change *= -1;
    }
    line.start.y1 = line.start.y2 += change * LINE_HEIGHT;
    line.start.x1 -= LINE_SIZE;
    line.start.x2 += LINE_SIZE;
  }

  change = 1;
  if (end.direction === Direction.left || end.direction === Direction.right) {
    if (end.direction === Direction.left) {
      change *= -1;
    }
    line.end.base.x2 += change * LINE_HEIGHT;
    line.end.left.x1 = line.end.center.x1 = line.end.right.x1 = line.end.base.x1 =
      line.end.base.x2;
    line.end.base.y1 -= LINE_SIZE;
    line.end.base.y2 += LINE_SIZE;
    line.end.left.y2 += LINE_SIZE;
    line.end.right.y2 -= LINE_SIZE;

    circle.cx += change * CIRCLE_HEIGHT;
  } else if (
    end.direction === Direction.top ||
    end.direction === Direction.bottom
  ) {
    if (end.direction === Direction.top) {
      change *= -1;
    }
    line.end.base.y2 += change * LINE_HEIGHT;
    line.end.left.y1 = line.end.center.y1 = line.end.right.y1 = line.end.base.y1 =
      line.end.base.y2;
    line.end.base.x1 -= LINE_SIZE;
    line.end.base.x2 += LINE_SIZE;
    line.end.left.x2 += LINE_SIZE;
    line.end.right.x2 -= LINE_SIZE;

    circle.cy += change * CIRCLE_HEIGHT;
  }

  return {
    line,
    circle,
  };
}

export function getZeroOne(relationship: Relationship): RelationshipPath {
  return {
    path: getPath(relationship.start, relationship.end),
    line: getLine(relationship.start, relationship.end),
  };
}

// ==================== UI Handler END ===================
