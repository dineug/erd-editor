// P3-31: the minimap as a second Stage. The thumbnail is its own scene now
// instead of a full size copy under a css scale, and it is a map of the content
// and the screen wherever a pan has taken it, not of a fixed box.

import { useProvider } from '@dineug/r-html';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestTheme,
  flush,
  mount,
  type Mounted,
} from '@/__test-utils__';
import { AppContext } from '@/components/appContext';
import * as canvasStyles from '@/components/erd/canvas/Canvas.styles';
import Minimap from '@/components/erd/minimap/Minimap';
import * as styles from '@/components/erd/minimap/Minimap.styles';
import {
  fromMinimapPoint,
  getMinimapHandleRect,
  getMinimapLayout,
  getMinimapMarkRect,
  getMinimapViewportRect,
  getScrollToCenter,
  getViewTransform,
  getVisibleCanvasRect,
  MINIMAP_BOX_MIN_SIDE,
  MINIMAP_MAP_STEP,
  MINIMAP_MARK_MIN,
  type MinimapLayout,
  toMinimapPoint,
  toScrollMovement,
} from '@/components/erd/minimap/minimapGeometry';
import { themeContext } from '@/components/themeContext';
import { MINIMAP_MARGIN, MINIMAP_SIZE, TABLE_BORDER } from '@/constants/layout';
import { RelationshipType, Show } from '@/constants/schema';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  changeShowAction,
  changeZoomLevelAction,
  getScrollRanges,
  streamScrollToAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  moveToTableAction,
} from '@/engine/modules/table/atom.actions';
import { whenDrawn } from '@/konva/batchDraw';
import { getContentRect } from '@/konva/scene/contentBounds';
import { getTableRect, type Rect } from '@/konva/scene/metrics';
import { freezeView, thawView } from '@/konva/scene/viewFreeze';
import { toScreenPoint } from '@/konva/scene/viewport';

const teardowns: Array<() => void> = [];

afterEach(async () => {
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  window.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
  vi.restoreAllMocks();
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

const stageRegistry = (): Record<string, Stage> =>
  Reflect.get(globalThis, '__erdStages') ?? {};

async function mountMinimap(app = createTestAppContext()): Promise<Mounted> {
  const mounted = mount(<Minimap />, app);
  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(
    mounted.container as any,
    themeContext,
    createTestTheme()
  );

  await flush();
  await whenDrawn();

  teardowns.push(() => {
    mounted.unmount();
    themeProvider.destroy();
  });

  return mounted;
}

const minimapOf = (mounted: Mounted) =>
  mounted.container.querySelector<HTMLElement>('.minimap')!;

const borderOf = (mounted: Mounted) =>
  mounted.container.querySelector<HTMLElement>(`.${String(styles.border)}`)!;

const sceneOf = (mounted: Mounted) =>
  mounted.container.querySelector<HTMLElement>(
    `.minimap > .${String(canvasStyles.root)}`
  )!;

const viewportOf = (mounted: Mounted) =>
  mounted.container.querySelector<HTMLElement>('.minimap-viewport')!;

const layoutOf = (app: AppContext) => getMinimapLayout(app.store.state);

/** The handle as drawn, in the thumbnail box's own pixels, read back off its style. */
const handleOf = (mounted: Mounted, { box, offset }: MinimapLayout) => {
  const el = viewportOf(mounted);
  const width = parseFloat(el.style.width);
  const height = parseFloat(el.style.height);

  return {
    x:
      MINIMAP_MARGIN +
      offset.x +
      box.width -
      parseFloat(el.style.right) -
      width,
    y: parseFloat(el.style.top) - MINIMAP_MARGIN - offset.y,
    width,
    height,
  };
};

const expectStageSized = ({ box }: MinimapLayout) => {
  expect(stageRegistry().minimap.width()).toBeCloseTo(box.width, 6);
  expect(stageRegistry().minimap.height()).toBeCloseTo(box.height, 6);
};

const stubRect = (x: number, y: number) =>
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x,
    y,
    left: x,
    top: y,
    right: x,
    bottom: y,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  } as DOMRect);

const touchAt = (clientX: number, clientY: number) =>
  new Touch({ identifier: 1, target: document.body, clientX, clientY });

