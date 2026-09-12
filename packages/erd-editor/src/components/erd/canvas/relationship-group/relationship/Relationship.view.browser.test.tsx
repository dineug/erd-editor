/** @jsxHost konva */

// AC-56 and AC-68 at the leaf: under a view provider a connector lays its route,
// its hit band and its marker traces at the anchors the view's sort wrote, among
// the view's boxes; a sibling with no provider draws the same entity at the document's.

import { useProvider } from '@dineug/r-html';
import type { Container } from 'konva/lib/Container';
import type { Node as KonvaNode } from 'konva/lib/Node';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, createTestTheme, flush } from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import Relationship from '@/components/erd/canvas/relationship-group/relationship/Relationship';
import { sceneSourceContext } from '@/components/sceneSourceContext';
import { RELATIONSHIP_STROKE_WIDTH } from '@/constants/layout';
import { RelationshipType } from '@/constants/schema';
import { ViewKind } from '@/engine/modules/editor/state';
import {
  viewMoveTableAction,
  viewOpenAction,
  viewSetLayoutAction,
} from '@/engine/modules/editor/view.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { Point, Relationship as RelationshipType_ } from '@/internal-types';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';
import { getAnchors } from '@/utils/draw-relationship';
import { tableToObjectPoint } from '@/utils/draw-relationship/calc';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import {
  getRelationshipPath,
  toPathD,
} from '@/utils/draw-relationship/pathFinding';
import { relationshipSort } from '@/utils/draw-relationship/sort';

const THEME = createTestTheme();

/** Where the Focus view stands the two tables, nowhere near the document's corner. */
const VIEW_POSITIONS: Record<string, Point> = {
  t1: { x: 5_000, y: -3_000 },
  t2: { x: 5_600, y: -3_000 },
};

type Bounds = { left: number; top: number; right: number; bottom: number };

const teardowns: Array<() => void> = [];

const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

/**
 * One store with two tables joined by a connector, sorted for the document,
 * and a Focus view on the first standing both far away, sorted for the view.
 * Both sorts are run here so the scene mounts onto settled geometry.
 */
async function createApp(): Promise<{
  app: AppContext;
  relationship: RelationshipType_;
}> {
  const app = createTestAppContext();
  const { store } = app;

  store.dispatchSync(
    addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 1 } }),
    addTableAction({ id: 't2', ui: { x: 800, y: 0, zIndex: 2 } }),
    addRelationshipAction({
      id: 'r1',
      relationshipType: RelationshipType.ZeroOne,
      start: { tableId: 't1', columnIds: [] },
      end: { tableId: 't2', columnIds: [] },
    }),
    viewOpenAction({ kind: ViewKind.focus, centerIds: ['t1'] }),
    viewSetLayoutAction({ kind: ViewKind.focus, positions: VIEW_POSITIONS })
  );
  // The hooks sort both sources a few ms after the dispatch; waiting them out
  // means the sorts below are the last word rather than one overwritten later.
  await tick(50);
  relationshipSort(store.state);
  relationshipSort(store.state, 'focus');

  return { app, relationship: store.state.collections.relationshipEntities.r1 };
}

/**
 * A scene root the way the editor mounts one: a shell of its own with the
 * provider hung on it and the Stage container inside; a shell with no source
 * is the ERD tab, which the context default covers.
 */
function mountShell(
  app: AppContext,
  relationship: RelationshipType_,
  source: GeometrySource | null
): Stage {
  const shell = document.createElement('div');
  const container = document.createElement('div');
  shell.append(container);
  document.body.append(shell);

  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  const provider = source
    ? // oxlint-disable-next-line react-hooks/rules-of-hooks
      useProvider(shell as any, sceneSourceContext, source)
    : null;
  const rendered = renderScene({
    app,
    container,
    scene: (
      <k-layer name="scene">
        <Relationship
          relationship={relationship}
          strokeWidth={RELATIONSHIP_STROKE_WIDTH}
        />
      </k-layer>
    ),
    width: 800,
    height: 600,
    theme: THEME,
  });

  teardowns.push(() => {
    rendered.destroy();
    provider?.destroy();
    shell.remove();
  });

  return rendered.stage;
}

const childNamed = (stage: Stage, name: string) =>
  (stage.findOne<Container>('.relationship') as Container)
    .getChildren()
    .find(node => node.name() === name) as KonvaNode;

