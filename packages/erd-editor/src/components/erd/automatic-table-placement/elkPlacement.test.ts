import { DOMTemplateLiterals, html } from '@dineug/r-html';
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
  mount,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { layoutByElk } from '@/components/erd/automatic-table-placement/elkPlacement';
import { TablePlacement } from '@/constants/tablePlacement';
import type { ElkLayoutPoint, ElkLayoutRequest } from '@/services/elk-layout';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

type Layout = (
  request: ElkLayoutRequest,
  onSlow?: () => void
) => Promise<ElkLayoutPoint[]>;

const hoisted = vi.hoisted(() => ({
  elkLayout: null as Layout | null,
  slow: [] as Array<(() => void) | undefined>,
}));

/**
 * ELK answers from a shared worker, which this environment runs none of, so
 * the one call across that boundary is the one the test stands in for.
 */
vi.mock('@/services/elk-layout', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/elk-layout')>();

  return {
    ...actual,
    createElkLayout: (request: ElkLayoutRequest, onSlow?: () => void) => {
      hoisted.slow.push(onSlow);
      return hoisted.elkLayout
        ? hoisted.elkLayout(request, onSlow)
        : Promise.reject(new Error('no layout'));
    },
  };
});

type Toast = { message: DOMTemplateLiterals; close?: Promise<void> };

const REQUEST: ElkLayoutRequest = {
  placement: TablePlacement.flow,
  nodes: [{ id: 't1', width: 100, height: 50 }],
  edges: [],
};

let toastContainer: Mounted | null = null;
const contexts: AppContext[] = [];

function createApp(): AppContext {
  const app = createTestAppContext();
  contexts.push(app);
  return app;
}

function listenToasts(app: AppContext): Toast[] {
  const toasts: Toast[] = [];
  app.emitter.on({
    openToast: ({ payload }) => {
      toasts.push(payload as Toast);
    },
  });
  return toasts;
}

async function clickCancel(toast: Toast) {
  toastContainer = mount(html`${toast.message}`);
  await flush();
  const button = Array.from(
    toastContainer.container.querySelectorAll('button')
  ).find(el => el.textContent?.trim() === 'Cancel');
  if (!button) throw new Error('button not found: Cancel');
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function pressStop(app: AppContext) {
  app.shortcut$.next({
    type: KeyBindingName.stop,
    event: new KeyboardEvent('keydown', { key: 'Escape' }),
  });
}

/** A layout that answers only when the test says so. */
function pendingLayout() {
  let settle = (_: ElkLayoutPoint[]) => {};
  hoisted.elkLayout = () =>
    new Promise(resolve => {
      settle = resolve;
    });
  return (points: ElkLayoutPoint[]) => settle(points);
}

/** Whether a promise has settled by the time the microtasks drain. */
async function isSettled(promise: Promise<unknown>) {
  let settled = false;
  promise.then(() => {
    settled = true;
  });
  await flush();
  return settled;
}

beforeEach(() => {
  hoisted.elkLayout = null;
  hoisted.slow.length = 0;
});

afterEach(() => {
  contexts.splice(0).forEach(app => app.store.destroy());
  toastContainer?.unmount();
  toastContainer = null;
});

describe('layoutByElk', () => {
  it('hands back the points ELK answered and takes its toast down', async () => {
    const app = createApp();
    const toasts = listenToasts(app);
    hoisted.elkLayout = async () => [{ id: 't1', x: 4, y: 8 }];

    const answer = await layoutByElk(app, REQUEST);

    expect(answer).toEqual({
      status: 'placed',
      points: [{ id: 't1', x: 4, y: 8 }],
    });
    expect(toasts).toHaveLength(1);
    await expect(toasts[0].close).resolves.toBeUndefined();
  });

  it('answers a failure with its error, the toast taken down first', async () => {
    const app = createApp();
    const toasts = listenToasts(app);
    const error = new Error('no worker');
    hoisted.elkLayout = async () => {
      throw error;
    };

    const answer = await layoutByElk(app, REQUEST);

    expect(answer).toEqual({ status: 'failed', error });
    await expect(toasts[0].close).resolves.toBeUndefined();
  });

  it('ends the wait at once on Cancel, before ELK answers', async () => {
    const app = createApp();
    const toasts = listenToasts(app);
    const settle = pendingLayout();

    const running = layoutByElk(app, REQUEST);
    await flush();
    await clickCancel(toasts[0]);

    await expect(running).resolves.toEqual({ status: 'cancelled' });
    await expect(toasts[0].close).resolves.toBeUndefined();
    settle([{ id: 't1', x: 0, y: 0 }]);
    await expect(running).resolves.toEqual({ status: 'cancelled' });
  });

  it('takes the stop key as Cancel while the toast is up', async () => {
    const app = createApp();
    pendingLayout();

    const running = layoutByElk(app, REQUEST);
    await flush();
    pressStop(app);

    await expect(running).resolves.toEqual({ status: 'cancelled' });
  });

  it('raises no toast for a placement left to say so once it is slow', async () => {
    const app = createApp();
    const toasts = listenToasts(app);
    hoisted.elkLayout = async () => [{ id: 't1', x: 0, y: 0 }];

    const answer = await layoutByElk(app, REQUEST, { whenSlow: true });

    expect(answer.status).toBe('placed');
    expect(toasts).toEqual([]);
  });

  it('raises the toast once the layout runs long, and only then hears the stop key', async () => {
    const app = createApp();
    const toasts = listenToasts(app);
    pendingLayout();

    const running = layoutByElk(app, REQUEST, { whenSlow: true });
    await flush();
    pressStop(app);
    expect(await isSettled(running)).toBe(false);

    hoisted.slow[0]?.();
    expect(toasts).toHaveLength(1);
    pressStop(app);

    await expect(running).resolves.toEqual({ status: 'cancelled' });
    await expect(toasts[0].close).resolves.toBeUndefined();
  });

  it('asks ELK to say when it is slow only where the toast waits for that', async () => {
    const app = createApp();
    hoisted.elkLayout = async () => [];

    await layoutByElk(app, REQUEST);
    await layoutByElk(app, REQUEST, { whenSlow: true });

    expect(hoisted.slow[0]).toBeUndefined();
    expect(hoisted.slow[1]).toBeTypeOf('function');
  });

  it('raises no toast for a slow layout already given up on', async () => {
    const app = createApp();
    const toasts = listenToasts(app);
    const controller = new AbortController();
    pendingLayout();

    const running = layoutByElk(app, REQUEST, {
      whenSlow: true,
      signal: controller.signal,
    });
    await flush();
    controller.abort();
    await running;
    hoisted.slow[0]?.();

    expect(toasts).toEqual([]);
  });

  it('ends the wait when its signal aborts, the toast with it', async () => {
    const app = createApp();
    const toasts = listenToasts(app);
    const controller = new AbortController();
    pendingLayout();

    const running = layoutByElk(app, REQUEST, { signal: controller.signal });
    await flush();
    controller.abort();

    await expect(running).resolves.toEqual({ status: 'cancelled' });
    await expect(toasts[0].close).resolves.toBeUndefined();
  });

  it('starts nothing for a signal that has already aborted', async () => {
    const app = createApp();
    const toasts = listenToasts(app);
    const controller = new AbortController();
    controller.abort();
    hoisted.elkLayout = async () => [];

    const answer = await layoutByElk(app, REQUEST, {
      signal: controller.signal,
    });

    expect(answer).toEqual({ status: 'cancelled' });
    expect(hoisted.slow).toEqual([]);
    expect(toasts).toEqual([]);
  });
});
