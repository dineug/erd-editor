import { html } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import VirtualScroll from '@/components/erd/virtual-scroll/VirtualScroll';
import * as styles from '@/components/erd/virtual-scroll/VirtualScroll.styles';
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from '@/constants/layout';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import {
  changeZoomLevelAction,
  getScrollRanges,
  type ScrollRange,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';

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

const ranges = () => getScrollRanges(app.store.state);

/**
 * The bar's geometry written out: the thumb is the screen's share of the
 * screen plus the travel, and it slides over the room it leaves on a track a
 * screen long, so that room over the travel is what one origin pixel is worth.
 */
const bar = (range: ScrollRange, viewportLength: number) => {
  const travel = range.max - range.min;
  const thumb = (viewportLength * viewportLength) / (viewportLength + travel);
  const ratio = (viewportLength - thumb) / travel;

  return {
    thumb,
    ratio,
    offsetAt: (origin: number) => (range.max - origin) * ratio,
    /** The origin that centres the thumb on a point pressed on the track. */
    pressAt: (point: number) => range.max - (point - thumb / 2) / ratio,
  };
};

const translateOf = (thumb: HTMLElement) =>
  thumb.style.transform
    .replace('translate(', '')
    .replace(')', '')
    .split(',')
    .map(parseFloat);

/** Content from the corner to 2000 on each axis, so both bars have travel. */
const seedContent = (target: AppContext = app) => {
  target.store.dispatchSync(
    addTableAction({ id: 'near', ui: { x: 0, y: 0, zIndex: 2 } })
  );
  target.store.dispatchSync(
    addTableAction({ id: 'far', ui: { x: 2_000, y: 2_000, zIndex: 2 } })
  );
};

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
  seedContent();
  mounted = await mountAndFlush(html`<${VirtualScroll} />`, app);
});

afterEach(() => {
  release();
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});

