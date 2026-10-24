import { createRef, FC, html, ref } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { usePinchZoom } from '@/hooks/usePinchZoom';

let mounted: Mounted | null = null;
let app: AppContext;
let pinch: ReturnType<typeof usePinchZoom>;

/** A scene box that takes its pinches through the hook, given or not a gate. */
const Probe: FC<{ interactive?: () => boolean }> = props => {
  const root = createRef<HTMLDivElement>();
  pinch = usePinchZoom({
    app: () => app,
    root,
    interactive: props.interactive,
  });

  return () => html`<div ${ref(root)}></div>`;
};

/** A trackpad pinch as a browser sends it: a ctrl wheel of -100 ln(scale). */
const pinchWheel = (scale: number) => {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaY: -100 * Math.log(scale),
  });
  // happy-dom's WheelEvent constructor drops the modifiers.
  Object.defineProperty(event, 'ctrlKey', { value: true });
  return event;
};

const zoomLevel = () => app.store.state.settings.zoomLevel;

beforeEach(() => {
  app = createTestAppContext();
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  app.store.destroy();
});

describe('usePinchZoom - handleWheel', () => {
  it('holds a pinch wheel off the page and zooms by it when no gate is given', async () => {
    mounted = await mountAndFlush(html`<${Probe} />`, app);

    const event = pinchWheel(1.08);
    const plain = new WheelEvent('wheel', { cancelable: true, deltaY: 50 });

    expect(pinch.handleWheel(event)).toBe(true);
    expect(pinch.handleWheel(plain)).toBe(false);
    await flush();

    expect([event, plain].map(e => e.defaultPrevented)).toEqual([true, false]);
    expect(zoomLevel()).toBe(1.08);
  });

  it('lets a pinch wheel through to the page while the scene takes no input', async () => {
    let interactive = false;
    mounted = await mountAndFlush(
      html`<${Probe} interactive=${() => interactive} />`,
      app
    );

    const passed = pinchWheel(1.08);

    expect(pinch.handleWheel(passed)).toBe(true);
    await flush();

    expect(passed.defaultPrevented).toBe(false);
    expect(zoomLevel()).toBe(1);

    interactive = true;
    const taken = pinchWheel(1.08);

    expect(pinch.handleWheel(taken)).toBe(true);
    await flush();

    expect(taken.defaultPrevented).toBe(true);
    expect(zoomLevel()).toBe(1.08);
  });
});
