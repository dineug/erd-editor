import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mount,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import Table from '@/components/erd/canvas/table/Table';
import * as styles from '@/components/erd/canvas/table/Table.styles';
import { Show } from '@/constants/schema';
import {
  dragendColumnAction,
  focusColumnAction,
  focusTableAction,
  focusTableEndAction,
  sharedFocusTrackerAction,
  sharedSelectionTrackerAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import { dragstartColumnAction$ } from '@/engine/modules/editor/generator.actions';
import {
  FocusType,
  SelectType,
  SharedFocus,
} from '@/engine/modules/editor/state';
import {
  changeMaxWidthCommentAction,
  changeShowAction,
} from '@/engine/modules/settings/atom.actions';
import {
  changeTableColorAction,
  changeTableCommentAction,
} from '@/engine/modules/table/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import { addColumnAction$ } from '@/engine/modules/table-column/generator.actions';
import { Tag } from '@/engine/tag';
import { Table as TableEntity } from '@/internal-types';
import { simpleShortcutToString } from '@/utils/keyboard-shortcut';
import { toSharedColor } from '@/utils/sharedColor';

let mounted: Mounted | null = null;

afterEach(() => {
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  mounted?.unmount();
  mounted = null;
});

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type Fixture = {
  app: AppContext;
  table: TableEntity;
  container: HTMLElement;
  root: HTMLElement;
  headerIcons: HTMLElement[];
  columnRows: () => HTMLElement[];
};

type SetupOptions = {
  columns?: number;
  prepare?: (app: AppContext) => void;
};

async function setup({ columns = 0, prepare }: SetupOptions = {}) {
  const app = createTestAppContext();
  const { store } = app;

  prepare?.(app);
  store.dispatchSync(addTableAction$());
  const tableId = store.state.doc.tableIds[0];
  const table = store.state.collections.tableEntities[tableId];

  for (let i = 0; i < columns; i++) {
    store.dispatchSync(addColumnAction$(tableId));
  }

  mounted = mount(html`<${Table} table=${table} />`, app);
  await flush();

  const container = mounted.container;
  const root = container.querySelector<HTMLElement>('.table')!;

  const fixture: Fixture = {
    app,
    table,
    container,
    root,
    headerIcons: Array.from(
      container
        .querySelector(`.${String(styles.headerButtonWrap)}`)!
        .querySelectorAll<HTMLElement>('.icon')
    ),
    columnRows: () =>
      Array.from(container.querySelectorAll<HTMLElement>('.column-row')),
  };

  return fixture;
}

const click = (el: HTMLElement, init: MouseEventInit = {}) =>
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, ...init }));

const mousedown = (el: HTMLElement) =>
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

const dblclick = (el: HTMLElement) =>
  el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

const dragEvent = (el: HTMLElement, type: string, init: MouseEventInit = {}) =>
  el.dispatchEvent(
    new MouseEvent(type, { bubbles: true, cancelable: true, ...init })
  );

