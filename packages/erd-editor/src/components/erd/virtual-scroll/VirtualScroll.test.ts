import { html } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import VirtualScroll from '@/components/erd/virtual-scroll/VirtualScroll';
import * as styles from '@/components/erd/virtual-scroll/VirtualScroll.styles';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { scrollToAction } from '@/engine/modules/settings/atom.actions';

// Default state: viewport 1200x675, canvas 2000x2000.
const VIEWPORT_WIDTH = 1200;
const VIEWPORT_HEIGHT = 675;
const W_RATIO = VIEWPORT_WIDTH / 2000;
const H_RATIO = VIEWPORT_HEIGHT / 2000;

// happy-dom measures every element as 0x0 at (0, 0), so the tracks get a
// deliberate origin to prove the component subtracts it from the click point.
const TRACK_X = 40;
const TRACK_Y = 25;

let mounted: Mounted | null = null;
let app: AppContext;

const tracks = () =>
  Array.from(
    mounted!.container.querySelectorAll<HTMLElement>('.virtual-scroll')
  );

const thumbs = () =>
  Array.from(
    mounted!.container.querySelectorAll<HTMLElement>(
      '.virtual-scroll-ghost-thumb'
    )
  );

const mouse = (
  type: 'mousedown' | 'mousemove' | 'mouseup',
  clientX: number,
  clientY: number
) =>
  new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true });

const release = () => window.dispatchEvent(mouse('mouseup', 0, 0));

beforeEach(async () => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: TRACK_X,
    y: TRACK_Y,
    left: TRACK_X,
    top: TRACK_Y,
    right: TRACK_X,
    bottom: TRACK_Y,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  } as DOMRect);

  app = createTestAppContext();
  mounted = await mountAndFlush(html`<${VirtualScroll} />`, app);
});

afterEach(() => {
  release();
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});

