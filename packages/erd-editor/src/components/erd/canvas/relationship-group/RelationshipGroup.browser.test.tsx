/** @jsxHost konva */

// P3-28 and P3-34: the connectors' new home. The group owns the repeat CanvasSvg
// used to, and owns culling too, because only the sort knows where a route
// reaches and a parent that filtered would have to route every connector again.

import { type DOMTemplateLiterals } from '@dineug/r-html';
import type { Container } from 'konva/lib/Container';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, createTestTheme, flush } from '@/__test-utils__';
import RelationshipGroup from '@/components/erd/canvas/relationship-group/RelationshipGroup';
import { RELATIONSHIP_STROKE_WIDTH } from '@/constants/layout';
import { Direction, RelationshipType } from '@/constants/schema';
import { Relationship as RelationshipType_ } from '@/internal-types';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';
import { type CullingRect } from '@/konva/scene/viewport';
import { createRelationship } from '@/utils/collection/relationship.entity';

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
  const container = document.createElement('div');
  document.body.append(container);
  const rendered = renderScene({
    app: createTestAppContext(),
    container,
    scene: sceneOf(options),
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

  return rendered.stage.findOne<Container>('.relationship-group') as Container;
}

const names = (group: Container) =>
  group.getChildren().map(node => node.name());

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
