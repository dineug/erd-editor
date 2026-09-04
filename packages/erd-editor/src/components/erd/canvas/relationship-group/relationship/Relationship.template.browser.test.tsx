/** @jsxHost konva */

// P3-30 and P3-34: the cardinality decorations as konva nodes. The svg template
// leant on an inherited stroke and four coordinate attributes; a konva shape
// carries its own paint and one flat point list, so both are asserted here.

import { type DOMTemplateLiterals } from '@dineug/r-html';
import type { Layer } from 'konva/lib/Layer';
import type { Node as KonvaNode } from 'konva/lib/Node';
import { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  DECORATION,
  relationshipShape,
} from '@/components/erd/canvas/relationship-group/relationship/Relationship.template';
import { Direction, RelationshipType } from '@/constants/schema';
import { whenDrawn } from '@/konva/batchDraw';
import { renderKonva } from '@/konva/host';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { PointToPoint, RelationshipPath } from '@/utils/draw-relationship';
import { getRelationshipPath } from '@/utils/draw-relationship/pathFinding';

/** Bit slots the schema comments out but the shape map still keys on. */
const ZERO_ONE_N = 1;
const ONE = 32;
const N = 64;

const STROKE = '#ff0000';

const createPath = (): RelationshipPath =>
  getRelationshipPath(
    createRelationship({
      id: 'r1',
      start: {
        tableId: 't1',
        columnIds: ['c1'],
        x: 100,
        y: 200,
        direction: Direction.right,
      },
      end: {
        tableId: 't2',
        columnIds: ['c2'],
        x: 400,
        y: 260,
        direction: Direction.left,
      },
    })
  );

const stages: Stage[] = [];

afterEach(async () => {
  await whenDrawn();

  for (const stage of stages.splice(0)) {
    const container = stage.container();
    renderKonva(stage, null);
    stage.destroy();
    container.remove();
  }

  await whenDrawn();
});

const layerOf = (shape: DOMTemplateLiterals | null) => (
  <k-layer name="scene">{shape}</k-layer>
);

async function renderShape(relationshipType: number, path: RelationshipPath) {
  const shape = relationshipShape(relationshipType, path, STROKE);
  const container = document.createElement('div');
  document.body.append(container);
  const stage = new Stage({ container, width: 800, height: 600 });
  stages.push(stage);

  renderKonva(stage, layerOf(shape));
  await whenDrawn();

  const layer = stage.getChildren()[0] as Layer;
  // The container's own union of Shape and Group has two incompatible getAttr
  // signatures, and every assertion below reads an attr rather than a config.
  const nodes: KonvaNode[] = layer.getChildren();

  return {
    shape,
    nodes,
    lines: nodes.filter(node => node.getClassName() === 'Line'),
    circles: nodes.filter(node => node.getClassName() === 'Circle'),
  };
}

const points = (node: KonvaNode) => node.getAttr('points');

const toPoints = ({ x1, y1, x2, y2 }: PointToPoint) => [x1, y1, x2, y2];

