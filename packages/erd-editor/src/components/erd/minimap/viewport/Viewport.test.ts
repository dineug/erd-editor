import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import Viewport from '@/components/erd/minimap/viewport/Viewport';
import * as styles from '@/components/erd/minimap/viewport/Viewport.styles';
import { MINIMAP_MARGIN, MINIMAP_SIZE } from '@/constants/layout';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import {
  changeZoomLevelAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';

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

describe('minimap Viewport', () => {
  it('renders the viewport box with its base class and focus marker', async () => {
    await mount_();

    const el = viewportOf();
    expect(el).toBeTruthy();
    expect(el.classList.contains('minimap-viewport')).toBe(true);
    expect(el.classList.contains(String(styles.viewport))).toBe(true);
    expect(el.hasAttribute('data-focus-border')).toBe(true);
  });

  it('scales the editor viewport down by the minimap ratio', async () => {
    await mount_();

    const el = viewportOf();
    // ratio = 150 / 2000 = 0.075 over a 1200 x 675 editor viewport
    expect(el.style.width).toBe('90px');
    expect(el.style.height).toBe('50.625px');
    expect(el.style.top).toBe('20px');
    // right = 0 - 90 + 150 + 20
    expect(el.style.right).toBe('80px');
  });

  it('offsets the box as the canvas scrolls', async () => {
    const app = createTestAppContext();
    await mount_(false, app);

    app.store.dispatchSync(
      scrollToAction({ scrollLeft: -400, scrollTop: -200 })
    );
    await flush();

    const el = viewportOf();
    // x = -400 * 0.075 = -30, y = -200 * 0.075 = -15
    expect(el.style.top).toBe('35px');
    expect(el.style.right).toBe('50px');
  });

  it('grows with the zoom, trimmed to the map it is drawn on', async () => {
    const app = createTestAppContext();
    await mount_(false, app);

    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    await flush();

    const el = viewportOf();
    // At half zoom the screen reaches 2400 x 1350 canvas units, which is 180 x
    // 101.25 from -75, -75 at the same 0.075. The map is 150 square, so what is
    // drawn is the part of that which lands on it.
    expect(parseFloat(el.style.width)).toBeCloseTo(105, 3);
    expect(parseFloat(el.style.height)).toBeCloseTo(26.25, 3);
    expect(parseFloat(el.style.top)).toBeCloseTo(20, 3);
    expect(parseFloat(el.style.right)).toBeCloseTo(65, 3);

    app.store.dispatchSync(changeZoomLevelAction({ value: 1 }));
    await flush();
    expect(parseFloat(viewportOf().style.width)).toBeCloseTo(90, 3);
  });

  it('never leaves the map, however far the canvas zooms out', async () => {
    const app = createTestAppContext();
    await mount_(false, app);

    for (const value of [1, 0.7, 0.5, 0.2, 0.1]) {
      app.store.dispatchSync(changeZoomLevelAction({ value }));
      await flush();

      const el = viewportOf();
      const width = parseFloat(el.style.width);
      const height = parseFloat(el.style.height);
      const x =
        MINIMAP_MARGIN + MINIMAP_SIZE - parseFloat(el.style.right) - width;
      const y = parseFloat(el.style.top) - MINIMAP_MARGIN;

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

    const el = viewportOf();
    expect(el.style.width).toBe('60px');
    expect(el.style.height).toBe('30px');
    // right = 0 - 60 + 150 + 20
    expect(el.style.right).toBe('110px');
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
    await mount_(false, app);

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

    expect(app.store.state.settings.scrollLeft).toBe(-133.3333);
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
