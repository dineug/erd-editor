/** @jsxHost konva */

// P3-30 and P3-34: the draw preview as konva nodes. The mousemove stream stays
// on the DOM shell the shell owns (C-I3); what changed is the shapes it feeds.

import { createRef, type DOMTemplateLiterals, type Ref } from '@dineug/r-html';
import type { Container } from 'konva/lib/Container';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createTestAppContext, createTestTheme, flush } from '@/__test-utils__';
import { type AppContext } from '@/components/appContext';
import DrawRelationship from '@/components/erd/canvas/draw-relationship/DrawRelationship';
import { RELATIONSHIP_STROKE_WIDTH } from '@/constants/layout';
import { RelationshipType } from '@/constants/schema';
import {
  drawStartAddRelationshipAction,
  drawStartRelationshipAction,
} from '@/engine/modules/editor/atom.actions';
import { DrawRelationship as DrawRelationshipType } from '@/engine/modules/editor/state';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';
import { PointToPoint } from '@/utils/draw-relationship';
import { getDraw } from '@/utils/draw-relationship/draw';

const THEME = createTestTheme();

const createDraw = (
  value: Partial<DrawRelationshipType> = {}
): DrawRelationshipType => ({
  relationshipType: RelationshipType.ZeroOne,
  start: { tableId: 't1', x: 200, y: 100 },
  end: { x: 500, y: 400 },
  ...value,
});

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
  vi.restoreAllMocks();
});

const sceneOf = (
  root: Ref<HTMLDivElement>,
  draw: DrawRelationshipType
): DOMTemplateLiterals => (
  <k-layer name="scene">
    <DrawRelationship root={root} draw={draw} />
  </k-layer>
);

type Mounted = {
  app: AppContext;
  group: Container;
  $root: HTMLDivElement;
  destroy: () => void;
};

async function mountDraw(
  draw: DrawRelationshipType,
  rect: Partial<DOMRect> = {}
): Promise<Mounted> {
  const $root = document.createElement('div');
  document.body.append($root);
  vi.spyOn($root, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);

  const container = document.createElement('div');
  document.body.append(container);
  const app = createTestAppContext();
  const rendered = renderScene({
    app,
    container,
    scene: sceneOf(createRef<HTMLDivElement>($root), draw),
    width: 800,
    height: 600,
    theme: THEME,
  });

  let done = false;
  const destroy = () => {
    if (done) return;
    done = true;
    rendered.destroy();
    container.remove();
    $root.remove();
  };
  teardowns.push(destroy);

  await flush();
  await whenDrawn();

  return {
    app,
    $root,
    destroy,
    group: rendered.stage.findOne<Container>('.draw-relationship') as Container,
  };
}

const lineAt = (group: Container, index: number) =>
  group.getChildren().filter(node => node.getClassName() === 'Line')[index];

const points = (group: Container, index: number) =>
  lineAt(group, index).getAttr('points');

const toPoints = ({ x1, y1, x2, y2 }: PointToPoint) => [x1, y1, x2, y2];

const mousemove = (x: number, y: number) =>
  new MouseEvent('mousemove', { clientX: x, clientY: y, cancelable: true });

describe('DrawRelationship as konva nodes', () => {
  it('names the group and takes itself out of the hit graph', async () => {
    const { group } = await mountDraw(createDraw());

    expect(group.getClassName()).toBe('Group');
    expect(group.id()).toBe('draw-relationship');
    expect(group.name()).toBe('draw-relationship');
    expect(group.getAttr('kind')).toBe('draw-relationship');
    // What the stylesheet said with pointer-events: none.
    expect(group.listening()).toBe(false);
  });

  it('draws the preview path the draw helper produced', async () => {
    const draw = createDraw();
    const { app, group } = await mountDraw(draw);
    const expected = getDraw(app.store.state, draw);

    const preview = group.getChildren()[0];
    expect(preview.getClassName()).toBe('Path');
    expect(preview.name()).toBe('draw-relationship-preview');
    expect(preview.getAttr('data')).toBe(expected.path.path.d());
    expect(preview.getAttr('dash')).toEqual([10, 10]);
    expect(preview.getAttr('stroke')).toBe(THEME.keyFK);
    expect(preview.getAttr('strokeWidth')).toBe(RELATIONSHIP_STROKE_WIDTH);
    expect(preview.getAttr('fill')).toBeUndefined();
  });

  it('renders the start tick, base, base2 and center2 markers', async () => {
    const draw = createDraw();
    const { app, group } = await mountDraw(draw);
    const { path, line } = getDraw(app.store.state, draw);

    expect(group.getChildren().map(node => node.getClassName())).toEqual([
      'Path',
      'Line',
      'Line',
      'Line',
      'Line',
    ]);
    expect(points(group, 0)).toEqual(toPoints(path.line.start));
    expect(points(group, 1)).toEqual(toPoints(line.start.base));
    expect(points(group, 2)).toEqual(toPoints(line.start.base2));
    expect(points(group, 3)).toEqual(toPoints(line.start.center2));

    for (const node of group.getChildren()) {
      expect(node.getAttr('strokeWidth')).toBe(RELATIONSHIP_STROKE_WIDTH);
      expect(node.getAttr('stroke')).toBe(THEME.keyFK);
    }
  });

  it('falls back to a degenerate path when the draw has no start point', async () => {
    const { group } = await mountDraw(createDraw({ start: null }));

    expect(group.getChildren()[0].getAttr('data')).toBe('M 0 0 L 0 0');
    for (let index = 0; index < 4; index++) {
      expect(points(group, index)).toEqual([0, 0, 0, 0]);
    }
  });

  it('tracks mousemove on the root element into the draw end point', async () => {
    const { app, $root } = await mountDraw(createDraw(), { x: 40, y: 25 });
    const { store } = app;

    store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 200, y: 100, zIndex: 2 } })
    );
    store.dispatchSync(
      drawStartRelationshipAction({
        relationshipType: RelationshipType.ZeroOne,
      })
    );
    store.dispatchSync(drawStartAddRelationshipAction({ tableId: 't1' }));
    await flush();

    $root.dispatchEvent(mousemove(300, 225));
    await flush();

    expect(store.state.editor.drawRelationship?.end).toEqual({
      x: 260,
      y: 200,
    });
  });

  it('prevents the default mousemove behaviour so text is not selected', async () => {
    const { $root } = await mountDraw(createDraw());
    const event = mousemove(10, 10);

    $root.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('stops tracking mousemove once the scene is destroyed', async () => {
    const { app, $root, destroy } = await mountDraw(createDraw(), {
      x: 0,
      y: 0,
    });
    const { store } = app;

    store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 200, y: 100, zIndex: 2 } })
    );
    store.dispatchSync(
      drawStartRelationshipAction({
        relationshipType: RelationshipType.ZeroOne,
      })
    );
    store.dispatchSync(drawStartAddRelationshipAction({ tableId: 't1' }));
    await flush();

    destroy();
    await whenDrawn();

    const event = mousemove(999, 999);
    $root.dispatchEvent(event);
    await flush();

    expect(event.defaultPrevented).toBe(false);
    expect(store.state.editor.drawRelationship?.end).toEqual({ x: 0, y: 0 });
  });
});
