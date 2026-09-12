/** @jsxHost konva */

// P3-28 and P3-34: the connectors' new home. The group owns the repeat CanvasSvg
// used to, and owns culling too, because only the sort knows where a route
// reaches and a parent that filtered would have to route every connector again.

import { type DOMTemplateLiterals, useProvider } from '@dineug/r-html';
import type { Container } from 'konva/lib/Container';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, createTestTheme, flush } from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import RelationshipGroup from '@/components/erd/canvas/relationship-group/RelationshipGroup';
import { sceneSourceContext } from '@/components/sceneSourceContext';
import { RELATIONSHIP_STROKE_WIDTH } from '@/constants/layout';
import { Direction, RelationshipType } from '@/constants/schema';
import { ViewKind } from '@/engine/modules/editor/state';
import {
  viewOpenAction,
  viewSetLayoutAction,
} from '@/engine/modules/editor/view.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { Relationship as RelationshipType_ } from '@/internal-types';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';
import { type CullingRect } from '@/konva/scene/viewport';
import { createRelationship } from '@/utils/collection/relationship.entity';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import { relationshipSort } from '@/utils/draw-relationship/sort';

const THEME = createTestTheme();

/** A screen at the origin, which the far relationship below sits well outside. */
const VIEWPORT: CullingRect = { x: 0, y: 0, width: 100, height: 100 };

const makeRelationship = (
  id: string,
  x: number,
  y: number
): RelationshipType_ =>
  createRelationship({
    id,
    relationshipType: RelationshipType.ZeroOne,
    start: {
      tableId: `${id}-start`,
      columnIds: [`${id}-sc`],
      x,
      y,
      direction: Direction.right,
    },
    end: {
      tableId: `${id}-end`,
      columnIds: [`${id}-ec`],
      x: x + 300,
      y: y + 60,
      direction: Direction.left,
    },
  });

const near = () => makeRelationship('near', 100, 200);
const far = () => makeRelationship('far', 5000, 5000);

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

type MountOptions = {
  relationships: RelationshipType_[];
  viewport?: CullingRect;
  strokeWidth?: number;
  app?: AppContext;
  /** Hung on a shell over the Stage, the way a view root provides its source. */
  source?: GeometrySource;
};

const sceneOf = ({
  relationships,
  viewport,
  strokeWidth,
}: MountOptions): DOMTemplateLiterals => (
  <k-layer name="scene">
    <RelationshipGroup
      relationships={relationships}
      viewport={viewport}
      strokeWidth={strokeWidth}
    />
  </k-layer>
);

async function mountGroup(options: MountOptions): Promise<Container> {
  const shell = document.createElement('div');
  const container = document.createElement('div');
  shell.append(container);
  document.body.append(shell);
  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  const provider = options.source
    ? // oxlint-disable-next-line react-hooks/rules-of-hooks
      useProvider(shell as any, sceneSourceContext, options.source)
    : null;
  const rendered = renderScene({
    app: options.app ?? createTestAppContext(),
    container,
    scene: sceneOf(options),
    width: 800,
    height: 600,
    theme: THEME,
  });

  teardowns.push(() => {
    rendered.destroy();
    provider?.destroy();
    shell.remove();
  });

  await flush();
  await whenDrawn();

  return rendered.stage.findOne<Container>('.relationship-group') as Container;
}

const names = (group: Container) =>
  group.getChildren().map(node => node.name());

const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * One store with two tables at the document's corner joined by a connector,
 * and a view standing both far away, each source sorted so the route the
 * culling reads is settled for both.
 */
async function createViewApp(): Promise<{
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
    viewOpenAction({ kind: ViewKind.flow, centerIds: ['t1'] }),
    viewSetLayoutAction({
      kind: ViewKind.flow,
      positions: { t1: { x: 5_000, y: -3_000 }, t2: { x: 5_600, y: -3_000 } },
    })
  );
  // The hooks sort both sources a few ms after the dispatch; waiting them out
  // means the sorts below are the last word rather than one overwritten later.
  await tick(50);
  relationshipSort(store.state);
  relationshipSort(store.state, 'flow');

  return { app, relationship: store.state.collections.relationshipEntities.r1 };
}

