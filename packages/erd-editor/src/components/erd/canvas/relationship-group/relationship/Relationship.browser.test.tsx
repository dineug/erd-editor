/** @jsxHost konva */

// P3-30 and P3-34: one connector as konva nodes — the node types and their
// order, the paint a stylesheet selector used to give it, and the hit band the
// svg path was, which the last block drives at four zooms through konva itself.

import { type DOMTemplateLiterals } from '@dineug/r-html';
import type { Container } from 'konva/lib/Container';
import type { Node as KonvaNode } from 'konva/lib/Node';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestTheme,
  flush,
  moveScenePointer,
  whenPainted,
} from '@/__test-utils__';
import { type AppContext } from '@/components/appContext';
import Relationship from '@/components/erd/canvas/relationship-group/relationship/Relationship';
import {
  RELATIONSHIP_HIT_STROKE_WIDTH,
  RELATIONSHIP_STROKE_WIDTH,
} from '@/constants/layout';
import {
  Direction,
  RelationshipType,
  StartRelationshipType,
} from '@/constants/schema';
import { hoverRelationshipMapAction } from '@/engine/modules/editor/atom.actions';
import { Point, Relationship as RelationshipType_ } from '@/internal-types';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { CIRCLE_RADIUS } from '@/utils/draw-relationship';
import {
  getRelationshipPath,
  toPathD,
} from '@/utils/draw-relationship/pathFinding';

const THEME = createTestTheme();

const makeRelationship = (
  value: Parameters<typeof createRelationship>[0] = {}
): RelationshipType_ =>
  createRelationship({
    id: 'r1',
    relationshipType: RelationshipType.ZeroOne,
    startRelationshipType: StartRelationshipType.dash,
    start: {
      tableId: 't1',
      columnIds: ['c1', 'c2'],
      x: 100,
      y: 200,
      direction: Direction.right,
    },
    end: {
      tableId: 't2',
      columnIds: ['c3'],
      x: 400,
      y: 260,
      direction: Direction.left,
    },
    ...value,
  });

type Mounted = {
  app: AppContext;
  group: Container;
};

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

const sceneOf = (
  relationship: RelationshipType_,
  strokeWidth: number
): DOMTemplateLiterals => (
  <k-layer name="scene">
    <Relationship relationship={relationship} strokeWidth={strokeWidth} />
  </k-layer>
);

async function mountRelationship(
  relationship: RelationshipType_,
  strokeWidth = RELATIONSHIP_STROKE_WIDTH
): Promise<Mounted> {
  const container = document.createElement('div');
  document.body.append(container);
  const app = createTestAppContext();
  const rendered = renderScene({
    app,
    container,
    scene: sceneOf(relationship, strokeWidth),
    width: 800,
    height: 600,
    theme: THEME,
  });

  teardowns.push(() => {
    rendered.destroy();
    container.remove();
  });

  await flush();
  await whenDrawn();

  return {
    app,
    group: rendered.stage.findOne<Container>('.relationship') as Container,
  };
}

const settle = async () => {
  await flush();
  await whenDrawn();
};

const kinds = (group: Container) =>
  group.getChildren().map(node => node.getAttr('kind'));

const classNames = (group: Container) =>
  group.getChildren().map(node => node.getClassName());

const childNamed = (group: Container, name: string) =>
  group.getChildren().find(node => node.name() === name)!;

