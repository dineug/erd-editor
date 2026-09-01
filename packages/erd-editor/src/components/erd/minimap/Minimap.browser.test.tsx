// P3-31: the minimap as a second Stage. The thumbnail is its own 150px scene
// now instead of a full size copy under a css scale, and it holds that one
// scale through a zoom: the zoom is drawn by the rectangle over it instead.

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
import * as canvasStyles from '@/components/erd/canvas/Canvas.styles';
import Minimap from '@/components/erd/minimap/Minimap';
import * as styles from '@/components/erd/minimap/Minimap.styles';
import { themeContext } from '@/components/themeContext';
import { MINIMAP_MARGIN, MINIMAP_SIZE } from '@/constants/layout';
import { RelationshipType, Show } from '@/constants/schema';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  changeShowAction,
  changeZoomLevelAction,
  resizeAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { whenDrawn } from '@/konva/batchDraw';

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

describe('the minimap shell', () => {
  it('lays the thumbnail out at the size it draws, in the corner', async () => {
    const mounted = await mountMinimap();
    const el = minimapOf(mounted);

    expect(el.classList.contains(String(styles.minimap))).toBe(true);
    // ratio = 150 / 2000 = 0.075, and 2000 * 0.075 is the box it used to reach
    // by scaling a full size copy of the canvas.
    expect(el.style.width).toBe('150px');
    expect(el.style.height).toBe('150px');
    expect(el.style.right).toBe('20px');
    expect(el.style.top).toBe('20px');
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

  it('hangs one Stage of one layer in the scene box', async () => {
    const mounted = await mountMinimap();
    const stage = stageRegistry().minimap;

    expect(stage.container()).toBe(sceneOf(mounted));
    expect(stage.width()).toBe(150);
    expect(stage.height()).toBe(150);
    expect(stage.getLayers().map(layer => layer.name())).toEqual([
      'minimap-scene',
    ]);
  });

  it('holds the thumbnail at the ratio alone, through every zoom', async () => {
    const app = createTestAppContext();
    await mountMinimap(app);
    const layer = stageRegistry().minimap.findOne('.minimap-scene')!;

    expect(layer.scaleX()).toBe(0.075);
    expect(layer.x()).toBe(0);

    for (const value of [0.5, 0.2, 0.1]) {
      app.store.dispatchSync(changeZoomLevelAction({ value }));
      await flush();

      // The canvas box fills the square at every zoom, so there is no offset
      // to restate either: a zoom that moved these would shrink the map.
      expect(layer.scaleX()).toBe(0.075);
      expect(layer.scaleY()).toBe(0.075);
      expect(layer.x()).toBe(0);
      expect(layer.y()).toBe(0);
    }
  });

  it('follows a canvas resize on both the box and the Stage', async () => {
    const app = createTestAppContext();
    const mounted = await mountMinimap(app);

    app.store.dispatchSync(resizeAction({ width: 4000, height: 2000 }));
    await flush();

    // ratio = 150 / 4000, so the height halves with the canvas aspect.
    expect(minimapOf(mounted).style.height).toBe('75px');
    expect(stageRegistry().minimap.width()).toBe(150);
    expect(stageRegistry().minimap.height()).toBe(75);
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

    app.store.dispatchSync(resizeAction({ width: 20000, height: 20000 }));
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

  it('scrolls the canvas so the pressed point becomes the viewport center', async () => {
    const app = createTestAppContext();
    const mounted = await mountMinimap(app);
    stubRect(10, 20);

    minimapOf(mounted).dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 85, clientY: 50 })
    );
    await flush();

    // (85 - 10) / 0.075 = 1000 -> 1000 - 1200 / 2 = 400
    expect(app.store.state.settings.scrollLeft).toBe(-400);
    // (50 - 20) / 0.075 = 400 -> 400 - 675 / 2 = 62.5
    expect(app.store.state.settings.scrollTop).toBe(-62.5);
  });

  it('centres the press on the same canvas point while zoomed out', async () => {
    const app = createTestAppContext();
    const mounted = await mountMinimap(app);
    // 8000 at half zoom still draws wider than the editor viewport, so the
    // scroll this asks for is nowhere near the bound and no clamp hides it.
    app.store.dispatchSync(resizeAction({ width: 8000, height: 8000 }));
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    await flush();
    stubRect(0, 0);

    minimapOf(mounted).dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 45, clientY: 45 })
    );
    await flush();

    // 45 / 0.01875 is canvas 2400 at any zoom, but at half zoom the screen
    // spans 2400 canvas units, so centring it is not 2400 - 1200 / 2.
    expect(app.store.state.settings.scrollLeft).toBe(-2600);
    expect(app.store.state.settings.scrollTop).toBe(-2862.5);

    const el = viewportOf(mounted);
    const width = parseFloat(el.style.width);
    const height = parseFloat(el.style.height);
    const x =
      MINIMAP_MARGIN + MINIMAP_SIZE - parseFloat(el.style.right) - width;
    const y = parseFloat(el.style.top) - MINIMAP_MARGIN;

    expect(x + width / 2).toBeCloseTo(45, 3);
    expect(y + height / 2).toBeCloseTo(45, 3);
  });

  it('clamps the scroll to the canvas bounds', async () => {
    const app = createTestAppContext();
    const mounted = await mountMinimap(app);
    stubRect(0, 0);

    minimapOf(mounted).dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 150, clientY: 150 })
    );
    await flush();

    // min scroll = viewport (1200 x 675) - canvas (2000 x 2000)
    expect(app.store.state.settings.scrollLeft).toBe(-800);
    expect(app.store.state.settings.scrollTop).toBe(-1325);
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

  it('reads the press position from the first touch on touchstart', async () => {
    const app = createTestAppContext();
    const mounted = await mountMinimap(app);
    stubRect(10, 20);

    minimapOf(mounted).dispatchEvent(
      new TouchEvent('touchstart', {
        bubbles: true,
        touches: [touchAt(85, 50)],
      })
    );
    await flush();

    expect(app.store.state.settings.scrollLeft).toBe(-400);
    expect(app.store.state.settings.scrollTop).toBe(-62.5);
    expect(viewportOf(mounted).classList.contains('selected')).toBe(true);
  });

  it('keeps dragging the canvas after the initial press', async () => {
    const app = createTestAppContext();
    const mounted = await mountMinimap(app);
    stubRect(0, 0);

    minimapOf(mounted).dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 60, clientY: 40 })
    );
    await flush();
    const afterPress = app.store.state.settings.scrollLeft;

    window.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: 70,
        clientY: 40,
      })
    );
    await flush();

    expect(afterPress).toBe(-200);
    expect(app.store.state.settings.scrollLeft).toBe(-333.3333);
  });

  it('keeps the viewport rectangle under the pointer while zoomed out', async () => {
    const app = createTestAppContext();
    const mounted = await mountMinimap(app);
    app.store.dispatchSync(resizeAction({ width: 8000, height: 8000 }));
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    await flush();
    stubRect(0, 0);

    minimapOf(mounted).dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 45, clientY: 45 })
    );
    await flush();

    // Half zoom, so the screen reaches twice the canvas and the rectangle is
    // twice the 22.5px it draws at zoom 1 over the same 150px map.
    expect(parseFloat(viewportOf(mounted).style.width)).toBeCloseTo(45, 3);
    const before = parseFloat(viewportOf(mounted).style.right);

    window.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: 55,
        clientY: 45,
      })
    );
    await flush();

    // The scroll carries the zoom, so ten pointer pixels are ten minimap
    // pixels: dropping the zoom term moves the rectangle twice as far.
    expect(app.store.state.settings.scrollLeft).toBe(-2866.6667);
    expect(before - parseFloat(viewportOf(mounted).style.right)).toBeCloseTo(
      10,
      3
    );
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