const routeOf = (group: Container, name: string) =>
  (group.getChildren().find(node => node.hasName(name)) as Container)
    .getChildren()
    .find(node => node.name() === 'relationship-route')!;

describe('RelationshipGroup', () => {
  it('names the group for a lookup and an ancestor walk', async () => {
    const group = await mountGroup({ relationships: [] });

    expect(group.getClassName()).toBe('Group');
    expect(group.name()).toBe('relationship-group');
    expect(group.getAttr('kind')).toBe('relationship-group');
    expect(group.getChildren()).toHaveLength(0);
  });

  it('renders one connector per relationship, in the order it was given', async () => {
    const group = await mountGroup({
      relationships: [near(), far()],
    });

    expect(names(group)).toEqual(['relationship near', 'relationship far']);
  });

  it('draws every relationship when it is given no viewport', async () => {
    const group = await mountGroup({
      relationships: [near(), far()],
      strokeWidth: 12,
    });

    expect(names(group)).toEqual(['relationship near', 'relationship far']);
  });

  it('drops a relationship whose whole reach is outside the viewport', async () => {
    const group = await mountGroup({
      relationships: [near(), far()],
      viewport: VIEWPORT,
    });

    expect(names(group)).toEqual(['relationship near']);
  });

  it('keeps a relationship the viewport only straddles', async () => {
    const group = await mountGroup({
      relationships: [near(), far()],
      viewport: { x: 450, y: 350, width: 100, height: 100 },
    });

    expect(names(group)).toEqual(['relationship near']);
  });

  /** Under a view provider the reach is the one that view's sort wrote, so the screen culls by the view's placement. */
  it('culls by the reach the view sort wrote under a view provider, and by the document reach without one', async () => {
    const { app, relationship } = await createViewApp();
    const aroundView: CullingRect = {
      x: 4_500,
      y: -3_500,
      width: 2_000,
      height: 1_000,
    };
    const aroundDocument: CullingRect = {
      x: -500,
      y: -500,
      width: 2_000,
      height: 1_000,
    };
    const relationships = [relationship];

    const viewOverView = await mountGroup({
      app,
      source: 'flow',
      relationships,
      viewport: aroundView,
    });
    const viewOverDocument = await mountGroup({
      app,
      source: 'flow',
      relationships,
      viewport: aroundDocument,
    });
    const documentOverView = await mountGroup({
      app,
      relationships,
      viewport: aroundView,
    });
    const documentOverDocument = await mountGroup({
      app,
      relationships,
      viewport: aroundDocument,
    });

    expect(names(viewOverView)).toEqual(['relationship r1']);
    expect(names(viewOverDocument)).toEqual([]);
    expect(names(documentOverView)).toEqual([]);
    expect(names(documentOverDocument)).toEqual(['relationship r1']);
  });

  it('defaults the relationship stroke width to the layout constant', async () => {
    const group = await mountGroup({ relationships: [near()] });

    expect(routeOf(group, 'near').getAttr('strokeWidth')).toBe(
      RELATIONSHIP_STROKE_WIDTH
    );
  });

  it('forwards the strokeWidth prop to every relationship', async () => {
    const group = await mountGroup({
      relationships: [near(), far()],
      strokeWidth: 12,
    });

    expect(routeOf(group, 'near').getAttr('strokeWidth')).toBe(12);
    expect(routeOf(group, 'far').getAttr('strokeWidth')).toBe(12);
  });

  it('forwards the resolved colours to every relationship', async () => {
    const group = await mountGroup({ relationships: [near()] });

    expect(routeOf(group, 'near').getAttr('stroke')).toBe(THEME.keyFK);
  });
});
