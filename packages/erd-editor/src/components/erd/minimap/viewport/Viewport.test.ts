import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import {
  getMinimapHandleRect,
  getMinimapLayout,
  getMinimapViewportRect,
  getViewTransform,
  toScrollMovement,
} from '@/components/erd/minimap/minimapGeometry';
import Viewport from '@/components/erd/minimap/viewport/Viewport';
import * as styles from '@/components/erd/minimap/viewport/Viewport.styles';
import { MINIMAP_MARGIN, MINIMAP_SIZE } from '@/constants/layout';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import {
  changeZoomLevelAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';

let mounted: Mounted | null = null;

afterEach(() => {
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  window.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
  mounted?.unmount();
  mounted = null;
});

const viewportOf = () =>
  mounted!.container.querySelector<HTMLElement>('.minimap-viewport')!;

const mount_ = async (selected = false, app?: AppContext) => {
  mounted = await mountAndFlush(
    html`<${Viewport} selected=${selected} />`,
    app
  );
  return mounted;
};

const touchAt = (clientX: number, clientY: number) =>
  new Touch({ identifier: 1, target: document.body, clientX, clientY });

/**
 * The handle as the geometry says it should be drawn for the store as it
 * stands: the box's own pixels plus the margin and the centring offset, which
 * is what the style below has to spell for a right anchored element.
 */
const expected = (app: AppContext) => {
  const layout = getMinimapLayout(app.store.state);
  const rect = getMinimapHandleRect(layout, getViewTransform(app.store.state));
  const { box, offset } = layout;

  return {
    width: rect.width,
    height: rect.height,
    top: MINIMAP_MARGIN + offset.y + rect.y,
    right: MINIMAP_MARGIN + offset.x + (box.width - rect.x - rect.width),
  };
};

const drawn = () => {
  const el = viewportOf();

  return {
    width: parseFloat(el.style.width),
    height: parseFloat(el.style.height),
    top: parseFloat(el.style.top),
    right: parseFloat(el.style.right),
  };
};

const expectDrawnAs = (app: AppContext) => {
  const want = expected(app);
  const got = drawn();

  expect(got.width).toBeCloseTo(want.width, 3);
  expect(got.height).toBeCloseTo(want.height, 3);
  expect(got.top).toBeCloseTo(want.top, 3);
  expect(got.right).toBeCloseTo(want.right, 3);
};

describe('minimap Viewport', () => {
  it('renders the viewport box with its base class and focus marker', async () => {
    await mount_();

    const el = viewportOf();
    expect(el).toBeTruthy();
    expect(el.classList.contains('minimap-viewport')).toBe(true);
    expect(el.classList.contains(String(styles.viewport))).toBe(true);
    expect(el.hasAttribute('data-focus-border')).toBe(true);
  });

  it('draws the editor viewport at the map ratio, offset into the box', async () => {
    const app = createTestAppContext();
    await mount_(false, app);

    const layout = getMinimapLayout(app.store.state);
    const rect = getMinimapHandleRect(
      layout,
      getViewTransform(app.store.state)
    );

    // An empty document maps the screen alone, so the handle is the screen
    // scaled by the ratio, sitting where the map's margin and snap put it.
    expect(rect.width).toBeCloseTo(1200 * layout.ratio, 9);
    expect(rect.height).toBeCloseTo(675 * layout.ratio, 9);
    expectDrawnAs(app);
  });

  it('offsets the box as the canvas scrolls', async () => {
    const app = createTestAppContext();
    // Content on both sides of the screen, so the scroll below moves the
    // screen inside the map rather than growing the map around it.
    app.store.dispatchSync(
      addTableAction({ id: 'near', ui: { x: -2000, y: -2000, zIndex: 2 } })
    );
    app.store.dispatchSync(
      addTableAction({ id: 'far', ui: { x: 3000, y: 3000, zIndex: 2 } })
    );
    await mount_(false, app);
    const before = drawn();
    const layout = getMinimapLayout(app.store.state);

    app.store.dispatchSync(scrollToAction({ originX: -400, originY: -200 }));
    await flush();

    expect(getMinimapLayout(app.store.state)).toEqual(layout);
    // The screen moved 400 and 200 scene units into the map, which is that
    // many map pixels down and to the right, read off the ratio.
    expect(drawn().top - before.top).toBeCloseTo(200 * layout.ratio, 3);
    expect(before.right - drawn().right).toBeCloseTo(400 * layout.ratio, 3);
    expectDrawnAs(app);
  });

  it('grows with the zoom, and the map grows to keep it', async () => {
    const app = createTestAppContext();
    await mount_(false, app);
    const before = getMinimapLayout(app.store.state);

    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    await flush();

    const layout = getMinimapLayout(app.store.state);
    const transform = getViewTransform(app.store.state);
    // At half zoom the screen reaches twice the scene, so the map is laid out
    // wider and the handle keeps its whole self on it: nothing is trimmed.
    expect(layout.map.width).toBeGreaterThan(before.map.width);
    expect(getMinimapHandleRect(layout, transform)).toEqual(
      getMinimapViewportRect(layout, transform)
    );
    expectDrawnAs(app);

    app.store.dispatchSync(changeZoomLevelAction({ value: 1 }));
    await flush();
    expectDrawnAs(app);
  });

  it('never leaves the square, however far the canvas zooms out', async () => {
    const app = createTestAppContext();
    await mount_(false, app);

    for (const value of [1, 0.7, 0.5, 0.2, 0.1]) {
      app.store.dispatchSync(changeZoomLevelAction({ value }));
      await flush();

      const { width, height, top, right } = drawn();
      const x = MINIMAP_MARGIN + MINIMAP_SIZE - right - width;
      const y = top - MINIMAP_MARGIN;

      // This box is a pointer target: a rectangle that hung over the canvas
      // would take the presses meant for the tables under it.
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(MINIMAP_SIZE + 1e-6);
      expect(y + height).toBeLessThanOrEqual(MINIMAP_SIZE + 1e-6);
    }
  });

  it('resizes with the editor viewport', async () => {
    const app = createTestAppContext();
    await mount_(false, app);

    app.store.dispatchSync(changeViewportAction({ width: 800, height: 400 }));
    await flush();

    const layout = getMinimapLayout(app.store.state);
    expect(drawn().width).toBeCloseTo(800 * layout.ratio, 3);
    expect(drawn().height).toBeCloseTo(400 * layout.ratio, 3);
    expectDrawnAs(app);
  });

  it('honours the selected prop pushed down by the minimap', async () => {
    await mount_(true);
    expect(viewportOf().classList.contains('selected')).toBe(true);
  });

  it('leaves the selected class off when neither source is selected', async () => {
    await mount_(false);
    expect(viewportOf().classList.contains('selected')).toBe(false);
  });

  it('selects itself on mousedown and releases on mouseup', async () => {
    await mount_(false);

    viewportOf().dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 })
    );
    await flush();
    expect(viewportOf().classList.contains('selected')).toBe(true);

    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await flush();
    expect(viewportOf().classList.contains('selected')).toBe(false);
  });

  it('selects itself on touchstart and releases on touchend', async () => {
    await mount_(false);

    viewportOf().dispatchEvent(
      new TouchEvent('touchstart', {
        bubbles: true,
        touches: [touchAt(10, 10)],
      })
    );
    await flush();
    expect(viewportOf().classList.contains('selected')).toBe(true);

    window.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    await flush();
    expect(viewportOf().classList.contains('selected')).toBe(false);
  });

  it('scrolls the canvas while it is dragged', async () => {
    const app = createTestAppContext();
    // Two tables far apart, which is what gives the origin travel to drag over.
    app.store.dispatchSync(
      addTableAction({ id: 'near', ui: { x: 0, y: 0, zIndex: 2 } })
    );
    app.store.dispatchSync(
      addTableAction({ id: 'far', ui: { x: 2_000, y: 2_000, zIndex: 2 } })
    );
    await mount_(false, app);
    const { ratio } = getMinimapLayout(app.store.state);

    viewportOf().dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 })
    );
    window.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: 20,
        clientY: 10,
      })
    );
    await flush();

    // Ten map pixels are ten over the ratio in scene units, and the origin
    // travels that far the other way at zoom 1.
    expect(app.store.state.settings.originX).toBeCloseTo(
      toScrollMovement(10, ratio, 1),
      3
    );
  });

  it('stays selected while the prop is true even after the drag ends', async () => {
    await mount_(true);

    viewportOf().dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 10 })
    );
    await flush();
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await flush();

    expect(viewportOf().classList.contains('selected')).toBe(true);
  });
});
