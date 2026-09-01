import { FC, html } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mount,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { useMinimapScroll } from '@/components/erd/minimap/useMinimapScroll';
import { ActionType } from '@/engine/modules/settings/actions';
import {
  changeZoomLevelAction,
  resizeAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';

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

const setup = async () => {
  app = createTestAppContext();
  mounted = mount(html`<${Probe} />`, app);
  await flush();
};

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
    mousedown(100, 100);
    mousemove(110, 100);
    await flush();

    const { settings } = app.store.state;
    // ratio = 150 / 2000; 10px of minimap travel = 10 / ratio canvas px
    expect(settings.scrollLeft).toBe(-133.3333);
    expect(Math.abs(settings.scrollTop)).toBe(0);
  });

  it('scales a downward drag into an inverse canvas scroll', async () => {
    mousedown(100, 100);
    mousemove(100, 110);
    await flush();

    const { settings } = app.store.state;
    expect(settings.scrollTop).toBe(-133.3333);
    expect(Math.abs(settings.scrollLeft)).toBe(0);
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
    expect(Math.abs(app.store.state.settings.scrollLeft)).toBe(0);
    expect(Math.abs(app.store.state.settings.scrollTop)).toBe(0);
  });

  it('drags left once the canvas is already scrolled', async () => {
    app.store.dispatchSync(
      scrollToAction({ scrollLeft: -500, scrollTop: -500 })
    );
    await flush();

    mousedown(100, 100);
    mousemove(90, 100);
    await flush();

    expect(app.store.state.settings.scrollLeft).toBe(-366.6667);
  });

  it('drags up once the canvas is already scrolled', async () => {
    app.store.dispatchSync(
      scrollToAction({ scrollLeft: -500, scrollTop: -500 })
    );
    await flush();

    mousedown(100, 100);
    mousemove(100, 90);
    await flush();

    expect(app.store.state.settings.scrollTop).toBe(-366.6667);
  });

  it('refuses to drag left when the canvas is already at the left edge', async () => {
    mousedown(100, 100);
    const { types, unsubscribe } = recordActions();

    mousemove(90, 90);
    await flush();
    unsubscribe();

    expect(types).not.toContain(ActionType.streamScrollTo);
    expect(Math.abs(app.store.state.settings.scrollLeft)).toBe(0);
    expect(Math.abs(app.store.state.settings.scrollTop)).toBe(0);
  });

  it('refuses to drag past the far edge of the canvas', async () => {
    // min scroll = viewport (1200 x 675) - canvas (2000 x 2000)
    app.store.dispatchSync(
      scrollToAction({ scrollLeft: -800, scrollTop: -1325 })
    );
    await flush();

    mousedown(100, 100);
    const { types, unsubscribe } = recordActions();

    mousemove(110, 110);
    await flush();
    unsubscribe();

    expect(types).not.toContain(ActionType.streamScrollTo);
    expect(app.store.state.settings.scrollLeft).toBe(-800);
    expect(app.store.state.settings.scrollTop).toBe(-1325);
  });

  it('keeps the drag origin fixed while a move is refused', async () => {
    mousedown(100, 100);
    // refused: the canvas is already at the left edge, so the origin stays 100
    mousemove(90, 100);
    await flush();

    const { types, unsubscribe } = recordActions();
    // heading right again but still left of the untouched origin
    mousemove(95, 100);
    await flush();
    unsubscribe();

    expect(types).not.toContain(ActionType.streamScrollTo);
    expect(Math.abs(app.store.state.settings.scrollLeft)).toBe(0);
  });

  it('stops scrolling once the pointer is released', async () => {
    mousedown(100, 100);
    mousemove(110, 100);
    await flush();
    mouseup();

    mousemove(130, 100);
    await flush();

    expect(app.store.state.settings.scrollLeft).toBe(-133.3333);
  });

  it('reads the start point from the first touch and scrolls on touchmove', async () => {
    touchstart(100, 100);
    await flush();

    expect(api!.state.selected).toBe(true);

    const event = touchmove(110, 100);
    await flush();

    expect(app.store.state.settings.scrollLeft).toBe(-133.3333);
    expect(event.defaultPrevented).toBe(false);
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
    // A canvas this large still draws wider than the viewport at half zoom, and
    // the start is far from either bound, so the step below is never clamped.
    app.store.dispatchSync(resizeAction({ width: 8000, height: 8000 }));
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    app.store.dispatchSync(
      scrollToAction({ scrollLeft: -3000, scrollTop: -3000 })
    );
    await flush();
    const before = app.store.state.settings.scrollLeft;

    mousedown(100, 100);
    mousemove(110, 100);
    await flush();

    // The minimap keeps its scale, so 10px of travel is still 10 / ratio canvas
    // px; a scroll pixel only buys half of one at this zoom, hence the halving.
    expect(before).toBe(-3000);
    expect(app.store.state.settings.scrollLeft - before).toBeCloseTo(
      -266.6667,
      3
    );
  });

  it('rescales the movement when the canvas is resized', async () => {
    app.store.dispatchSync(resizeAction({ width: 4000, height: 4000 }));
    await flush();
    expect(app.store.state.settings.width).toBe(4000);

    mousedown(100, 100);
    mousemove(110, 100);
    await flush();

    // ratio = 150 / 4000 -> 10px of travel = 266.6667 canvas px
    expect(app.store.state.settings.scrollLeft).toBe(-266.6667);
  });
});
