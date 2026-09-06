import { FC, html } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mount,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import {
  getMinimapLayout,
  toScrollMovement,
} from '@/components/erd/minimap/minimapGeometry';
import { useMinimapScroll } from '@/components/erd/minimap/useMinimapScroll';
import { ActionType } from '@/engine/modules/settings/actions';
import {
  changeZoomLevelAction,
  getScrollRanges,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { isViewFrozen } from '@/konva/scene/viewFreeze';

type Api = ReturnType<typeof useMinimapScroll>;

let api: Api | null = null;

const Probe: FC<{}> = (props, ctx) => {
  const scroll = useMinimapScroll(ctx);
  api = scroll;

  return () =>
    html`<div class=${['probe', { selected: scroll.state.selected }]}></div>`;
};

let mounted: Mounted | null = null;
let app: AppContext;

const probeOf = () => mounted!.container.querySelector<HTMLElement>('.probe')!;

/** Two tables, which is what gives the origin travel with room on either side. */
const setup = async () => {
  app = createTestAppContext();
  app.store.dispatchSync(
    addTableAction({ id: 'near', ui: { x: 0, y: 0, zIndex: 2 } })
  );
  app.store.dispatchSync(
    addTableAction({ id: 'far', ui: { x: 2_000, y: 2_000, zIndex: 2 } })
  );
  mounted = mount(html`<${Probe} />`, app);
  await flush();
};

const ranges = () => getScrollRanges(app.store.state);

/**
 * What a step of the pointer is worth in origin pixels for the store as it
 * stands: the map's ratio and the zoom, which the press then holds still.
 */
const worth = (movement: number) =>
  toScrollMovement(
    movement,
    getMinimapLayout(app.store.state).ratio,
    app.store.state.settings.zoomLevel
  );

const touchAt = (clientX: number, clientY: number) =>
  new Touch({
    identifier: 1,
    target: document.body,
    clientX,
    clientY,
  });

const mousedown = (clientX: number, clientY: number) => {
  const event = new MouseEvent('mousedown', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  });
  window.dispatchEvent(event);
  api!.onScrollStart(event);
  return event;
};

const touchstart = (clientX: number, clientY: number) => {
  const event = new TouchEvent('touchstart', {
    bubbles: true,
    cancelable: true,
    touches: [touchAt(clientX, clientY)],
  });
  window.dispatchEvent(event);
  api!.onScrollStart(event);
  return event;
};

const mousemove = (clientX: number, clientY: number) => {
  const event = new MouseEvent('mousemove', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  });
  window.dispatchEvent(event);
  return event;
};

const touchmove = (clientX: number, clientY: number) => {
  const event = new TouchEvent('touchmove', {
    bubbles: true,
    cancelable: true,
    touches: [touchAt(clientX, clientY)],
  });
  window.dispatchEvent(event);
  return event;
};

const mouseup = () =>
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

const recordActions = () => {
  const types: string[] = [];
  const unsubscribe = app.store.subscribe(actions => {
    actions.forEach(action => types.push(action.type));
  });
  return { types, unsubscribe };
};

beforeEach(async () => {
  await setup();
});

afterEach(() => {
  mouseup();
  window.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
  mounted?.unmount();
  mounted = null;
  api = null;
});

