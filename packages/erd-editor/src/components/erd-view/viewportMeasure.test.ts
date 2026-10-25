import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__/index';
import type { AppContext } from '@/components/appContext';
import { measureViewport } from '@/components/erd-view/viewportMeasure';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';

/**
 * A ResizeObserver the case drives by hand: the one vitest.setup.ts installs
 * reports nothing, and happy-dom lays nothing out, so no real one would call back.
 */
class ResizeObserverStub {
  static instances: ResizeObserverStub[] = [];

  readonly observed: Element[] = [];
  disconnected = false;

  constructor(readonly callback: ResizeObserverCallback) {
    ResizeObserverStub.instances.push(this);
  }

  observe(target: Element) {
    this.observed.push(target);
  }

  unobserve() {}

  disconnect() {
    this.disconnected = true;
  }

  /** Reports the sizes given, one entry each, for the first element observed. */
  resize(...sizes: Array<{ width: number; height: number }>) {
    const entries = sizes.map(
      ({ width, height }) =>
        ({
          target: this.observed[0],
          contentRect: { width, height },
        }) as unknown as ResizeObserverEntry
    );
    this.callback(entries, this as unknown as ResizeObserver);
  }
}

let app: AppContext;
let target: HTMLDivElement;

beforeEach(() => {
  ResizeObserverStub.instances = [];
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  app = createTestAppContext();
  app.store.dispatchSync(changeViewportAction({ width: 0, height: 0 }));
  target = document.createElement('div');
});

afterEach(() => {
  vi.unstubAllGlobals();
  app.store.destroy();
});

const observer = () => ResizeObserverStub.instances[0];

const viewport = () => {
  const { width, height } = app.store.state.editor.viewport;
  return { width, height };
};

describe('measureViewport', () => {
  it('observes the element it is given and nothing else', () => {
    measureViewport(app.store, target);

    expect(ResizeObserverStub.instances).toHaveLength(1);
    expect(observer().observed).toEqual([target]);
  });

  it('hands the store the measured size as its viewport', () => {
    measureViewport(app.store, target);

    observer().resize({ width: 960, height: 540.5 });

    expect(viewport()).toEqual({ width: 960, height: 540.5 });
  });

  it('follows every resize, the last of a batch landing', () => {
    measureViewport(app.store, target);

    observer().resize({ width: 960, height: 540 });
    observer().resize(
      { width: 640, height: 480 },
      { width: 1280, height: 720 }
    );

    expect(viewport()).toEqual({ width: 1280, height: 720 });
  });

  it('dispatches nothing for a size the store already holds', () => {
    measureViewport(app.store, target);
    observer().resize({ width: 960, height: 540 });
    const batches: string[][] = [];
    const unsubscribe = app.store.subscribe(actions =>
      batches.push(actions.map(({ type }) => type))
    );

    observer().resize({ width: 960, height: 540 });
    observer().resize({ width: 960, height: 600 });
    unsubscribe();

    expect(batches).toEqual([['editor.changeViewport']]);
  });

  it('reports a host that hides the view as a screen with no size', () => {
    measureViewport(app.store, target);
    observer().resize({ width: 960, height: 540 });

    observer().resize({ width: 0, height: 0 });

    expect(viewport()).toEqual({ width: 0, height: 0 });
  });

  it('stops observing once the view lets it go', () => {
    const stop = measureViewport(app.store, target);

    stop();

    expect(observer().disconnected).toBe(true);
  });
});
