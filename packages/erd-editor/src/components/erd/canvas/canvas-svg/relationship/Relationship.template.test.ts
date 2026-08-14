import { svg } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vitest';

import { mountAndFlush, Mounted } from '@/__test-utils__/index';
import { relationshipShape } from '@/components/erd/canvas/canvas-svg/relationship/Relationship.template';
import { Direction, RelationshipType } from '@/constants/schema';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { RelationshipPath } from '@/utils/draw-relationship';
import { getRelationshipPath } from '@/utils/draw-relationship/pathFinding';

/** Bit slots the schema comments out but the shape map still keys on. */
const ZERO_ONE_N = 0b0000000000000000000000000000001;
const ONE = 0b0000000000000000000000000100000;
const N = 0b0000000000000000000000001000000;

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

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

async function renderShape(relationshipType: number, path: RelationshipPath) {
  const shape = relationshipShape(relationshipType, path);
  mounted = await mountAndFlush(svg`<svg>${shape}</svg>`);
  const root = mounted.container;
  return {
    shape,
    lines: Array.from(root.querySelectorAll('line')),
    circles: Array.from(root.querySelectorAll('circle')),
  };
}

const xy = (el: Element) => [
  el.getAttribute('x1'),
  el.getAttribute('y1'),
  el.getAttribute('x2'),
  el.getAttribute('y2'),
];

const toXY = (p: { x1: number; y1: number; x2: number; y2: number }) => [
  `${p.x1}`,
  `${p.y1}`,
  `${p.x2}`,
  `${p.y2}`,
];

describe('relationshipShape', () => {
  it('returns null for a relationship type with no registered shape', () => {
    const path = createPath();
    expect(relationshipShape(0, path)).toBeNull();
    expect(relationshipShape(0b11, path)).toBeNull();
    expect(relationshipShape(0b10000000, path)).toBeNull();
  });

  it('renders the zero-one-n shape with a circle and left/center/right ticks', async () => {
    const path = createPath();
    const { lines, circles } = await renderShape(ZERO_ONE_N, path);

    expect(lines).toHaveLength(5);
    expect(circles).toHaveLength(1);
    expect(xy(lines[0])).toEqual(toXY(path.path.line.end));
    expect(circles[0].getAttribute('cx')).toBe(`${path.line.circle.cx}`);
    expect(circles[0].getAttribute('cy')).toBe(`${path.line.circle.cy}`);
    expect(circles[0].getAttribute('r')).toBe('8');
    expect(circles[0].getAttribute('fill-opacity')).toBe('0.0');
    expect(xy(lines[1])).toEqual(toXY(path.line.line.end.base));
    expect(xy(lines[2])).toEqual(toXY(path.line.line.end.left));
    expect(xy(lines[3])).toEqual(toXY(path.line.line.end.center));
    expect(xy(lines[4])).toEqual(toXY(path.line.line.end.right));
  });

  it('renders the zero-one shape as a circle plus base and center ticks', async () => {
    const path = createPath();
    const { lines, circles } = await renderShape(
      RelationshipType.ZeroOne,
      path
    );

    expect(lines).toHaveLength(3);
    expect(circles).toHaveLength(1);
    expect(xy(lines[0])).toEqual(toXY(path.path.line.end));
    expect(xy(lines[1])).toEqual(toXY(path.line.line.end.base));
    expect(xy(lines[2])).toEqual(toXY(path.line.line.end.center));
  });

  it('renders the zero-n shape as a circle plus a crow foot without a base', async () => {
    const path = createPath();
    const { lines, circles } = await renderShape(RelationshipType.ZeroN, path);

    expect(lines).toHaveLength(4);
    expect(circles).toHaveLength(1);
    expect(xy(lines[1])).toEqual(toXY(path.line.line.end.left));
    expect(xy(lines[2])).toEqual(toXY(path.line.line.end.center));
    expect(xy(lines[3])).toEqual(toXY(path.line.line.end.right));
  });

  it('renders the one-only shape as two bases plus a center, with no circle', async () => {
    const path = createPath();
    const { lines, circles } = await renderShape(
      RelationshipType.OneOnly,
      path
    );

    expect(circles).toHaveLength(0);
    expect(lines).toHaveLength(4);
    expect(xy(lines[1])).toEqual(toXY(path.line.line.end.base));
    expect(xy(lines[2])).toEqual(toXY(path.line.line.end.base2));
    expect(xy(lines[3])).toEqual(toXY(path.line.line.end.center2));
  });

  it('renders the one-n shape as a base plus a crow foot, with no circle', async () => {
    const path = createPath();
    const { lines, circles } = await renderShape(RelationshipType.OneN, path);

    expect(circles).toHaveLength(0);
    expect(lines).toHaveLength(5);
    expect(xy(lines[1])).toEqual(toXY(path.line.line.end.base));
    expect(xy(lines[2])).toEqual(toXY(path.line.line.end.left));
    expect(xy(lines[3])).toEqual(toXY(path.line.line.end.center2));
    expect(xy(lines[4])).toEqual(toXY(path.line.line.end.right));
  });

  it('renders the one shape as a base plus a center tick', async () => {
    const path = createPath();
    const { lines, circles } = await renderShape(ONE, path);

    expect(circles).toHaveLength(0);
    expect(lines).toHaveLength(3);
    expect(xy(lines[1])).toEqual(toXY(path.line.line.end.base));
    expect(xy(lines[2])).toEqual(toXY(path.line.line.end.center2));
  });

  it('renders the n shape as a bare crow foot', async () => {
    const path = createPath();
    const { lines, circles } = await renderShape(N, path);

    expect(circles).toHaveLength(0);
    expect(lines).toHaveLength(4);
    expect(xy(lines[1])).toEqual(toXY(path.line.line.end.left));
    expect(xy(lines[2])).toEqual(toXY(path.line.line.end.center2));
    expect(xy(lines[3])).toEqual(toXY(path.line.line.end.right));
  });

  it('gives every rendered segment a stroke-width of 3', async () => {
    const path = createPath();
    const { lines, circles } = await renderShape(ZERO_ONE_N, path);

    for (const el of [...lines, ...circles]) {
      expect(el.getAttribute('stroke-width')).toBe('3');
    }
  });
});
