import type { Point } from '@/internal-types';

export class ANode {
  x: number;
  y: number;
  g = Infinity;
  h = 0;
  f = Infinity;
  parent: ANode | null = null;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

class PriorityQueue {
  nodes: ANode[] = [];

  enqueue(node: ANode) {
    this.nodes.push(node);
    this.nodes.sort((a, b) => a.f - b.f);
  }

  dequeue() {
    return this.nodes.shift();
  }

  includes(node: ANode) {
    return this.nodes.some(n => n.x === node.x && n.y === node.y);
  }
}

function heuristic(a: Point, b: Point) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export type Wall = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

function getNeighbors(
  node: ANode,
  end: ANode,
  walls: Wall[],
  boundary: number
) {
  const neighbors = [];
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    // [1, 1],
    // [-1, -1],
    // [1, -1],
    // [-1, 1],
  ];

  for (const [dx, dy] of directions) {
    const x = node.x + dx;
    const y = node.y + dy;

    if (Math.abs(x - end.x) > boundary || Math.abs(y - end.y) > boundary) {
      continue;
    }

    const isWall = walls.some(
      wall =>
        wall.minX <= x && x <= wall.maxX && wall.minY <= y && y <= wall.maxY
    );
    if (isWall) {
      continue;
    }

    const neighbor = new ANode(x, y);
    neighbors.push(neighbor);
  }

  return neighbors;
}

export function aStar(
  start: ANode,
  end: ANode,
  walls: Wall[],
  boundary = 400
): Point[] {
  const openSet = new PriorityQueue();
  const closedSet = new Set();

  start.g = 0;
  start.h = heuristic(start, end);
  start.f = start.h;
  openSet.enqueue(start);

  while (openSet.nodes.length > 0) {
    const current = openSet.dequeue()!;

    if (current.x === end.x && current.y === end.y) {
      return reconstructPath(current);
    }

    closedSet.add(`${current.x},${current.y}`);

    const neighbors = getNeighbors(current, end, walls, boundary);
    for (const neighbor of neighbors) {
      const key = `${neighbor.x},${neighbor.y}`;

      if (closedSet.has(key)) {
        continue;
      }

      const tentativeG =
        current.g +
        (current.x !== neighbor.x && current.y !== neighbor.y ? Math.SQRT2 : 1);

      if (tentativeG < neighbor.g) {
        neighbor.parent = current;
        neighbor.g = tentativeG;
        neighbor.h = heuristic(neighbor, end);
        neighbor.f = neighbor.g + neighbor.h;

        if (!openSet.includes(neighbor)) {
          openSet.enqueue(neighbor);
        }
      }
    }
  }

  return [];
}

function reconstructPath(node: ANode | null): Point[] {
  const path: ANode[] = [];
  while (node) {
    path.push(node);
    node = node.parent;
  }
  return compressPath(path.reverse());
}

function compressPath(nodes: ANode[]): Point[] {
  if (nodes.length < 3) {
    return nodes.map(node => ({ x: node.x, y: node.y }));
  }

  const compressed: Point[] = [];

  let sx = nodes[0].x;
  let sy = nodes[0].y;
  let px = nodes[1].x;
  let py = nodes[1].y;
  let dx = px - sx;
  let dy = py - sy;
  let lx, ly, ldx, ldy, sq, i;

  sq = Math.sqrt(dx * dx + dy * dy);
  dx /= sq;
  dy /= sq;

  compressed.push({ x: sx, y: sy });

  for (i = 2; i < nodes.length; i++) {
    lx = px;
    ly = py;

    ldx = dx;
    ldy = dy;

    px = nodes[i].x;
    py = nodes[i].y;

    dx = px - lx;
    dy = py - ly;

    sq = Math.sqrt(dx * dx + dy * dy);
    dx /= sq;
    dy /= sq;

    if (dx !== ldx || dy !== ldy) {
      compressed.push({ x: lx, y: ly });
    }
  }

  compressed.push({ x: px, y: py });

  return compressed;
}
