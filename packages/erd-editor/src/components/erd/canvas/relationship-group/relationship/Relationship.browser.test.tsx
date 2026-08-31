/** @jsxHost konva */

// P3-30 and P3-34: one connector as konva nodes — the node types and their
// order, the hit band the svg path used to be, and the paint that used to come
// from a stylesheet selector.

import { type DOMTemplateLiterals } from '@dineug/r-html';
import type { Container } from 'konva/lib/Container';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, createTestTheme, flush } from '@/__test-utils__';
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
import { Relationship as RelationshipType_ } from '@/internal-types';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';
import { createRelationship } from '@/utils/collection/relationship.entity';
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

  it('runs the pointer band from one cardinality decoration to the other', async () => {
    const relationship = makeRelationship();
    const { path } = getRelationshipPath(relationship);
    const { group } = await mountRelationship(relationship);

    const numbers = numbersIn(
      childNamed(group, 'relationship-hit-area').getAttr('data')
    );

    // The route alone spans the two turning points. The guide lines either side
    // of it carry the connector the rest of the way to its decorations, and
    // they are as thin as the route.
    expect(numbers.slice(0, 2)).toEqual([
      path.line.start.x1,
      path.line.start.y1,
    ]);
    expect(numbers.slice(-2)).toEqual([path.line.end.x1, path.line.end.y1]);
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