const numbersIn = (data: string) =>
  (data.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

/** One hit path holds the run and a trace per anchor, so it is split. */
const subpaths = (node: KonvaNode) =>
  (node.getAttr('data') as string)
    .split('M')
    .filter(Boolean)
    .map(part => `M${part}`);

/**
 * The points a subpath visits. A ring is two arcs, whose parameters are not
 * coordinates, so for one the move and the two arc ends are what count; every
 * other subpath is a move and lines, which are coordinate pairs throughout.
 */
function pointsOf(subpath: string): Point[] {
  if (subpath.includes('A')) {
    const [x, y] = numbersIn(subpath.slice(0, subpath.indexOf('A')));
    const ends = [
      ...subpath.matchAll(/A[\d.]+ [\d.]+ \d \d \d (-?[\d.]+) (-?[\d.]+)/g),
    ].map(([, ex, ey]) => ({ x: Number(ex), y: Number(ey) }));
    return [{ x, y }, ...ends];
  }

  const flat = numbersIn(subpath);
  const points: Point[] = [];
  for (let index = 0; index < flat.length; index += 2) {
    points.push({ x: flat[index], y: flat[index + 1] });
  }
  return points;
}

/** The bounding rect of the boxes the view draws for both tables. */
function viewBounds(app: AppContext): Bounds {
  const { state } = app.store;
  const boxes = ['t1', 't2'].map(id =>
    tableToObjectPoint(state, state.collections.tableEntities[id], 'focus')
  );

  return {
    left: Math.min(...boxes.map(({ lt }) => lt.x)),
    top: Math.min(...boxes.map(({ lt }) => lt.y)),
    right: Math.max(...boxes.map(({ rb }) => rb.x)),
    bottom: Math.max(...boxes.map(({ rb }) => rb.y)),
  };
}

const within = ({ left, top, right, bottom }: Bounds, { x, y }: Point) =>
  x >= left && x <= right && y >= top && y <= bottom;

describe('Relationship under a view provider', () => {
  /** AC-68. The hit band runs from the view's start anchor to its end anchor. */
  it('runs the pointer band between the anchors the view sort wrote', async () => {
    const { app, relationship } = await createApp();
    const stage = mountShell(app, relationship, 'focus');
    await flush();
    await whenDrawn();

    const [run] = subpaths(childNamed(stage, 'relationship-hit-area'));
    const numbers = numbersIn(run);
    const { start, end } = getAnchors(relationship, 'focus');

    expect(start.x).toBeGreaterThanOrEqual(5_000);
    expect(numbers.slice(0, 2)).toEqual([start.x, start.y]);
    expect(numbers.slice(-2)).toEqual([end.x, end.y]);
    // The entity still carries the document's anchors, which the band left.
    expect(relationship.start.x).toBeLessThan(1_000);
    expect(numbers.slice(0, 2)).not.toEqual([
      relationship.start.x,
      relationship.start.y,
    ]);
  });

  it('draws the route the view path finder produced', async () => {
    const { app, relationship } = await createApp();
    const stage = mountShell(app, relationship, 'focus');
    await flush();
    await whenDrawn();

    const route = childNamed(stage, 'relationship-route');
    const viewD = toPathD(
      getRelationshipPath(relationship, 'focus').path.path.d()
    );
    const documentD = toPathD(getRelationshipPath(relationship).path.path.d());

    expect(route.getAttr('data')).toBe(viewD);
    expect(viewD).not.toBe(documentD);
  });

  /** AC-56. Every point of the hit band, marker traces included, lies among the view's boxes. */
  it('keeps the whole hit path inside the bounding rect of the view boxes', async () => {
    const { app, relationship } = await createApp();
    const stage = mountShell(app, relationship, 'focus');
    await flush();
    await whenDrawn();

    const bounds = viewBounds(app);
    const parts = subpaths(childNamed(stage, 'relationship-hit-area'));

    expect(bounds.left).toBe(5_000);
    expect(parts).toHaveLength(11);
    for (const part of parts) {
      for (const point of pointsOf(part)) {
        expect(within(bounds, point)).toBe(true);
      }
    }
  });

  /** The view sort writes no observable entity, so the channel itself has to wake the leaf. */
  it('follows a view move through the hook, the sort and the channel with no other change', async () => {
    const { app, relationship } = await createApp();
    const stage = mountShell(app, relationship, 'focus');
    await flush();
    await whenDrawn();
    const before = getAnchors(relationship, 'focus').end.x;

    app.store.dispatchSync(
      viewMoveTableAction({ ids: ['t2'], movementX: 400, movementY: 0 })
    );
    await tick(50);
    await flush();
    await whenDrawn();

    const { end } = getAnchors(relationship, 'focus');
    const [run] = subpaths(childNamed(stage, 'relationship-hit-area'));
    expect(end.x).toBe(before + 400);
    expect(numbersIn(run).slice(-2)).toEqual([end.x, end.y]);
    expect(childNamed(stage, 'relationship-route').getAttr('data')).toBe(
      toPathD(getRelationshipPath(relationship, 'focus').path.path.d())
    );
    expect(relationship.end.x).toBeLessThan(1_000);
  });

  it('draws the same entity at the document anchors in a sibling with no provider', async () => {
    const { app, relationship } = await createApp();
    const viewStage = mountShell(app, relationship, 'focus');
    const documentStage = mountShell(app, relationship, null);
    await flush();
    await whenDrawn();

    const bounds = viewBounds(app);
    const [documentRun] = subpaths(
      childNamed(documentStage, 'relationship-hit-area')
    );
    const [viewRun] = subpaths(childNamed(viewStage, 'relationship-hit-area'));

    expect(numbersIn(documentRun).slice(0, 2)).toEqual([
      relationship.start.x,
      relationship.start.y,
    ]);
    expect(
      within(bounds, { x: relationship.start.x, y: relationship.start.y })
    ).toBe(false);
    expect(
      childNamed(documentStage, 'relationship-route').getAttr('data')
    ).toBe(toPathD(getRelationshipPath(relationship).path.path.d()));
    expect(viewRun).not.toBe(documentRun);
  });
});