describe('useMinimapScroll', () => {
  it('starts unselected and exposes an observable selected flag', () => {
    expect(api).toBeTruthy();
    expect(api!.state.selected).toBe(false);
    expect(typeof api!.onScrollStart).toBe('function');
    expect(probeOf().classList.contains('selected')).toBe(false);
  });

  it('marks the scroll as selected while the pointer is down', async () => {
    mousedown(100, 100);
    await flush();

    expect(api!.state.selected).toBe(true);
    expect(probeOf().classList.contains('selected')).toBe(true);

    mouseup();
    await flush();

    expect(api!.state.selected).toBe(false);
    expect(probeOf().classList.contains('selected')).toBe(false);
  });

  it('scales a rightward drag into an inverse canvas scroll', async () => {
    const step = worth(10);
    mousedown(100, 100);
    mousemove(110, 100);
    await flush();

    const { settings } = app.store.state;
    // 10px of minimap travel is 10 over the map's ratio in scene units, and
    // the origin moves the other way to follow it.
    expect(step).toBeLessThan(0);
    expect(settings.originX).toBeCloseTo(step, 3);
    expect(Math.abs(settings.originY)).toBe(0);
  });

  it('scales a downward drag into an inverse canvas scroll', async () => {
    const step = worth(10);
    mousedown(100, 100);
    mousemove(100, 110);
    await flush();

    const { settings } = app.store.state;
    expect(settings.originY).toBeCloseTo(step, 3);
    expect(Math.abs(settings.originX)).toBe(0);
  });

  it('prevents the default of the forwarded mousemove', async () => {
    mousedown(100, 100);
    const event = mousemove(110, 110);
    await flush();

    expect(event.defaultPrevented).toBe(true);
  });

  it('dispatches nothing when neither axis moves', async () => {
    mousedown(100, 100);
    const { types, unsubscribe } = recordActions();

    mousemove(100, 100);
    await flush();
    unsubscribe();

    expect(types).not.toContain(ActionType.streamScrollTo);
    expect(Math.abs(app.store.state.settings.originX)).toBe(0);
    expect(Math.abs(app.store.state.settings.originY)).toBe(0);
  });

  it('drags left once the canvas is already scrolled', async () => {
    app.store.dispatchSync(scrollToAction({ originX: -500, originY: -500 }));
    await flush();
    const step = worth(-10);

    mousedown(100, 100);
    mousemove(90, 100);
    await flush();

    expect(step).toBeGreaterThan(0);
    expect(app.store.state.settings.originX).toBeCloseTo(-500 + step, 3);
  });

  it('drags up once the canvas is already scrolled', async () => {
    app.store.dispatchSync(scrollToAction({ originX: -500, originY: -500 }));
    await flush();
    const step = worth(-10);

    mousedown(100, 100);
    mousemove(100, 90);
    await flush();

    expect(app.store.state.settings.originY).toBeCloseTo(-500 + step, 3);
  });

  it('refuses to drag left when the origin already stands at the near end', async () => {
    const { left, top } = ranges();
    app.store.dispatchSync(
      scrollToAction({ originX: left.max, originY: top.max })
    );
    await flush();

    mousedown(100, 100);
    const { types, unsubscribe } = recordActions();

    mousemove(90, 90);
    await flush();
    unsubscribe();

    expect(types).not.toContain(ActionType.streamScrollTo);
    expect(app.store.state.settings.originX).toBe(left.max);
    expect(app.store.state.settings.originY).toBe(top.max);
  });

  it('refuses to drag past the far end of the travel', async () => {
    const { left, top } = ranges();
    app.store.dispatchSync(
      scrollToAction({ originX: left.min, originY: top.min })
    );
    await flush();

    mousedown(100, 100);
    const { types, unsubscribe } = recordActions();

    mousemove(110, 110);
    await flush();
    unsubscribe();

    expect(types).not.toContain(ActionType.streamScrollTo);
    expect(app.store.state.settings.originX).toBe(left.min);
    expect(app.store.state.settings.originY).toBe(top.min);
  });

  it('keeps the drag origin fixed while a move is refused', async () => {
    const { left } = ranges();
    app.store.dispatchSync(scrollToAction({ originX: left.max, originY: 0 }));
    await flush();

    mousedown(100, 100);
    // refused: the origin stands at the near end, so the pointer start stays 100
    mousemove(90, 100);
    await flush();

    const { types, unsubscribe } = recordActions();
    // heading right again but still left of the untouched start
    mousemove(95, 100);
    await flush();
    unsubscribe();

    expect(types).not.toContain(ActionType.streamScrollTo);
    expect(app.store.state.settings.originX).toBe(left.max);
  });

  it('stops scrolling once the pointer is released', async () => {
    const step = worth(10);
    mousedown(100, 100);
    mousemove(110, 100);
    await flush();
    mouseup();

    mousemove(130, 100);
    await flush();

    expect(app.store.state.settings.originX).toBeCloseTo(step, 3);
  });

  it('reads the start point from the first touch and scrolls on touchmove', async () => {
    const step = worth(10);
    touchstart(100, 100);
    await flush();

    expect(api!.state.selected).toBe(true);

    const event = touchmove(110, 100);
    await flush();

    expect(app.store.state.settings.originX).toBeCloseTo(step, 3);
    expect(event.defaultPrevented).toBe(false);
  });

  /**
   * A touch is followed by a compatibility mouse press at the same pixel, and
   * by then the handle has moved on, so that press would land on the thumbnail
   * beside it and jump the view a second time.
   */
  it('prevents the default of a touch press, and leaves a mouse press alone', async () => {
    const touch = touchstart(100, 100);
    await flush();
    expect(touch.defaultPrevented).toBe(true);

    window.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    await flush();

    const mouse = mousedown(100, 100);
    expect(mouse.defaultPrevented).toBe(false);
  });

  it('clears the selected flag on touchend', async () => {
    touchstart(100, 100);
    await flush();
    expect(api!.state.selected).toBe(true);

    window.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    await flush();

    expect(api!.state.selected).toBe(false);
  });

  it('rescales the movement when the canvas is zoomed out', async () => {
    // The start sits inside the travel the content allows, so the step below
    // is never clamped, and the map is read once before the press holds it.
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    app.store.dispatchSync(scrollToAction({ originX: 500, originY: 300 }));
    await flush();
    const before = app.store.state.settings.originX;
    const { left } = ranges();
    const { ratio } = getMinimapLayout(app.store.state);
    const step = worth(10);

    mousedown(100, 100);
    mousemove(110, 100);
    await flush();

    // 10px of travel is still 10 over the ratio in scene units; an origin
    // pixel only buys half of one at this zoom, hence the halving.
    expect(before).toBe(500);
    expect(before).toBeGreaterThan(left.min);
    expect(before).toBeLessThan(left.max);
    expect(step).toBeCloseTo(-(10 / ratio) * 0.5, 9);
    expect(app.store.state.settings.originX - before).toBeCloseTo(step, 3);
  });

  /**
   * At 150% the travel the content allows grows with the zoom, and the handle
   * has all of it to cover, from the near end back to the far one. Each move
   * is flushed: the gate reads the last.
   */
  describe('at a zoom that magnifies', () => {
    const magnify = async () => {
      app.store.dispatchSync(changeZoomLevelAction({ value: 1.5 }));
      await flush();
    };

    const stepHorizontal = async (
      from: number,
      step: number,
      times: number
    ) => {
      mousedown(from, 100);
      for (let index = 1; index <= times; index++) {
        mousemove(from + step * index, 100);
        await flush();
      }
      mouseup();
    };

    const stepVertical = async (from: number, step: number, times: number) => {
      mousedown(100, from);
      for (let index = 1; index <= times; index++) {
        mousemove(100, from + step * index);
        await flush();
      }
      mouseup();
    };

    // Enough steps to cross the whole travel, so the last one is clamped exactly
    // onto the end and the walk back lands exactly on the other.
    const STEPS = 30;

    it('drags the handle across every pixel the engine allows sideways', async () => {
      await magnify();
      const { left } = ranges();
      app.store.dispatchSync(scrollToAction({ originX: left.max, originY: 0 }));
      await flush();

      await stepHorizontal(100, 10, STEPS);

      expect(app.store.state.settings.originX).toBe(left.min);

      await stepHorizontal(100 + 10 * STEPS, -10, STEPS);

      expect(app.store.state.settings.originX).toBe(left.max);
    });

    it('drags the handle across every pixel the engine allows downwards', async () => {
      await magnify();
      const { top } = ranges();
      app.store.dispatchSync(scrollToAction({ originX: 0, originY: top.max }));
      await flush();

      await stepVertical(100, 10, STEPS);

      expect(app.store.state.settings.originY).toBe(top.min);

      await stepVertical(100 + 10 * STEPS, -10, STEPS);

      expect(app.store.state.settings.originY).toBe(top.max);
    });

    it('still refuses a step once the origin is standing on a bound', async () => {
      await magnify();
      const { left } = ranges();
      app.store.dispatchSync(scrollToAction({ originX: left.min, originY: 0 }));
      await flush();

      mousedown(100, 100);
      const { types, unsubscribe } = recordActions();
      mousemove(110, 100);
      await flush();
      unsubscribe();

      expect(types).not.toContain(ActionType.streamScrollTo);
      expect(app.store.state.settings.originX).toBe(left.min);
    });
  });

  it('rescales the movement when the content spreads out', async () => {
    const narrow = worth(10);
    app.store.dispatchSync(
      addTableAction({ id: 'farther', ui: { x: 6_000, y: 0, zIndex: 2 } })
    );
    await flush();
    const wide = worth(10);

    mousedown(100, 100);
    mousemove(110, 100);
    await flush();

    // A wider map folds more scene into each of the same 150 pixels, so the
    // same ten of them now cover more of it.
    expect(Math.abs(wide)).toBeGreaterThan(Math.abs(narrow));
    expect(app.store.state.settings.originX).toBeCloseTo(wide, 3);
  });

  it('moves the origin by the same scene distance from two different starts', async () => {
    // Content wide enough that both screens below lie inside it, so the map,
    // and with it what a pixel is worth, is the same at either start.
    app.store.dispatchSync(
      addTableAction({ id: 'farther', ui: { x: 6_000, y: 6_000, zIndex: 2 } })
    );
    await flush();
    const first = getMinimapLayout(app.store.state);

    mousedown(100, 100);
    mousemove(110, 100);
    await flush();
    mouseup();
    await flush();
    const fromZero = app.store.state.settings.originX;

    app.store.dispatchSync(scrollToAction({ originX: -800, originY: -600 }));
    await flush();
    expect(getMinimapLayout(app.store.state)).toEqual(first);

    mousedown(100, 100);
    mousemove(110, 100);
    await flush();
    mouseup();
    await flush();
    const fromInside = app.store.state.settings.originX - -800;

    expect(fromZero).toBeLessThan(0);
    expect(fromInside).toBeCloseTo(fromZero, 3);
  });

  it('holds the view for the drag and lets it go on release', async () => {
    expect(isViewFrozen(app.store.state)).toBe(false);

    mousedown(100, 100);
    expect(isViewFrozen(app.store.state)).toBe(true);

    mousemove(110, 100);
    await flush();
    expect(isViewFrozen(app.store.state)).toBe(true);

    mouseup();
    await flush();
    expect(isViewFrozen(app.store.state)).toBe(false);
  });

  it('holds the view for a touch drag as well', async () => {
    touchstart(100, 100);
    expect(isViewFrozen(app.store.state)).toBe(true);

    window.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    await flush();
    expect(isViewFrozen(app.store.state)).toBe(false);
  });

  it('keeps the map the press saw for the whole drag', async () => {
    const before = getMinimapLayout(app.store.state);

    mousedown(100, 100);
    mousemove(110, 100);
    await flush();
    mousemove(120, 110);
    await flush();

    // The origin has moved, and the screen with it, but the map is held.
    expect(app.store.state.settings.originX).not.toBe(0);
    expect(getMinimapLayout(app.store.state)).toEqual(before);
  });

  it('lets the view go when unmounted in the middle of a drag', async () => {
    mousedown(100, 100);
    expect(isViewFrozen(app.store.state)).toBe(true);

    mounted!.unmount();
    mounted = null;

    expect(isViewFrozen(app.store.state)).toBe(false);
  });
});
