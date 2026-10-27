import { Point } from '@/internal-types';
import type { DirtyBox } from '@/utils/draw-relationship/incremental';
import type { Obstacles } from '@/utils/draw-relationship/route';
import { isHorizontal, outwardSign } from '@/utils/draw-relationship/stub';

/**
 * How far past the two turning points the search looks for a way round. Far
 * enough to clear a table standing between them; a detour further out than
 * this reads worse than the table it avoids.
 */
const SEARCH_MARGIN = 240;

/** Above this many grid points the search gives up, so one route never stalls a sort. */
const MAX_SEARCH_POINTS = 4096;

/** The four headings, as unit steps: right, left, down, up. */
const STEP_X = [1, -1, 0, 0];
const STEP_Y = [0, 0, 1, -1];

/** Which heading leaves an anchor facing this way. */
function headingOf(direction: number, sign = 1) {
  const outward = outwardSign(direction) * sign;
  if (isHorizontal(direction)) return outward > 0 ? 0 : 1;
  return outward > 0 ? 2 : 3;
}

/**
 * The grid and search state, grown to the largest search so far and reused, so
 * a sort that searches many routes allocates them once rather than per route.
 */
let pointBlocked = new Uint8Array(0);
let acrossBlocked = new Uint8Array(0);
let downBlocked = new Uint8Array(0);
let spentTo = new Float64Array(0);
let cameFrom = new Int32Array(0);

function reserve(points: number) {
  if (pointBlocked.length < points) {
    pointBlocked = new Uint8Array(points);
    acrossBlocked = new Uint8Array(points);
    downBlocked = new Uint8Array(points);
    spentTo = new Float64Array(points * 4);
    cameFrom = new Int32Array(points * 4);
  }
  pointBlocked.fill(0, 0, points);
  acrossBlocked.fill(0, 0, points);
  downBlocked.fill(0, 0, points);
  spentTo.fill(Infinity, 0, points * 4);
  cameFrom.fill(-1, 0, points * 4);
}

/** Sorted coordinates with no two within half a pixel of each other. */
function uniqueSorted(values: number[]) {
  values.sort((a, b) => a - b);
  const out: number[] = [];
  for (const value of values) {
    if (out.length && value - out[out.length - 1] < 0.5) continue;
    out.push(value);
  }
  return out;
}

