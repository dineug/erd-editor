import { describe, expect, it } from 'vite-plus/test';

import { Direction } from '@/constants/schema';
import { Relationship } from '@/internal-types';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { getRelationshipPath } from '@/utils/draw-relationship/pathFinding';

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
      expect(path.line.start).toEqual({ x1: 135, y1: 50, x2: 150, y2: 50 });
      expect(path.line.end).toEqual({ x1: 365, y1: 50, x2: 350, y2: 50 });
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
        x1: 116,
        y1: 40,
        x2: 116,
        y2: 60,
      });
      expect(line.line.start.base2).toEqual({
        x1: 126,
        y1: 40,
        x2: 126,
        y2: 60,
      });
      expect(line.line.start.center).toEqual({
        x1: 116,
        y1: 50,
        x2: 100,
        y2: 50,
      });
      expect(line.line.start.center2).toEqual({
        x1: 135,
        y1: 50,
        x2: 100,
        y2: 50,
      });
      expect(line.startCircle).toEqual({ cx: 126, cy: 50 });
    });

    it('lays out the end decoration lines horizontally', () => {
      expect(line.line.end.base).toEqual({ x1: 384, y1: 40, x2: 384, y2: 60 });
      expect(line.line.end.base2).toEqual({ x1: 374, y1: 40, x2: 374, y2: 60 });
      expect(line.line.end.left).toEqual({ x1: 384, y1: 50, x2: 400, y2: 60 });
      expect(line.line.end.right).toEqual({ x1: 384, y1: 50, x2: 400, y2: 40 });
      expect(line.line.end.center).toEqual({
        x1: 384,
        y1: 50,
        x2: 400,
        y2: 50,
      });
      expect(line.line.end.center2).toEqual({
        x1: 365,
        y1: 50,
        x2: 400,
        y2: 50,
      });
      expect(line.circle).toEqual({ cx: 374, cy: 50 });
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
      expect(path.line.start).toEqual({ x1: 100, y1: 135, x2: 100, y2: 150 });
      expect(path.line.end).toEqual({ x1: 300, y1: 465, x2: 300, y2: 450 });
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
        x1: 90,
        y1: 116,
        x2: 110,
        y2: 116,
      });
      expect(line.line.start.base2).toEqual({
        x1: 90,
        y1: 126,
        x2: 110,
        y2: 126,
      });
      expect(line.line.start.center).toEqual({
        x1: 100,
        y1: 116,
        x2: 100,
        y2: 100,
      });
      expect(line.line.start.center2).toEqual({
        x1: 100,
        y1: 135,
        x2: 100,
        y2: 100,
      });
      expect(line.startCircle).toEqual({ cx: 100, cy: 126 });
    });

    it('lays out the end decoration lines vertically', () => {
      expect(line.line.end.base).toEqual({
        x1: 290,
        y1: 484,
        x2: 310,
        y2: 484,
      });
      expect(line.line.end.base2).toEqual({
        x1: 290,
        y1: 474,
        x2: 310,
        y2: 474,
      });
      expect(line.line.end.left).toEqual({
        x1: 300,
        y1: 484,
        x2: 310,
        y2: 500,
      });
      expect(line.line.end.right).toEqual({
        x1: 300,
        y1: 484,
        x2: 290,
        y2: 500,
      });
      expect(line.line.end.center).toEqual({
        x1: 300,
        y1: 484,
        x2: 300,
        y2: 500,
      });
      expect(line.line.end.center2).toEqual({
        x1: 300,
        y1: 465,
        x2: 300,
        y2: 500,
      });
      expect(line.circle).toEqual({ cx: 300, cy: 474 });
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
        x1: 484,
        y1: 200,
        x2: 500,
        y2: 200,
      });
      expect(line.line.start.center2).toEqual({
        x1: 465,
        y1: 200,
        x2: 500,
        y2: 200,
      });
      expect(line.line.end.left).toEqual({
        x1: 116,
        y1: 260,
        x2: 100,
        y2: 270,
      });
      expect(line.line.end.right).toEqual({
        x1: 116,
        y1: 260,
        x2: 100,
        y2: 250,
      });
      expect(line.startCircle).toEqual({ cx: 474, cy: 200 });
      expect(line.circle).toEqual({ cx: 126, cy: 260 });
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
        x1: 190,
        y1: 116,
        x2: 210,
        y2: 116,
      });
      expect(line.line.end.base2).toEqual({
        x1: 190,
        y1: 126,
        x2: 210,
        y2: 126,
      });
      expect(line.line.end.left).toEqual({
        x1: 200,
        y1: 116,
        x2: 210,
        y2: 100,
      });
      expect(line.line.end.right).toEqual({
        x1: 200,
        y1: 116,
        x2: 190,
        y2: 100,
      });
      expect(line.line.end.center2).toEqual({
        x1: 200,
        y1: 135,
        x2: 200,
        y2: 100,
      });
      expect(line.startCircle).toEqual({ cx: 200, cy: 374 });
      expect(line.circle).toEqual({ cx: 200, cy: 126 });
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
      expect(path.line.start).toEqual({ x1: 98, y1: -35, x2: 98, y2: -50 });
      expect(path.line.end).toEqual({ x1: 153, y1: 20, x2: 168, y2: 20 });
      expect(line.line.start.base).toEqual({
        x1: 88,
        y1: -16,
        x2: 108,
        y2: -16,
      });
      expect(line.line.start.center2).toEqual({
        x1: 98,
        y1: -35,
        x2: 98,
        y2: 0,
      });
      expect(line.line.end.base).toEqual({ x1: 134, y1: 10, x2: 134, y2: 30 });
      expect(line.line.end.center2).toEqual({
        x1: 153,
        y1: 20,
        x2: 118,
        y2: 20,
      });
      expect(line.startCircle).toEqual({ cx: 98, cy: -26 });
      expect(line.circle).toEqual({ cx: 144, cy: 20 });
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
