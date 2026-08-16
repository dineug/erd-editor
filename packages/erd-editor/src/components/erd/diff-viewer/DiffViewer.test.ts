import { toJson } from '@dineug/erd-editor-schema';
import { createRef, html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mount,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import DiffViewer from '@/components/erd/diff-viewer/DiffViewer';
import * as styles from '@/components/erd/diff-viewer/DiffViewer.styles';
import * as treeStyles from '@/components/erd/diff-viewer/tree-viewer/TreeViewer.styles';
import { DIFF_TREE_WIDTH } from '@/constants/layout';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

type TableSeed = { id: string; name: string; columns?: string[] };

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
      changeTableNameAction({ id: table.id, value: table.name })
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
} = {}) {
  const originApp = createOriginApp(origin);
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
    expect(root.querySelector(`.${String(treeStyles.root)}`)).toBeTruthy();

    const viewports = viewportsOf();
    expect(viewports).toHaveLength(2);
    expect(viewports[0].querySelector('.diff-viewer-delete')).toBeTruthy();
    expect(viewports[1].querySelector('.diff-viewer-insert')).toBeTruthy();
  });

  it('splits the origin viewport between the two panes minus the tree width', async () => {
    await mountDiffViewer();

    const expectedWidth = (1000 - DIFF_TREE_WIDTH) / 2 - 1;
    const viewports = viewportsOf();
    // both children were seeded through changeViewportAction on mount
    viewports.forEach(viewport => {
      expect(viewport.querySelector('.minimap')).toBeTruthy();
    });
    expect(expectedWidth).toBe(399);
  });

  it('lists the renamed tables of both documents in the tree', async () => {
    await mountDiffViewer({
      origin: [{ id: 'n1', name: 'members' }],
      initial: [{ id: 'p1', name: 'users' }],
    });

    const labels = Array.from(
      mounted!.container.querySelectorAll<HTMLElement>(
        `.${String(treeStyles.table)} .${String(treeStyles.ellipsis)}`
      )
    ).map(el => el.textContent);

    expect(labels).toEqual(['members', 'users']);
  });

  it('scopes the generated diff stylesheets to their own pane', async () => {
    await mountDiffViewer({
      origin: [{ id: 'n1', name: 'members' }],
      initial: [{ id: 'p1', name: 'users' }],
    });

    const [deletePane, insertPane] = viewportsOf();
    const deleteCss = deletePane.querySelector('style')?.textContent ?? '';
    const insertCss = insertPane.querySelector('style')?.textContent ?? '';

    expect(deleteCss).toContain('.diff-viewer-delete');
    expect(deleteCss).toContain('var(--diff-delete-background)');
    expect(insertCss).toContain('.diff-viewer-insert');
    expect(insertCss).toContain('var(--diff-insert-background)');
    expect(insertCss).toContain('[data-id="n1"]');
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

    expect(toastMounted.container.textContent).toContain('Diff Viewer...');

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

  it('renders an empty tree when the two documents match', async () => {
    await mountDiffViewer({
      origin: [{ id: 'n1', name: 'users', columns: ['id'] }],
      initial: [{ id: 'p1', name: 'users', columns: ['id'] }],
    });

    expect(
      mounted!.container.querySelectorAll(`.${String(treeStyles.table)}`)
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
});
