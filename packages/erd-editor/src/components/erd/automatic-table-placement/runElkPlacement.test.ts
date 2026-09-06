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
import { runElkPlacement } from '@/components/erd/automatic-table-placement/runElkPlacement';
import { Open } from '@/constants/open';
import { TablePlacement } from '@/constants/tablePlacement';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import type { ElkLayoutPoint } from '@/services/elk-layout';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

type Layout = (request: any) => Promise<ElkLayoutPoint[]>;

const hoisted = vi.hoisted(() => ({
  elkLayout: null as Layout | null,
  requests: [] as any[],
}));

/**
 * ELK answers from a shared worker, which this environment runs none of, so
 * the one call across that boundary is the one the test stands in for.
 */
vi.mock('@/services/elk-layout', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/elk-layout')>();

  return {
    ...actual,
    createElkLayout: (request: any) => {
      hoisted.requests.push(request);
      return hoisted.elkLayout
        ? hoisted.elkLayout(request)
        : Promise.reject(new Error('no layout'));
    },
  };
});

type Toast = { message: DOMTemplateLiterals; close?: Promise<void> };

let toastContainer: Mounted | null = null;
const contexts: AppContext[] = [];

function createApp(): AppContext {
  const app = createTestAppContext();
  contexts.push(app);
  return app;
}

function addTable(app: AppContext, id: string, x = 10, y = 20) {
  app.store.dispatchSync(
    addTableAction({ id, ui: { x, y, zIndex: 2 } }),
    changeTableNameAction({ id, value: id })
  );
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

async function renderToast(toast: Toast) {
  toastContainer = mount(html`${toast.message}`);
  await flush();
  return toastContainer.container;
}

function clickButton(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    el => el.textContent?.trim() === text
  );
  if (!button) throw new Error(`button not found: ${text}`);
  button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

beforeEach(() => {
  hoisted.elkLayout = null;
  hoisted.requests.length = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  contexts.splice(0).forEach(app => app.store.destroy());
  toastContainer?.unmount();
  toastContainer = null;
});

describe('runElkPlacement', () => {
  it('asks for the placement it was given, and for every table', async () => {
    const app = createApp();
    addTable(app, 't1');
    addTable(app, 't2');
    hoisted.elkLayout = async () => [];

    await runElkPlacement(app, TablePlacement.flow, vi.fn());

    expect(hoisted.requests).toHaveLength(1);
    expect(hoisted.requests[0].placement).toBe(TablePlacement.flow);
    expect(hoisted.requests[0].nodes.map((node: any) => node.id)).toEqual([
      't1',
      't2',
    ]);
  });

  it('hands the placed positions over without asking anyone first', async () => {
    const app = createApp();
    addTable(app, 't1');
    addTable(app, 't2');
    const onChange = vi.fn();
    hoisted.elkLayout = async () => [
      { id: 't1', x: 0, y: 0 },
      { id: 't2', x: 600, y: 0 },
    ];

    await runElkPlacement(app, TablePlacement.layeredHorizontal, onChange);

    expect(onChange).toHaveBeenCalledTimes(1);
    const [first, second] = onChange.mock.calls[0][0];
    expect(second.x - first.x).toBe(600);
  });

  // The preview overlay is the simulation's, and opening it here is what put a
  // pointless zoom out between the click and the layout.
  it('opens no preview overlay', async () => {
    const app = createApp();
    addTable(app, 't1');
    hoisted.elkLayout = async () => [{ id: 't1', x: 0, y: 0 }];

    await runElkPlacement(app, TablePlacement.flow, vi.fn());
    await flush();

    expect(
      app.store.state.editor.openMap[Open.automaticTablePlacement]
    ).toBeFalsy();
  });

  it('offers only Cancel while ELK is still working', async () => {
    const app = createApp();
    addTable(app, 't1');
    const toasts = listenToasts(app);
    hoisted.elkLayout = () => new Promise(() => {});

    runElkPlacement(app, TablePlacement.flow, vi.fn());
    await flush();

    const container = await renderToast(toasts[0]);
    expect(container.textContent).toContain('Placing tables…');
    expect(
      Array.from(container.querySelectorAll('button')).map(el =>
        el.textContent?.trim()
      )
    ).toEqual(['Cancel']);
  });

  it('takes the toast down once the layout has landed', async () => {
    const app = createApp();
    addTable(app, 't1');
    const toasts = listenToasts(app);
    hoisted.elkLayout = async () => [{ id: 't1', x: 0, y: 0 }];

    await runElkPlacement(app, TablePlacement.flow, vi.fn());

    await expect(toasts[0].close).resolves.toBeUndefined();
  });

  it('drops a layout that lands after Cancel was pressed', async () => {
    const app = createApp();
    addTable(app, 't1');
    const toasts = listenToasts(app);
    const onChange = vi.fn();
    let settle = (_: ElkLayoutPoint[]) => {};
    hoisted.elkLayout = () =>
      new Promise(resolve => {
        settle = resolve;
      });

    const running = runElkPlacement(app, TablePlacement.flow, onChange);
    await flush();
    clickButton(await renderToast(toasts[0]), 'Cancel');
    settle([{ id: 't1', x: 4_000, y: 4_000 }]);
    await running;

    expect(onChange).not.toHaveBeenCalled();
  });

  it('drops a layout that lands after the stop key binding', async () => {
    const app = createApp();
    addTable(app, 't1');
    const onChange = vi.fn();
    let settle = (_: ElkLayoutPoint[]) => {};
    hoisted.elkLayout = () =>
      new Promise(resolve => {
        settle = resolve;
      });

    const running = runElkPlacement(app, TablePlacement.flow, onChange);
    await flush();
    app.shortcut$.next({
      type: KeyBindingName.stop,
      event: new KeyboardEvent('keydown', { key: 'Escape' }),
    });
    settle([{ id: 't1', x: 4_000, y: 4_000 }]);
    await running;

    expect(onChange).not.toHaveBeenCalled();
  });

  it('says so, and places nothing, when no layout comes back', async () => {
    const app = createApp();
    addTable(app, 't1');
    const toasts = listenToasts(app);
    const onChange = vi.fn();
    hoisted.elkLayout = async () => {
      throw new Error('no worker');
    };

    await runElkPlacement(app, TablePlacement.flow, onChange);

    expect(onChange).not.toHaveBeenCalled();
    const container = await renderToast(toasts[toasts.length - 1]);
    expect(container.textContent).toContain('Could not place tables');
  });

  it('asks ELK nothing about a document with no tables', async () => {
    const app = createApp();
    const toasts = listenToasts(app);
    const onChange = vi.fn();

    await runElkPlacement(app, TablePlacement.flow, onChange);

    expect(hoisted.requests).toEqual([]);
    expect(onChange).not.toHaveBeenCalled();
    const container = await renderToast(toasts[0]);
    expect(container.textContent).toContain('No tables to place');
  });
});
