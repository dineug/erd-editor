import { FC, html } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { useVirtualScroll } from '@/components/erd/virtual-scroll/useVirtualScroll';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import {
  changeZoomLevelAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';

type Api = ReturnType<typeof useVirtualScroll>;

// Default state: viewport 1200x675, canvas 2000x2000.
const W_RATIO = 1200 / 2000;
const H_RATIO = 675 / 2000;
const MIN_SCROLL_LEFT = 1200 - 2000;
const MIN_SCROLL_TOP = 675 - 2000;

let api: Api;

const Probe: FC<{}> = (props, ctx) => {
  api = useVirtualScroll(ctx);

  return () => html`
    <div class="probe" ?data-selected=${api.state.selected !== null}>
      ${api.state.selected ?? 'none'}
    </div>
  `;
};

let mounted: Mounted | null = null;
let app: AppContext;

const dispatchMouse = (
  type: 'mousedown' | 'mousemove' | 'mouseup',
  clientX: number,
  clientY: number
) => {
  const event = new MouseEvent(type, {
    clientX,
    clientY,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(event);
  return event;
};

const dispatchTouchMove = (clientX: number, clientY: number) => {
  const event = new TouchEvent('touchmove', {
    touches: [{ clientX, clientY } as unknown as Touch],
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(event);
  return event;
};

/** Presses the pointer down and hands the very same event to the hook. */
const pressHorizontal = (clientX: number, clientY: number) => {
  const event = dispatchMouse('mousedown', clientX, clientY);
  api.onScrollLeftStart(event);
  return event;
};

const pressVertical = (clientX: number, clientY: number) => {
  const event = dispatchMouse('mousedown', clientX, clientY);
  api.onScrollTopStart(event);
  return event;
};

const release = () => dispatchMouse('mouseup', 0, 0);

const probe = () => mounted!.container.querySelector('.probe') as HTMLElement;

beforeEach(async () => {
  app = createTestAppContext();
  mounted = await mountAndFlush(html`<${Probe} />`, app);
});

afterEach(() => {
  release();
  mounted?.unmount();
  mounted = null;
});

describe('useVirtualScroll', () => {
  it('starts with nothing selected', () => {
    expect(api.state.selected).toBeNull();
    expect(probe().hasAttribute('data-selected')).toBe(false);
  });

  it('derives the thumb ratios from the viewport over the canvas size', () => {
    expect(api.getWidthRatio()).toBeCloseTo(W_RATIO, 10);
    expect(api.getHeightRatio()).toBeCloseTo(H_RATIO, 10);
  });

  it('recomputes the ratios when the viewport matches the canvas', () => {
    app.store.dispatchSync(changeViewportAction({ width: 2000, height: 2000 }));

    expect(api.getWidthRatio()).toBe(1);
    expect(api.getHeightRatio()).toBe(1);
  });

  it('marks the horizontal thumb selected until the pointer is released', async () => {
    pressHorizontal(100, 100);
    await flush();

    expect(api.state.selected).toBe('horizontal');
    expect(probe().hasAttribute('data-selected')).toBe(true);
    expect(probe().textContent).toContain('horizontal');

    release();
    await flush();

    expect(api.state.selected).toBeNull();
    expect(probe().hasAttribute('data-selected')).toBe(false);
  });

  it('marks the vertical thumb selected until the pointer is released', async () => {
    pressVertical(100, 100);
    await flush();

    expect(api.state.selected).toBe('vertical');
    expect(probe().textContent).toContain('vertical');

    release();
    await flush();

    expect(api.state.selected).toBeNull();
  });

  it('scrolls the canvas left when the horizontal thumb is dragged right', async () => {
    pressHorizontal(100, 100);
    const move = dispatchMouse('mousemove', 150, 100);
    await flush();

    expect(move.defaultPrevented).toBe(true);
    expect(app.store.state.settings.scrollLeft).toBeCloseTo(-50 / W_RATIO, 3);
    expect(app.store.state.settings.scrollTop).toBe(0);
  });

  it('scrolls the canvas right when the horizontal thumb is dragged back', async () => {
    app.store.dispatchSync(scrollToAction({ scrollLeft: -100, scrollTop: 0 }));

    pressHorizontal(200, 100);
    dispatchMouse('mousemove', 150, 100);
    await flush();

    expect(app.store.state.settings.scrollLeft).toBeCloseTo(
      -100 + 50 / W_RATIO,
      3
    );
  });

  it('ignores a horizontal drag that would push past the canvas edge', async () => {
    app.store.dispatchSync(
      scrollToAction({ scrollLeft: MIN_SCROLL_LEFT, scrollTop: 0 })
    );

    pressHorizontal(100, 100);
    dispatchMouse('mousemove', 150, 100);
    await flush();

    expect(app.store.state.settings.scrollLeft).toBe(MIN_SCROLL_LEFT);
  });

  it('ignores a horizontal drag back while the canvas is already at scrollLeft 0', async () => {
    pressHorizontal(200, 100);
    dispatchMouse('mousemove', 150, 100);
    await flush();

    expect(app.store.state.settings.scrollLeft).toBe(0);
  });

  it('scrolls the canvas up when the vertical thumb is dragged down', async () => {
    pressVertical(100, 100);
    dispatchMouse('mousemove', 100, 150);
    await flush();

    expect(app.store.state.settings.scrollTop).toBeCloseTo(-50 / H_RATIO, 3);
    expect(app.store.state.settings.scrollLeft).toBe(0);
  });

  it('scrolls the canvas down when the vertical thumb is dragged back', async () => {
    app.store.dispatchSync(scrollToAction({ scrollLeft: 0, scrollTop: -200 }));

    pressVertical(100, 200);
    dispatchMouse('mousemove', 100, 150);
    await flush();

    expect(app.store.state.settings.scrollTop).toBeCloseTo(
      -200 + 50 / H_RATIO,
      3
    );
  });

  it('ignores a vertical drag that would push past the canvas edge', async () => {
    app.store.dispatchSync(
      scrollToAction({ scrollLeft: 0, scrollTop: MIN_SCROLL_TOP })
    );

    pressVertical(100, 100);
    dispatchMouse('mousemove', 100, 150);
    await flush();

    expect(app.store.state.settings.scrollTop).toBe(MIN_SCROLL_TOP);
  });

  it('ignores a vertical drag back while the canvas is already at scrollTop 0', async () => {
    pressVertical(100, 200);
    dispatchMouse('mousemove', 100, 150);
    await flush();

    expect(app.store.state.settings.scrollTop).toBe(0);
  });

  it('keeps the axes independent — a horizontal drag never moves scrollTop', async () => {
    pressHorizontal(100, 100);
    dispatchMouse('mousemove', 150, 160);
    await flush();

    expect(app.store.state.settings.scrollTop).toBe(0);
    expect(app.store.state.settings.scrollLeft).toBeCloseTo(-50 / W_RATIO, 3);
  });

  it('follows touch drags without preventing the default touch behaviour', async () => {
    pressHorizontal(100, 100);
    const move = dispatchTouchMove(150, 100);
    await flush();

    expect(move.defaultPrevented).toBe(false);
    expect(app.store.state.settings.scrollLeft).toBeCloseTo(-50 / W_RATIO, 3);
  });

  /**
   * The step that runs past a bound is still the thumb's to take. Refusing it
   * for overshooting leaves the scroll a whole step short of the end, which is
   * a gap the pointer cannot close however far it keeps going.
   */
  it('takes the overshooting step and lets the reducer clamp it', async () => {
    app.store.dispatchSync(scrollToAction({ scrollLeft: -500, scrollTop: 0 }));

    pressHorizontal(100, 100);
    dispatchMouse('mousemove', 350, 100);
    await flush();

    expect(app.store.state.settings.scrollLeft).toBe(MIN_SCROLL_LEFT);
  });

  it('stops reacting to moves once the pointer has been released', async () => {
    pressHorizontal(100, 100);
    release();
    await flush();

    dispatchMouse('mousemove', 400, 100);
    await flush();

    expect(app.store.state.settings.scrollLeft).toBe(0);
  });

  /**
   * At 150% the 2000 box draws 3000 wide and starts 500 left of the scroll, so
   * the travel is 1800 rather than the 800 the canvas box alone would suggest.
   */
  describe('at a zoom that magnifies', () => {
    const MAX_SCROLL_LEFT = 500;
    const MIN_ZOOMED_LEFT = 1200 - 3000 + 500;
    const MAX_SCROLL_TOP = 500;
    const MIN_ZOOMED_TOP = 675 - 3000 + 500;

    const magnify = () => {
      app.store.dispatchSync(changeZoomLevelAction({ value: 1.5 }));
    };

    // Each move is flushed before the next, because the gate reads the scroll
    // the previous move landed on — a whole gesture in one batch never would.
    const stepHorizontal = async (
      from: number,
      step: number,
      times: number
    ) => {
      pressHorizontal(from, 100);
      for (let index = 1; index <= times; index++) {
        dispatchMouse('mousemove', from + step * index, 100);
        await flush();
      }
      release();
    };

    const stepVertical = async (from: number, step: number, times: number) => {
      pressVertical(100, from);
      for (let index = 1; index <= times; index++) {
        dispatchMouse('mousemove', 100, from + step * index);
        await flush();
      }
      release();
    };

    it('sizes the thumb from the travel the zoom allows, not the canvas box', () => {
      magnify();

      expect(api.getWidthRatio()).toBeCloseTo(1200 / 3000, 10);
      expect(api.getHeightRatio()).toBeCloseTo(675 / 3000, 10);
    });

    it('drags the horizontal thumb across every pixel the engine allows', async () => {
      magnify();
      app.store.dispatchSync(
        scrollToAction({ scrollLeft: 1_000_000, scrollTop: 0 })
      );
      expect(app.store.state.settings.scrollLeft).toBe(MAX_SCROLL_LEFT);

      await stepHorizontal(100, 72, 10);

      expect(app.store.state.settings.scrollLeft).toBe(MIN_ZOOMED_LEFT);

      await stepHorizontal(820, -72, 10);

      expect(app.store.state.settings.scrollLeft).toBe(MAX_SCROLL_LEFT);
    });

    it('drags the vertical thumb across every pixel the engine allows', async () => {
      magnify();
      app.store.dispatchSync(
        scrollToAction({ scrollLeft: 0, scrollTop: 1_000_000 })
      );
      expect(app.store.state.settings.scrollTop).toBe(MAX_SCROLL_TOP);

      await stepVertical(100, 40, 20);

      expect(app.store.state.settings.scrollTop).toBe(MIN_ZOOMED_TOP);

      await stepVertical(900, -40, 20);

      expect(app.store.state.settings.scrollTop).toBe(MAX_SCROLL_TOP);
    });

    it('still refuses a step once the scroll is standing on a bound', async () => {
      magnify();
      app.store.dispatchSync(
        scrollToAction({ scrollLeft: -1_000_000, scrollTop: 0 })
      );
      expect(app.store.state.settings.scrollLeft).toBe(MIN_ZOOMED_LEFT);

      pressHorizontal(100, 100);
      dispatchMouse('mousemove', 150, 100);
      await flush();

      expect(app.store.state.settings.scrollLeft).toBe(MIN_ZOOMED_LEFT);
    });
  });
});
