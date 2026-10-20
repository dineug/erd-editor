import { toJson } from '@dineug/erd-editor-schema';
import { createRef, html, render } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestI18n,
  flush,
  mount,
  mountAndFlush,
  Mounted,
  movePointer,
  provideI18n,
  pseudoMessages,
  releasePointer,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import DiffViewer from '@/components/erd/diff-viewer/DiffViewer';
import * as styles from '@/components/erd/diff-viewer/DiffViewer.styles';
import { EXPLORER_WIDTH } from '@/constants/layout';
import { NameViewMode } from '@/constants/schema';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { toNameViewModeAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableLogicalNameAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

const highlight = vi.hoisted(() => ({ dropped: [] as string[] }));

vi.mock('@/components/erd/relationshipHighlight', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('@/components/erd/relationshipHighlight')
    >();
  return {
    ...actual,
    dropRelationshipHighlight: (editorId: string) => {
      highlight.dropped.push(editorId);
      actual.dropRelationshipHighlight(editorId);
    },
  };
});

const contexts = vi.hoisted(() => ({ created: [] as unknown[] }));

vi.mock('@/components/appContext', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/components/appContext')>();
  return {
    ...actual,
    createAppContext: (...args: Parameters<typeof actual.createAppContext>) => {
      const app = actual.createAppContext(...args);
      contexts.created.push(app);
      return app;
    },
  };
});

type TableSeed = {
  id: string;
  name: string;
  logicalName?: string;
  columns?: string[];
};

let mounted: Mounted | null = null;
let toastMounted: Mounted | null = null;

afterEach(() => {
  toastMounted?.unmount();
  toastMounted = null;
  mounted?.unmount();
  mounted = null;
});

function seed(app: AppContext, tables: TableSeed[]) {
  tables.forEach((table, index) => {
    app.store.dispatchSync(
      addTableAction({
        id: table.id,
        ui: { x: index * 100, y: 0, zIndex: 1 },
      })
    );
    app.store.dispatchSync(
      changeTableNameAction({ id: table.id, value: table.name }),
      changeTableLogicalNameAction({
        id: table.id,
        value: table.logicalName ?? '',
      })
    );
    (table.columns ?? []).forEach((name, columnIndex) => {
      const id = `${table.id}-c${columnIndex}`;
      app.store.dispatchSync(addColumnAction({ tableId: table.id, id }));
      app.store.dispatchSync(
        changeColumnNameAction({ tableId: table.id, id, value: name })
      );
    });
  });
}

function createOriginApp(tables: TableSeed[]): AppContext {
  const app = createTestAppContext();
  app.store.dispatchSync(changeViewportAction({ width: 1000, height: 800 }));
  seed(app, tables);
  return app;
}

function initialValueOf(tables: TableSeed[]): string {
  const app = createTestAppContext();
  seed(app, tables);
  return toJson(app.store.state);
}

async function mountDiffViewer({
  origin = [{ id: 'n1', name: 'users' }] as TableSeed[],
  initial = [{ id: 'p1', name: 'users' }] as TableSeed[],
  onClose = vi.fn(),
  nameViewMode = NameViewMode.physical as (typeof NameViewMode)[keyof typeof NameViewMode],
} = {}) {
  const originApp = createOriginApp(origin);
  originApp.store.dispatchSync(
    toNameViewModeAction(originApp.store.state, nameViewMode, false)
  );
  const appRef = createRef<AppContext>(originApp);

  mounted = await mountAndFlush(
    html`<${DiffViewer}
      app=${appRef}
      initialValue=${initialValueOf(initial)}
      .onClose=${onClose}
    />`
  );

  return { originApp, onClose };
}

/** The two panes' apps, the last two the viewer created. */
const paneWidths = () =>
  (contexts.created.slice(-2) as AppContext[]).map(
    app => app.store.state.editor.viewport.width
  );

const rootOf = () =>
  mounted!.container.querySelector<HTMLElement>(`.${String(styles.root)}`)!;
const viewportsOf = () =>
  Array.from(
    mounted!.container.querySelectorAll<HTMLElement>(
      `.${String(styles.viewport)}`
    )
  );