describe('Table', () => {
  it('renders the positioned shell with the table id and the root class', async () => {
    const { root, table } = await setup();

    expect(root.classList.contains('table')).toBe(true);
    expect(root.classList.contains(String(styles.root))).toBe(true);
    expect(root.dataset.id).toBe(table.id);
    expect(root.style.top).toBe(`${table.ui.y}px`);
    expect(root.style.left).toBe(`${table.ui.x}px`);
    expect(root.style.zIndex).toBe(`${table.ui.zIndex}`);
  });

  it('sizes the shell from the calculated table width and height', async () => {
    const { root } = await setup();

    expect(root.style.width).toBe('365px');
    expect(root.style.height).toBe('56px');
  });

  it('grows the shell height by one column row per column', async () => {
    const { root } = await setup({ columns: 2 });

    expect(root.style.height).toBe(`${56 + 2 * 24}px`);
  });

  it('marks the shell as selected while the table is in the selected map', async () => {
    const { app, root } = await setup();

    expect(root.hasAttribute('data-selected')).toBe(true);
    expect(root.hasAttribute('data-focus-border')).toBe(true);

    app.store.dispatchSync(unselectAllAction());
    await flush();

    expect(root.hasAttribute('data-selected')).toBe(false);
    expect(root.hasAttribute('data-focus-border')).toBe(false);
  });

  it('paints the header color bar from the table ui color', async () => {
    const { app, table, container } = await setup();

    app.store.dispatchSync(
      changeTableColorAction({
        id: table.id,
        color: '#ff0000',
        prevColor: table.ui.color,
      })
    );
    await flush();

    const bar = container.querySelector<HTMLElement>('.table-header-color')!;
    expect(bar.classList.contains(String(styles.headerColor))).toBe(true);
    expect(bar.style.backgroundColor).toBe('#ff0000');
  });

  it('emits openColorPicker with the pointer position and the current color', async () => {
    const { app, container } = await setup();

    const payloads: any[] = [];
    app.emitter.on({
      openColorPicker: action => payloads.push(action.payload),
    });

    click(container.querySelector<HTMLElement>('.table-header-color')!, {
      clientX: 42,
      clientY: 84,
    });

    expect(payloads).toEqual([{ x: 42, y: 84, color: '' }]);
  });

  it('titles the header buttons with their keyboard shortcuts', async () => {
    const { app, headerIcons } = await setup();

    expect(headerIcons).toHaveLength(2);
    expect(headerIcons[0].getAttribute('title')).toBe(
      simpleShortcutToString(app.keyBindingMap.addColumn[0]?.shortcut)
    );
    expect(headerIcons[1].getAttribute('title')).toBe(
      simpleShortcutToString(app.keyBindingMap.removeTable[0]?.shortcut)
    );
  });

  it('adds a column when the plus button is clicked', async () => {
    const { app, table, headerIcons, columnRows } = await setup();

    expect(columnRows()).toHaveLength(0);

    click(headerIcons[0]);
    await flush();

    expect(table.columnIds).toHaveLength(1);
    expect(columnRows()).toHaveLength(1);
    expect(columnRows()[0].dataset.tableId).toBe(table.id);
    expect(
      app.store.state.collections.tableColumnEntities[table.columnIds[0]]
    ).toBeTruthy();
  });

  it('removes the table when the xmark button is clicked', async () => {
    const { app, table, headerIcons } = await setup();

    click(headerIcons[1]);
    await flush();

    expect(app.store.state.doc.tableIds).not.toContain(table.id);
  });

  it('renders the table name and comment editors side by side', async () => {
    const { container } = await setup();

    const wrap = container.querySelector(`.${String(styles.headerInputWrap)}`)!;
    const paddings = Array.from(
      wrap.querySelectorAll<HTMLElement>('.input-padding')
    );

    expect(paddings.map(el => el.dataset.type)).toEqual([
      'tableName',
      'tableComment',
    ]);
  });

  it('hides the comment editor when Show.tableComment is off', async () => {
    const { container } = await setup({
      prepare: app => {
        app.store.dispatchSync(
          changeShowAction({ show: Show.tableComment, value: false })
        );
      },
    });

    expect(container.querySelector('[data-type="tableComment"]')).toBeNull();
    expect(container.querySelector('[data-type="tableName"]')).toBeTruthy();
  });

  it.each([
    [-1, 120],
    [100, 100],
    [200, 120],
  ])(
    'clamps the comment editor width with maxWidthComment %i',
    async (maxWidthComment, expected) => {
      const { app, table, container } = await setup({
        prepare: app => {
          app.store.dispatchSync(
            changeMaxWidthCommentAction({ value: maxWidthComment })
          );
        },
      });

      app.store.dispatchSync(
        changeTableCommentAction({ id: table.id, value: 'abcdefghijkl' })
      );
      await flush();

      const comment = container.querySelector<HTMLElement>(
        '[data-type="tableComment"] .edit-input'
      )!;
      expect(table.ui.widthComment).toBe(120);
      expect(comment.style.width).toBe(`${expected}px`);
    }
  );

  it('focuses the table name on mousedown and edits it on dblclick', async () => {
    const { app, table, container } = await setup();

    const namePadding = container.querySelector<HTMLElement>(
      '[data-type="tableName"]'
    )!;

    mousedown(namePadding);
    await flush();

    expect(app.store.state.editor.focusTable).toMatchObject({
      tableId: table.id,
      focusType: FocusType.tableName,
      edit: false,
    });

    dblclick(namePadding);
    await flush();

    expect(app.store.state.editor.focusTable?.edit).toBe(true);
    expect(
      container.querySelector('[data-type="tableName"] input.edit-input')
    ).toBeTruthy();
  });

  it('writes the typed table name back into the store', async () => {
    const { app, table, container } = await setup();

    const namePadding = container.querySelector<HTMLElement>(
      '[data-type="tableName"]'
    )!;
    mousedown(namePadding);
    dblclick(namePadding);
    await flush();

    const input = container.querySelector<HTMLInputElement>(
      '[data-type="tableName"] input.edit-input'
    )!;
    input.value = 'users';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await flush();

    expect(table.name).toBe('users');
    // toWidth("users") is 50 which textInRange clamps up to COLUMN_MIN_WIDTH
    expect(table.ui.widthName).toBe(60);
    expect(app.store.state.editor.focusTable?.tableId).toBe(table.id);
  });

  it('writes the typed table comment back into the store', async () => {
    const { app, table, container } = await setup();

    const commentPadding = container.querySelector<HTMLElement>(
      '[data-type="tableComment"]'
    )!;
    mousedown(commentPadding);
    await flush();
    expect(app.store.state.editor.focusTable?.focusType).toBe(
      FocusType.tableComment
    );

    dblclick(commentPadding);
    await flush();

    const input = container.querySelector<HTMLInputElement>(
      '[data-type="tableComment"] input.edit-input'
    )!;
    input.value = 'people table';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await flush();

    expect(table.comment).toBe('people table');
  });

  it('ends the edit when the name editor blurs', async () => {
    const { app, container } = await setup();

    const namePadding = container.querySelector<HTMLElement>(
      '[data-type="tableName"]'
    )!;
    mousedown(namePadding);
    dblclick(namePadding);
    await flush();

    const input = container.querySelector<HTMLInputElement>(
      '[data-type="tableName"] input.edit-input'
    )!;
    input.dispatchEvent(new FocusEvent('blur'));
    await flush();

    expect(app.store.state.editor.focusTable?.edit).toBe(false);
  });

  it('starts a column drag from a focused column row', async () => {
    const { app, table, columnRows } = await setup({ columns: 2 });
    const [first] = columnRows();

    app.store.dispatchSync(
      focusColumnAction({
        tableId: table.id,
        columnId: table.columnIds[0],
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );
    await flush();

    dragEvent(first, 'dragstart');
    await flush();

    expect(app.store.state.editor.draggableColumn).toEqual({
      tableId: table.id,
      columnIds: [table.columnIds[0]],
    });
    expect(columnRows().every(el => el.classList.contains('none-hover'))).toBe(
      true
    );
  });

  it('drags every selected column when the modifier key is held', async () => {
    const { app, table, columnRows } = await setup({ columns: 2 });
    const columnIds = [...table.columnIds];

    app.store.dispatchSync(
      focusColumnAction({
        tableId: table.id,
        columnId: columnIds[0],
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );
    app.store.dispatchSync(
      focusColumnAction({
        tableId: table.id,
        columnId: columnIds[1],
        focusType: FocusType.columnName,
        $mod: true,
        shiftKey: false,
      })
    );
    await flush();

    dragEvent(columnRows()[1], 'dragstart', { ctrlKey: true });
    await flush();

    expect(app.store.state.editor.draggableColumn?.columnIds).toEqual(
      columnIds
    );
  });

  it('ignores a dragstart while nothing is focused', async () => {
    const { app, columnRows } = await setup({ columns: 1 });

    app.store.dispatchSync(focusTableEndAction());
    await flush();

    dragEvent(columnRows()[0], 'dragstart');
    await flush();

    expect(app.store.state.editor.draggableColumn).toBeNull();
    expect(columnRows()[0].classList.contains('none-hover')).toBe(false);
  });

  it('ignores a dragstart while only the table header is focused', async () => {
    const { app, table, columnRows } = await setup({ columns: 1 });

    app.store.dispatchSync(
      focusTableAction({ tableId: table.id, focusType: FocusType.tableName })
    );
    await flush();

    expect(app.store.state.editor.focusTable?.columnId).toBeNull();

    dragEvent(columnRows()[0], 'dragstart');
    await flush();

    expect(app.store.state.editor.draggableColumn).toBeNull();
    expect(columnRows()[0].classList.contains('none-hover')).toBe(false);
  });

  it('ignores a dragstart raised from a descendant without a column id', async () => {
    const { app, table, columnRows } = await setup({ columns: 1 });

    app.store.dispatchSync(
      focusColumnAction({
        tableId: table.id,
        columnId: table.columnIds[0],
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );
    await flush();

    const inner = columnRows()[0].querySelector<HTMLElement>('.column-col')!;
    dragEvent(inner, 'dragstart');
    await flush();

    expect(app.store.state.editor.draggableColumn).toBeNull();
  });

  it('clears the drag state and notifies every table on dragend', async () => {
    const { app, table, columnRows } = await setup({ columns: 2 });

    app.store.dispatchSync(
      focusColumnAction({
        tableId: table.id,
        columnId: table.columnIds[0],
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );
    await flush();

    let notified = 0;
    app.emitter.on({ dragendColumnAll: () => notified++ });

    dragEvent(columnRows()[0], 'dragstart');
    await flush();

    dragEvent(columnRows()[0], 'dragend');
    await flush();

    expect(notified).toBe(1);
    expect(app.store.state.editor.draggableColumn).toBeNull();
    expect(columnRows().some(el => el.classList.contains('none-hover'))).toBe(
      false
    );
  });

  it('joins an in-flight column drag when a dragenter reaches the column list', async () => {
    const { app, table, columnRows } = await setup({ columns: 2 });

    app.store.dispatchSync(
      focusColumnAction({
        tableId: table.id,
        columnId: table.columnIds[0],
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );
    app.store.dispatchSync(dragstartColumnAction$(false));
    await flush();

    expect(app.store.state.editor.draggableColumn).toBeTruthy();
    expect(columnRows()[0].classList.contains('none-hover')).toBe(false);

    dragEvent(columnRows()[1], 'dragenter');
    await flush();

    expect(columnRows().every(el => el.classList.contains('none-hover'))).toBe(
      true
    );

    // a repeated dragenter must not stack a second subscription
    dragEvent(columnRows()[1], 'dragenter');
    await flush();

    expect(columnRows().every(el => el.classList.contains('none-hover'))).toBe(
      true
    );
  });

  it('ignores a dragenter while no column drag is in flight', async () => {
    const { app, columnRows } = await setup({ columns: 2 });

    expect(app.store.state.editor.draggableColumn).toBeNull();

    dragEvent(columnRows()[1], 'dragenter');
    await flush();

    expect(columnRows().some(el => el.classList.contains('none-hover'))).toBe(
      false
    );
  });

  it('reorders the columns when one is dragged over another', async () => {
    const { app, table, columnRows } = await setup({ columns: 2 });
    const [firstId, secondId] = [...table.columnIds];

    app.store.dispatchSync(
      focusColumnAction({
        tableId: table.id,
        columnId: firstId,
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );
    await flush();

    dragEvent(columnRows()[0], 'dragstart');
    await flush();

    dragEvent(
      columnRows().find(el => el.dataset.id === secondId)!,
      'dragover'
    );
    await wait(120);
    await flush();

    expect(table.columnIds).toEqual([secondId, firstId]);
  });

  it('keeps a ghost row for a column dragged into another table', async () => {
    const app = createTestAppContext();
    const { store } = app;

    store.dispatchSync(addTableAction$());
    store.dispatchSync(addTableAction$());
    const [aId, bId] = store.state.doc.tableIds;
    const a = store.state.collections.tableEntities[aId];
    const b = store.state.collections.tableEntities[bId];
    store.dispatchSync(addColumnAction$(aId));
    store.dispatchSync(addColumnAction$(aId));
    store.dispatchSync(addColumnAction$(bId));

    const [c1, c2] = [...a.columnIds];
    const [d1] = [...b.columnIds];

    mounted = mount(
      html`
        <${Table} table=${a} />
        <${Table} table=${b} />
      `,
      app
    );
    await flush();

    const tableEls = Array.from(
      mounted.container.querySelectorAll<HTMLElement>('.table')
    );
    const rowsOf = (el: HTMLElement) =>
      Array.from(el.querySelectorAll<HTMLElement>('.column-row'));
    const aEl = tableEls.find(el => el.dataset.id === aId)!;
    const bEl = tableEls.find(el => el.dataset.id === bId)!;

    store.dispatchSync(
      focusColumnAction({
        tableId: aId,
        columnId: c1,
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );
    await flush();

    dragEvent(
      rowsOf(aEl).find(el => el.dataset.id === c1)!,
      'dragstart'
    );
    await flush();

    dragEvent(rowsOf(bEl)[0], 'dragenter');
    await flush();

    dragEvent(
      rowsOf(bEl).find(el => el.dataset.id === d1)!,
      'dragover'
    );
    await wait(120);
    await flush();

    expect(a.columnIds).toEqual([c2]);
    expect(b.columnIds).toHaveLength(2);

    const ghost = rowsOf(aEl).find(el => el.dataset.id === c1);
    expect(ghost).toBeTruthy();
    expect(ghost!.hasAttribute('data-ghost')).toBe(true);
  });

  it('ignores a dragover on one of the dragged columns', async () => {
    const { app, table, columnRows } = await setup({ columns: 2 });
    const columnIds = [...table.columnIds];

    app.store.dispatchSync(
      focusColumnAction({
        tableId: table.id,
        columnId: columnIds[0],
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );
    await flush();

    dragEvent(columnRows()[0], 'dragstart');
    await flush();

    dragEvent(columnRows()[0], 'dragover');
    await wait(120);
    await flush();

    expect(table.columnIds).toEqual(columnIds);
  });

  it('ignores a dragover once the drag state has been cleared', async () => {
    const { app, table, columnRows } = await setup({ columns: 2 });
    const columnIds = [...table.columnIds];

    app.store.dispatchSync(
      focusColumnAction({
        tableId: table.id,
        columnId: columnIds[0],
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );
    await flush();

    dragEvent(columnRows()[0], 'dragstart');
    await flush();

    app.store.dispatchSync(dragendColumnAction());

    dragEvent(
      columnRows().find(el => el.dataset.id === columnIds[1])!,
      'dragover'
    );
    await wait(120);
    await flush();

    expect(table.columnIds).toEqual(columnIds);
  });
});

describe('Table shared focus', () => {
  const apps = new Set<AppContext>();

  afterEach(() => {
    for (const app of apps) {
      for (const tracker of Object.values(
        app.store.state.editor.sharedFocusTrackerMap
      )) {
        clearTimeout(tracker.timeoutId);
      }
    }
    apps.clear();
  });

  const track = (
    app: AppContext,
    focus: SharedFocus | null,
    editorId = 'remote-1'
  ) => {
    apps.add(app);
    app.store.dispatchSync({
      ...sharedFocusTrackerAction({ focus }),
      tags: Tag.shared,
      meta: { editorId },
    });
  };

  const sharedFocusOf = (container: HTMLElement, selector: string) =>
    container
      .querySelector<HTMLElement>(selector)!
      .hasAttribute('data-shared-focus');

  const snapshotFocusTable = (app: AppContext) => {
    const { focusTable } = app.store.state.editor;
    return focusTable
      ? { ...focusTable, selectColumnIds: [...focusTable.selectColumnIds] }
      : null;
  };

  it('leaves the shell unmarked while no remote editor is focused', async () => {
    const { root, container } = await setup({ columns: 1 });

    expect(root.hasAttribute('data-shared-focus')).toBe(false);
    expect(sharedFocusOf(container, '[data-type="tableName"]')).toBe(false);
    expect(container.querySelectorAll('[data-shared-focus]')).toHaveLength(0);
  });

  it('marks the shell and the focused header cell for a remote editor', async () => {
    const { app, table, root, container } = await setup();

    track(app, {
      tableId: table.id,
      columnId: null,
      focusType: FocusType.tableName,
    });
    await flush();

    expect(root.hasAttribute('data-shared-focus')).toBe(true);
    expect(sharedFocusOf(container, '[data-type="tableName"]')).toBe(true);
    expect(sharedFocusOf(container, '[data-type="tableComment"]')).toBe(false);
  });

  it('ignores a remote focus that names another table', async () => {
    const { app, root, container } = await setup();

    track(app, {
      tableId: 'other-table',
      columnId: null,
      focusType: FocusType.tableName,
    });
    await flush();

    expect(root.hasAttribute('data-shared-focus')).toBe(false);
    expect(container.querySelectorAll('[data-shared-focus]')).toHaveLength(0);
  });

  it('marks only the column cell a remote editor is focused on', async () => {
    const { app, table, root, container } = await setup({ columns: 2 });
    const [firstId] = table.columnIds;

    track(app, {
      tableId: table.id,
      columnId: firstId,
      focusType: FocusType.columnName,
    });
    await flush();

    expect(root.hasAttribute('data-shared-focus')).toBe(true);
    expect(sharedFocusOf(container, '[data-type="tableName"]')).toBe(false);

    const marked = Array.from(
      container.querySelectorAll<HTMLElement>('.column-col[data-shared-focus]')
    );
    expect(marked).toHaveLength(1);
    expect(marked[0].dataset.type).toBe('columnName');
    expect(marked[0].closest<HTMLElement>('.column-row')!.dataset.id).toBe(
      firstId
    );
  });

  it('never moves the local focus', async () => {
    const { app, table, container } = await setup({ columns: 1 });
    const { store } = app;

    store.dispatchSync(
      focusColumnAction({
        tableId: table.id,
        columnId: table.columnIds[0],
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );
    await flush();

    const before = snapshotFocusTable(app);
    expect(before).toMatchObject({
      tableId: table.id,
      columnId: table.columnIds[0],
      focusType: FocusType.columnName,
    });

    track(app, {
      tableId: table.id,
      columnId: null,
      focusType: FocusType.tableComment,
    });
    await flush();

    expect(store.state.editor.sharedFocusTrackerMap['remote-1']).toMatchObject({
      id: 'remote-1',
      tableId: table.id,
      columnId: null,
      focusType: FocusType.tableComment,
    });
    expect(sharedFocusOf(container, '[data-type="tableComment"]')).toBe(true);
    expect(snapshotFocusTable(app)).toEqual(before);
  });

  it('clears the marker when the remote editor drops its focus', async () => {
    const { app, table, root, container } = await setup();

    track(app, {
      tableId: table.id,
      columnId: null,
      focusType: FocusType.tableName,
    });
    await flush();
    expect(root.hasAttribute('data-shared-focus')).toBe(true);

    track(app, null);
    await flush();

    expect(app.store.state.editor.sharedFocusTrackerMap).toEqual({});
    expect(root.hasAttribute('data-shared-focus')).toBe(false);
    expect(container.querySelectorAll('[data-shared-focus]')).toHaveLength(0);
  });

  it('paints the marker in the color that identifies the peer', async () => {
    const { app, table, root, container } = await setup({ columns: 1 });
    const [firstId] = table.columnIds;

    track(app, {
      tableId: table.id,
      columnId: firstId,
      focusType: FocusType.columnName,
    });
    await flush();

    const cell = container.querySelector<HTMLElement>(
      '.column-col[data-type="columnName"][data-shared-focus]'
    )!;

    expect(root.style.getPropertyValue('--shared-focus')).toBe(
      toSharedColor('remote-1')
    );
    expect(cell.style.getPropertyValue('--shared-focus')).toBe(
      toSharedColor('remote-1')
    );
  });

  it('gives two peers their own colors', async () => {
    const { app, table, root } = await setup();
    const focus = {
      tableId: table.id,
      columnId: null,
      focusType: FocusType.tableName,
    };

    track(app, focus, 'remote-1');
    await flush();
    const first = root.style.getPropertyValue('--shared-focus');

    track(app, null, 'remote-1');
    track(app, focus, 'remote-2');
    await flush();
    const second = root.style.getPropertyValue('--shared-focus');

    expect(first).toBe(toSharedColor('remote-1'));
    expect(second).toBe(toSharedColor('remote-2'));
    expect(second).not.toBe(first);
  });
});

describe('Table shared select', () => {
  const apps = new Set<AppContext>();

  afterEach(() => {
    for (const app of apps) {
      const { editor } = app.store.state;
      for (const tracker of Object.values(editor.sharedSelectionTrackerMap)) {
        clearTimeout(tracker.timeoutId);
      }
      for (const tracker of Object.values(editor.sharedFocusTrackerMap)) {
        clearTimeout(tracker.timeoutId);
      }
    }
    apps.clear();
  });

  const trackSelection = (
    app: AppContext,
    selectedIds: string[],
    editorId = 'remote-1'
  ) => {
    apps.add(app);
    app.store.dispatchSync({
      ...sharedSelectionTrackerAction({ selectedIds }),
      tags: Tag.shared,
      meta: { editorId },
    });
  };

  const trackFocus = (
    app: AppContext,
    focus: SharedFocus | null,
    editorId = 'remote-1'
  ) => {
    apps.add(app);
    app.store.dispatchSync({
      ...sharedFocusTrackerAction({ focus }),
      tags: Tag.shared,
      meta: { editorId },
    });
  };

  const snapshotSelectedMap = (app: AppContext) => ({
    ...app.store.state.editor.selectedMap,
  });

  it('leaves the shell unmarked while no peer has selected it', async () => {
    const { root } = await setup();

    expect(root.hasAttribute('data-shared-select')).toBe(false);
    expect(root.style.getPropertyValue('--shared-select')).toBe('');
  });

  it('marks the shell in the peer color once a peer selects the table', async () => {
    const { app, table, root } = await setup();

    trackSelection(app, [table.id]);
    await flush();

    expect(
      app.store.state.editor.sharedSelectionTrackerMap['remote-1']
    ).toMatchObject({ id: 'remote-1', selectedIds: [table.id] });
    expect(root.hasAttribute('data-shared-select')).toBe(true);
    expect(root.style.getPropertyValue('--shared-select')).toBe(
      toSharedColor('remote-1')
    );
  });

  it('leaves the shell unmarked while the peer selects another entity', async () => {
    const { app, root } = await setup();

    trackSelection(app, ['other-table']);
    await flush();

    expect(root.hasAttribute('data-shared-select')).toBe(false);
    expect(root.style.getPropertyValue('--shared-select')).toBe('');
  });

  it('marks the shell when the peer selection holds several ids', async () => {
    const { app, table, root } = await setup();

    trackSelection(app, ['memo-1', 'other-table', table.id]);
    await flush();

    expect(root.hasAttribute('data-shared-select')).toBe(true);
    expect(root.style.getPropertyValue('--shared-select')).toBe(
      toSharedColor('remote-1')
    );
  });

  it('follows a peer that widens its selection onto this table', async () => {
    const { app, table, root } = await setup();

    trackSelection(app, ['other-table']);
    await flush();
    expect(root.hasAttribute('data-shared-select')).toBe(false);

    trackSelection(app, ['other-table', table.id]);
    await flush();

    expect(root.hasAttribute('data-shared-select')).toBe(true);
  });

  it('clears the marker when the peer selection empties', async () => {
    const { app, table, root } = await setup();

    trackSelection(app, [table.id]);
    await flush();
    expect(root.hasAttribute('data-shared-select')).toBe(true);

    trackSelection(app, []);
    await flush();

    expect(app.store.state.editor.sharedSelectionTrackerMap).toEqual({});
    expect(root.hasAttribute('data-shared-select')).toBe(false);
    expect(root.style.getPropertyValue('--shared-select')).toBe('');
  });

  it('gives two peers their own colors', async () => {
    const { app, table, root } = await setup();

    trackSelection(app, [table.id], 'remote-1');
    await flush();
    const first = root.style.getPropertyValue('--shared-select');

    trackSelection(app, [], 'remote-1');
    trackSelection(app, [table.id], 'remote-2');
    await flush();
    const second = root.style.getPropertyValue('--shared-select');

    expect(first).toBe(toSharedColor('remote-1'));
    expect(second).toBe(toSharedColor('remote-2'));
    expect(second).not.toBe(first);
  });

  it('never writes a peer selection into the local selection map', async () => {
    const { app, table } = await setup();

    const before = snapshotSelectedMap(app);
    expect(before).toEqual({ [table.id]: SelectType.table });

    trackSelection(app, [table.id, 'ghost-table']);
    await flush();

    expect(snapshotSelectedMap(app)).toEqual(before);
  });

  it('carries a local selection, a peer selection and a peer focus at once', async () => {
    const { app, table, root } = await setup();

    trackSelection(app, [table.id], 'remote-1');
    trackFocus(
      app,
      { tableId: table.id, columnId: null, focusType: FocusType.tableName },
      'remote-2'
    );
    await flush();

    expect(root.hasAttribute('data-selected')).toBe(true);
    expect(root.hasAttribute('data-shared-select')).toBe(true);
    expect(root.hasAttribute('data-shared-focus')).toBe(true);
    expect(root.style.getPropertyValue('--shared-select')).toBe(
      toSharedColor('remote-1')
    );
    expect(root.style.getPropertyValue('--shared-focus')).toBe(
      toSharedColor('remote-2')
    );
    expect(toSharedColor('remote-2')).not.toBe(toSharedColor('remote-1'));
    expect(snapshotSelectedMap(app)).toEqual({ [table.id]: SelectType.table });
  });
});