const numbersIn = (data: string) =>
  (data.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

/** One hit path holds the run and a closed box per anchor, so it is split. */
const subpaths = (node: KonvaNode) =>
  (node.getAttr('data') as string)
    .split('M')
    .filter(Boolean)
    .map(part => `M${part}`);

describe('Relationship as konva nodes', () => {
  it('names the group for a lookup and an ancestor walk', async () => {
    const { group } = await mountRelationship(makeRelationship());

    expect(group.getClassName()).toBe('Group');
    expect(group.name()).toBe('relationship r1');
    expect(group.hasName('relationship')).toBe(true);
    expect(group.hasName('r1')).toBe(true);
    expect(group.getAttr('kind')).toBe('relationship');
    // P0-2: an id would make an id scan ambiguous the moment the minimap draws
    // the same connector, so the relationship id rides in the name instead.
    expect(group.id()).toBe('');
  });

  it('draws the hit band, the route and the decorations in that order', async () => {
    const { group } = await mountRelationship(makeRelationship());

    expect(classNames(group)).toEqual([
      'Path',
      'Path',
      'Line',
      'Line',
      'Line',
      'Line',
      'Line',
      'Circle',
      'Line',
      'Line',
    ]);
    expect(kinds(group).slice(0, 3)).toEqual([
      'relationship-hit-area',
      'relationship-route',
      'relationship-decoration',
    ]);
  });

  it('draws the route the path finder produced as one path', async () => {
    const relationship = makeRelationship();
    const expected = getRelationshipPath(relationship).path.path.d();
    const { group } = await mountRelationship(relationship);

    // Three runs, and a cut either side of both corners between them.
    expect(expected).toHaveLength(5);

    const route = childNamed(group, 'relationship-route');
    expect(route.getAttr('data')).toBe(toPathD(expected));
    // No fill attr at all: konva strokes an open path and leaves the area the
    // bends enclose alone, in the scene and in the hit graph both.
    expect(route.getAttr('fill')).toBeUndefined();
  });

  it('collapses a self relationship into a single path segment', async () => {
    const relationship = makeRelationship({
      start: {
        tableId: 't1',
        columnIds: ['c1'],
        x: 100,
        y: 200,
        direction: Direction.right,
      },
      end: {
        tableId: 't1',
        columnIds: ['c2'],
        x: 100,
        y: 300,
        direction: Direction.right,
      },
    });
    const { group } = await mountRelationship(relationship);

    expect(getRelationshipPath(relationship).path.path.d()).toHaveLength(1);
    expect(childNamed(group, 'relationship-route').getAttr('data')).toBe(
      toPathD(getRelationshipPath(relationship).path.path.d())
    );
  });

  it('dashes the route unless the relationship is identifying', async () => {
    const dashed = await mountRelationship(makeRelationship());
    expect(
      childNamed(dashed.group, 'relationship-route').getAttr('dash')
    ).toEqual([10, 10]);

    const solid = await mountRelationship(
      makeRelationship({ identification: true })
    );
    expect(
      childNamed(solid.group, 'relationship-route').getAttr('dash')
    ).toEqual([]);
  });

  it('applies the strokeWidth prop to the route only', async () => {
    const { group } = await mountRelationship(makeRelationship(), 7);

    expect(childNamed(group, 'relationship-route').getAttr('strokeWidth')).toBe(
      7
    );

    // Every remaining painted node is a cardinality decoration, drawn at a
    // fixed width.
    for (const node of group.getChildren()) {
      if (node.name() !== 'relationship-decoration') continue;
      expect(node.getAttr('strokeWidth')).toBe(RELATIONSHIP_STROKE_WIDTH);
    }
  });

  it('lays a pointer band over the connector that is wider than the drawing', async () => {
    const { group } = await mountRelationship(makeRelationship());
    const hit = childNamed(group, 'relationship-hit-area');

    expect(hit.getAttr('hitStrokeWidth')).toBe(RELATIONSHIP_HIT_STROKE_WIDTH);
    expect(RELATIONSHIP_HIT_STROKE_WIDTH).toBeGreaterThan(
      RELATIONSHIP_STROKE_WIDTH
    );
    // Nothing painted and nothing filled: the band exists for the hit graph,
    // where an explicit hitStrokeWidth is what konva reads instead of a stroke.
    expect(hit.getAttr('stroke')).toBeUndefined();
    expect(hit.getAttr('fill')).toBeUndefined();
    expect(hit.getAttr('dash')).toBeUndefined();
    expect(hit.listening()).toBe(true);
  });

  it('runs the pointer band from one anchor to the other', async () => {
    const relationship = makeRelationship();
    const { group } = await mountRelationship(relationship);

    const [run] = subpaths(childNamed(group, 'relationship-hit-area'));
    const numbers = numbersIn(run);

    // The route alone spans the two turning points. The band carries on past
    // the guide lines to the anchors themselves, because the markers between
    // them are drawn there and nothing else in the group listens.
    expect(numbers.slice(0, 2)).toEqual([
      relationship.start.x,
      relationship.start.y,
    ]);
    expect(numbers.slice(-2)).toEqual([relationship.end.x, relationship.end.y]);
  });

  it('traces every cardinality marker at both anchors', async () => {
    const relationship = makeRelationship();
    const { line } = getRelationshipPath(relationship);
    const { group } = await mountRelationship(relationship);
    const parts = subpaths(childNamed(group, 'relationship-hit-area'));

    // The run, then the two ticks, the two crow's foot arms and the ring at
    // each anchor. Traced whether or not this connector drew them, so the band
    // never has to know which cardinality it is carrying.
    expect(parts).toHaveLength(11);

    expect(numbersIn(parts[1])).toEqual([
      line.line.start.base.x1,
      line.line.start.base.y1,
      line.line.start.base.x1,
      line.line.start.base.y2,
    ]);
    expect(numbersIn(parts[2])).toEqual([
      line.line.start.base2.x1,
      line.line.start.base2.y1,
      line.line.start.base2.x1,
      line.line.start.base2.y2,
    ]);

    // The arc command, which konva parses the way the browser did, and which
    // is what carries the band round a ring the ticks leave a gap in.
    expect(numbersIn(parts[5]).slice(0, 2)).toEqual([
      line.startCircle.cx - CIRCLE_RADIUS,
      line.startCircle.cy,
    ]);
    expect(parts[5]).toContain(`A${CIRCLE_RADIUS} ${CIRCLE_RADIUS} 0 0 1`);
    expect(numbersIn(parts[10]).slice(0, 2)).toEqual([
      line.circle.cx - CIRCLE_RADIUS,
      line.circle.cy,
    ]);
  });

  it('renders the dash start marker for a dash start relationship type', async () => {
    const relationship = makeRelationship({
      startRelationshipType: StartRelationshipType.dash,
    });
    const { line } = getRelationshipPath(relationship);
    const { group } = await mountRelationship(relationship);

    const circles = group
      .getChildren()
      .filter(node => node.getClassName() === 'Circle');
    expect(circles).toHaveLength(1);

    const lines = group
      .getChildren()
      .filter(node => node.getClassName() === 'Line');
    const base2 = lines.find(
      node => node.getAttr('points')[0] === line.line.start.base2.x1
    );
    expect(base2).toBeTruthy();
    expect(base2?.getAttr('points')[3]).toBe(line.line.start.base2.y2);
  });

  it('renders a start ring for a ring start relationship type', async () => {
    const relationship = makeRelationship({
      startRelationshipType: StartRelationshipType.ring,
    });
    const { line } = getRelationshipPath(relationship);
    const { group } = await mountRelationship(relationship);

    const circles = group
      .getChildren()
      .filter(node => node.getClassName() === 'Circle');
    // one for the start ring, one for the ZeroOne end shape
    expect(circles).toHaveLength(2);
    expect(circles[0].x()).toBe(line.startCircle.cx);
    expect(circles[0].y()).toBe(line.startCircle.cy);
    expect(circles[0].getAttr('radius')).toBe(6);

    // The ring branch renders nodes the dash branch never does, and every other
    // mount in this file takes the dash branch.
    for (const node of group.getChildren()) {
      if (node.name() !== 'relationship-decoration') continue;
      expect(node.getAttr('strokeWidth')).toBe(RELATIONSHIP_STROKE_WIDTH);
    }
  });

  it('omits the end shape when the relationship type has no registered shape', async () => {
    const { group } = await mountRelationship(
      makeRelationship({ relationshipType: 0 })
    );

    expect(classNames(group)).toEqual([
      'Path',
      'Path',
      'Line',
      'Line',
      'Line',
      'Line',
    ]);
  });

  it('paints a plain connector with the foreign key colour', async () => {
    const { group } = await mountRelationship(makeRelationship());

    for (const node of group.getChildren()) {
      if (node.name() === 'relationship-hit-area') continue;
      expect(node.getAttr('stroke')).toBe(THEME.keyFK);
    }
  });

  it('paints an identifying connector with the primary foreign key colour', async () => {
    const { group } = await mountRelationship(
      makeRelationship({ identification: true })
    );

    expect(childNamed(group, 'relationship-route').getAttr('stroke')).toBe(
      THEME.keyPFK
    );
  });

  it('takes the hover colour from the editor hover map', async () => {
    const { app, group } = await mountRelationship(makeRelationship());
    const route = childNamed(group, 'relationship-route');

    app.store.dispatchSync(
      hoverRelationshipMapAction({ relationshipIds: ['r1'] })
    );
    await settle();
    expect(route.getAttr('stroke')).toBe(THEME.relationshipHover);

    app.store.dispatchSync(hoverRelationshipMapAction({ relationshipIds: [] }));
    await settle();
    expect(route.getAttr('stroke')).toBe(THEME.keyFK);
  });

  it('hovers every start and end column on mouseenter and clears them on mouseleave', async () => {
    const { app, group } = await mountRelationship(makeRelationship());
    const route = childNamed(group, 'relationship-route');

    group.fire('mouseenter');
    await settle();
    expect(Object.keys(app.store.state.editor.hoverColumnMap).sort()).toEqual([
      'c1',
      'c2',
      'c3',
    ]);
    // What the svg :hover selector used to paint, now a value in the render.
    expect(route.getAttr('stroke')).toBe(THEME.relationshipHover);

    group.fire('mouseleave');
    await settle();
    expect(app.store.state.editor.hoverColumnMap).toEqual({});
    expect(route.getAttr('stroke')).toBe(THEME.keyFK);
  });
});

/** The four zooms the band has to hold, either side of the unscaled scene. */
const ZOOM_LEVELS = [0.1, 0.5, 1, 1.5];

/** Half the band, less the antialiased rim konva's hit read never counts. */
const INSIDE_BAND = 3;

/** Clear of the band at every zoom, and of every other run of the connector. */
const OUTSIDE_BAND = 12;

const ZOOM_STAGE = { width: 900, height: 700 };

/** Inside the stage, off the connector at every zoom this file mounts. */
const AWAY = { x: 860, y: 660 };

type ZoomMounted = {
  app: AppContext;
  stage: Stage;
  hit: Container;
  group: Container;
};

/**
 * The middle of the route's longest straight run, and the unit normal to it. A
 * probe offset along that normal measures the band in screen pixels, which is
 * the width the layer scale would otherwise rewrite.
 */
function longestRun(relationship: RelationshipType_) {
  const segments = getRelationshipPath(relationship).path.path.d();
  let best = segments[0];
  let bestLength = -1;

  for (const segment of segments) {
    const [from, to] = segment;
    const length = Math.hypot(to.x - from.x, to.y - from.y);

    if (length > bestLength) {
      bestLength = length;
      best = segment;
    }
  }

  const [from, to] = best;

  return {
    mid: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
    normal: {
      x: -(to.y - from.y) / bestLength,
      y: (to.x - from.x) / bestLength,
    },
  };
}

/**
 * The connector in a layer scaled the way CanvasScene scales the scene one, with
 * settings carrying that same zoom. Written straight onto the state because the
 * zoom action clamps to the range the editor exposes today.
 */
async function mountAtZoom(
  relationship: RelationshipType_,
  zoomLevel: number
): Promise<ZoomMounted> {
  const container = document.createElement('div');
  document.body.append(container);
  const app = createTestAppContext();
  app.store.state.settings.zoomLevel = zoomLevel;

  const rendered = renderScene({
    app,
    container,
    scene: (
      <k-layer name="scene" scaleX={zoomLevel} scaleY={zoomLevel}>
        <Relationship
          relationship={relationship}
          strokeWidth={RELATIONSHIP_STROKE_WIDTH}
        />
      </k-layer>
    ),
    width: ZOOM_STAGE.width,
    height: ZOOM_STAGE.height,
    theme: THEME,
  });

  teardowns.push(() => {
    rendered.destroy();
    container.remove();
  });

  await flush();
  await whenDrawn();
  await whenPainted();

  return {
    app,
    stage: rendered.stage,
    hit: rendered.stage.findOne<Container>(
      '.relationship-hit-area'
    ) as Container,
    group: rendered.stage.findOne<Container>('.relationship') as Container,
  };
}

/**
 * Whether konva's own hit graph answers the connector at a point that many
 * screen pixels off the route. Every probe leaves the band first, so the enter
 * it reports is one konva dispatched for this point and not the one before it.
 */
async function hoversAt(
  { app, stage }: ZoomMounted,
  relationship: RelationshipType_,
  zoomLevel: number,
  offset: number
): Promise<boolean> {
  const { mid, normal } = longestRun(relationship);

  moveScenePointer(stage, AWAY.x, AWAY.y);
  await flush();
  await whenDrawn();
  await whenPainted();

  moveScenePointer(
    stage,
    mid.x * zoomLevel + normal.x * offset,
    mid.y * zoomLevel + normal.y * offset
  );
  await flush();
  await whenDrawn();

  return Object.keys(app.store.state.editor.hoverColumnMap).length > 0;
}

describe('the connector catches the pointer at one screen width', () => {
  it.each(ZOOM_LEVELS)('holds the band at zoom %s', async zoomLevel => {
    const relationship = makeRelationship();
    const { hit } = await mountAtZoom(relationship, zoomLevel);

    expect(hit.getAttr('hitStrokeWidth') * zoomLevel).toBeCloseTo(
      RELATIONSHIP_HIT_STROKE_WIDTH,
      6
    );
  });

  it.each(ZOOM_LEVELS)('hovers the route at zoom %s', async zoomLevel => {
    const relationship = makeRelationship();
    const mounted = await mountAtZoom(relationship, zoomLevel);

    expect(await hoversAt(mounted, relationship, zoomLevel, 0)).toBe(true);
  });

  it.each(ZOOM_LEVELS)(
    'hovers three screen pixels off the route at zoom %s',
    async zoomLevel => {
      const relationship = makeRelationship();
      const mounted = await mountAtZoom(relationship, zoomLevel);

      expect(
        await hoversAt(mounted, relationship, zoomLevel, INSIDE_BAND)
      ).toBe(true);
      expect(
        await hoversAt(mounted, relationship, zoomLevel, -INSIDE_BAND)
      ).toBe(true);
    }
  );

  it.each(ZOOM_LEVELS)(
    'stays off twelve screen pixels away at zoom %s',
    async zoomLevel => {
      const relationship = makeRelationship();
      const mounted = await mountAtZoom(relationship, zoomLevel);

      expect(
        await hoversAt(mounted, relationship, zoomLevel, OUTSIDE_BAND)
      ).toBe(false);
      expect(
        await hoversAt(mounted, relationship, zoomLevel, -OUTSIDE_BAND)
      ).toBe(false);
    }
  );
});

/** Enough of one drawn node to stand for it: both ends and the middle. */
function drawnPoints(node: KonvaNode): Point[] {
  if (node.getClassName() === 'Circle') {
    const radius = node.getAttr('radius');

    return Array.from({ length: 8 }, (_, index) => {
      const angle = (index / 8) * Math.PI * 2;
      return {
        x: node.x() + radius * Math.cos(angle),
        y: node.y() + radius * Math.sin(angle),
      };
    });
  }

  const flat: number[] =
    node.getClassName() === 'Line'
      ? node.getAttr('points')
      : numbersIn(node.getAttr('data'));
  const corners: Point[] = [];
  for (let index = 0; index < flat.length; index += 2) {
    corners.push({ x: flat[index], y: flat[index + 1] });
  }

  const points: Point[] = [];
  for (let index = 1; index < corners.length; index++) {
    const from = corners[index - 1];
    const to = corners[index];
    for (const t of [0, 0.5, 1]) {
      points.push({
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      });
    }
  }

  return points;
}

/**
 * Where the stage answers with something other than the connector's own band.
 * A layer scaled by the zoom is what the scene does, so a scene point is put
 * through that same scale before konva's hit graph is asked about it.
 */
function unreachable({ stage, group }: ZoomMounted, zoomLevel: number) {
  const missed: string[] = [];

  for (const node of group.getChildren()) {
    if (node.name() === 'relationship-hit-area') continue;

    for (const point of drawnPoints(node)) {
      const hit = stage.getIntersection({
        x: point.x * zoomLevel,
        y: point.y * zoomLevel,
      });

      if (hit?.name() !== 'relationship-hit-area') {
        missed.push(`${node.getClassName()} ${point.x},${point.y}`);
      }
    }
  }

  return missed;
}

/** The bits the schema comments out, which the shape map still answers. */
const ZERO_ONE_N = 1;
const ONE = 32;
const N = 64;

const SHAPE_TYPES = [
  ZERO_ONE_N,
  RelationshipType.ZeroOne,
  RelationshipType.ZeroN,
  RelationshipType.OneOnly,
  RelationshipType.OneN,
  ONE,
  N,
];

const START_TYPES = [StartRelationshipType.ring, StartRelationshipType.dash];

const SWEEP = SHAPE_TYPES.flatMap(relationshipType =>
  START_TYPES.flatMap(startRelationshipType =>
    ZOOM_LEVELS.map(zoomLevel => ({
      relationshipType,
      startRelationshipType,
      zoomLevel,
    }))
  )
);

describe('every drawn part of the connector takes the pointer', () => {
  it.each(SWEEP)(
    'type $relationshipType, start $startRelationshipType, zoom $zoomLevel',
    async ({ relationshipType, startRelationshipType, zoomLevel }) => {
      const relationship = makeRelationship({
        relationshipType,
        startRelationshipType,
      });
      const mounted = await mountAtZoom(relationship, zoomLevel);

      // Nothing but the band listens, so a marker outside it is a marker the
      // pointer cannot reach however plainly it is painted.
      expect(mounted.group.getChildren().length).toBeGreaterThan(4);
      expect(unreachable(mounted, zoomLevel)).toEqual([]);
    }
  );

  it('dispatches enter from a marker the band now covers', async () => {
    const relationship = makeRelationship({
      startRelationshipType: StartRelationshipType.ring,
    });
    const mounted = await mountAtZoom(relationship, 1);
    const ring = mounted.group
      .getChildren()
      .find(node => node.getClassName() === 'Circle')!;

    moveScenePointer(mounted.stage, AWAY.x, AWAY.y);
    await flush();
    await whenDrawn();
    await whenPainted();
    expect(mounted.app.store.state.editor.hoverColumnMap).toEqual({});

    moveScenePointer(
      mounted.stage,
      ring.x() + ring.getAttr('radius'),
      ring.y()
    );
    await flush();
    await whenDrawn();

    expect(
      Object.keys(mounted.app.store.state.editor.hoverColumnMap).sort()
    ).toEqual(['c1', 'c2', 'c3']);
  });
});
