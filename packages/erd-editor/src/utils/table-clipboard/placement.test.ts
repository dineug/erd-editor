import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { START_ADD, START_X, START_Y } from '@/constants/layout';
import { Memo, Settings, Table } from '@/internal-types';
import { nextPoint } from '@/utils';
import { createMemo } from '@/utils/collection/memo.entity';
import { createTable } from '@/utils/collection/table.entity';
import {
  PlacementEntity,
  PlacementPoint,
  resolvePlacement,
  ResolvePlacementConfig,
} from '@/utils/table-clipboard/placement';

vi.mock('@/utils', async importOriginal => {
  const mod = await importOriginal<typeof import('@/utils')>();

  return {
    ...mod,
    nextPoint: vi.fn(mod.nextPoint),
  };
});

const createSettings = (partial: Partial<Settings> = {}): Settings => ({
  ...schemaV3Parser({}).settings,
  width: 2000,
  height: 2000,
  scrollTop: 0,
  scrollLeft: 0,
  zoomLevel: 1,
  ...partial,
});

const createEntity = (
  sourceId: string,
  x: number,
  y: number,
  zIndex = 2
): PlacementEntity => ({ sourceId, ui: { x, y, zIndex } });

const createFindSource =
  (tables: Table[], memos: Memo[] = []) =>
  (sourceId: string) =>
    tables.find(({ id }) => id === sourceId) ??
    memos.find(({ id }) => id === sourceId);

const resolve = (overrides: Partial<ResolvePlacementConfig> = {}) =>
  resolvePlacement({
    entities: [],
    offset: { x: START_ADD, y: START_ADD },
    escapeCollision: true,
    settings: createSettings(),
    tables: [],
    memos: [],
    findSource: () => undefined,
    ...overrides,
  });

const toXY = ({ x, y }: PlacementPoint) => ({ x, y });

const xyOf = (placement: Map<string, PlacementPoint>, sourceId: string) => {
  const point = placement.get(sourceId);
  expect(point).toBeDefined();
  return toXY(point as PlacementPoint);
};

const countDistinct = (placement: Map<string, PlacementPoint>) =>
  new Set([...placement.values()].map(({ x, y }) => `${x},${y}`)).size;

beforeEach(() => {
  vi.mocked(nextPoint).mockClear();
});

