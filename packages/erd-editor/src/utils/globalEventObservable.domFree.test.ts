// @vitest-environment node

// P5-45b: the module must survive being imported by a realm that has no window,
// because the worker export path reaches it through the scene import graph. Node
// is that realm here; the browser half stays in globalEventObservable.test.ts.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { forwardMoveStartEvent } from '@/utils/internalEvents';

const MODULE_ID = '@/utils/globalEventObservable';

const STREAM_NAMES = [
  'keyup$',
  'mousedown$',
  'mousemove$',
  'mouseup$',
  'touchstart$',
  'touchmove$',
  'touchend$',
  'animationFrames$',
  'moveStart$',
  'moveEnd$',
  'move$',
  'drag$',
];

/** What the module opens on its own behalf, in the order the merge subscribes. */
const ANCHOR_TYPES = ['mousedown', 'touchstart', forwardMoveStartEvent.type];

type Registration = { type: string; listener: EventListener };

type Streams = Record<string, { subscribe: (observer?: any) => any }>;

const loadModule = async () => (await import(MODULE_ID)) as unknown as Streams;

/**
 * A window stand-in that records every registration while still behaving as a
 * real event target, which is what fromEvent probes for before it accepts one.
 */
function createWindowStub() {
  const added: Registration[] = [];
  const removed: Registration[] = [];
  const target = new EventTarget();

  const stub = {
    addEventListener(
      type: string,
      listener: EventListener,
      options?: AddEventListenerOptions
    ) {
      added.push({ type, listener });
      target.addEventListener(type, listener, options);
    },
    removeEventListener(
      type: string,
      listener: EventListener,
      options?: EventListenerOptions
    ) {
      removed.push({ type, listener });
      target.removeEventListener(type, listener, options);
    },
    dispatchEvent: (event: Event) => target.dispatchEvent(event),
  };

  return { added, removed, stub };
}

const types = (registrations: Registration[]) =>
  registrations.map(({ type }) => type);

const flushMacrotask = () =>
  new Promise(resolve => {
    setTimeout(resolve, 0);
  });

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('importing where there is no window (P5-45b)', () => {
  it('runs in a realm that declares no window at all', () => {
    expect(typeof window).toBe('undefined');
  });

  it('evaluates the module without throwing', async () => {
    const streams = await loadModule();

    for (const name of STREAM_NAMES) {
      expect(typeof streams[name]?.subscribe).toBe('function');
    }
  });

  it('opens no subscription of its own, so nothing reads the missing global', async () => {
    const { config } = await import('rxjs');
    const unhandled = vi.fn();
    config.onUnhandledError = unhandled;

    await loadModule();
    await flushMacrotask();
    config.onUnhandledError = null;

    expect(unhandled).not.toHaveBeenCalled();
  });

  it('reports the missing window to a subscriber rather than to the importer', async () => {
    const { keyup$ } = await loadModule();
    const error = vi.fn();

    keyup$.subscribe({ error });

    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0][0]).toBeInstanceOf(ReferenceError);
  });
});

describe('where a window is there, listeners follow the subscription (P5-45b)', () => {
  it('registers at import only what the module subscribes to itself', async () => {
    const { added, stub } = createWindowStub();
    vi.stubGlobal('window', stub);

    await loadModule();

    expect(types(added)).toEqual(ANCHOR_TYPES);
  });

  it('adds one listener per subscribe and drops it on unsubscribe', async () => {
    const { added, removed, stub } = createWindowStub();
    vi.stubGlobal('window', stub);
    const { keyup$ } = await loadModule();

    expect(types(added)).not.toContain('keyup');
    const first = keyup$.subscribe();
    const second = keyup$.subscribe();
    expect(types(added).filter(type => type === 'keyup')).toHaveLength(2);

    first.unsubscribe();
    second.unsubscribe();

    expect(types(removed).filter(type => type === 'keyup')).toHaveLength(2);
  });
});
