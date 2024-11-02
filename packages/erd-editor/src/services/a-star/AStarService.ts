import type { Point } from '@/internal-types';
import type { GridObject } from '@/utils/draw-relationship';

import { ANode, aStar, type Wall } from './AStarFinder';

type Payload = {
  id: string;
  start: Point;
  end: Point;
  objectGridMap: Map<string, GridObject>;
};

const LIMIT = 400;

export class AStarService {
  async run({
    id,
    start,
    end,
    objectGridMap,
  }: Payload): Promise<Array<[Point, Point]>> {
    const distanceX = Math.abs(start.x - end.x);
    const distanceY = Math.abs(start.y - end.y);
    const levelX = Math.ceil(distanceX / LIMIT);
    const levelY = Math.ceil(distanceY / LIMIT);
    const startX = Math.ceil(start.x / levelX);
    const startY = Math.ceil(start.y / levelY);
    const endX = Math.ceil(end.x / levelX);
    const endY = Math.ceil(end.y / levelY);

    const walls = [...objectGridMap.values()].map<Wall>(obj => ({
      minX: Math.ceil(obj.x / levelX),
      maxX: Math.ceil((obj.x + obj.width) / levelX),
      minY: Math.ceil(obj.y / levelY),
      maxY: Math.ceil((obj.y + obj.height) / levelY),
    }));
    const startNode = new ANode(startX, startY);
    const endNode = new ANode(endX, endY);

    const st = Date.now();
    const path = aStar(startNode, endNode, walls, 400);
    const et = Date.now();

    console.log('path', path.length);
    console.log(`${(et - st) / 1000}s`);

    if (path.length < 2) {
      return [];
    }

    const lines: Array<[Point, Point]> = [];
    path.reduce((prev, next) => {
      lines.push([
        {
          x: prev.x * levelX,
          y: prev.y * levelY,
        },
        {
          x: next.x * levelX,
          y: next.y * levelY,
        },
      ]);
      return next;
    });

    return lines;
  }
}