describe('resolvePlacement', () => {
  it('returns an empty map and never asks for an anchor when there is nothing to place', () => {
    const placement = resolve({ entities: [] });

    expect(placement.size).toBe(0);
    expect(vi.mocked(nextPoint)).not.toHaveBeenCalled();
  });

  // AC-8
  it('places a copy 50 down-right of the live source that is still in the document', () => {
    const tables = [createTable({ id: 't1', ui: { x: 300, y: 400 } })];

    const placement = resolve({
      entities: [createEntity('t1', 300, 400)],
      tables,
      findSource: createFindSource(tables),
    });

    expect(xyOf(placement, 't1')).toEqual({ x: 350, y: 450 });
    expect(vi.mocked(nextPoint)).not.toHaveBeenCalled();
  });

  // AC-8 — memos take the same path as tables
  it('places a memo copy against its own live source', () => {
    const memos = [createMemo({ id: 'm1', ui: { x: 10, y: 20 } })];

    const placement = resolve({
      entities: [createEntity('m1', 10, 20)],
      memos,
      findSource: createFindSource([], memos),
    });

    expect(xyOf(placement, 'm1')).toEqual({ x: 60, y: 70 });
  });

  // AC-9
  it('steps a repeated paste by 50 per round because the caller scales the offset', () => {
    const source = createTable({ id: 't1', ui: { x: 200, y: 100 } });
    const tables: Table[] = [source];
    const results: Array<{ x: number; y: number }> = [];

    for (const round of [1, 2, 3]) {
      const placement = resolve({
        entities: [createEntity('t1', 200, 100)],
        offset: { x: START_ADD * round, y: START_ADD * round },
        tables: [...tables],
        findSource: createFindSource([source]),
      });

      const point = xyOf(placement, 't1');
      results.push(point);
      // the copy the round just produced is part of the document for the next one
      tables.push(createTable({ ui: { x: point.x, y: point.y } }));
    }

    expect(results).toEqual([
      { x: 250, y: 150 },
      { x: 300, y: 200 },
      { x: 350, y: 250 },
    ]);
  });

  // AC-10 — the round counter lives in the caller, so a reset is just offset (50,50) again
  it('produces the first-round placement again once the caller resets the offset', () => {
    const tables = [createTable({ id: 't1', ui: { x: 200, y: 100 } })];
    const config = {
      entities: [createEntity('t1', 200, 100)],
      offset: { x: START_ADD, y: START_ADD },
      tables,
      findSource: createFindSource(tables),
    };

    expect(
      xyOf(resolve({ ...config, offset: { x: 150, y: 150 } }), 't1')
    ).toEqual({ x: 350, y: 250 });
    expect(xyOf(resolve(config), 't1')).toEqual({ x: 250, y: 150 });
  });

  // AC-11
  it('follows the source to its new coordinates when the original was moved after the copy', () => {
    const entities = [createEntity('t1', 300, 400)];
    const moved = [createTable({ id: 't1', ui: { x: 700, y: 800 } })];

    const placement = resolve({
      entities,
      tables: moved,
      findSource: createFindSource(moved),
    });

    expect(xyOf(placement, 't1')).toEqual({ x: 750, y: 850 });
  });

  // AC-12
  it('anchors the whole absent set with a single nextPoint call and keeps their relative offsets', () => {
    const entities = [
      createEntity('a', 0, 0),
      createEntity('b', 140, 50),
      createEntity('c', -40, 200),
    ];

    const placement = resolve({ entities });

    expect(vi.mocked(nextPoint)).toHaveBeenCalledTimes(1);
    // originRef is (min x, then min y) — 'c' here
    expect(xyOf(placement, 'c')).toEqual({ x: START_X, y: START_Y });
    expect(xyOf(placement, 'a')).toEqual({ x: START_X + 40, y: START_Y - 200 });
    expect(xyOf(placement, 'b')).toEqual({
      x: START_X + 180,
      y: START_Y - 150,
    });

    const a = xyOf(placement, 'a');
    const b = xyOf(placement, 'b');
    expect({ x: b.x - a.x, y: b.y - a.y }).toEqual({ x: 140, y: 50 });
    expect(countDistinct(placement)).toBe(3);
  });

  // AC-12 — a second paste into the same foreign document must not stack on the first
  it('shifts the anchor when the previous fallback batch already occupies it', () => {
    const entities = [createEntity('a', 0, 0), createEntity('b', 140, 50)];

    const first = resolve({ entities });
    const tables = [...first.values()].map(({ x, y }) =>
      createTable({ ui: { x, y } })
    );
    const second = resolve({ entities, tables });

    expect(xyOf(second, 'a')).toEqual({
      x: xyOf(first, 'a').x + START_ADD,
      y: xyOf(first, 'a').y + START_ADD,
    });
    expect(xyOf(second, 'b')).toEqual({
      x: xyOf(first, 'b').x + START_ADD,
      y: xyOf(first, 'b').y + START_ADD,
    });
  });

  // AC-12 — the anchor is asked for once no matter how large the absent set is
  it('asks for the anchor once for an absent set of ten', () => {
    const entities = Array.from({ length: 10 }, (_, index) =>
      createEntity(`e${index}`, index * 10, index * 10)
    );

    const placement = resolve({ entities });

    expect(vi.mocked(nextPoint)).toHaveBeenCalledTimes(1);
    expect(countDistinct(placement)).toBe(10);
  });

  // AC-13
  it('keeps two entities of one batch off the same point even when they were recorded on it', () => {
    const entities = [createEntity('a', 100, 100), createEntity('b', 100, 100)];

    const placement = resolve({ entities });

    expect(countDistinct(placement)).toBe(2);
    expect(xyOf(placement, 'a')).toEqual({ x: START_X, y: START_Y });
    expect(xyOf(placement, 'b')).toEqual({
      x: START_X + START_ADD,
      y: START_Y + START_ADD,
    });
  });

  // AC-13 — a present copy landing on an absent copy's anchor escapes too
  it('keeps a present copy and an absent copy apart when they compete for one point', () => {
    const source = createTable({
      id: 't1',
      ui: { x: START_X - 50, y: START_Y - 50 },
    });
    const tables = [source];

    const placement = resolve({
      entities: [
        createEntity('t1', START_X - 50, START_Y - 50),
        createEntity('gone', 0, 0),
      ],
      tables,
      findSource: createFindSource(tables),
    });

    expect(countDistinct(placement)).toBe(2);
  });

  // AC-30
  it('splits a partially deleted set into a live-anchored copy and a rigid absent group', () => {
    const survivor = createTable({ id: 'kept', ui: { x: 600, y: 300 } });
    const tables = [survivor];
    const entities = [
      createEntity('kept', 600, 300),
      createEntity('gone-a', 0, 0),
      createEntity('gone-b', 120, 80),
    ];

    const placement = resolve({
      entities,
      tables,
      findSource: createFindSource(tables),
    });

    expect(vi.mocked(nextPoint)).toHaveBeenCalledTimes(1);
    expect(xyOf(placement, 'kept')).toEqual({ x: 650, y: 350 });
    expect(xyOf(placement, 'gone-a')).toEqual({ x: START_X, y: START_Y });
    expect(xyOf(placement, 'gone-b')).toEqual({
      x: START_X + 120,
      y: START_Y + 80,
    });
    expect(countDistinct(placement)).toBe(3);
  });

  // AC-37
  it('leaves an occupied target untouched when escapeCollision is off', () => {
    const source = createTable({ id: 't1', ui: { x: 200, y: 100 } });
    const blocker = createTable({ ui: { x: 250, y: 150 } });
    const tables = [source, blocker];

    const placement = resolve({
      entities: [createEntity('t1', 200, 100)],
      escapeCollision: false,
      tables,
      findSource: createFindSource(tables),
    });

    expect(xyOf(placement, 't1')).toEqual({ x: 250, y: 150 });
  });

  // AC-37
  it('escapes the same occupied target by 50 when escapeCollision is on', () => {
    const source = createTable({ id: 't1', ui: { x: 200, y: 100 } });
    const blocker = createTable({ ui: { x: 250, y: 150 } });
    const tables = [source, blocker];

    const placement = resolve({
      entities: [createEntity('t1', 200, 100)],
      escapeCollision: true,
      tables,
      findSource: createFindSource(tables),
    });

    expect(xyOf(placement, 't1')).toEqual({ x: 300, y: 200 });
  });

  // AC-37 — escape is driven by the flag, never inferred from the offset value
  it('honours an exactly (50,50) drag rather than reading it as a paste round', () => {
    const source = createTable({ id: 't1', ui: { x: 0, y: 0 } });
    const neighbour = createTable({ ui: { x: 50, y: 50 } });
    const tables = [source, neighbour];

    const placement = resolve({
      entities: [createEntity('t1', 0, 0)],
      offset: { x: 50, y: 50 },
      escapeCollision: false,
      tables,
      findSource: createFindSource(tables),
    });

    expect(xyOf(placement, 't1')).toEqual({ x: 50, y: 50 });
  });

  it('escapes past a run of occupied points', () => {
    const source = createTable({ id: 't1', ui: { x: 0, y: 0 } });
    const tables = [
      source,
      createTable({ ui: { x: 50, y: 50 } }),
      createTable({ ui: { x: 100, y: 100 } }),
      createTable({ ui: { x: 150, y: 150 } }),
    ];

    const placement = resolve({
      entities: [createEntity('t1', 0, 0)],
      tables,
      findSource: createFindSource(tables),
    });

    expect(xyOf(placement, 't1')).toEqual({ x: 200, y: 200 });
  });

  it('does not depend on the order the entities arrive in', () => {
    const entities = [
      createEntity('a', 300, 20),
      createEntity('b', 40, 500),
      createEntity('c', 40, 90),
    ];

    const forward = resolve({ entities });
    const backward = resolve({ entities: [...entities].reverse() });

    for (const sourceId of ['a', 'b', 'c']) {
      expect(xyOf(backward, sourceId)).toEqual(xyOf(forward, sourceId));
    }
  });

  it('stacks the copies above everything on the canvas in their recorded order', () => {
    const tables = [createTable({ ui: { zIndex: 7 } })];
    const memos = [createMemo({ ui: { zIndex: 9 } })];

    const placement = resolve({
      entities: [
        createEntity('a', 0, 0, 5),
        createEntity('b', 100, 0, 2),
        createEntity('c', 200, 0, 11),
      ],
      tables,
      memos,
    });

    expect(placement.get('b')?.zIndex).toBe(10);
    expect(placement.get('a')?.zIndex).toBe(11);
    expect(placement.get('c')?.zIndex).toBe(12);
  });

  it('mutates neither the entities it was given nor the document collections', () => {
    const entities = [createEntity('t1', 200, 100), createEntity('gone', 0, 0)];
    const tables = [createTable({ id: 't1', ui: { x: 200, y: 100 } })];
    const snapshot = structuredClone({ entities, ui: tables[0].ui });

    resolve({ entities, tables, findSource: createFindSource(tables) });

    expect(entities).toEqual(snapshot.entities);
    expect(tables[0].ui).toEqual(snapshot.ui);
  });
});
