// The particles of a Flow view's lit connectors: six on each, from the PK end
// toward the FK end, on a layer the commit gate never draws, moved by one frame
// loop that stops with the tab (AC-33, AC-51, AC-70).

import { type AnyAction, useProvider } from '@dineug/r-html';
import type { Group } from 'konva/lib/Group';
import type { Layer } from 'konva/lib/Layer';
import type { Circle } from 'konva/lib/shapes/Circle';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestTheme,
  fireScenePointer,
  flush,
  mount,
  type Mounted,
  releasePointer,
  whenPainted,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import { themeContext } from '@/components/themeContext';
import Visualization from '@/components/visualization/Visualization';
import { CanvasType, RelationshipType } from '@/constants/schema';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { ViewKind, VisualizationMode } from '@/engine/modules/editor/state';
import {
  changeVisualizationModeAction,
  viewChangeZoomLevelAction,
  viewOpenAction,
  viewScrollToAction,
} from '@/engine/modules/editor/view.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import { Tag } from '@/engine/tag';
import { whenDrawn } from '@/konva/batchDraw';
import { getAnchors } from '@/utils/draw-relationship';

import { getParticleEdges } from './particleEdges';
import { particleClock } from './particleLoop';
import {
  PARTICLE_COUNT,
  PARTICLE_EDGE_ALPHA,
  PARTICLE_RX,
  PARTICLE_RY,
  particlePhase,
  pointAlong,
  tangentAt,
  withAlpha,
} from './particlePath';

const hoisted = vi.hoisted(() => ({
  requests: [] as Array<{ placement: string; nodes: any[] }>,
}));

/**
 * ELK answers from a shared worker the spec does not wait on: the one call
 * across that boundary is stood in for by a row, so the landing is something
 * the spec can predict.
 */
vi.mock('@/services/elk-layout', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/elk-layout')>();

  return {
    ...actual,
    createElkLayout: (request: any) => {
      hoisted.requests.push(request);
      return Promise.resolve(
        request.nodes.map((node: any, index: number) => ({
          id: node.id,
          x: index * 400,
          y: (index % 2) * 200,
        }))
      );
    },
  };
});

const VIEWPORT = { width: 1000, height: 630 };

/** The slot the Flow scene reads, which is the one source these particles run in. */
const SOURCE = ViewKind.flow;

const teardowns: Array<() => void> = [];

afterEach(async () => {
  releasePointer();
  teardowns.splice(0).forEach(teardown => teardown());
  hoisted.requests.splice(0);
  vi.restoreAllMocks();
  await whenDrawn();
});

const link = (id: string, start: string, end: string) =>
  addRelationshipAction({
    id,
    relationshipType: RelationshipType.ZeroN,
    start: { tableId: start, columnIds: [] },
    end: { tableId: end, columnIds: [] },
  });

/**
 * A chain t1 - t2 - t3, a second neighbour t4 of t1 joined to t2, and t5 off
 * on its own: a Flow narrowed to t1 lights r12 and r14, shows r24 unlit since
 * neither end is a center, and leaves r23 and t5 out of the display set entirely.
 */
function seed(app: AppContext) {
  app.store.dispatchSync(
    changeViewportAction(VIEWPORT),
    addTableAction({ id: 't1', ui: { x: 100, y: 100, zIndex: 1 } }),
    addTableAction({ id: 't2', ui: { x: 700, y: 100, zIndex: 2 } }),
    addTableAction({ id: 't3', ui: { x: 1300, y: 100, zIndex: 3 } }),
    addTableAction({ id: 't4', ui: { x: 100, y: 500, zIndex: 4 } }),
    addTableAction({ id: 't5', ui: { x: 1300, y: 500, zIndex: 5 } }),
    addColumnAction({ id: 'c1', tableId: 't1' }),
    link('r12', 't1', 't2'),
    link('r23', 't2', 't3'),
    link('r14', 't1', 't4'),
    link('r24', 't2', 't4')
  );
}