describe('DiffViewer', () => {
  it('renders the tree and the two side by side diff viewports', async () => {
    await mountDiffViewer();

    const root = rootOf();
    expect(root).toBeTruthy();
    expect(root.querySelector(`.${String(styles.container)}`)).toBeTruthy();
    expect(root.querySelector('.diff-viewer-tree')).toBeTruthy();

    const viewports = viewportsOf();
    expect(viewports).toHaveLength(2);
    expect(viewports[0].querySelector('.diff-viewer-delete')).toBeTruthy();
    expect(viewports[1].querySelector('.diff-viewer-insert')).toBeTruthy();
  });

  it('opens the tree at the Explorer width and splits what is left between the two panes', async () => {
    await mountDiffViewer();

    const tree =
      mounted!.container.querySelector<HTMLElement>('.diff-viewer-tree')!;
    expect(tree.style.width).toBe(`${EXPLORER_WIDTH}px`);
    // Each pane takes half of the 1000 the origin spans less the tree and a border.
    expect(paneWidths()).toEqual([369, 369]);
    const viewports = viewportsOf();
    // both children were seeded through changeViewportAction on mount
    viewports.forEach(viewport => {
      expect(viewport.querySelector('.minimap')).toBeTruthy();
    });
  });

  it('sizes the tree from its edge between 200 and 480, and gives back 260 on a double press (AC-D12)', async () => {
    await mountDiffViewer();
    const tree = () =>
      mounted!.container.querySelector<HTMLElement>('.diff-viewer-tree')!;
    const sash = () => tree().querySelector<HTMLElement>('.sash')!;
    const drag = async (to: number) => {
      sash().dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 10 })
      );
      movePointer(to, 10);
      releasePointer(to, 10);
      await flush();
    };

    await drag(900);
    expect(tree().style.width).toBe('480px');
    // Past the end again, the width it holds already moves nothing.
    await drag(950);
    expect(tree().style.width).toBe('480px');
    await drag(50);
    expect(tree().style.width).toBe('200px');
    await drag(320);
    expect(tree().style.width).toBe('320px');
    expect(paneWidths()).toEqual([339, 339]);

    sash().dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await flush();
    expect(tree().style.width).toBe(`${EXPLORER_WIDTH}px`);
    expect(paneWidths()).toEqual([369, 369]);
  });

  it('lists a table from elsewhere of another name as one removed and one added', async () => {
    await mountDiffViewer({
      origin: [{ id: 'n1', name: 'members' }],
      initial: [{ id: 'p1', name: 'users' }],
    });

    const labels = Array.from(
      mounted!.container.querySelectorAll<HTMLElement>('[role="treeitem"]')
    ).map(row => {
      const copy = row.cloneNode(true) as HTMLElement;
      copy
        .querySelectorAll('.diff-tree-status-text')
        .forEach(node => node.remove());
      return copy.textContent?.trim();
    });

    expect(labels).toEqual(['Tables2~', 'membersA', 'usersD']);
  });

  it("opens both panes in the reader's name view, which neither file holds, and names the tree by it", async () => {
    const { originApp } = await mountDiffViewer({
      origin: [{ id: 'n1', name: 'members', logicalName: 'Members' }],
      initial: [{ id: 'p1', name: 'users', logicalName: 'Users' }],
      nameViewMode: NameViewMode.logical,
    });
    expect(originApp.store.state.settings.lockSettings).toBe(63);

    const labels = Array.from(
      mounted!.container.querySelectorAll<HTMLElement>('[role="treeitem"]')
    ).map(row => {
      const copy = row.cloneNode(true) as HTMLElement;
      copy
        .querySelectorAll('.diff-tree-status-text')
        .forEach(node => node.remove());
      return copy.textContent?.trim();
    });

    expect(
      (contexts.created.slice(-2) as AppContext[]).map(
        app => app.store.state.settings.nameViewMode
      )
    ).toEqual([NameViewMode.logical, NameViewMode.logical]);
    expect(labels).toEqual(['Tables2~', 'MembersA', 'UsersD']);
  });

  it('puts out the lights of both panes as it goes, kept by editor ids no teardown of its own reaches (AC-D19)', async () => {
    const { originApp } = await mountDiffViewer();
    highlight.dropped = [];

    mounted!.unmount();
    mounted = null;

    expect(highlight.dropped).toHaveLength(2);
    expect(new Set(highlight.dropped).size).toBe(2);
    expect(highlight.dropped).not.toContain(originApp.store.state.editor.id);
  });

  it('emits an open toast on the origin app carrying a close action', async () => {
    const originApp = createOriginApp([{ id: 'n1', name: 'users' }]);
    const appRef = createRef<AppContext>(originApp);
    const onClose = vi.fn();
    const actions: any[] = [];
    originApp.emitter.on({ openToast: action => actions.push(action) });

    mounted = await mountAndFlush(
      html`<${DiffViewer}
        app=${appRef}
        initialValue=${initialValueOf([{ id: 'p1', name: 'users' }])}
        .onClose=${onClose}
      />`
    );

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('openToast');
    expect(actions[0].payload.close).toBeInstanceOf(Promise);

    toastMounted = mount(actions[0].payload.message);
    await flush();

    expect(toastMounted.container.textContent).toContain('Diff Viewer');

    const closeButton =
      toastMounted.container.querySelector<HTMLButtonElement>('button')!;
    expect(closeButton).toBeTruthy();
    expect(closeButton.textContent?.trim()).toBe('Close');

    let closed = false;
    actions[0].payload.close.then(() => {
      closed = true;
    });

    closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(closed).toBe(true);
  });

  it('closes when the stop shortcut fires on the origin app', async () => {
    const { originApp, onClose } = await mountDiffViewer();

    originApp.shortcut$.next({
      type: KeyBindingName.stop,
      event: new KeyboardEvent('keydown', { key: 'Escape' }),
    });
    await flush();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores shortcuts other than stop', async () => {
    const { originApp, onClose } = await mountDiffViewer();

    originApp.shortcut$.next({
      type: KeyBindingName.zoomIn,
      event: new KeyboardEvent('keydown', { key: '+' }),
    });
    await flush();

    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not react to shortcuts after unmount', async () => {
    const { originApp, onClose } = await mountDiffViewer();

    mounted!.unmount();
    mounted = null;

    originApp.shortcut$.next({
      type: KeyBindingName.stop,
      event: new KeyboardEvent('keydown', { key: 'Escape' }),
    });
    await flush();

    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps rendering both panes after the origin viewport resizes', async () => {
    const { originApp } = await mountDiffViewer();

    originApp.store.dispatchSync(
      changeViewportAction({ width: 1600, height: 900 })
    );
    await flush();

    const viewports = viewportsOf();
    expect(viewports).toHaveLength(2);
    expect(viewports[0].querySelector('.diff-viewer-delete')).toBeTruthy();
    expect(viewports[1].querySelector('.diff-viewer-insert')).toBeTruthy();
  });

  it('says there are no changes when the two documents match', async () => {
    await mountDiffViewer({
      origin: [{ id: 'n1', name: 'users', columns: ['id'] }],
      initial: [{ id: 'p1', name: 'users', columns: ['id'] }],
    });

    expect(
      mounted!.container.querySelector('.diff-tree-empty')?.textContent?.trim()
    ).toBe('No changes');
    expect(
      mounted!.container.querySelectorAll('[role="treeitem"]')
    ).toHaveLength(0);
    expect(viewportsOf()).toHaveLength(2);
  });

  it('tears the two replica apps down on unmount without throwing', async () => {
    await mountDiffViewer();

    const root = rootOf();
    expect(() => mounted!.unmount()).not.toThrow();
    mounted = null;

    expect(root.isConnected).toBe(false);
  });

  it('says it is open, and offers Close, in the language the editor shows', async () => {
    const originApp = createOriginApp([{ id: 'n1', name: 'users' }]);
    const actions: any[] = [];
    originApp.emitter.on({ openToast: action => actions.push(action) });
    mounted = await mountAndFlush(
      html`<${DiffViewer}
        app=${createRef<AppContext>(originApp)}
        initialValue=${initialValueOf([{ id: 'p1', name: 'users' }])}
        .onClose=${vi.fn()}
      />`
    );

    const container = document.createElement('div');
    document.body.append(container);
    const provider = provideI18n(
      container,
      createTestI18n('tr-TR', pseudoMessages('tr'))
    );
    render(container, actions[0].payload.message);
    await flush();

    expect(container.textContent).toContain('tr:Diff Viewer');
    expect(container.querySelector('button')?.textContent?.trim()).toBe(
      'tr:Close'
    );

    render(container, null);
    provider.destroy();
    container.remove();
  });

  it('keeps both documents and the tree left to right whatever the editor reads in', async () => {
    await mountDiffViewer();

    expect(rootOf().getAttribute('dir')).toBe('ltr');
  });
});