describe('VirtualScroll', () => {
  it('renders a horizontal track before a vertical one when both axes have travel', () => {
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

  it('renders nothing over an empty document, which has no travel', async () => {
    mounted?.unmount();
    app = createTestAppContext();
    mounted = await mountAndFlush(html`<${VirtualScroll} />`, app);

    expect(tracks()).toHaveLength(0);
    expect(thumbs()).toHaveLength(0);
  });

  it('sizes each ghost thumb as the screen share of the screen plus the travel', () => {
    const { left, top } = ranges();
    const [horizontalThumb, verticalThumb] = thumbs();

    expect(parseFloat(horizontalThumb.style.width)).toBeCloseTo(
      bar(left, DEFAULT_WIDTH).thumb,
      6
    );
    expect(horizontalThumb.style.height).toBe('100%');
    expect(verticalThumb.style.width).toBe('100%');
    expect(parseFloat(verticalThumb.style.height)).toBeCloseTo(
      bar(top, DEFAULT_HEIGHT).thumb,
      6
    );
  });

  it('parks both thumbs at the start while the origin stands at the range maximum', async () => {
    const { left, top } = ranges();
    app.store.dispatchSync(
      scrollToAction({ originX: left.max, originY: top.max })
    );
    await flush();

    const [horizontalThumb, verticalThumb] = thumbs();

    expect(horizontalThumb.style.transform).toBe('translate(0px, 0px)');
    expect(verticalThumb.style.transform).toBe('translate(0px, 0px)');
    expect(horizontalThumb.hasAttribute('data-selected')).toBe(false);
    expect(verticalThumb.hasAttribute('data-selected')).toBe(false);
  });

  it('translates each thumb by the scrolled distance scaled to its track', async () => {
    const { left, top } = ranges();
    app.store.dispatchSync(scrollToAction({ originX: -400, originY: -200 }));
    await flush();

    const [horizontalThumb, verticalThumb] = thumbs();

    expect(translateOf(horizontalThumb)[0]).toBeCloseTo(
      bar(left, DEFAULT_WIDTH).offsetAt(-400),
      6
    );
    expect(translateOf(horizontalThumb)[1]).toBe(0);
    expect(translateOf(verticalThumb)[0]).toBe(0);
    expect(translateOf(verticalThumb)[1]).toBeCloseTo(
      bar(top, DEFAULT_HEIGHT).offsetAt(-200),
      6
    );
  });

  /**
   * The travel is the content plus one screen, so it never closes however far
   * the screen grows: a document that holds anything always has both bars.
   */
  it('keeps both tracks however large the screen grows', async () => {
    app.store.dispatchSync(
      changeViewportAction({ width: 20_000, height: 20_000 })
    );
    await flush();

    expect(tracks()).toHaveLength(2);
  });

  it('jumps the horizontal scroll so the clicked point becomes the thumb centre', async () => {
    const { left } = ranges();
    const [horizontal] = tracks();

    horizontal.dispatchEvent(mouse('mousedown', TRACK_X + 600, TRACK_Y));
    await flush();

    expect(app.store.state.settings.originX).toBeCloseTo(
      bar(left, DEFAULT_WIDTH).pressAt(600),
      3
    );
    expect(app.store.state.settings.originY).toBe(0);
    expect(thumbs()[0].hasAttribute('data-selected')).toBe(true);
    expect(thumbs()[1].hasAttribute('data-selected')).toBe(false);
  });

  it('jumps the vertical scroll so the clicked point becomes the thumb centre', async () => {
    const { top } = ranges();
    const [, vertical] = tracks();

    vertical.dispatchEvent(mouse('mousedown', TRACK_X, TRACK_Y + 300));
    await flush();

    expect(app.store.state.settings.originY).toBeCloseTo(
      bar(top, DEFAULT_HEIGHT).pressAt(300),
      3
    );
    expect(app.store.state.settings.originX).toBe(0);
    expect(thumbs()[1].hasAttribute('data-selected')).toBe(true);
    expect(thumbs()[0].hasAttribute('data-selected')).toBe(false);
  });

  it('keeps a press at the very end of the track inside the travel', async () => {
    const { left } = ranges();
    const [horizontal] = tracks();

    horizontal.dispatchEvent(mouse('mousedown', TRACK_X, TRACK_Y));
    await flush();
    expect(app.store.state.settings.originX).toBe(left.max);

    release();
    horizontal.dispatchEvent(
      mouse('mousedown', TRACK_X + DEFAULT_WIDTH, TRACK_Y)
    );
    await flush();
    expect(app.store.state.settings.originX).toBeCloseTo(left.min, 3);
  });

  it('keeps the horizontal scroll put when the press starts on the ghost thumb', async () => {
    app.store.dispatchSync(scrollToAction({ originX: -100, originY: 0 }));
    await flush();

    thumbs()[0].dispatchEvent(mouse('mousedown', TRACK_X + 600, TRACK_Y));
    await flush();

    expect(app.store.state.settings.originX).toBe(-100);
    expect(thumbs()[0].hasAttribute('data-selected')).toBe(true);
  });

  it('keeps the vertical scroll put when the press starts on the ghost thumb', async () => {
    app.store.dispatchSync(scrollToAction({ originX: 0, originY: -100 }));
    await flush();

    thumbs()[1].dispatchEvent(mouse('mousedown', TRACK_X, TRACK_Y + 300));
    await flush();

    expect(app.store.state.settings.originY).toBe(-100);
    expect(thumbs()[1].hasAttribute('data-selected')).toBe(true);
  });

  it('drags the canvas horizontally while the ghost thumb is held', async () => {
    const { left } = ranges();

    thumbs()[0].dispatchEvent(mouse('mousedown', 100, 0));
    window.dispatchEvent(mouse('mousemove', 150, 0));
    await flush();

    expect(app.store.state.settings.originX).toBeCloseTo(
      -50 / bar(left, DEFAULT_WIDTH).ratio,
      3
    );
  });

  /**
   * At 150% the content draws half again as wide, so the travel grows with it
   * and the thumb is sized and placed from that travel rather than from the
   * content's own extent.
   */
  describe('at a zoom that magnifies', () => {
    const magnify = async () => {
      app.store.dispatchSync(changeZoomLevelAction({ value: 1.5 }));
      await flush();
    };

    it('sizes the thumb from the travel the zoom draws', async () => {
      const before = bar(ranges().left, DEFAULT_WIDTH).thumb;
      await magnify();
      const { left, top } = ranges();

      expect(bar(left, DEFAULT_WIDTH).thumb).toBeLessThan(before);
      expect(parseFloat(thumbs()[0].style.width)).toBeCloseTo(
        bar(left, DEFAULT_WIDTH).thumb,
        6
      );
      expect(parseFloat(thumbs()[1].style.height)).toBeCloseTo(
        bar(top, DEFAULT_HEIGHT).thumb,
        6
      );
    });

    it('keeps the thumb inside its track at both ends of the travel', async () => {
      await magnify();
      const { left } = ranges();
      app.store.dispatchSync(scrollToAction({ originX: left.max, originY: 0 }));
      await flush();

      const thumb = () => thumbs()[0];
      const offsetOf = () => translateOf(thumb())[0];

      expect(offsetOf()).toBeCloseTo(0, 6);

      app.store.dispatchSync(scrollToAction({ originX: left.min, originY: 0 }));
      await flush();

      const width = parseFloat(thumb().style.width);
      expect(offsetOf()).toBeCloseTo(DEFAULT_WIDTH - width, 6);
      expect(offsetOf() + width).toBeCloseTo(DEFAULT_WIDTH, 6);
    });

    it('centres the clicked point through the zoomed ratio', async () => {
      await magnify();
      const { left } = ranges();
      const [horizontal] = tracks();

      horizontal.dispatchEvent(mouse('mousedown', TRACK_X + 600, TRACK_Y));
      await flush();

      expect(app.store.state.settings.originX).toBeCloseTo(
        bar(left, DEFAULT_WIDTH).pressAt(600),
        3
      );
    });
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
    expect(app.store.state.settings.originX).toBe(0);
  });
});