/** A document edit the way a peer's arrives, which is the one way an edit reaches the store under a view. */
const shared = (action: AnyAction): AnyAction => ({
  ...action,
  tags: Tag.shared,
});

/** Two rounds: the layout lands in a microtask after the first, and the fit after it. */
const settle = async () => {
  await flush();
  await whenDrawn();
  await flush();
  await whenDrawn();
};

/** Settles the scene and lets the loop run a frame on it. */
const settleAndPaint = async () => {
  await settle();
  await whenPainted();
};

/**
 * The tab standing on Flow, narrowed to the centers given before the mount, so
 * the one placement the mount asks for is that display set's. The mode is
 * taken after the theme stands, or the circles would be built without a palette.
 */
async function mountFlow(
  app: AppContext,
  centerIds: string[]
): Promise<Mounted> {
  app.store.dispatchSync(
    changeCanvasTypeAction({ value: CanvasType.visualization }),
    viewOpenAction({ kind: SOURCE, centerIds })
  );
  const mounted = mount(<Visualization />, app);
  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(
    mounted.container as any,
    themeContext,
    createTestTheme()
  );

  app.store.dispatchSync(
    changeVisualizationModeAction({ value: VisualizationMode.flow })
  );
  await settleAndPaint();

  const teardown = () => {
    mounted.unmount();
    themeProvider.destroy();
  };
  teardowns.push(teardown);

  return {
    ...mounted,
    unmount: () => {
      const at = teardowns.indexOf(teardown);
      if (at !== -1) teardowns.splice(at, 1);
      teardown();
    },
  };
}

const stageRegistry = (): Record<string, Stage> =>
  Reflect.get(globalThis, '__erdStages') ?? {};

const flowStage = () => stageRegistry().canvas;

const particleLayer = () =>
  flowStage().findOne<Layer>('.view-particles') as Layer;

const groupsOf = () => particleLayer().find<Group>('.particle-edge');

const circlesOf = () => particleLayer().find<Circle>('Circle');

const groupOf = (id: string) => particleLayer().findOne<Group>(`.${id}`);

const litIdsOf = () =>
  groupsOf()
    .map(group => group.name().replace('particle-edge ', ''))
    .sort();

const tableOf = (id: string) =>
  flowStage().findOne<Group>(`#table-${id}`) as Group;

const hover = async (id: string) => {
  fireScenePointer(tableOf(id), 'mouseenter');
  await settleAndPaint();
};

const leave = async (id: string) => {
  fireScenePointer(tableOf(id), 'mouseleave');
  await settleAndPaint();
};

/** Whether whenDrawn answers at all, which an open animation window would hold up. */
const drawnAnswers = () =>
  Promise.race([
    whenDrawn().then(() => true),
    new Promise<boolean>(resolve => setTimeout(() => resolve(false), 300)),
  ]);

