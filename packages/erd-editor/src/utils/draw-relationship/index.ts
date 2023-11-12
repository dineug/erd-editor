import { arrayHas } from '@dineug/shared';

import { Point, RelationshipPoint, ValuesType } from '@/internal-types';

export const DirectionName = {
  left: 'left',
  right: 'right',
  top: 'top',
  bottom: 'bottom',
} as const;
export type DirectionName = ValuesType<typeof DirectionName>;
export const DirectionNameList: ReadonlyArray<string> =
  Object.values(DirectionName);

export type PointToPoint = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type DrawPathLine = {
  start: PointToPoint;
};

export type DrawLine = {
  start: {
    base: PointToPoint;
    base2: PointToPoint;
    center: PointToPoint;
    center2: PointToPoint;
  };
};

export type Path = {
  M: Point;
  L: Point;
  Q: Point;
  d(): string;
};

export type DrawPath = {
  path: { path: Path; line: DrawPathLine };
  line: DrawLine;
};

export type PathLine = {
  start: PointToPoint;
  end: PointToPoint;
};

export type Line = {
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
};

export type Circle = {
  cx: number;
  cy: number;
};

export type RelationshipPath = {
  path: { path: Path; line: PathLine };
  line: { line: Line; circle: Circle; startCircle: Circle };
};

export type RelationshipMarginPoint = {
  xArray: number[];
  yArray: number[];
};

export type RelationshipOrder = {
  start: RelationshipPoint;
  end: RelationshipPoint;
  distance: number;
};

export type ObjectPoint = {
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
};

export const isDirection = arrayHas<string>([
  DirectionName.top,
  DirectionName.bottom,
  DirectionName.left,
  DirectionName.right,
]);

export const PATH_HEIGHT = 30;
export const PATH_END_HEIGHT = PATH_HEIGHT + 20;
export const PATH_LINE_HEIGHT = 35;
export const LINE_SIZE = 10;
export const LINE_HEIGHT = 16;
export const CIRCLE_HEIGHT = 26;
