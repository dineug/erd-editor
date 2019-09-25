import {SIZE_MIN_WIDTH, SIZE_TABLE_PADDING} from '@/ts/layout';
import {Column, Table} from '@/store/table';
import StoreManagement from '@/store/StoreManagement';
import ColumnModel from '@/models/ColumnModel';
import {autoName, uuid, getData, log} from '@/ts/util';
import {RelationshipDraw} from '../relationship';

const TABLE_PADDING = SIZE_TABLE_PADDING * 2;
const PATH_HEIGHT = 40;
const PATH_END_HEIGHT = PATH_HEIGHT + 20;
const PATH_LINE_HEIGHT = 35;
const LINE_SIZE = 10;
const LINE_HEIGHT = 15;
const CIRCLE_HEIGHT = 26;

export const enum Direction {
  left = 'left',
  right = 'right',
  top = 'top',
  bottom = 'bottom',
}

export interface Point {
  x: number;
  y: number;
}

export interface PointToPoint {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Coordinate {
  top: Point;
  bottom: Point;
  left: Point;
  right: Point;
  lt: Point;
  rt: Point;
  lb: Point;
  rb: Point;
}

export interface Path {
  M: Point;
  L: Point;
  Q: Point;

  d(): string;
}

export interface Line {
  start: PointToPoint;
}

export interface Circle {
  cx: number;
  cy: number;
}

export interface DrawPath {
  path: { path: Path, line: Line };
  line: Line;
}

export function columnIds(table: Table): string[] {
  const ids: string[] = [];
  table.columns.forEach((column: Column) => {
    if (column.option.primaryKey) {
      ids.push(column.id);
    }
  });
  return ids;
}

export function createPrimaryKey(store: StoreManagement, table: Table) {
  let result = false;
  for (const column of table.columns) {
    if (column.option.primaryKey) {
      result = true;
      break;
    }
  }
  if (!result) {
    const id = uuid();
    const column: Column = {
      id,
      name: autoName(table.columns, id, 'unnamed'),
      comment: '',
      dataType: '',
      default: '',
      option: {
        autoIncrement: false,
        primaryKey: true,
        unique: false,
        notNull: false,
      },
      ui: {
        active: false,
        pk: true,
        fk: false,
        pfk: false,
        widthName: SIZE_MIN_WIDTH,
        widthComment: SIZE_MIN_WIDTH,
        widthDataType: SIZE_MIN_WIDTH,
        widthDefault: SIZE_MIN_WIDTH,
      },
    };
    table.columns.push(new ColumnModel(store, column));
  }
}

export function createColumns(store: StoreManagement, tableId: string, table: Table): string[] {
  const ids: string[] = [];
  const targetTable = getData(store.tableStore.state.tables, tableId);
  if (targetTable) {
    targetTable.columns.forEach((column) => {
      if (column.option.primaryKey) {
        const id = uuid();
        table.columns.push(new ColumnModel(store, {
          id,
          name: column.name,
          comment: column.comment,
          dataType: column.dataType,
          default: column.default,
          option: {
            autoIncrement: false,
            primaryKey: false,
            unique: false,
            notNull: column.option.notNull,
          },
          ui: {
            active: false,
            pk: false,
            fk: true,
            pfk: false,
            widthName: column.ui.widthName,
            widthComment: column.ui.widthComment,
            widthDataType: column.ui.widthDataType,
            widthDefault: column.ui.widthDefault,
          },
        }));
        ids.push(id);
      }
    });
  }
  return ids;
}

export function getCoordinate(table: Table): Coordinate {
  const width = table.width() + TABLE_PADDING;
  const height = table.height() + TABLE_PADDING;
  const ui = table.ui;
  return {
    top: {
      x: ui.left + (width / 2),
      y: ui.top,
    },
    bottom: {
      x: ui.left + (width / 2),
      y: ui.top + height,
    },
    left: {
      x: ui.left,
      y: ui.top + (height / 2),
    },
    right: {
      x: ui.left + width,
      y: ui.top + (height / 2),
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

export function directionFilter(key: string) {
  return key === 'left' || key === 'right' || key === 'top' || key === 'bottom';
}

export function getDirection(draw: RelationshipDraw): Direction {
  let direction = Direction.bottom;
  if (draw.start) {
    const start = getCoordinate(draw.start.table);
    let min = Math.abs(start.bottom.x - draw.end.x) + Math.abs(start.bottom.y - draw.end.y);
    draw.start.x = start.bottom.x;
    draw.start.y = start.bottom.y;

    Object.keys(start).filter(directionFilter).forEach((key) => {
      const k = key as Direction;
      const temp = Math.abs(start[k].x - draw.end.x) + Math.abs(start[k].y - draw.end.y);
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

export function getPath(direction: Direction, draw: RelationshipDraw): { path: Path, line: Line } {
  const line: Line = {
    start: {
      x1: 0, y1: 0,
      x2: 0, y2: 0,
    },
  };
  const path: Path = {
    M: {x: 0, y: 0},
    L: {x: 0, y: 0},
    Q: {x: 0, y: 0},
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
      line.start.x2 = draw.start.x + (change * PATH_HEIGHT);
      path.M.x = line.start.x2;
      path.M.y = draw.start.y;
    } else if (direction === Direction.top || direction === Direction.bottom) {
      if (direction === Direction.top) {
        change *= -1;
      }
      line.start.y2 = draw.start.y + (change * PATH_HEIGHT);
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

export function getLine(direction: Direction, draw: RelationshipDraw): Line {
  const line: Line = {
    start: {
      x1: 0, y1: 0,
      x2: 0, y2: 0,
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
      line.start.x1 = line.start.x2 += (change * LINE_HEIGHT);
      line.start.y1 -= LINE_SIZE;
      line.start.y2 += LINE_SIZE;
    } else if (direction === Direction.top || direction === Direction.bottom) {
      if (direction === Direction.top) {
        change *= -1;
      }
      line.start.y1 = line.start.y2 += (change * LINE_HEIGHT);
      line.start.x1 -= LINE_SIZE;
      line.start.x2 += LINE_SIZE;
    }
  }

  return line;
}

export function getDraw(draw: RelationshipDraw): DrawPath {
  const drawPath: DrawPath = {
    path: {
      path: {
        M: {x: 0, y: 0},
        L: {x: 0, y: 0},
        Q: {x: 0, y: 0},
        d(): string {
          return `M ${this.M.x} ${this.M.y} L ${this.L.x} ${this.L.y}`;
        },
      },
      line: {
        start: {
          x1: 0, y1: 0,
          x2: 0, y2: 0,
        },
      },
    },
    line: {
      start: {
        x1: 0, y1: 0,
        x2: 0, y2: 0,
      },
    },
  };

  if (draw.start) {
    const direction = getDirection(draw);
    drawPath.path = getPath(direction, draw);
    drawPath.line = getLine(direction, draw);
  }

  return drawPath;
}