/** Two tables far apart sideways, so the map is much wider than it is tall. */
const seedWide = (app: AppContext) => {
  app.store.dispatchSync(
    addTableAction({ id: 'near', ui: { x: 0, y: 0, zIndex: 1 } })
  );
  app.store.dispatchSync(
    addTableAction({ id: 'far', ui: { x: 5000, y: 0, zIndex: 2 } })
  );
};

/**
 * What a press at a thumbnail pixel asks for: the scene point under it and the
 * origin that centres the screen on that point, both read off the map as it
 * stood before the press; a press inside the travel then holds that same map.
 */
const pressExpectation = (app: AppContext, pixel: { x: number; y: number }) => {
  const layout = layoutOf(app);
  const scene = fromMinimapPoint(layout, pixel);
  const origin = getScrollToCenter(getViewTransform(app.store.state), scene);

  return { layout, scene, origin };
};

/** A whole pixel inside the box: a pointer event carries no fraction of one. */
const pixelIn = ({ box }: MinimapLayout, fx: number, fy: number) => ({
  x: Math.round(box.width * fx),
  y: Math.round(box.height * fy),
});

const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

const expectCentred = (app: AppContext, scene: { x: number; y: number }) => {
  const { settings, editor } = app.store.state;
  const landed = toScreenPoint(settings, scene);

  expect(landed.x).toBeCloseTo(editor.viewport.width / 2, 3);
  expect(landed.y).toBeCloseTo(editor.viewport.height / 2, 3);
};