describe('relationshipShape as konva nodes', () => {
  it('returns null for a relationship type with no registered shape', () => {
    const path = createPath();

    expect(relationshipShape(0, path, STROKE)).toBeNull();
    expect(relationshipShape(3, path, STROKE)).toBeNull();
    expect(relationshipShape(128, path, STROKE)).toBeNull();
  });

  it('renders the zero-one-n shape with a ring and left/center/right ticks', async () => {
    const path = createPath();
    const { nodes, lines, circles } = await renderShape(ZERO_ONE_N, path);

    expect(nodes.map(node => node.getClassName())).toEqual([
      'Line',
      'Circle',
      'Line',
      'Line',
      'Line',
      'Line',
    ]);
    expect(points(lines[0])).toEqual(toPoints(path.path.line.end));
    expect(circles[0].x()).toBe(path.line.circle.cx);
    expect(circles[0].y()).toBe(path.line.circle.cy);
    expect(circles[0].getAttr('radius')).toBe(6);
    expect(points(lines[1])).toEqual(toPoints(path.line.line.end.base));
    expect(points(lines[2])).toEqual(toPoints(path.line.line.end.left));
    expect(points(lines[3])).toEqual(toPoints(path.line.line.end.center));
    expect(points(lines[4])).toEqual(toPoints(path.line.line.end.right));
  });

  it('renders the zero-one shape as a ring plus base and center ticks', async () => {
    const path = createPath();
    const { lines, circles } = await renderShape(
      RelationshipType.ZeroOne,
      path
    );

    expect(lines).toHaveLength(3);
    expect(circles).toHaveLength(1);
    expect(points(lines[0])).toEqual(toPoints(path.path.line.end));
    expect(points(lines[1])).toEqual(toPoints(path.line.line.end.base));
    expect(points(lines[2])).toEqual(toPoints(path.line.line.end.center));
  });

  it('renders the zero-n shape as a ring plus a crow foot without a base', async () => {
    const path = createPath();
    const { lines, circles } = await renderShape(RelationshipType.ZeroN, path);

    expect(lines).toHaveLength(4);
    expect(circles).toHaveLength(1);
    expect(points(lines[1])).toEqual(toPoints(path.line.line.end.left));
    expect(points(lines[2])).toEqual(toPoints(path.line.line.end.center));
    expect(points(lines[3])).toEqual(toPoints(path.line.line.end.right));
  });

  it('renders the one-only shape as two bases plus a center, with no ring', async () => {
    const path = createPath();
    const { lines, circles } = await renderShape(
      RelationshipType.OneOnly,
      path
    );

    expect(circles).toHaveLength(0);
    expect(lines).toHaveLength(4);
    expect(points(lines[1])).toEqual(toPoints(path.line.line.end.base));
    expect(points(lines[2])).toEqual(toPoints(path.line.line.end.base2));
    expect(points(lines[3])).toEqual(toPoints(path.line.line.end.center2));
  });

  it('renders the one-n shape as a base plus a crow foot, with no ring', async () => {
    const path = createPath();
    const { lines, circles } = await renderShape(RelationshipType.OneN, path);

    expect(circles).toHaveLength(0);
    expect(lines).toHaveLength(5);
    expect(points(lines[1])).toEqual(toPoints(path.line.line.end.base));
    expect(points(lines[2])).toEqual(toPoints(path.line.line.end.left));
    expect(points(lines[3])).toEqual(toPoints(path.line.line.end.center2));
    expect(points(lines[4])).toEqual(toPoints(path.line.line.end.right));
  });

  it('renders the one shape as a base plus a center tick', async () => {
    const path = createPath();
    const { lines, circles } = await renderShape(ONE, path);

    expect(circles).toHaveLength(0);
    expect(lines).toHaveLength(3);
    expect(points(lines[1])).toEqual(toPoints(path.line.line.end.base));
    expect(points(lines[2])).toEqual(toPoints(path.line.line.end.center2));
  });

  it('renders the n shape as a bare crow foot', async () => {
    const path = createPath();
    const { lines, circles } = await renderShape(N, path);

    expect(circles).toHaveLength(0);
    expect(lines).toHaveLength(4);
    expect(points(lines[1])).toEqual(toPoints(path.line.line.end.left));
    expect(points(lines[2])).toEqual(toPoints(path.line.line.end.center2));
    expect(points(lines[3])).toEqual(toPoints(path.line.line.end.right));
  });

  // Every shape in the map, not just one of them: the paint and the width are
  // separate literals per node and a sweep that leaves one behind draws a
  // single cardinality symbol in the wrong colour.
  const EVERY_SHAPE = [
    ['zero-one-n', ZERO_ONE_N],
    ['zero-one', RelationshipType.ZeroOne],
    ['zero-n', RelationshipType.ZeroN],
    ['one-only', RelationshipType.OneOnly],
    ['one-n', RelationshipType.OneN],
    ['one', ONE],
    ['n', N],
  ] as const;

  for (const [name, relationshipType] of EVERY_SHAPE) {
    it(`paints every segment of the ${name} shape at width 2 in the stroke it was given`, async () => {
      const { nodes } = await renderShape(relationshipType, createPath());

      expect(nodes.length).toBeGreaterThan(0);
      for (const node of nodes) {
        expect(node.getAttr('stroke')).toBe(STROKE);
        expect(node.getAttr('strokeWidth')).toBe(2);
      }
    });
  }

  for (const [name, relationshipType] of EVERY_SHAPE) {
    it(`names every node of the ${name} shape for an ancestor walk`, async () => {
      const { nodes, circles } = await renderShape(
        relationshipType,
        createPath()
      );

      for (const node of nodes) {
        expect(node.name()).toBe(DECORATION);
        expect(node.getAttr('kind')).toBe(DECORATION);
        // A decoration is drawn, never hit: only the hit band answers a pointer,
        // and a ring is a closed shape whose interior would swallow one.
        expect(node.listening()).toBe(false);
      }

      for (const circle of circles) {
        expect(circle.getAttr('radius')).toBe(6);
      }
    });
  }
});