/** The first index whose coordinate is at least value. */
function lowerBound(sorted: number[], value: number) {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (sorted[middle] < value) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** The first index whose coordinate is past value. */
function upperBound(sorted: number[], value: number) {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (sorted[middle] <= value) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** A binary heap of states by cost, the lower state index first on a tie. */
function createQueue() {
  const costs: number[] = [];
  const states: number[] = [];

  const less = (a: number, b: number) =>
    costs[a] < costs[b] || (costs[a] === costs[b] && states[a] < states[b]);

  const swap = (a: number, b: number) => {
    [costs[a], costs[b]] = [costs[b], costs[a]];
    [states[a], states[b]] = [states[b], states[a]];
  };

  return {
    get size() {
      return costs.length;
    },
    push(cost: number, state: number) {
      costs.push(cost);
      states.push(state);
      let index = costs.length - 1;
      while (index > 0) {
        const parent = (index - 1) >> 1;
        if (!less(index, parent)) break;
        swap(index, parent);
        index = parent;
      }
    },
    pop(): [number, number] {
      const top: [number, number] = [costs[0], states[0]];
      const lastCost = costs.pop() as number;
      const lastState = states.pop() as number;
      if (costs.length) {
        costs[0] = lastCost;
        states[0] = lastState;
        let index = 0;
        for (;;) {
          const left = index * 2 + 1;
          const right = left + 1;
          let next = index;
          if (left < costs.length && less(left, next)) next = left;
          if (right < costs.length && less(right, next)) next = right;
          if (next === index) break;
          swap(index, next);
          index = next;
        }
      }
      return top;
    },
  };
}

export type SearchResult = {
  points: Point[] | null;
  /** Every table this answer depends on lies within it, the box searched. */
  region: DirtyBox;
};

/**
 * The cheapest orthogonal route from m to l through no table, the two it joins
 * included, turning on lanes a clearance from the tables within SEARCH_MARGIN
 * of the box the two turning points span, or null if there is none.
 */
export function searchRoute(
  m: Point,
  mDirection: number,
  l: Point,
  lDirection: number,
  obstacles: Obstacles,
  clearance: number,
  bendCost: number
): SearchResult {
  const region: DirtyBox = {
    left: Math.min(m.x, l.x) - SEARCH_MARGIN,
    top: Math.min(m.y, l.y) - SEARCH_MARGIN,
    right: Math.max(m.x, l.x) + SEARCH_MARGIN,
    bottom: Math.max(m.y, l.y) + SEARCH_MARGIN,
  };

  const inside: number[] = [];
  const xs = [m.x, l.x, region.left, region.right];
  const ys = [m.y, l.y, region.top, region.bottom];
  for (let index = 0; index < obstacles.ids.length; index++) {
    if (
      obstacles.right[index] < region.left ||
      obstacles.left[index] > region.right ||
      obstacles.bottom[index] < region.top ||
      obstacles.top[index] > region.bottom
    ) {
      continue;
    }
    inside.push(index);
    xs.push(
      obstacles.left[index] - clearance,
      obstacles.right[index] + clearance
    );
    ys.push(
      obstacles.top[index] - clearance,
      obstacles.bottom[index] + clearance
    );
  }

  // A lane within a pixel of an end gives way to that end's own coordinate, or
  // the route would leave or arrive a sub-pixel off its turning point. The ends
  // stay even when they lie that close to each other.
  const nearEnd = (value: number, a: number, b: number) =>
    value !== a &&
    value !== b &&
    (Math.abs(value - a) < 1 || Math.abs(value - b) < 1);
  const columns = uniqueSorted(
    xs.filter(
      x => x >= region.left && x <= region.right && !nearEnd(x, m.x, l.x)
    )
  );
  const rows = uniqueSorted(
    ys.filter(
      y => y >= region.top && y <= region.bottom && !nearEnd(y, m.y, l.y)
    )
  );
  const width = columns.length;
  const height = rows.length;
  if (width * height > MAX_SEARCH_POINTS) return { points: null, region };

  // A point inside a table, and a run between two neighbouring points that
  // meets one, closed boxes as countBlocked reads them.
  reserve(width * height);
  const point = pointBlocked;
  const across = acrossBlocked;
  const down = downBlocked;
  for (const index of inside) {
    const left = obstacles.left[index];
    const right = obstacles.right[index];
    const top = obstacles.top[index];
    const bottom = obstacles.bottom[index];
    const firstColumn = lowerBound(columns, left);
    const firstRow = lowerBound(rows, top);

    for (let row = firstRow; row < height && rows[row] <= bottom; row++) {
      for (
        let column = Math.max(0, firstColumn - 1);
        column < width && columns[column] <= right;
        column++
      ) {
        const at = row * width + column;
        if (columns[column] >= left) point[at] = 1;
        if (column + 1 < width && columns[column + 1] >= left) across[at] = 1;
      }
    }
    for (
      let column = firstColumn;
      column < width && columns[column] <= right;
      column++
    ) {
      for (
        let row = Math.max(0, firstRow - 1);
        row < height && rows[row] <= bottom;
        row++
      ) {
        if (row + 1 < height && rows[row + 1] >= top) {
          down[row * width + column] = 1;
        }
      }
    }
  }

  // Each end's coordinates are on the grid, or merged into the other end's
  // within half a pixel of them, the first past half a pixel short of them.
  const start =
    upperBound(rows, m.y - 0.5) * width + upperBound(columns, m.x - 0.5);
  const goal =
    upperBound(rows, l.y - 0.5) * width + upperBound(columns, l.x - 0.5);
  if (point[start] || point[goal]) return { points: null, region };

  const startHeading = headingOf(mDirection);
  const away = headingOf(lDirection);
  const arrive = headingOf(lDirection, -1);

  const best = spentTo;
  const parent = cameFrom;
  const queue = createQueue();
  const estimate = (at: number) =>
    Math.abs(columns[at % width] - l.x) +
    Math.abs(rows[Math.floor(at / width)] - l.y);

  const first = start * 4 + startHeading;
  best[first] = 0;
  queue.push(estimate(start), first);

  let found = -1;
  let foundCost = Infinity;

  while (queue.size) {
    const [cost, state] = queue.pop();
    if (cost >= foundCost) break;

    const at = state >> 2;
    const heading = state & 3;
    const spent = best[state];
    if (cost > spent + estimate(at)) continue;

    // Arriving from inside the end's stub would draw over its guide line, and
    // arriving from the side turns once more into the stub.
    if (at === goal) {
      const total = spent + (heading === arrive ? 0 : bendCost);
      if (heading !== away && total < foundCost) {
        foundCost = total;
        found = state;
      }
      continue;
    }

    const column = at % width;
    const row = (at - column) / width;
    for (let next = 0; next < 4; next++) {
      // Never back along the run just drawn, the stub first among them: that
      // folds the route on itself.
      if (
        STEP_X[next] === -STEP_X[heading] &&
        STEP_Y[next] === -STEP_Y[heading]
      ) {
        continue;
      }
      const nextColumn = column + STEP_X[next];
      const nextRow = row + STEP_Y[next];
      if (nextColumn < 0 || nextColumn >= width) continue;
      if (nextRow < 0 || nextRow >= height) continue;

      const target = nextRow * width + nextColumn;
      if (point[target]) continue;
      if (next < 2 && across[row * width + Math.min(column, nextColumn)]) {
        continue;
      }
      if (next >= 2 && down[Math.min(row, nextRow) * width + column]) continue;

      const length =
        Math.abs(columns[nextColumn] - columns[column]) +
        Math.abs(rows[nextRow] - rows[row]);
      const total = spent + length + (next === heading ? 0 : bendCost);
      const nextState = target * 4 + next;
      if (total >= best[nextState]) continue;

      best[nextState] = total;
      parent[nextState] = state;
      queue.push(total + estimate(target), nextState);
    }
  }

  if (found < 0) return { points: null, region };

  const path: Point[] = [];
  for (let state = found; state >= 0; state = parent[state]) {
    const at = state >> 2;
    path.push({ x: columns[at % width], y: rows[Math.floor(at / width)] });
  }
  path.reverse();
  path[0] = { x: m.x, y: m.y };
  path[path.length - 1] = { x: l.x, y: l.y };

  return { points: straighten(path), region };
}

/** Drops every point a route runs straight through, keeping its turns. */
function straighten(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const current of points) {
    const last = out[out.length - 1];
    if (
      last &&
      Math.abs(last.x - current.x) < 0.5 &&
      Math.abs(last.y - current.y) < 0.5
    ) {
      continue;
    }
    if (out.length >= 2) {
      const before = out[out.length - 2];
      const upright =
        Math.abs(before.x - last.x) < 0.5 && Math.abs(last.x - current.x) < 0.5;
      const level =
        Math.abs(before.y - last.y) < 0.5 && Math.abs(last.y - current.y) < 0.5;
      if (upright || level) {
        out[out.length - 1] = current;
        continue;
      }
    }
    out.push(current);
  }
  return out;
}
