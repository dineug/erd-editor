import { describe, expect, it } from 'vite-plus/test';

import { Direction } from '@/constants/schema';
import { Point } from '@/internal-types';
import {
  countBlocked,
  type Obstacles,
  routeOrthogonal,
  segmentHitsBox,
} from '@/utils/draw-relationship/route';
import { searchRoute } from '@/utils/draw-relationship/search';

type Box = [
  id: string,
  left: number,
  top: number,
  right: number,
  bottom: number,
];

function obstacles(boxes: Box[]): Obstacles {
  return {
    ids: boxes.map(box => box[0]),
    left: Float64Array.from(boxes.map(box => box[1])),
    top: Float64Array.from(boxes.map(box => box[2])),
    right: Float64Array.from(boxes.map(box => box[3])),
    bottom: Float64Array.from(boxes.map(box => box[4])),
  };
}

const search = (
  m: Point,
  mDirection: number,
  l: Point,
  lDirection: number,
  boxes: Obstacles
) => searchRoute(m, mDirection, l, lDirection, boxes, 16, 36);

function isOrthogonal(points: Point[]) {
  return points.every((point, index) => {
    if (!index) return true;
    const previous = points[index - 1];
    return (
      Math.abs(point.x - previous.x) < 0.5 !==
      Math.abs(point.y - previous.y) < 0.5
    );
  });
}

function entersBox(points: Point[], [, left, top, right, bottom]: Box) {
  return points.some((point, index) => {
    if (!index) return false;
    const previous = points[index - 1];
    return segmentHitsBox(
      previous.x,
      previous.y,
      point.x,
      point.y,
      left,
      top,
      right,
      bottom
    );
  });
}

/** Two tables 600 apart with their facing sides at -24 and 624, and a third between them. */
const START: Box = ['a', -200, -15, -24, 15];
const END: Box = ['b', 624, -15, 800, 15];
const BETWEEN: Box = ['x', 250, -100, 350, 100];

describe('searchRoute', () => {
  it('runs straight between two facing ends with nothing between them', () => {
    const { points } = search(
      { x: 0, y: 0 },
      Direction.right,
      { x: 600, y: 0 },
      Direction.left,
      obstacles([START, END])
    );

    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 600, y: 0 },
    ]);
  });

  it('goes round a table standing between the two ends, through none', () => {
    const boxes: Box[] = [START, END, BETWEEN];
    const { points } = search(
      { x: 0, y: 0 },
      Direction.right,
      { x: 600, y: 0 },
      Direction.left,
      obstacles(boxes)
    );

    expect(points?.[0]).toEqual({ x: 0, y: 0 });
    expect(points?.[points.length - 1]).toEqual({ x: 600, y: 0 });
    expect(isOrthogonal(points!)).toBe(true);
    expect(boxes.some(box => entersBox(points!, box))).toBe(false);
  });

  it('goes round the table it leaves to reach an end behind it', () => {
    // B stands left of A and faces right, so the route has to come back past
    // A, and the shortest way would run through it. Arriving from above costs
    // the one turn into the stub that coming back down to its axis spends.
    const boxes: Box[] = [START, ['b', -600, -15, -424, 15]];
    const { points } = search(
      { x: 0, y: 0 },
      Direction.right,
      { x: -400, y: 0 },
      Direction.right,
      obstacles(boxes)
    );

    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: -31 },
      { x: -400, y: -31 },
      { x: -400, y: 0 },
    ]);
  });

  it('picks the same route whatever order the tables come in', () => {
    const boxes: Box[] = [START, END, BETWEEN, ['y', 400, -300, 500, -60]];
    const route = (order: Box[]) =>
      search(
        { x: 0, y: 0 },
        Direction.right,
        { x: 600, y: 0 },
        Direction.left,
        obstacles(order)
      ).points;

    expect(route([...boxes].reverse())).toEqual(route(boxes));
  });

  it('finds no route when walls close every way round within its reach', () => {
    const { points, region } = search(
      { x: 0, y: 0 },
      Direction.right,
      { x: 600, y: 0 },
      Direction.left,
      obstacles([START, END, ['wall', 120, -5000, 480, 5000]])
    );

    expect(points).toBeNull();
    expect(region).toEqual({ left: -240, top: -240, right: 840, bottom: 240 });
  });

  it('finds no route when an end sits inside a table', () => {
    const { points } = search(
      { x: 0, y: 0 },
      Direction.right,
      { x: 600, y: 0 },
      Direction.left,
      obstacles([START, ['over', 580, -20, 700, 20]])
    );

    expect(points).toBeNull();
  });

  it('gives up on a region with more lanes than it searches', () => {
    // Forty small tables spread over the region give each axis eighty lanes.
    const crowd: Box[] = Array.from({ length: 40 }, (_, index) => {
      const x = -200 + index * 25;
      const y = -200 + ((index * 37) % 40) * 10;
      return [`c${index}`, x, y, x + 2, y + 2];
    });
    const { points } = search(
      { x: 0, y: 0 },
      Direction.right,
      { x: 600, y: 0 },
      Direction.left,
      obstacles(crowd)
    );

    expect(points).toBeNull();
  });
});

describe('routeOrthogonal with every candidate blocked', () => {
  it('searches a way round a corridor no candidate can leave', () => {
    // A table stands in a corridor between two long ones, leaving gaps too
    // narrow for a lane, so every candidate of a few bends runs through one.
    const boxes: Box[] = [
      START,
      END,
      BETWEEN,
      ['top', -50, -200, 650, -110],
      ['bottom', -50, 110, 650, 200],
    ];
    const ids = obstacles(boxes);

    const points = routeOrthogonal(
      { x: 0, y: 0 },
      Direction.right,
      { x: 600, y: 0 },
      Direction.left,
      ids,
      'a',
      'b'
    );

    expect(countBlocked(points, ids, 'a', 'b')).toBe(0);
    expect(boxes.some(box => entersBox(points, box))).toBe(false);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[points.length - 1]).toEqual({ x: 600, y: 0 });
  });
});