describe('VirtualScroll', () => {
  it('renders a horizontal track before a vertical one when both axes overflow', () => {
    const [horizontal, vertical] = tracks();

    expect(tracks()).toHaveLength(2);
    expect(horizontal.classList.contains(String(styles.horizontal))).toBe(true);
    expect(vertical.classList.contains(String(styles.vertical))).toBe(true);
    expect(
      horizontal.querySelector(`.${String(styles.horizontalThumb)}`)
    ).toBeTruthy();
    expect(
      vertical.querySelector(`.${String(styles.verticalThumb)}`)
    ).toBeTruthy();
  });

  it('sizes each ghost thumb from the viewport-to-canvas ratio', () => {
    const [horizontalThumb, verticalThumb] = thumbs();

    expect(horizontalThumb.style.width).toBe(`${VIEWPORT_WIDTH * W_RATIO}px`);
    expect(horizontalThumb.style.height).toBe('100%');
    expect(verticalThumb.style.width).toBe('100%');
    expect(parseFloat(verticalThumb.style.height)).toBeCloseTo(
      VIEWPORT_HEIGHT * H_RATIO,
      6
    );
  });

  it('parks both thumbs at the origin while the canvas is unscrolled', () => {
    const [horizontalThumb, verticalThumb] = thumbs();

    expect(horizontalThumb.style.transform).toBe('translate(0px, 0px)');
    expect(verticalThumb.style.transform).toBe('translate(0px, 0px)');
    expect(horizontalThumb.hasAttribute('data-selected')).toBe(false);
    expect(verticalThumb.hasAttribute('data-selected')).toBe(false);
  });

  it('translates each thumb by the scrolled distance scaled to its track', async () => {
    app.store.dispatchSync(
      scrollToAction({ scrollLeft: -400, scrollTop: -200 })
    );
    await flush();

    const [horizontalThumb, verticalThumb] = thumbs();

    expect(horizontalThumb.style.transform).toBe(
      `translate(${400 * W_RATIO}px, 0px)`
    );
    expect(verticalThumb.style.transform).toBe(
      `translate(0px, ${200 * H_RATIO}px)`
    );
  });

  it('hides the horizontal track once the viewport is as wide as the canvas', async () => {
    app.store.dispatchSync(changeViewportAction({ width: 2000, height: 675 }));
    await flush();

    expect(tracks()).toHaveLength(1);
    expect(tracks()[0].classList.contains(String(styles.vertical))).toBe(true);
  });

  it('hides the vertical track once the viewport is as tall as the canvas', async () => {
    app.store.dispatchSync(changeViewportAction({ width: 1200, height: 2000 }));
    await flush();

    expect(tracks()).toHaveLength(1);
    expect(tracks()[0].classList.contains(String(styles.horizontal))).toBe(
      true
    );
  });

  it('renders nothing when the viewport covers the whole canvas', async () => {
    app.store.dispatchSync(changeViewportAction({ width: 2000, height: 2000 }));
    await flush();

    expect(tracks()).toHaveLength(0);
    expect(thumbs()).toHaveLength(0);
  });

  it('jumps the horizontal scroll so the clicked point becomes the viewport center', async () => {
    const [horizontal] = tracks();

    horizontal.dispatchEvent(mouse('mousedown', TRACK_X + 600, TRACK_Y));
    await flush();

    // 600 / ratio = 1000 absolute, minus half a viewport.
    expect(app.store.state.settings.scrollLeft).toBeCloseTo(
      -(600 / W_RATIO - VIEWPORT_WIDTH / 2),
      3
    );
    expect(app.store.state.settings.scrollTop).toBe(0);
    expect(thumbs()[0].hasAttribute('data-selected')).toBe(true);
    expect(thumbs()[1].hasAttribute('data-selected')).toBe(false);
  });

  it('jumps the vertical scroll so the clicked point becomes the viewport center', async () => {
    const [, vertical] = tracks();

    vertical.dispatchEvent(mouse('mousedown', TRACK_X, TRACK_Y + 300));
    await flush();

    expect(app.store.state.settings.scrollTop).toBeCloseTo(
      -(300 / H_RATIO - VIEWPORT_HEIGHT / 2),
      3
    );
    expect(app.store.state.settings.scrollLeft).toBe(0);
    expect(thumbs()[1].hasAttribute('data-selected')).toBe(true);
    expect(thumbs()[0].hasAttribute('data-selected')).toBe(false);
  });

  it('keeps the horizontal scroll put when the press starts on the ghost thumb', async () => {
    app.store.dispatchSync(scrollToAction({ scrollLeft: -100, scrollTop: 0 }));
    await flush();

    thumbs()[0].dispatchEvent(mouse('mousedown', TRACK_X + 600, TRACK_Y));
    await flush();

    expect(app.store.state.settings.scrollLeft).toBe(-100);
    expect(thumbs()[0].hasAttribute('data-selected')).toBe(true);
  });

  it('keeps the vertical scroll put when the press starts on the ghost thumb', async () => {
    app.store.dispatchSync(scrollToAction({ scrollLeft: 0, scrollTop: -100 }));
    await flush();

    thumbs()[1].dispatchEvent(mouse('mousedown', TRACK_X, TRACK_Y + 300));
    await flush();

    expect(app.store.state.settings.scrollTop).toBe(-100);
    expect(thumbs()[1].hasAttribute('data-selected')).toBe(true);
  });

  it('drags the canvas horizontally while the ghost thumb is held', async () => {
    thumbs()[0].dispatchEvent(mouse('mousedown', 100, 0));
    window.dispatchEvent(mouse('mousemove', 150, 0));
    await flush();

    expect(app.store.state.settings.scrollLeft).toBeCloseTo(-50 / W_RATIO, 3);
  });

  it('releases the selected thumb on mouseup and stops following the pointer', async () => {
    thumbs()[0].dispatchEvent(mouse('mousedown', 100, 0));
    await flush();
    expect(thumbs()[0].hasAttribute('data-selected')).toBe(true);

    release();
    await flush();
    expect(thumbs()[0].hasAttribute('data-selected')).toBe(false);

    window.dispatchEvent(mouse('mousemove', 400, 0));
    await flush();
    expect(app.store.state.settings.scrollLeft).toBe(0);
  });
});