describe('the particles of a Flow view', () => {
  it('runs six on every lit connector as the view opens, and none on a connector it shows unlit (AC-33)', async () => {
    const app = createTestAppContext();
    seed(app);
    await mountFlow(app, ['t1']);

    const theme = createTestTheme();
    expect(particleLayer()).toBeDefined();
    expect(litIdsOf()).toEqual(['r12', 'r14']);
    expect(circlesOf()).toHaveLength(2 * PARTICLE_COUNT);
    for (const id of ['r12', 'r14']) {
      const circles = groupOf(id)!.find<Circle>('Circle');
      expect(circles).toHaveLength(PARTICLE_COUNT);
      circles.forEach(circle => {
        expect(circle.fill()).toBe(theme.accentColor9);
        expect(circle.listening()).toBe(false);
      });
    }

    // r24 joins two neighbours and no center, so it is shown and not lit: it
    // carries no particle.
    expect(flowStage().findOne('.r24')).toBeDefined();
    expect(groupOf('r24')).toBeUndefined();
  });

  it('carries each particle from the PK end toward the FK end, a sixth of the run a second (AC-33)', async () => {
    const app = createTestAppContext();
    seed(app);
    const now = vi.spyOn(particleClock, 'now').mockReturnValue(0);
    await mountFlow(app, ['t1']);

    const relationship = app.store.state.collections.relationshipEntities.r12;
    const { start, end } = getAnchors(relationship, SOURCE);
    const [edge] = getParticleEdges(app.store.state, SOURCE).filter(
      candidate => candidate.id === 'r12'
    );
    const circles = groupOf('r12')!.find<Circle>('Circle');
    const at = (index: number) => ({
      x: circles[index].x(),
      y: circles[index].y(),
    });
    const expectAt = (index: number, elapsed: number) => {
      const expected = pointAlong(
        edge.path,
        particlePhase(elapsed, edge.path.length)[index]
      );
      expect(at(index).x).toBeCloseTo(expected.x, 6);
      expect(at(index).y).toBeCloseTo(expected.y, 6);
    };

    // The PK end is the start anchor, on t1, where the first particle stands
    // at the start of the run.
    expect(relationship.start.tableId).toBe('t1');
    expect(at(0)).toEqual({ x: start.x, y: start.y });
    for (let index = 0; index < PARTICLE_COUNT; index++) expectAt(index, 0);

    now.mockReturnValue(3_000);
    await whenPainted();

    const half = pointAlong(edge.path, edge.path.length / 2);
    expect(at(0).x).toBeCloseTo(half.x, 6);
    expect(at(0).y).toBeCloseTo(half.y, 6);
    expect(at(3)).toEqual({ x: start.x, y: start.y });
    for (let index = 0; index < PARTICLE_COUNT; index++) {
      expectAt(index, 3_000);
    }

    // Nearer the FK end than at the start, and never past it.
    const toEnd = (point: { x: number; y: number }) =>
      Math.hypot(end.x - point.x, end.y - point.y);
    expect(toEnd(at(0))).toBeLessThan(toEnd({ x: start.x, y: start.y }));

    now.mockReturnValue(5_999);
    await whenPainted();
    expect(toEnd(at(0))).toBeLessThan(edge.path.length / 100);
  });

  it('draws each particle as a Circle stretched along its run, turned to face it and fading at its edge (AC-30, AC-31)', async () => {
    const app = createTestAppContext();
    seed(app);
    vi.spyOn(particleClock, 'now').mockReturnValue(0);
    await mountFlow(app, ['t1']);

    const theme = createTestTheme();
    const [edge] = getParticleEdges(app.store.state, SOURCE).filter(
      candidate => candidate.id === 'r12'
    );
    const circles = groupOf('r12')!.find<Circle>('Circle');
    const distances = particlePhase(0, edge.path.length);

    circles.forEach((circle, index) => {
      // A Circle with a scale rather than an Ellipse, which is the one shape
      // class the konva allowlist and the scene's tag count both stand on.
      expect(circle.getClassName()).toBe('Circle');
      expect(circle.radius()).toBe(PARTICLE_RY);
      expect(circle.scaleX()).toBeCloseTo(PARTICLE_RX / PARTICLE_RY, 9);
      expect(circle.scaleY()).toBe(1);
      expect(circle.rotation()).toBeCloseTo(
        tangentAt(edge.path, distances[index]),
        9
      );
      expect(circle.fillPriority()).toBe('radial-gradient');
      expect(circle.fillRadialGradientStartRadius()).toBe(0);
      expect(circle.fillRadialGradientEndRadius()).toBe(PARTICLE_RY);
      expect(circle.fillRadialGradientColorStops()).toEqual([
        0,
        theme.accentColor9,
        1,
        withAlpha(theme.accentColor9, PARTICLE_EDGE_ALPHA),
      ]);
    });

    // The connector bends, so the six do not all face one way.
    const facings = new Set(
      circles.map(circle => Math.round(circle.rotation()))
    );
    expect(facings.size).toBeGreaterThan(1);
  });

  it('follows the hover: a lit connector takes its particles on with it and off with the leave (AC-33)', async () => {
    const app = createTestAppContext();
    seed(app);
    await mountFlow(app, ['t1']);

    await hover('t2');
    expect(litIdsOf()).toEqual(['r12', 'r14', 'r24']);
    expect(circlesOf()).toHaveLength(3 * PARTICLE_COUNT);

    await leave('t2');
    await hover('t4');
    expect(litIdsOf()).toEqual(['r12', 'r14', 'r24']);

    await leave('t4');
    expect(litIdsOf()).toEqual(['r12', 'r14']);
    expect(circlesOf()).toHaveLength(2 * PARTICLE_COUNT);
  });

  it('stops with the tab: leaving it takes the layer down and asks for no frame again', async () => {
    const app = createTestAppContext();
    seed(app);
    const frames = vi.spyOn(particleClock, 'requestFrame');
    const mounted = await mountFlow(app, ['t1']);

    expect(frames).toHaveBeenCalled();
    expect(circlesOf()).toHaveLength(2 * PARTICLE_COUNT);

    mounted.unmount();
    app.store.dispatchSync(changeCanvasTypeAction({ value: CanvasType.ERD }));
    await settle();

    expect(flowStage()).toBeUndefined();

    const asked = frames.mock.calls.length;
    await whenPainted();
    await whenPainted();
    expect(frames.mock.calls.length).toBe(asked);
  });

  it('asks one frame at a time however often the hover moves, and whenDrawn answers while it runs (AC-51)', async () => {
    const app = createTestAppContext();
    seed(app);
    await mountFlow(app, ['t1']);
    const frames = vi.spyOn(particleClock, 'requestFrame');

    // One frame asked per frame painted: two rAFs pass, so two or three.
    const perPaint = async () => {
      const before = frames.mock.calls.length;
      await whenPainted();
      return frames.mock.calls.length - before;
    };
    const baseline = await perPaint();
    expect(baseline).toBeGreaterThanOrEqual(1);
    expect(baseline).toBeLessThanOrEqual(3);

    for (let round = 0; round < 10; round++) {
      const id = round % 2 ? 't4' : 't2';
      fireScenePointer(tableOf(id), 'mouseenter');
      await flush();
      fireScenePointer(tableOf(id), 'mouseleave');
      await flush();
    }
    fireScenePointer(tableOf('t2'), 'mouseenter');
    await settleAndPaint();

    expect(litIdsOf()).toEqual(['r12', 'r14', 'r24']);
    expect(await perPaint()).toBeLessThanOrEqual(3);
    expect(await drawnAnswers()).toBe(true);
  });

  it('is committed at mount alone: the gate never draws it again while the scene commits around it, and the circles stay (AC-70)', async () => {
    const app = createTestAppContext();
    seed(app);
    await mountFlow(app, ['t1']);

    const particles = particleLayer();
    const scene = flowStage().findOne<Layer>('.scene') as Layer;
    const particleDraw = vi.spyOn(particles, 'batchDraw');
    const sceneDraw = vi.spyOn(scene, 'batchDraw');
    const expectIntact = (lit: number) => {
      expect(circlesOf()).toHaveLength(lit * PARTICLE_COUNT);
      expect(
        particles.getChildren().every(child => child.hasName('particle-edge'))
      ).toBe(true);
    };

    await hover('t2');
    expectIntact(3);

    app.store.dispatchSync(
      viewScrollToAction({ kind: SOURCE, originX: 40, originY: -30 })
    );
    await settleAndPaint();
    expectIntact(3);
    expect(particles.position()).toEqual({ x: 40, y: -30 });

    app.store.dispatchSync(
      viewChangeZoomLevelAction({ kind: SOURCE, value: 0.5 })
    );
    await settleAndPaint();
    expectIntact(3);
    expect(particles.scale()).toEqual({ x: 0.5, y: 0.5 });

    app.store.dispatchSync(
      shared(changeColumnNameAction({ tableId: 't1', id: 'c1', value: 'id' }))
    );
    await settleAndPaint();
    expectIntact(3);

    await leave('t2');
    expectIntact(2);

    expect(sceneDraw).toHaveBeenCalled();
    expect(particleDraw).not.toHaveBeenCalled();
    expect(particles.getZIndex()).toBe(scene.getZIndex() + 1);
  });
});
