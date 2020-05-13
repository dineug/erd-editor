import { SIZE_TABLE_PADDING } from "../Layout";
import { Store } from "../Store";
import { Logger } from "../Logger";
import {
  Relationship,
  RelationshipPoint,
  Direction,
} from "../store/Relationship";
import { Table } from "../store/Table";
import { DrawRelationship } from "../store/Editor";
import { getData } from "../Helper";
import { getColumns } from "./ColumnHelper";
import {
  executeChangeIdentification,
  executeRemoveRelationship,
} from "../command/relationship";

// ==================== Draw Relationship ===================
const TABLE_PADDING = SIZE_TABLE_PADDING * 2;
const PATH_HEIGHT = 40;
const PATH_END_HEIGHT = PATH_HEIGHT + 20;
const PATH_LINE_HEIGHT = 35;
const LINE_SIZE = 10;
const LINE_HEIGHT = 16;
const CIRCLE_HEIGHT = 26;
const directions: Direction[] = ["top", "bottom", "left", "right"];

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
    base2: PointToPoint;
    left: PointToPoint;
    center: PointToPoint;
    center2: PointToPoint;
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

function getDistance(a: Point, b: Point): number {
  return Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
}

function directionFilter(key: string) {
  return directions.some((direction) => direction === key);
}

function getDrawDirection(draw: DrawRelationship): Direction {
  let direction: Direction = "bottom";
  if (draw.start) {
    const start = getCoordinate(draw.start.table);
    let min = getDistance(start.bottom, draw.end);
    draw.start.x = start.bottom.x;
    draw.start.y = start.bottom.y;

    Object.keys(start)
      .filter(directionFilter)
      .forEach((key) => {
        const k = key as Direction;
        const temp = getDistance(start[k], draw.end);
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
    if (direction === "left" || direction === "right") {
      if (direction === "left") {
        change *= -1;
      }
      line.start.x2 = draw.start.x + change * PATH_HEIGHT;
      path.M.x = line.start.x2;
      path.M.y = draw.start.y;
    } else if (direction === "top" || direction === "bottom") {
      if (direction === "top") {
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
    if (direction === "left" || direction === "right") {
      if (direction === "left") {
        change *= -1;
      }
      line.start.x1 = line.start.x2 += change * LINE_HEIGHT;
      line.start.y1 -= LINE_SIZE;
      line.start.y2 += LINE_SIZE;
    } else if (direction === "top" || direction === "bottom") {
      if (direction === "top") {
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
  const direction: { start: Direction; end: Direction } = {
    start: "bottom",
    end: "bottom",
  };
  let min = getDistance(start.bottom, end.bottom);
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
          const temp = getDistance(start[k], end[k2]);

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

  if (direction === "left" || direction === "right") {
    let sum = graph.coordinate.lt.y - padding.y;
    for (let i = 0; i < len; i++) {
      sum += margin.y;
      yArray.push(sum);
    }
  } else if (direction === "top" || direction === "bottom") {
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
      if (direction === "top") {
        startPoints.push(relationship.start);
        endPoints.push(relationship.end);
      } else if (direction === "right") {
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
    distances.push({
      start: startPoints[index],
      end: endPoints[index],
      distance: getDistance(start, endPoint),
    });
  });
  distances.sort(sortDistance);
  return distances;
}

function relationshipOverlayFirstCheck(
  direction: Direction,
  order: RelationshipOrder,
  point: RelationshipMarginPoint
): boolean {
  let result = true;
  if (direction === "left" || direction === "right") {
    result =
      getDistance({ x: order.start.x, y: point.yArray[0] }, order.end) <
      getDistance(
        { x: order.start.x, y: point.yArray[point.yArray.length - 1] },
        order.end
      );
  } else if (direction === "top" || direction === "bottom") {
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

  if (distances.length > 1) {
    if (!relationshipOverlayFirstCheck(direction, distances[0], point)) {
      distances = distances.reverse();
    }
  }

  if (direction === "left" || direction === "right") {
    point.yArray.forEach((y, index) => {
      distances[index].start.y = y;
    });
  } else if (direction === "top" || direction === "bottom") {
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

  relationships.forEach((relationship) => {
    const tableStart = getData(tables, relationship.start.tableId);
    const tableEnd = getData(tables, relationship.end.tableId);

    if (tableStart && tableEnd) {
      if (relationship.start.tableId === relationship.end.tableId) {
        relationship.start.direction = "top";
        relationship.end.direction = "right";
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
  if (start.direction === "left" || start.direction === "right") {
    if (start.direction === "left") {
      change *= -1;
    }
    line.start.x2 = start.x + change * PATH_HEIGHT;
    path.M.x = line.start.x2;
    path.M.y = start.y;
  } else if (start.direction === "top" || start.direction === "bottom") {
    if (start.direction === "top") {
      change *= -1;
    }
    line.start.y2 = start.y + change * PATH_HEIGHT;
    path.M.x = start.x;
    path.M.y = line.start.y2;
  }

  change = 1;
  if (end.direction === "left" || end.direction === "right") {
    if (end.direction === "left") {
      change *= -1;
    }
    line.end.x2 = end.x + change * PATH_END_HEIGHT;
    line.end.x1 += change * PATH_LINE_HEIGHT;
    path.L.x = line.end.x2;
    path.L.y = end.y;
  } else if (end.direction === "top" || end.direction === "bottom") {
    if (end.direction === "top") {
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

  let change = 1;
  if (start.direction === "left" || start.direction === "right") {
    if (start.direction === "left") {
      change *= -1;
    }
    line.start.x1 = line.start.x2 += change * LINE_HEIGHT;
    line.start.y1 -= LINE_SIZE;
    line.start.y2 += LINE_SIZE;
  } else if (start.direction === "top" || start.direction === "bottom") {
    if (start.direction === "top") {
      change *= -1;
    }
    line.start.y1 = line.start.y2 += change * LINE_HEIGHT;
    line.start.x1 -= LINE_SIZE;
    line.start.x2 += LINE_SIZE;
  }

  change = 1;
  if (end.direction === "left" || end.direction === "right") {
    if (end.direction === "left") {
      change *= -1;
    }
    line.end.base.x1 = line.end.base.x2 += change * LINE_HEIGHT;
    line.end.base2.x1 = line.end.base2.x2 += change * (LINE_SIZE + LINE_HEIGHT);
    line.end.center.x1 = line.end.left.x1 = line.end.right.x1 =
      line.end.base.x1;
    line.end.base.y1 -= LINE_SIZE;
    line.end.base.y2 += LINE_SIZE;
    line.end.base2.y1 -= LINE_SIZE;
    line.end.base2.y2 += LINE_SIZE;
    line.end.left.y2 += LINE_SIZE;
    line.end.right.y2 -= LINE_SIZE;
    line.end.center2.x1 += change * (LINE_HEIGHT + LINE_HEIGHT + 3);

    circle.cx += change * CIRCLE_HEIGHT;
  } else if (end.direction === "top" || end.direction === "bottom") {
    if (end.direction === "top") {
      change *= -1;
    }
    line.end.base.y1 = line.end.base.y2 += change * LINE_HEIGHT;
    line.end.base2.y1 = line.end.base2.y2 += change * (LINE_SIZE + LINE_HEIGHT);
    line.end.center.y1 = line.end.left.y1 = line.end.right.y1 =
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
// ==================== Draw Relationship END ===================

export function identificationValid(store: Store) {
  const { relationships } = store.relationshipState;
  const { tables } = store.tableState;
  relationships.forEach((relationship) => {
    const { end } = relationship;
    const table = getData(tables, end.tableId);
    if (table) {
      const columns = getColumns(table, end.columnIds);
      const identification = !columns.some(
        (column) => !column.option.primaryKey
      );
      if (identification !== relationship.identification) {
        executeChangeIdentification(store, {
          relationshipId: relationship.id,
          identification,
        });
      }
    }
  });
}

export function removeTableRelationshipValid(store: Store, tableIds: string[]) {
  const { relationships } = store.relationshipState;
  const removeRelationshipIds: string[] = [];
  relationships.forEach((relationship) => {
    const { start, end } = relationship;
    if (
      tableIds.some(
        (tableId) => tableId === start.tableId || tableId === end.tableId
      )
    ) {
      removeRelationshipIds.push(relationship.id);
    }
  });
  if (removeRelationshipIds.length !== 0) {
    executeRemoveRelationship(store, {
      relationshipIds: removeRelationshipIds,
    });
  }
}

interface ColumnUIKeyValid {
  startTableId: string;
  endTableId: string;
  columnIds: string[];
}
export function removeColumnRelationshipValid(
  store: Store,
  table: Table,
  columnIds: string[]
) {
  const { relationships } = store.relationshipState;
  const removeRelationshipIds: string[] = [];
  const columnUIKeyValidList: ColumnUIKeyValid[] = [];
  relationships.forEach((relationship) => {
    const { start, end } = relationship;
    const columnUIKeyValid: ColumnUIKeyValid = {
      startTableId: start.tableId,
      endTableId: end.tableId,
      columnIds: [],
    };
    if (table.id === start.tableId) {
      for (let i = 0; i < start.columnIds.length; i++) {
        const id = start.columnIds[i];
        if (columnIds.some((columnId) => columnId === id)) {
          columnUIKeyValid.columnIds.push(end.columnIds[i]);
          start.columnIds.splice(i, 1);
          end.columnIds.splice(i, 1);
          i--;
        }
      }
    } else if (table.id === end.tableId) {
      for (let i = 0; i < end.columnIds.length; i++) {
        const id = end.columnIds[i];
        if (columnIds.some((columnId) => columnId === id)) {
          columnUIKeyValid.columnIds.push(id);
          start.columnIds.splice(i, 1);
          end.columnIds.splice(i, 1);
          i--;
        }
      }
    }

    if (start.columnIds.length === 0) {
      removeRelationshipIds.push(relationship.id);
    }
    columnUIKeyValidList.push(columnUIKeyValid);
  });

  if (removeRelationshipIds.length !== 0) {
    executeRemoveRelationship(store, {
      relationshipIds: removeRelationshipIds,
    });
  }
  columnUIKeyValidList.forEach((columnUIKeyValid) => {
    if (columnUIKeyValid.columnIds.length !== 0) {
      removeRelationshipColumnIdValid(
        store,
        columnUIKeyValid.startTableId,
        columnUIKeyValid.columnIds
      );
      removeRelationshipColumnIdValid(
        store,
        columnUIKeyValid.endTableId,
        columnUIKeyValid.columnIds
      );
    }
  });
}

export function removeRelationshipColumnIdValid(
  store: Store,
  tableId: string,
  columnIds: string[]
) {
  const { tables } = store.tableState;
  const table = getData(tables, tableId);
  if (table) {
    columnIds.forEach((columnId) => {
      const column = getData(table.columns, columnId);
      if (column?.ui.fk) {
        column.ui.fk = false;
      } else if (column?.ui.pfk) {
        column.ui.pfk = false;
        column.ui.pk = true;
      }
    });
  }
}
