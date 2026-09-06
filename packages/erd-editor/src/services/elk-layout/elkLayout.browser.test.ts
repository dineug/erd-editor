import { describe, expect, it } from 'vite-plus/test';

import { TablePlacement } from '@/constants/tablePlacement';
import { createElkLayout } from '@/services/elk-layout';
import type {
  ElkLayoutPoint,
  ElkLayoutRequest,
} from '@/services/elk-layout/elkGraph';

/**
 * ELK is megabytes of script the worker parses before it answers anything, so
 * the first case here pays for the whole realm and every timeout below leaves
 * room for it.
 */
const TIMEOUT = 30_000;

const chain = (placement: ElkLayoutRequest['placement']): ElkLayoutRequest => ({
  placement,
  nodes: [
    { id: 't1', width: 200, height: 100 },
    { id: 't2', width: 200, height: 100 },
    { id: 't3', width: 200, height: 100 },
  ],
  edges: [
    { source: 't1', target: 't2', sourceRow: 0, targetRow: 0 },
    { source: 't2', target: 't3', sourceRow: 0, targetRow: 0 },
  ],
});

const byId = (points: ElkLayoutPoint[]) =>
  new Map(points.map(point => [point.id, point]));

describe('the placement runs in a shared worker', () => {
  it(
    'answers from a realm that has no document of its own',
    async () => {
      const points = await createElkLayout(
        chain(TablePlacement.layeredHorizontal)
      );

      expect(points.map(point => point.id).sort()).toEqual(['t1', 't2', 't3']);
    },
    TIMEOUT
  );

  it(
    'lays a chain left to right, so elk really ran there',
    async () => {
      const placed = byId(
        await createElkLayout(chain(TablePlacement.layeredHorizontal))
      );

      expect(placed.get('t2')!.x).toBeGreaterThan(placed.get('t1')!.x);
      expect(placed.get('t3')!.x).toBeGreaterThan(placed.get('t2')!.x);
    },
    TIMEOUT
  );

  it(
    'lays the same chain top to bottom for the vertical placement',
    async () => {
      const placed = byId(
        await createElkLayout(chain(TablePlacement.layeredVertical))
      );

      expect(placed.get('t2')!.y).toBeGreaterThan(placed.get('t1')!.y);
      expect(placed.get('t3')!.y).toBeGreaterThan(placed.get('t2')!.y);
    },
    TIMEOUT
  );

  it(
    'answers the flow placement from the same worker',
    async () => {
      const points = await createElkLayout(chain(TablePlacement.flow));

      expect(points).toHaveLength(3);
      expect(points.every(point => Number.isFinite(point.x))).toBe(true);
    },
    TIMEOUT
  );
});
