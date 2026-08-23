import { describe, expect, it } from 'vite-plus/test';

import { Direction } from '@/constants/schema';
import { Relationship } from '@/internal-types';
import { createRelationship } from '@/utils/collection/relationship.entity';
import {
  getRelationshipPath,
  toPathD,
} from '@/utils/draw-relationship/pathFinding';

type Point = { tableId: string; x: number; y: number; direction: number };

function relationship(start: Point, end: Point): Relationship {
  return createRelationship({ id: 'rel', start, end });
}

describe('getRelationshipPath', () => {
  describe('start right -> end left (horizontal)', () => {
    const { path, line } = getRelationshipPath(
      relationship(
        { tableId: 'A', x: 100, y: 50, direction: Direction.right },
        { tableId: 'B', x: 400, y: 50, direction: Direction.left }
      )
    );

    it('pushes the path end points out by PATH_END_HEIGHT on the x axis', () => {
      expect(path.path.M).toEqual({ x: 150, y: 50 });
      expect(path.path.L).toEqual({ x: 350, y: 50 });
      expect(path.path.Q).toEqual({ x: 0, y: 0 });
    });

    it('pushes the path guide line out by PATH_LINE_HEIGHT', () => {
      expect(path.line.start).toEqual({ x1: 125, y1: 50, x2: 150, y2: 50 });
      expect(path.line.end).toEqual({ x1: 375, y1: 50, x2: 350, y2: 50 });
    });

    it('draws one straight run when the two anchors line up', () => {
      expect(path.path.d()).toEqual([
        [
          { x: 150, y: 50 },
          { x: 350, y: 50 },
        ],
      ]);
    });

    it('lays out the start decoration lines horizontally', () => {
      expect(line.line.start.base).toEqual({
        x1: 111,
        y1: 43,
        x2: 111,
        y2: 57,
      });
      expect(line.line.start.base2).toEqual({
        x1: 118,
        y1: 43,
        x2: 118,
        y2: 57,
      });
      expect(line.line.start.center).toEqual({
        x1: 111,
        y1: 50,
        x2: 100,
        y2: 50,
      });
      expect(line.line.start.center2).toEqual({
        x1: 125,
        y1: 50,
        x2: 100,
        y2: 50,
      });
      expect(line.startCircle).toEqual({ cx: 118, cy: 50 });
    });

    it('lays out the end decoration lines horizontally', () => {
      expect(line.line.end.base).toEqual({ x1: 389, y1: 43, x2: 389, y2: 57 });
      expect(line.line.end.base2).toEqual({ x1: 382, y1: 43, x2: 382, y2: 57 });
      expect(line.line.end.left).toEqual({ x1: 389, y1: 50, x2: 400, y2: 57 });
      expect(line.line.end.right).toEqual({ x1: 389, y1: 50, x2: 400, y2: 43 });
      expect(line.line.end.center).toEqual({
        x1: 389,
        y1: 50,
        x2: 400,
        y2: 50,
      });
      expect(line.line.end.center2).toEqual({
        x1: 375,
        y1: 50,
        x2: 400,
        y2: 50,
      });
      expect(line.circle).toEqual({ cx: 382, cy: 50 });
    });
  });

  describe('start bottom -> end top (vertical)', () => {
    const { path, line } = getRelationshipPath(
      relationship(
        { tableId: 'A', x: 100, y: 100, direction: Direction.bottom },
        { tableId: 'B', x: 300, y: 500, direction: Direction.top }
      )
    );

    it('pushes the path end points out on the y axis', () => {
      expect(path.path.M).toEqual({ x: 100, y: 150 });
      expect(path.path.L).toEqual({ x: 300, y: 450 });
      expect(path.line.start).toEqual({ x1: 100, y1: 125, x2: 100, y2: 150 });
      expect(path.line.end).toEqual({ x1: 300, y1: 475, x2: 300, y2: 450 });
    });

    it('turns at right angles on the y axis, with the corners cut', () => {
      // Two turns at the midpoint, each drawn as a 45-degree cut of
      // `ROUTE_CHAMFER` either side of the corner.
      expect(path.path.d()).toEqual([
        [
          { x: 100, y: 150 },
          { x: 100, y: 292 },
        ],
        [
          { x: 100, y: 292 },
          { x: 108, y: 300 },
        ],
        [
          { x: 108, y: 300 },
          { x: 292, y: 300 },
        ],
        [
          { x: 292, y: 300 },
          { x: 300, y: 308 },
        ],
        [
          { x: 300, y: 308 },
          { x: 300, y: 450 },
        ],
      ]);
    });

    it('lays out the start decoration lines vertically', () => {
      expect(line.line.start.base).toEqual({
        x1: 93,
        y1: 111,
        x2: 107,
        y2: 111,
      });
      expect(line.line.start.base2).toEqual({
        x1: 93,
        y1: 118,
        x2: 107,
        y2: 118,
      });
      expect(line.line.start.center).toEqual({
        x1: 100,
        y1: 111,
        x2: 100,
        y2: 100,
      });
      expect(line.line.start.center2).toEqual({
        x1: 100,
        y1: 125,
        x2: 100,
        y2: 100,
      });
      expect(line.startCircle).toEqual({ cx: 100, cy: 118 });
    });

    it('lays out the end decoration lines vertically', () => {
      expect(line.line.end.base).toEqual({
        x1: 293,
        y1: 489,
        x2: 307,
        y2: 489,
      });
      expect(line.line.end.base2).toEqual({
        x1: 293,
        y1: 482,
        x2: 307,
        y2: 482,
      });
      expect(line.line.end.left).toEqual({
        x1: 300,
        y1: 489,
        x2: 307,
        y2: 500,
      });
      expect(line.line.end.right).toEqual({
        x1: 300,
        y1: 489,
        x2: 293,
        y2: 500,
      });
      expect(line.line.end.center).toEqual({
        x1: 300,
        y1: 489,
        x2: 300,
        y2: 500,
      });
      expect(line.line.end.center2).toEqual({
        x1: 300,
        y1: 475,
        x2: 300,
        y2: 500,
      });
      expect(line.circle).toEqual({ cx: 300, cy: 482 });
    });
  });

  describe('start left -> end right with an offset on both axes', () => {
    const { path, line } = getRelationshipPath(
      relationship(
        { tableId: 'A', x: 500, y: 200, direction: Direction.left },
        { tableId: 'B', x: 100, y: 260, direction: Direction.right }
      )
    );

    it('crosses on the x axis at the midpoint, with the corners cut', () => {
      expect(path.path.M).toEqual({ x: 450, y: 200 });
      expect(path.path.L).toEqual({ x: 150, y: 260 });
      expect(path.path.d()).toEqual([
        [
          { x: 450, y: 200 },
          { x: 308, y: 200 },
        ],
        [
          { x: 308, y: 200 },
          { x: 300, y: 208 },
        ],
        [
          { x: 300, y: 208 },
          { x: 300, y: 252 },
        ],
        [
          { x: 300, y: 252 },
          { x: 292, y: 260 },
        ],
        [
          { x: 292, y: 260 },
          { x: 150, y: 260 },
        ],
      ]);
    });

    it('mirrors the decoration lines for the inverted directions', () => {
      expect(line.line.start.center).toEqual({
        x1: 489,
        y1: 200,
        x2: 500,
        y2: 200,
      });
      expect(line.line.start.center2).toEqual({
        x1: 475,
        y1: 200,
        x2: 500,
        y2: 200,
      });
      expect(line.line.end.left).toEqual({
        x1: 111,
        y1: 260,
        x2: 100,
        y2: 267,
      });
      expect(line.line.end.right).toEqual({
        x1: 111,
        y1: 260,
        x2: 100,
        y2: 253,
      });
      expect(line.startCircle).toEqual({ cx: 482, cy: 200 });
      expect(line.circle).toEqual({ cx: 118, cy: 260 });
    });
  });

  describe('start top -> end bottom (inverted vertical)', () => {
    const { path, line } = getRelationshipPath(
      relationship(
        { tableId: 'A', x: 200, y: 400, direction: Direction.top },
        { tableId: 'B', x: 200, y: 100, direction: Direction.bottom }
      )
    );

    it('draws one straight run when the two anchors share an x', () => {
      expect(path.path.M).toEqual({ x: 200, y: 350 });
      expect(path.path.L).toEqual({ x: 200, y: 150 });
      expect(path.path.d()).toEqual([
        [
          { x: 200, y: 350 },
          { x: 200, y: 150 },
        ],
      ]);
    });

    it('flips the end decoration lines downwards', () => {
      expect(line.line.end.base).toEqual({
        x1: 193,
        y1: 111,
        x2: 207,
        y2: 111,
      });
      expect(line.line.end.base2).toEqual({
        x1: 193,
        y1: 118,
        x2: 207,
        y2: 118,
      });
      expect(line.line.end.left).toEqual({
        x1: 200,
        y1: 111,
        x2: 207,
        y2: 100,
      });
      expect(line.line.end.right).toEqual({
        x1: 200,
        y1: 111,
        x2: 193,
        y2: 100,
      });
      expect(line.line.end.center2).toEqual({
        x1: 200,
        y1: 125,
        x2: 200,
        y2: 100,
      });
      expect(line.startCircle).toEqual({ cx: 200, cy: 382 });
      expect(line.circle).toEqual({ cx: 200, cy: 118 });
    });
  });

  describe('self relationship', () => {
    const { path, line } = getRelationshipPath(
      relationship(
        { tableId: 'A', x: 98, y: 0, direction: Direction.top },
        { tableId: 'A', x: 118, y: 20, direction: Direction.right }
      )
    );

    it('collapses the path to a single segment', () => {
      expect(path.path.M).toEqual({ x: 98, y: -50 });
      expect(path.path.L).toEqual({ x: 168, y: 20 });
      expect(path.path.d()).toEqual([
        [
          { x: 98, y: -50 },
          { x: 168, y: 20 },
        ],
      ]);
    });

    it('still lays out both decoration ends', () => {
      expect(path.line.start).toEqual({ x1: 98, y1: -25, x2: 98, y2: -50 });
      expect(path.line.end).toEqual({ x1: 143, y1: 20, x2: 168, y2: 20 });
      expect(line.line.start.base).toEqual({
        x1: 91,
        y1: -11,
        x2: 105,
        y2: -11,
      });
      expect(line.line.start.center2).toEqual({
        x1: 98,
        y1: -25,
        x2: 98,
        y2: 0,
      });
      expect(line.line.end.base).toEqual({ x1: 129, y1: 13, x2: 129, y2: 27 });
      expect(line.line.end.center2).toEqual({
        x1: 143,
        y1: 20,
        x2: 118,
        y2: 20,
      });
      expect(line.startCircle).toEqual({ cx: 98, cy: -18 });
      expect(line.circle).toEqual({ cx: 136, cy: 20 });
    });
  });

  describe('unknown direction', () => {
    const { path, line } = getRelationshipPath(
      relationship(
        { tableId: 'A', x: 100, y: 50, direction: 0 },
        { tableId: 'B', x: 400, y: 90, direction: 0 }
      )
    );

    it('leaves the anchors at the origin', () => {
      expect(path.path.M).toEqual({ x: 0, y: 0 });
      expect(path.path.L).toEqual({ x: 0, y: 0 });
      expect(path.path.d()).toEqual([
        [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
      ]);
    });

    it('leaves the guide and decoration lines untouched', () => {
      expect(path.line.start).toEqual({ x1: 100, y1: 50, x2: 100, y2: 50 });
      expect(path.line.end).toEqual({ x1: 400, y1: 90, x2: 400, y2: 90 });
      expect(line.line.start.base).toEqual({
        x1: 100,
        y1: 50,
        x2: 100,
        y2: 50,
      });
      expect(line.line.end.base).toEqual({ x1: 400, y1: 90, x2: 400, y2: 90 });
      expect(line.startCircle).toEqual({ cx: 100, cy: 50 });
      expect(line.circle).toEqual({ cx: 400, cy: 90 });
    });
  });
});

describe('toPathD', () => {
  it('writes one move and a line per segment', () => {
    expect(
      toPathD([
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        [
          { x: 10, y: 0 },
          { x: 10, y: 20 },
        ],
      ])
    ).toBe('M0 0L10 0L10 20');
  });

  it('rounds each coordinate to two decimals', () => {
    expect(
      toPathD([
        [
          { x: 1 / 3, y: 2 / 3 },
          { x: 10.005, y: 4.994 },
        ],
      ])
    ).toBe('M0.33 0.67L10.01 4.99');
  });

  it('draws nothing when there is no segment', () => {
    expect(toPathD([])).toBe('');
  });
});
