import { FC, html } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import {
  getScrollbarTrack,
  SCROLLBAR_THUMB_MIN,
  trackPointToScroll,
  useVirtualScroll,
} from '@/components/erd/virtual-scroll/useVirtualScroll';
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from '@/constants/layout';
import {
  changeZoomLevelAction,
  getScrollRanges,
  type ScrollRange,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { isViewFrozen, thawView } from '@/konva/scene/viewFreeze';

type Api = ReturnType<typeof useVirtualScroll>;

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

const seedTable = (id: string, x: number, y: number) => {
  app.store.dispatchSync(addTableAction({ id, ui: { x, y, zIndex: 2 } }));
};

/** Content wide enough that a step from the origin has room on either side. */
const seedContent = () => {
  seedTable('near', 0, 0);
  seedTable('far', 2_000, 2_000);
};

const ranges = () => getScrollRanges(app.store.state);
const originX = () => app.store.state.settings.originX;
const originY = () => app.store.state.settings.originY;

/**
 * What a drag pixel is worth, written out: the travel spread over the room the
 * thumb leaves on a track a viewport long, and the sign turned around because
 * the thumb moves with the pointer while the origin moves against it.
 */
const dragToOrigin = (
  pixels: number,
  range: ScrollRange,
  viewportLength: number
) => {
  const travel = range.max - range.min;
  const thumb = Math.max(
    SCROLLBAR_THUMB_MIN,
    (viewportLength * viewportLength) / (viewportLength + travel)
  );

  return (-pixels * travel) / (viewportLength - thumb);
};

beforeEach(async () => {
  app = createTestAppContext();
  mounted = await mountAndFlush(html`<${Probe} />`, app);
});

afterEach(() => {
  release();
  thawView(app.store.state);
  mounted?.unmount();
  mounted = null;
});

describe('useVirtualScroll', () => {
  it('starts with nothing selected', () => {
    expect(api.state.selected).toBeNull();
    expect(probe().hasAttribute('data-selected')).toBe(false);
  });

  it('hides both bars over an empty document, which has no travel', () => {
    expect(api.getHorizontalTrack().scrollable).toBe(false);
    expect(api.getVerticalTrack().scrollable).toBe(false);
  });

  /**
   * The thumb is the screen's share of a screen plus the travel, and slides
   * over what it leaves of the track: at the range maximum it stands at the
   * start, at the minimum against the far end.
   */
  it('sizes the thumb as the screen share of the screen plus the travel', () => {
    seedContent();
    const { left, top } = ranges();
    const travelX = left.max - left.min;
    const travelY = top.max - top.min;
    const thumbX = (DEFAULT_WIDTH * DEFAULT_WIDTH) / (DEFAULT_WIDTH + travelX);
    const thumbY =
      (DEFAULT_HEIGHT * DEFAULT_HEIGHT) / (DEFAULT_HEIGHT + travelY);

    expect(thumbX).toBeGreaterThan(SCROLLBAR_THUMB_MIN);
    expect(api.getHorizontalTrack().thumb).toBeCloseTo(thumbX, 9);
    expect(api.getVerticalTrack().thumb).toBeCloseTo(thumbY, 9);
    expect(api.getWidthRatio()).toBeCloseTo(
      (DEFAULT_WIDTH - thumbX) / travelX,
      9
    );
    expect(api.getHeightRatio()).toBeCloseTo(
      (DEFAULT_HEIGHT - thumbY) / travelY,
      9
    );

    app.store.dispatchSync(
      scrollToAction({ originX: left.max, originY: top.max })
    );
    expect(api.getHorizontalTrack().offset).toBeCloseTo(0, 9);
    expect(api.getVerticalTrack().offset).toBeCloseTo(0, 9);

    app.store.dispatchSync(
      scrollToAction({ originX: left.min, originY: top.min })
    );
    expect(api.getHorizontalTrack().offset).toBeCloseTo(
      DEFAULT_WIDTH - thumbX,
      9
    );
    expect(api.getVerticalTrack().offset).toBeCloseTo(
      DEFAULT_HEIGHT - thumbY,
      9
    );
  });

  describe('over a span of 500,000 units', () => {
    beforeEach(() => {
      seedTable('near', 0, 0);
      seedTable('far', 500_000, 500_000);
    });

    it('floors the thumb at 24 px rather than drawing a hairline', () => {
      const { left } = ranges();
      const share =
        (DEFAULT_WIDTH * DEFAULT_WIDTH) / (DEFAULT_WIDTH + left.max - left.min);

      expect(share).toBeLessThan(SCROLLBAR_THUMB_MIN);
      expect(api.getHorizontalTrack().thumb).toBe(SCROLLBAR_THUMB_MIN);
      expect(api.getVerticalTrack().thumb).toBe(SCROLLBAR_THUMB_MIN);
      expect(api.getHorizontalTrack().scrollable).toBe(true);
    });

    it('maps a drag over the room the floored thumb leaves', async () => {
      const { left } = ranges();
      const expected = dragToOrigin(50, left, DEFAULT_WIDTH);

      pressHorizontal(100, 100);
      dispatchMouse('mousemove', 150, 100);
      await flush();

      expect(Math.abs(expected)).toBeGreaterThan(20_000);
      expect(originX()).toBeCloseTo(expected, 3);
    });

    it('parks the thumb against the far end at the range minimum', () => {
      const { left } = ranges();
      app.store.dispatchSync(scrollToAction({ originX: left.min, originY: 0 }));

      expect(api.getHorizontalTrack().offset).toBeCloseTo(
        DEFAULT_WIDTH - SCROLLBAR_THUMB_MIN,
        9
      );
    });
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
    seedContent();
    const { left } = ranges();

    pressHorizontal(100, 100);
    const move = dispatchMouse('mousemove', 150, 100);
    await flush();

    expect(move.defaultPrevented).toBe(true);
    expect(originX()).toBeCloseTo(dragToOrigin(50, left, DEFAULT_WIDTH), 3);
    expect(originY()).toBe(0);
  });

  it('scrolls the canvas right when the horizontal thumb is dragged back', async () => {
    seedContent();
    app.store.dispatchSync(scrollToAction({ originX: -100, originY: 0 }));
    const { left } = ranges();

    pressHorizontal(200, 100);
    dispatchMouse('mousemove', 150, 100);
    await flush();

    expect(originX()).toBeCloseTo(
      -100 + dragToOrigin(-50, left, DEFAULT_WIDTH),
      3
    );
  });

  it('ignores a horizontal drag that would push past the far end', async () => {
    seedContent();
    const { left } = ranges();
    app.store.dispatchSync(scrollToAction({ originX: left.min, originY: 0 }));

    pressHorizontal(100, 100);
    dispatchMouse('mousemove', 150, 100);
    await flush();

    expect(originX()).toBe(left.min);
  });

  it('ignores a horizontal drag back while the thumb stands at the near end', async () => {
    seedContent();
    const { left } = ranges();
    app.store.dispatchSync(scrollToAction({ originX: left.max, originY: 0 }));

    pressHorizontal(200, 100);
    dispatchMouse('mousemove', 150, 100);
    await flush();

    expect(originX()).toBe(left.max);
  });

  it('scrolls the canvas up when the vertical thumb is dragged down', async () => {
    seedContent();
    const { top } = ranges();

    pressVertical(100, 100);
    dispatchMouse('mousemove', 100, 150);
    await flush();

    expect(originY()).toBeCloseTo(dragToOrigin(50, top, DEFAULT_HEIGHT), 3);
    expect(originX()).toBe(0);
  });

  it('scrolls the canvas down when the vertical thumb is dragged back', async () => {
    seedContent();
    app.store.dispatchSync(scrollToAction({ originX: 0, originY: -200 }));
    const { top } = ranges();

    pressVertical(100, 200);
    dispatchMouse('mousemove', 100, 150);
    await flush();

    expect(originY()).toBeCloseTo(
      -200 + dragToOrigin(-50, top, DEFAULT_HEIGHT),
      3
    );
  });

  it('ignores a vertical drag that would push past the far end', async () => {
    seedContent();
    const { top } = ranges();
    app.store.dispatchSync(scrollToAction({ originX: 0, originY: top.min }));

    pressVertical(100, 100);
    dispatchMouse('mousemove', 100, 150);
    await flush();

    expect(originY()).toBe(top.min);
  });

  it('keeps the axes independent, so a horizontal drag never moves the vertical origin', async () => {
    seedContent();
    const { left } = ranges();

    pressHorizontal(100, 100);
    dispatchMouse('mousemove', 150, 160);
    await flush();

    expect(originY()).toBe(0);
    expect(originX()).toBeCloseTo(dragToOrigin(50, left, DEFAULT_WIDTH), 3);
  });

  it('follows touch drags without preventing the default touch behaviour', async () => {
    seedContent();
    const { left } = ranges();

    pressHorizontal(100, 100);
    const move = dispatchTouchMove(150, 100);
    await flush();

    expect(move.defaultPrevented).toBe(false);
    expect(originX()).toBeCloseTo(dragToOrigin(50, left, DEFAULT_WIDTH), 3);
  });

  /**
   * The step that runs past a bound is still the thumb's to take. Refusing it
   * for overshooting leaves the scroll a whole step short of the end, which is
   * a gap the pointer cannot close however far it keeps going.
   */
  it('takes the overshooting step and cuts it to the end of the travel itself', async () => {
    seedContent();
    const { left } = ranges();
    app.store.dispatchSync(
      scrollToAction({ originX: left.min + 50, originY: 0 })
    );

    pressHorizontal(100, 100);
    dispatchMouse('mousemove', 350, 100);
    await flush();

    expect(originX()).toBe(left.min);
  });

  it('stops reacting to moves once the pointer has been released', async () => {
    seedContent();

    pressHorizontal(100, 100);
    release();
    await flush();

    dispatchMouse('mousemove', 400, 100);
    await flush();

    expect(originX()).toBe(0);
  });

  /**
   * A drag scales against the travel it started with: the hull would close in
   * as the origin nears the content and grow the thumb under the pointer, which
   * changes what the next pixel is worth, so the view is held until the drop.
   */
  it('holds the travel it started with until the pointer is released', async () => {
    seedContent();
    app.store.dispatchSync(scrollToAction({ originX: 40_000, originY: 0 }));
    const start = api.getHorizontalTrack();

    pressHorizontal(100, 100);
    dispatchMouse('mousemove', 110, 100);
    await flush();

    expect(isViewFrozen(app.store.state)).toBe(true);
    expect(originX()).toBeCloseTo(
      40_000 + dragToOrigin(10, start.range, DEFAULT_WIDTH),
      3
    );
    expect(originX()).toBeLessThan(40_000);
    expect(api.getHorizontalTrack().range).toEqual(start.range);
    expect(api.getHorizontalTrack().thumb).toBe(start.thumb);

    release();
    await flush();

    expect(isViewFrozen(app.store.state)).toBe(false);
    expect(api.getHorizontalTrack().range.max).toBe(originX());
    expect(api.getHorizontalTrack().thumb).toBeGreaterThan(start.thumb);
  });

  it('lets the view go when unmounted in the middle of a scrollbar drag', async () => {
    seedContent();
    pressHorizontal(100, 100);
    expect(isViewFrozen(app.store.state)).toBe(true);

    mounted!.unmount();
    mounted = null;

    expect(isViewFrozen(app.store.state)).toBe(false);
    expect(api.state.selected).toBeNull();
  });

  describe('at a zoom that magnifies', () => {
    const magnify = () => {
      seedContent();
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

    it('sizes the thumb from the travel the zoom draws', () => {
      const before = ranges().left;
      magnify();
      const { left } = ranges();
      const thumb =
        (DEFAULT_WIDTH * DEFAULT_WIDTH) / (DEFAULT_WIDTH + left.max - left.min);

      expect(left.max - left.min).toBeGreaterThan(before.max - before.min);
      expect(api.getHorizontalTrack().thumb).toBeCloseTo(thumb, 9);
    });

    it('drags the horizontal thumb across every pixel the engine allows', async () => {
      magnify();
      const { left } = ranges();
      const room = DEFAULT_WIDTH - api.getHorizontalTrack().thumb;
      app.store.dispatchSync(scrollToAction({ originX: left.max, originY: 0 }));

      // One step more than the room takes, so the last one is clamped exactly.
      await stepHorizontal(10, room / 10, 11);

      expect(originX()).toBe(left.min);

      await stepHorizontal(10 + room, -room / 10, 11);

      expect(originX()).toBe(left.max);
    });

    it('drags the vertical thumb across every pixel the engine allows', async () => {
      magnify();
      const { top } = ranges();
      const room = DEFAULT_HEIGHT - api.getVerticalTrack().thumb;
      app.store.dispatchSync(scrollToAction({ originX: 0, originY: top.max }));

      await stepVertical(10, room / 10, 11);

      expect(originY()).toBe(top.min);

      await stepVertical(10 + room, -room / 10, 11);

      expect(originY()).toBe(top.max);
    });

    it('still refuses a step once the scroll is standing on a bound', async () => {
      magnify();
      const { left } = ranges();
      app.store.dispatchSync(scrollToAction({ originX: left.min, originY: 0 }));

      pressHorizontal(100, 100);
      dispatchMouse('mousemove', 150, 100);
      await flush();

      expect(originX()).toBe(left.min);
    });
  });
});

describe('trackPointToScroll', () => {
  const range: ScrollRange = { min: -3_000, max: 500 };
  const viewport = 1_000;
  const track = getScrollbarTrack(range, 0, viewport);

  it('centres the thumb on the pressed point, which is the old centring where the floor is slack', () => {
    const points = [track.thumb / 2, 300, 500, viewport - track.thumb / 2];

    for (const point of points) {
      expect(trackPointToScroll(track, point, viewport)).toBeCloseTo(
        range.max - (point / track.ratio - viewport / 2),
        9
      );
    }
  });

  it('parks the thumb against either end for a press past it', () => {
    expect(trackPointToScroll(track, 0, viewport)).toBe(range.max);
    expect(trackPointToScroll(track, viewport, viewport)).toBeCloseTo(
      range.min,
      9
    );
  });

  it('answers the maximum for a track with no room, where nothing can move', () => {
    const still = getScrollbarTrack({ min: 40, max: 40 }, 40, viewport);

    expect(still.scrollable).toBe(false);
    expect(trackPointToScroll(still, 250, viewport)).toBe(40);
  });
});