describe('the minimap shell', () => {
  it('lays the thumbnail out at the size the map draws, centred in the square', async () => {
    const app = createTestAppContext();
    const mounted = await mountMinimap(app);
    const el = minimapOf(mounted);
    const { box, offset } = layoutOf(app);

    expect(el.classList.contains(String(styles.minimap))).toBe(true);
    // An empty document maps the screen alone, with the margin around it; the
    // longer side of that fills the square and the shorter one is centred.
    expect(Math.max(box.width, box.height)).toBeCloseTo(MINIMAP_SIZE, 6);
    expect(parseFloat(el.style.width)).toBeCloseTo(box.width, 3);
    expect(parseFloat(el.style.height)).toBeCloseTo(box.height, 3);
    expect(parseFloat(el.style.right)).toBeCloseTo(
      MINIMAP_MARGIN + offset.x,
      3
    );
    expect(parseFloat(el.style.top)).toBeCloseTo(MINIMAP_MARGIN + offset.y, 3);
    expect(el.style.transform).toBe('');
  });

  it('draws a fixed size border frame inset by one pixel', async () => {
    const mounted = await mountMinimap();
    const el = borderOf(mounted);

    expect(el.style.width).toBe('150px');
    expect(el.style.height).toBe('150px');
    expect(el.style.right).toBe('19px');
    expect(el.style.top).toBe('19px');
  });

  /**
   * The thumbnail keeps the content's shape and is centred in the square, so
   * the square has to be painted behind it: an unpainted frame let the scene
   * under the minimap show through the letterbox on either side of the map.
   */
  it('paints the square behind the thumbnail so the scene cannot show through', async () => {
    const app = createTestAppContext();
    seedWide(app);
    const mounted = await mountMinimap(app);
    const frame = borderOf(mounted);
    const thumbnail = minimapOf(mounted);
    const { box } = layoutOf(app);

    // A wide document leaves a letterbox above and below the thumbnail. The
    // colour the frame paints is pinned by Minimap.styles.test.ts; this bare
    // mount carries no stylesheet, so what it can see is the paint order.
    expect(box.height).toBeLessThan(MINIMAP_SIZE);
    expect(
      frame.compareDocumentPosition(thumbnail) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('hangs one Stage of one layer in the scene box', async () => {
    const app = createTestAppContext();
    const mounted = await mountMinimap(app);
    const stage = stageRegistry().minimap;

    expect(stage.container()).toBe(sceneOf(mounted));
    expectStageSized(layoutOf(app));
    expect(stage.getLayers().map(layer => layer.name())).toEqual([
      'minimap-scene',
    ]);
  });

  it('places the layer by the map alone, through every zoom', async () => {
    const app = createTestAppContext();
    seedWide(app);
    await mountMinimap(app);
    const layer = stageRegistry().minimap.findOne('.minimap-scene')!;
    const ratios: number[] = [];

    for (const value of [1, 0.5, 0.2, 0.1]) {
      app.store.dispatchSync(changeZoomLevelAction({ value }));
      await flush();

      // The ratio is the one scale and scene zero lands at the map's corner;
      // the centring in the square is the container's, never the layer's.
      const layout = layoutOf(app);
      const place = toMinimapPoint(layout, { x: 0, y: 0 });
      expect(layer.scaleX()).toBeCloseTo(layout.ratio, 9);
      expect(layer.scaleY()).toBeCloseTo(layout.ratio, 9);
      expect(layer.x()).toBeCloseTo(place.x, 9);
      expect(layer.y()).toBeCloseTo(place.y, 9);
      ratios.push(layout.ratio);
    }

    // Zooming out widens the screen, and the map grows to keep holding it, so
    // the thumbnail folds more scene into each pixel rather than none.
    for (let index = 1; index < ratios.length; index++) {
      expect(ratios[index]).toBeLessThanOrEqual(ratios[index - 1]);
    }
    expect(ratios[ratios.length - 1]).toBeLessThan(ratios[0]);
  });

  it('follows a table moved far away on both the box and the Stage', async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(
      addTableAction({ id: 'near', ui: { x: 0, y: 0, zIndex: 1 } })
    );
    const mounted = await mountMinimap(app);
    const before = layoutOf(app);
    expectStageSized(before);

    app.store.dispatchSync(moveToTableAction({ id: 'near', x: 8000, y: 0 }));
    await flush();
    await whenDrawn();

    const after = layoutOf(app);
    expect(after.box).not.toEqual(before.box);
    expectStageSized(after);
    expect(parseFloat(minimapOf(mounted).style.width)).toBeCloseTo(
      after.box.width,
      3
    );
    expect(parseFloat(minimapOf(mounted).style.height)).toBeCloseTo(
      after.box.height,
      3
    );

    // The moved table is drawn where the map now puts it, inside the box. At
    // this fold its height is under a mark, so the box drawn is the mark's,
    // grown about the table's own middle, and its left edge is still the table's.
    const box = stageRegistry().minimap.findOne('.minimap-table')!;
    const drawnAt = box.getAbsolutePosition();
    const rect = getMinimapMarkRect(
      after.ratio,
      getTableRect(
        app.store.state,
        app.store.state.collections.tableEntities.near
      )
    );
    const mappedAt = toMinimapPoint(after, {
      x: rect.x + TABLE_BORDER / 2,
      y: rect.y + TABLE_BORDER / 2,
    });
    expect(rect.x).toBe(8000);
    expect(rect.y).toBeLessThan(0);
    expect(drawnAt.x).toBeCloseTo(mappedAt.x, 6);
    expect(drawnAt.y).toBeCloseTo(mappedAt.y, 6);
    expect(drawnAt.x).toBeLessThan(after.box.width);
  });

  it('renders one box per table and per memo in the document', async () => {
    const app = createTestAppContext();
    await mountMinimap(app);
    const stage = stageRegistry().minimap;

    expect(stage.find('.minimap-table')).toHaveLength(0);
    expect(stage.find('.minimap-memo')).toHaveLength(0);

    app.store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 10, y: 20, zIndex: 1 } })
    );
    app.store.dispatchSync(
      addTableAction({ id: 't2', ui: { x: 30, y: 40, zIndex: 2 } })
    );
    app.store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 50, y: 60, zIndex: 3 } })
    );
    await flush();

    const tables = stage.find('.minimap-table');
    const memos = stage.find('.minimap-memo');
    expect(tables.map(node => node.getAttr('tableId'))).toEqual(['t1', 't2']);
    expect(memos).toHaveLength(1);
    expect(memos[0].hasName('m1')).toBe(true);
  });

  it('keeps the box for a table the canvas culls (AC-S4, AC-S5)', async () => {
    const app = createTestAppContext();
    await mountMinimap(app);
    const stage = stageRegistry().minimap;

    app.store.dispatchSync(
      addTableAction({ id: 'near', ui: { x: 100, y: 100, zIndex: 1 } })
    );
    // Past the culling rect on every side: CanvasScene drops this one.
    app.store.dispatchSync(
      addTableAction({ id: 'far', ui: { x: 5000, y: 5000, zIndex: 2 } })
    );
    app.store.dispatchSync(
      addMemoAction({ id: 'farMemo', ui: { x: 6000, y: 6000, zIndex: 3 } })
    );
    await flush();

    expect(
      stage.find('.minimap-table').map(node => node.getAttr('tableId'))
    ).toEqual(['near', 'far']);
    expect(stage.find('.minimap-memo')).toHaveLength(1);
  });

  it('carries no id, so an id scan over the live stages stays unambiguous', async () => {
    const app = createTestAppContext();
    await mountMinimap(app);

    app.store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 10, y: 20, zIndex: 1 } })
    );
    app.store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 50, y: 60, zIndex: 3 } })
    );
    await flush();

    const stage = stageRegistry().minimap;
    const written = [stage, ...stage.find('Node')].filter(node =>
      Object.hasOwn(node.attrs, 'id')
    );

    expect(written).toEqual([]);
  });

  it('draws no connectors at all, whatever the canvas is showing', async () => {
    const app = createTestAppContext();
    await mountMinimap(app);
    const stage = stageRegistry().minimap;

    app.store.dispatchSync(
      addTableAction({ id: 'table-a', ui: { x: 10, y: 20, zIndex: 1 } })
    );
    app.store.dispatchSync(
      addTableAction({ id: 'table-b', ui: { x: 600, y: 400, zIndex: 2 } })
    );
    app.store.dispatchSync(
      addRelationshipAction({
        id: 'r1',
        relationshipType: RelationshipType.ZeroOne,
        start: { tableId: 'table-a', columnIds: ['c1'] },
        end: { tableId: 'table-b', columnIds: ['c2'] },
      })
    );
    app.store.dispatchSync(
      changeShowAction({ show: Show.relationship, value: true })
    );
    await flush();

    // A connector between two boxes this small is noise, so the minimap draws
    // the boxes and nothing between them. The canvas still draws its own.
    expect(app.store.state.doc.relationshipIds).toHaveLength(1);
    expect(stage.find('.minimap-table')).toHaveLength(2);
    expect(stage.find('.relationship-group')).toHaveLength(0);
    expect(stage.find('.relationship-route')).toHaveLength(0);
  });

  it('centres the screen on the scene point pressed, on a map wider than tall', async () => {
    const app = createTestAppContext();
    seedWide(app);
    const mounted = await mountMinimap(app);
    stubRect(10, 20);
    const { layout } = pressExpectation(app, { x: 0, y: 0 });
    expect(layout.box.width).toBeGreaterThan(layout.box.height * 2);

    const pixel = pixelIn(layout, 0.6, 0.5);
    const { scene, origin } = pressExpectation(app, pixel);

    minimapOf(mounted).dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        clientX: 10 + pixel.x,
        clientY: 20 + pixel.y,
      })
    );
    await flush();

    expect(app.store.state.settings.originX).toBeCloseTo(origin.x, 3);
    expect(app.store.state.settings.originY).toBeCloseTo(origin.y, 3);
    expectCentred(app, scene);

    // The press holds the map it landed on, and the screen it centred lies
    // inside it, so the handle is drawn whole with its middle on the pixel.
    expect(layoutOf(app)).toEqual(layout);
    const view = getViewTransform(app.store.state);
    expect(getMinimapHandleRect(layout, view)).toEqual(
      getMinimapViewportRect(layout, view)
    );
    const handle = handleOf(mounted, layout);
    expect(handle.x + handle.width / 2).toBeCloseTo(pixel.x, 3);
    expect(handle.y + handle.height / 2).toBeCloseTo(pixel.y, 3);
  });

  it('centres the screen on the scene point under the first touch', async () => {
    const app = createTestAppContext();
    seedWide(app);
    const mounted = await mountMinimap(app);
    stubRect(10, 20);
    const { layout } = pressExpectation(app, { x: 0, y: 0 });
    const pixel = pixelIn(layout, 0.35, 0.6);
    const { scene, origin } = pressExpectation(app, pixel);

    minimapOf(mounted).dispatchEvent(
      new TouchEvent('touchstart', {
        bubbles: true,
        touches: [touchAt(10 + pixel.x, 20 + pixel.y)],
      })
    );
    await flush();

    expect(app.store.state.settings.originX).toBeCloseTo(origin.x, 3);
    expect(app.store.state.settings.originY).toBeCloseTo(origin.y, 3);
    expectCentred(app, scene);
    expect(viewportOf(mounted).classList.contains('selected')).toBe(true);

    const handle = handleOf(mounted, layout);
    expect(handle.x + handle.width / 2).toBeCloseTo(pixel.x, 3);
    expect(handle.y + handle.height / 2).toBeCloseTo(pixel.y, 3);
  });

  it('centres the press on the same scene point while zoomed out', async () => {
    const app = createTestAppContext();
    seedWide(app);
    const mounted = await mountMinimap(app);
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    await flush();
    stubRect(0, 0);
    const { layout } = pressExpectation(app, { x: 0, y: 0 });
    const pixel = pixelIn(layout, 0.5, 0.5);
    const { scene, origin } = pressExpectation(app, pixel);

    minimapOf(mounted).dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        clientX: pixel.x,
        clientY: pixel.y,
      })
    );
    await flush();

    // The pixel names a scene point whatever the zoom is, and the origin that
    // centres it is half a screen back from where the zoom draws it.
    expect(app.store.state.settings.originX).toBeCloseTo(origin.x, 3);
    expect(app.store.state.settings.originY).toBeCloseTo(origin.y, 3);
    expectCentred(app, scene);

    const handle = handleOf(mounted, layout);
    expect(handle.x + handle.width / 2).toBeCloseTo(pixel.x, 3);
    expect(handle.y + handle.height / 2).toBeCloseTo(pixel.y, 3);
  });

  /**
   * A press at the map's edge asks to centre the screen half a screen past
   * where the travel ends, and gets it: a pan goes anywhere. The press lands
   * before the drag holds the view, so the map held is one grown around that screen.
   */
  it('centres the pressed point on an edge press and holds the map through the drag that follows', async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(
      addTableAction({ id: 'a', ui: { x: 0, y: 0, zIndex: 1 } })
    );
    app.store.dispatchSync(
      addTableAction({ id: 'b', ui: { x: 400, y: 300, zIndex: 2 } })
    );
    const mounted = await mountMinimap(app);
    stubRect(0, 0);
    const before = layoutOf(app);
    const { left, top } = getScrollRanges(app.store.state);
    const pixel = {
      x: Math.round(before.box.width) - 1,
      y: Math.round(before.box.height / 2),
    };
    const { scene, origin: asked } = pressExpectation(app, pixel);

    minimapOf(mounted).dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        clientX: pixel.x,
        clientY: pixel.y,
      })
    );
    await flush();

    // Sideways the request lies past the far end of the travel, upright
    // inside it, and both land exactly where they asked.
    const { settings } = app.store.state;
    expect(asked.x).toBeLessThan(left.min);
    expect(asked.y).toBeGreaterThan(top.min);
    expect(asked.y).toBeLessThan(top.max);
    expect(settings.originX).toBeCloseTo(asked.x, 3);
    expect(settings.originY).toBeCloseTo(asked.y, 3);
    expectCentred(app, scene);

    // The screen now lies half outside the map the press read, so the map the
    // drag holds is a wider one, laid out around that screen with the handle
    // whole on it and the Stage sized to it.
    const held = layoutOf(app);
    const view = getViewTransform(app.store.state);
    const visible = getVisibleCanvasRect(view);
    expect(contains(before.map, visible)).toBe(false);
    expect(held).not.toEqual(before);
    expect(contains(held.map, visible)).toBe(true);
    const rect = getMinimapHandleRect(held, view);
    expect(rect).toEqual(getMinimapViewportRect(held, view));
    expect(contains({ x: 0, y: 0, ...held.box }, rect)).toBe(true);
    expect(handleOf(mounted, held).x).toBeCloseTo(rect.x, 3);
    expect(handleOf(mounted, held).width).toBeCloseTo(rect.width, 3);
    expectStageSized(held);

    // A step further out is refused, since the origin stands on the end of the
    // held travel; a step back in is taken; neither lays the map out again.
    const OUT = 10;
    const IN = -20;
    window.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: pixel.x + OUT,
        clientY: pixel.y,
      })
    );
    await flush();
    expect(app.store.state.settings.originX).toBeCloseTo(asked.x, 3);
    expect(layoutOf(app)).toEqual(held);

    window.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: pixel.x + OUT + IN,
        clientY: pixel.y,
      })
    );
    await flush();
    expect(app.store.state.settings.originX).toBeCloseTo(
      asked.x + toScrollMovement(IN, held.ratio, 1),
      3
    );
    expect(layoutOf(app)).toEqual(held);
    expectStageSized(held);
    const during = getMinimapHandleRect(
      held,
      getViewTransform(app.store.state)
    );
    expect(contains({ x: 0, y: 0, ...held.box }, during)).toBe(true);
    expect(handleOf(mounted, held).x).toBeCloseTo(during.x, 3);

    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await flush();
    await whenDrawn();

    // The release lets the map lay out again around wherever the drag left
    // the screen, and the Stage follows whatever that is.
    expectStageSized(layoutOf(app));
  });

  /**
   * The map holds every screen the travel reaches and a handle drag is cut to
   * that travel, so however far the pointer goes the handle stays whole on the
   * map rather than pinning to its edge, and the release finds nothing to lay out.
   */
  it('keeps the handle whole on the map through a drag to the end of the travel, and the map through the release', async () => {
    const app = createTestAppContext();
    seedWide(app);
    const mounted = await mountMinimap(app);
    stubRect(0, 0);
    const before = layoutOf(app);
    const { left } = getScrollRanges(app.store.state);
    expect(app.store.state.settings.originX).toBeGreaterThan(left.min);

    // Pressed on the handle itself, so no jump lands first and the drag
    // starts from the origin as it stands.
    const start = handleOf(mounted, before);
    const from = {
      x: Math.round(start.x + start.width / 2),
      y: Math.round(start.y + start.height / 2),
    };
    viewportOf(mounted).dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        clientX: from.x,
        clientY: from.y,
      })
    );
    await flush();

    // Twice the width of the whole square: the travel ends long before the
    // pointer stops, and every step past its end is refused.
    const STEP = 10;
    for (let step = 1; step <= (MINIMAP_SIZE * 2) / STEP; step++) {
      window.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          cancelable: true,
          clientX: from.x + step * STEP,
          clientY: from.y,
        })
      );
      await flush();
    }

    expect(app.store.state.settings.originX).toBe(left.min);
    expect(layoutOf(app)).toEqual(before);
    const view = getViewTransform(app.store.state);
    const rect = getMinimapHandleRect(before, view);
    expect(rect).toEqual(getMinimapViewportRect(before, view));
    expect(contains({ x: 0, y: 0, ...before.box }, rect)).toBe(true);
    const during = handleOf(mounted, before);
    expect(during.x).toBeCloseTo(rect.x, 3);
    expect(during.width).toBeCloseTo(rect.width, 3);
    expect(during.width).toBeCloseTo(start.width, 3);
    expect(during.x).toBeGreaterThan(start.x);

    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await flush();
    await whenDrawn();

    expect(layoutOf(app)).toEqual(before);
    expectStageSized(before);
    const after = handleOf(mounted, before);
    expect(after.x).toBeCloseTo(during.x, 3);
    expect(after.width).toBeCloseTo(during.width, 3);
  });

  /**
   * Two tables fifty thousand units apart fold the map by a factor that draws
   * a table under a pixel: the boxes and the handle are floored at a mark, and
   * the thumbnail is no thinner than its floor, so the map still shows them.
   */
  it('draws tables fifty thousand units apart as marks on a thumbnail no thinner than its floor', async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(
      addTableAction({ id: 'near', ui: { x: 0, y: 0, zIndex: 1 } })
    );
    app.store.dispatchSync(
      addTableAction({ id: 'far', ui: { x: 50_000, y: 0, zIndex: 2 } })
    );
    const mounted = await mountMinimap(app);
    const layout = layoutOf(app);
    const stage = stageRegistry().minimap;
    const drawn = getTableRect(
      app.store.state,
      app.store.state.collections.tableEntities.near
    );

    expect(drawn.height * layout.ratio).toBeLessThan(1);
    expect(layout.box.width).toBeCloseTo(MINIMAP_SIZE, 6);
    expect(layout.box.height).toBeGreaterThanOrEqual(MINIMAP_BOX_MIN_SIDE);
    expectStageSized(layout);

    const nodes = stage.find('.minimap-table');
    expect(nodes).toHaveLength(2);
    for (const node of nodes) {
      // The box is drawn a border in from the mark, with the stroke centred on
      // that line, so the mark is what the fill and the stroke cover together.
      expect((node.width() + TABLE_BORDER) * layout.ratio).toBeCloseTo(
        MINIMAP_MARK_MIN,
        6
      );
      expect((node.height() + TABLE_BORDER) * layout.ratio).toBeCloseTo(
        MINIMAP_MARK_MIN,
        6
      );
    }

    const view = getViewTransform(app.store.state);
    expect(getMinimapViewportRect(layout, view).height).toBeLessThan(
      MINIMAP_MARK_MIN
    );
    expect(handleOf(mounted, layout).height).toBeCloseTo(MINIMAP_MARK_MIN, 3);
  });

  it('marks the viewport as selected for the duration of the press', async () => {
    const app = createTestAppContext();
    const mounted = await mountMinimap(app);
    stubRect(0, 0);

    expect(viewportOf(mounted).classList.contains('selected')).toBe(false);

    minimapOf(mounted).dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 40, clientY: 40 })
    );
    await flush();
    expect(viewportOf(mounted).classList.contains('selected')).toBe(true);

    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await flush();
    expect(viewportOf(mounted).classList.contains('selected')).toBe(false);
  });

  it('keeps dragging the canvas after the initial press', async () => {
    const app = createTestAppContext();
    seedWide(app);
    const mounted = await mountMinimap(app);
    stubRect(0, 0);
    const { layout } = pressExpectation(app, { x: 0, y: 0 });
    const pixel = pixelIn(layout, 0.4, 0.5);
    const { origin } = pressExpectation(app, pixel);

    minimapOf(mounted).dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        clientX: pixel.x,
        clientY: pixel.y,
      })
    );
    await flush();
    const afterPress = app.store.state.settings.originX;

    window.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: pixel.x + 10,
        clientY: pixel.y,
      })
    );
    await flush();

    // Ten pointer pixels are ten map pixels at the ratio the press held.
    expect(afterPress).toBeCloseTo(origin.x, 3);
    expect(app.store.state.settings.originX).toBeCloseTo(
      afterPress + toScrollMovement(10, layout.ratio, 1),
      3
    );
    expect(layoutOf(app)).toEqual(layout);
  });

  it('keeps the viewport rectangle under the pointer while zoomed out', async () => {
    const app = createTestAppContext();
    seedWide(app);
    const mounted = await mountMinimap(app);
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    await flush();
    stubRect(0, 0);
    const { layout } = pressExpectation(app, { x: 0, y: 0 });
    const pixel = pixelIn(layout, 0.5, 0.5);

    minimapOf(mounted).dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        clientX: pixel.x,
        clientY: pixel.y,
      })
    );
    await flush();

    // Half zoom, so the screen reaches twice the scene it did at zoom 1, and
    // the rectangle drawn over the held map is twice as wide for it.
    const before = handleOf(mounted, layout);
    expect(before.width).toBeCloseTo(
      (app.store.state.editor.viewport.width / 0.5) * layout.ratio,
      3
    );
    const pressed = app.store.state.settings.originX;

    window.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: pixel.x + 10,
        clientY: pixel.y,
      })
    );
    await flush();

    // The origin travel carries the zoom, so ten pointer pixels are ten map
    // pixels: dropping the zoom term would move the rectangle twice as far.
    expect(app.store.state.settings.originX).toBeCloseTo(
      pressed + toScrollMovement(10, layout.ratio, 0.5),
      3
    );
    const after = handleOf(mounted, layout);
    expect(after.x - before.x).toBeCloseTo(10, 3);
    expect(after.width).toBeCloseTo(before.width, 3);
  });

  it('holds the layout still through an entity drag and lays out again on the drop', async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(
      addTableAction({ id: 'near', ui: { x: 0, y: 0, zIndex: 1 } })
    );
    const mounted = await mountMinimap(app);
    const before = layoutOf(app);

    // The drag holds the view through the freeze module the entity drag, the
    // scrollbars and this minimap share; the table then moves under it.
    freezeView(app.store.state);
    app.store.dispatchSync(moveToTableAction({ id: 'near', x: 8000, y: 0 }));
    await flush();
    await whenDrawn();

    expect(layoutOf(app)).toEqual(before);
    expectStageSized(before);
    expect(parseFloat(minimapOf(mounted).style.width)).toBeCloseTo(
      before.box.width,
      3
    );
    const layer = stageRegistry().minimap.findOne('.minimap-scene')!;
    expect(layer.scaleX()).toBeCloseTo(before.ratio, 9);

    thawView(app.store.state);
    await flush();
    await whenDrawn();

    const after = layoutOf(app);
    expect(after).not.toEqual(before);
    expectStageSized(after);
    expect(parseFloat(minimapOf(mounted).style.width)).toBeCloseTo(
      after.box.width,
      3
    );
    expect(layer.scaleX()).toBeCloseTo(after.ratio, 9);
  });

  /**
   * The freeze holds the content and the origin the drag began from, not the
   * screen: the editor has no edge scroll, so a table is carried far by wheeling
   * mid drag, and the map grows to keep the handle on it rather than cut it away.
   */
  it('grows the map under a wheel during an entity drag and keeps the handle whole on it', async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(
      addTableAction({ id: 'near', ui: { x: 0, y: 0, zIndex: 1 } })
    );
    const mounted = await mountMinimap(app);
    const before = layoutOf(app);
    const frozenContent = getContentRect(app.store.state)!;

    // The entity drag holds the view through the freeze module it shares with
    // this minimap; the wheel then carries the screen a step past the far edge
    // of the map the press saw, as the opposite origin movement, and the table goes further still.
    freezeView(app.store.state);
    const carried = before.map.x + before.map.width + MINIMAP_MAP_STEP;
    app.store.dispatchSync(
      streamScrollToAction({ movementX: -carried, movementY: 0 })
    );
    app.store.dispatchSync(
      moveToTableAction({ id: 'near', x: carried * 4, y: 0 })
    );
    await flush();
    await whenDrawn();

    // Against the map the press saw the screen is off the thumbnail entirely,
    // and the handle drawn for it would have no width at all.
    const held = layoutOf(app);
    const view = getViewTransform(app.store.state);
    const visible = getVisibleCanvasRect(view);
    expect(contains(before.map, visible)).toBe(false);
    expect(getMinimapHandleRect(before, view).width).toBe(0);

    // The map grew to hold the screen, still around the content the drag began
    // with rather than the table where the pointer has it, and the handle is whole.
    expect(held).not.toEqual(before);
    expect(contains(held.map, visible)).toBe(true);
    expect(contains(held.map, frozenContent)).toBe(true);
    expect(contains(held.map, getContentRect(app.store.state)!)).toBe(false);
    const rect = getMinimapHandleRect(held, view);
    expect(rect).toEqual(getMinimapViewportRect(held, view));
    expect(contains({ x: 0, y: 0, ...held.box }, rect)).toBe(true);
    const drawn = handleOf(mounted, held);
    expect(drawn.x).toBeCloseTo(rect.x, 3);
    expect(drawn.width).toBeCloseTo(rect.width, 3);
    expectStageSized(held);

    thawView(app.store.state);
    await flush();
    await whenDrawn();

    const after = layoutOf(app);
    expect(contains(after.map, getContentRect(app.store.state)!)).toBe(true);
    expect(contains(after.map, visible)).toBe(true);
    expectStageSized(after);
  });

  it('drops the Stage and its registry entry on unmount', async () => {
    await mountMinimap();
    const stage = stageRegistry().minimap;

    teardowns.splice(0).forEach(teardown => teardown());
    await whenDrawn();

    expect(stageRegistry().minimap).toBeUndefined();
    expect(stage.getLayers()).toHaveLength(0);
  });
});
