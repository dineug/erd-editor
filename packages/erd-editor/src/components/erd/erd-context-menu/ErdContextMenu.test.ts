import { query } from '@dineug/erd-editor-schema';
import {
  DOMTemplateLiterals,
  FC,
  html,
  observable,
  useProvider,
} from '@dineug/r-html';
import { Subject } from 'rxjs';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { iconNameOf } from '@/__test-utils__/icon';
import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import ErdContextMenu, {
  ErdContextMenuType,
} from '@/components/erd/erd-context-menu/ErdContextMenu';
import {
  ContextMenuRootContext,
  contextMenuRootContext,
} from '@/components/primitives/context-menu/context-menu-root/contextMenuRootContext';
import { Open } from '@/constants/open';
import {
  CanvasType,
  ColumnOption,
  Database,
  ReferentialAction,
  RelationshipType,
} from '@/constants/schema';
import { TablePlacement } from '@/constants/tablePlacement';
import {
  focusColumnAction,
  selectAction,
} from '@/engine/modules/editor/atom.actions';
import {
  FocusType,
  SelectType,
  VisualizationMode,
} from '@/engine/modules/editor/state';
import {
  addMemoAction,
  changeMemoColorAction,
} from '@/engine/modules/memo/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  changeDatabaseAction,
  changeZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableColorAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnPrimaryKeyAction,
  removeColumnAction,
} from '@/engine/modules/table-column/atom.actions';
import { bHas } from '@/utils/bit';
import { setExportFileCallback } from '@/utils/file/exportFile';
import { setImportFileCallback } from '@/utils/file/importFile';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

type WrapperProps = {
  children?: DOMTemplateLiterals;
};

const Wrapper: FC<WrapperProps> = (props, ctx) => {
  const state = observable<ContextMenuRootContext>({
    show: true,
    x: 0,
    y: 0,
    change$: new Subject(),
  });
  useProvider(ctx, contextMenuRootContext, state);

  return () => html`<div class="wrapper">${props.children}</div>`;
};

let app: AppContext;
let mounted: Mounted | null = null;
let onClose: ReturnType<typeof vi.fn>;
let importRequests: Array<{ type: string; op: string; accept: string }>;
let exportedFiles: string[];

type MountOptions = {
  type?: ErdContextMenuType;
  relationshipId?: string;
  tableId?: string;
  columnId?: string;
  memoId?: string;
};

async function mountMenu({
  type,
  relationshipId,
  tableId,
  columnId,
  memoId,
}: MountOptions = {}) {
  mounted = await mountAndFlush(
    html`
      <${Wrapper}
        children=${html`
          <${ErdContextMenu}
            type=${type ?? ErdContextMenuType.ERD}
            relationshipId=${relationshipId}
            tableId=${tableId}
            columnId=${columnId}
            memoId=${memoId}
            .onClose=${onClose}
          />
        `}
      />
    `,
    app
  );
  return mounted;
}

function contentEl(id: string): HTMLElement {
  const el = mounted?.container.querySelector<HTMLElement>(
    `.context-menu-content[data-id="${id}"]`
  );
  if (!el) throw new Error(`context menu content not found: ${id}`);
  return el;
}

function itemsOf(content: HTMLElement): HTMLElement[] {
  return Array.from(content.children).filter(
    (el): el is HTMLElement =>
      el instanceof HTMLElement &&
      !el.classList.contains('context-menu-content')
  );
}

function rootItems(): HTMLElement[] {
  return itemsOf(contentEl('root'));
}

function labelsOf(items: HTMLElement[]): string[] {
  return items.map(item => item.textContent?.replace(/\s+/g, ' ').trim() ?? '');
}

function findItem(items: HTMLElement[], label: string): HTMLElement {
  const text = (el: HTMLElement) =>
    (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  // An exact label wins, so Delete is not taken for On Delete above it.
  const item =
    items.find(el => text(el) === label) ??
    items.find(el => text(el).includes(label));
  if (!item) throw new Error(`menu item not found: ${label}`);
  return item;
}

async function openSubMenu(item: HTMLElement): Promise<HTMLElement> {
  item.dispatchEvent(new MouseEvent('mouseenter'));
  await flush();
  return contentEl(item.dataset.id ?? '');
}

async function click(item: HTMLElement, init: MouseEventInit = {}) {
  item.dispatchEvent(new MouseEvent('click', { bubbles: true, ...init }));
  await flush();
}

beforeEach(() => {
  app = createTestAppContext();
  onClose = vi.fn();
  importRequests = [];
  exportedFiles = [];
  setImportFileCallback(options => {
    importRequests.push({ ...options });
  });
  setExportFileCallback((_blob, options) => {
    exportedFiles.push(options.fileName);
  });
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  setImportFileCallback(null);
  setExportFileCallback(null);
});

describe('ErdContextMenu / ERD type', () => {
  it('renders the erd level menu entries', async () => {
    await mountMenu();

    expect(labelsOf(rootItems())).toEqual([
      'New TableAlt + N',
      'New MemoAlt + M',
      'Find and ReplaceCtrl + F',
      'Relationship',
      'View Option',
      'Database',
      'Import',
      'Export',
      'Auto Layout',
      'Diff Viewer',
    ]);
  });

  it('draws New Table with the table icon the rest of the editor shows a table by', async () => {
    await mountMenu();

    expect(iconNameOf(findItem(rootItems(), 'New Table'))).toBe('table-2');
    expect(iconNameOf(findItem(rootItems(), 'New Memo'))).toBe('sticky-note');
  });

  it('draws Find and Replace with the text-search icon the toolbar and the palette draw', async () => {
    await mountMenu();

    expect(iconNameOf(findItem(rootItems(), 'Find and Replace'))).toBe(
      'text-search'
    );
  });

  it('adds a table and closes the menu', async () => {
    await mountMenu();

    await click(findItem(rootItems(), 'New Table'));

    expect(app.store.state.doc.tableIds).toHaveLength(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks for Find and Replace and closes the menu', async () => {
    const opened: unknown[] = [];
    app.emitter.on({
      openFindReplace: action => {
        opened.push(action.payload);
      },
    });
    await mountMenu();

    await click(findItem(rootItems(), 'Find and Replace'));

    expect(opened).toEqual([undefined]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('adds a memo and closes the menu', async () => {
    await mountMenu();

    await click(findItem(rootItems(), 'New Memo'));

    expect(app.store.state.doc.memoIds).toHaveLength(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('lists every placement in the automatic table placement submenu', async () => {
    await mountMenu();

    const sub = await openSubMenu(findItem(rootItems(), 'Auto Layout'));

    expect(labelsOf(itemsOf(sub))).toEqual([
      'Force',
      'Flow',
      'Tree - vertical',
      'Tree - horizontal',
    ]);
  });

  it('opens automatic table placement with the placement that was picked', async () => {
    await mountMenu();
    const placements: string[] = [];
    app.emitter.on({
      openAutomaticTablePlacement: ({ payload: { placement } }) => {
        placements.push(placement);
      },
    });

    const sub = await openSubMenu(findItem(rootItems(), 'Auto Layout'));
    await click(findItem(itemsOf(sub), 'Tree - vertical'));

    expect(placements).toEqual([TablePlacement.layeredVertical]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens the diff viewer through a diff import request', async () => {
    await mountMenu();

    await click(findItem(rootItems(), 'Diff Viewer'));

    expect(importRequests).toEqual([
      { type: 'json', op: 'diff', accept: '.json' },
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('starts drawing a relationship from the relationship submenu', async () => {
    await mountMenu();

    const sub = await openSubMenu(findItem(rootItems(), 'Relationship'));
    const items = itemsOf(sub);

    expect(labelsOf(items)).toEqual([
      'Zero OneCtrl + Alt + 1',
      'Zero NCtrl + Alt + 2',
      'One OnlyCtrl + Alt + 3',
      'One NCtrl + Alt + 4',
    ]);

    await click(findItem(items, 'Zero N'));

    expect(app.store.state.editor.drawRelationship?.relationshipType).toBe(
      RelationshipType.ZeroN
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('toggles a view option from the view option submenu', async () => {
    await mountMenu();

    const sub = await openSubMenu(findItem(rootItems(), 'View Option'));
    const items = itemsOf(sub);

    expect(labelsOf(items)).toEqual([
      'Table Comment',
      'Column Comment',
      'DataType',
      'Default',
      'Not Null',
      'Unique',
      'Alternate Key',
      'Auto Increment',
      'Relationship',
      'Referential Actions',
    ]);

    const before = app.store.state.settings.show;
    await click(items[0]);

    expect(app.store.state.settings.show).not.toBe(before);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('changes the database from the database submenu: a choice keeps the menu open, an action closes it', async () => {
    app.store.dispatchSync(changeDatabaseAction({ value: Database.MySQL }));
    await mountMenu();

    const sub = await openSubMenu(findItem(rootItems(), 'Database'));
    const items = itemsOf(sub);

    expect(labelsOf(items)).toEqual([
      'Databricks',
      'MSSQL',
      'MariaDB',
      'MySQL',
      'Oracle',
      'PostgreSQL',
      'Snowflake',
      'SQLite',
    ]);

    await click(findItem(items, 'Oracle'));

    expect(app.store.state.settings.database).toBe(Database.Oracle);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('requests a json import from the import submenu', async () => {
    await mountMenu();

    const sub = await openSubMenu(findItem(rootItems(), 'Import'));
    const items = itemsOf(sub);

    expect(labelsOf(items)).toEqual([
      'json',
      'Schema SQL',
      'GraphQL',
      'DBML',
      'AML',
    ]);

    await click(items[0]);

    expect(importRequests).toEqual([
      { type: 'json', op: 'set', accept: '.json' },
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('exports json from the export submenu', async () => {
    await mountMenu();

    const sub = await openSubMenu(findItem(rootItems(), 'Export'));
    const items = itemsOf(sub);

    expect(labelsOf(items)).toEqual(['json', 'Schema SQL', 'png']);

    await click(items[0]);

    expect(exportedFiles).toHaveLength(1);
    expect(exportedFiles[0]).toMatch(/\.erd\.json$/);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes the menu on the stop shortcut only', async () => {
    await mountMenu();

    app.shortcut$.next({
      type: KeyBindingName.addTable,
      event: new KeyboardEvent('keydown'),
    });
    expect(onClose).not.toHaveBeenCalled();

    app.shortcut$.next({
      type: KeyBindingName.stop,
      event: new KeyboardEvent('keydown'),
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes the menu on the key its Delete row names, which takes away what it was raised over', async () => {
    await mountMenu({ type: ErdContextMenuType.memo, memoId: 'memo-1' });

    app.shortcut$.next({
      type: KeyBindingName.removeSelection,
      event: new KeyboardEvent('keydown', { key: 'Delete' }),
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ErdContextMenu / table type', () => {
  const TABLE_ID = 'table-1';
  const COLUMN_ID = 'column-1';

  function seedTable() {
    app.store.dispatchSync(
      addTableAction({ id: TABLE_ID, ui: { x: 0, y: 0, zIndex: 1 } })
    );
    app.store.dispatchSync(
      addColumnAction({ id: COLUMN_ID, tableId: TABLE_ID })
    );
  }

  function focusColumn() {
    app.store.dispatchSync(
      focusColumnAction({
        tableId: TABLE_ID,
        columnId: COLUMN_ID,
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );
  }

  it('renders the table level menu entries', async () => {
    seedTable();
    await mountMenu({ type: ErdContextMenuType.table, tableId: TABLE_ID });

    expect(labelsOf(rootItems())).toEqual([
      'Primary KeyAlt + K',
      'Table PropertiesAlt + Space',
      'Focus on this tableAlt + F',
      'Color',
      'DeleteDelete',
    ]);
  });

  it('draws no icon beside Delete and names the key that does the same', async () => {
    seedTable();
    await mountMenu({ type: ErdContextMenuType.table, tableId: TABLE_ID });

    const item = findItem(rootItems(), 'Delete');
    expect(item.querySelector('svg')).toBeNull();
    expect(item.querySelector('.kbd')?.textContent?.trim()).toBe('Delete');
  });

  describe('Delete', () => {
    const SECOND_TABLE_ID = 'table-2';
    const MEMO_ID = 'memo-1';

    const tableIds = () => app.store.state.doc.tableIds;
    const memoIds = () => app.store.state.doc.memoIds;
    const columnIds = () =>
      query(app.store.state.collections)
        .collection('tableEntities')
        .selectById(TABLE_ID)?.columnIds;

    function seedNeighbors() {
      seedTable();
      app.store.dispatchSync(
        addTableAction({
          id: SECOND_TABLE_ID,
          ui: { x: 400, y: 0, zIndex: 2 },
        }),
        addMemoAction({ id: MEMO_ID, ui: { x: 0, y: 400, zIndex: 3 } })
      );
    }

    it('deletes the table it was raised over alone, and closes', async () => {
      seedNeighbors();
      app.store.dispatchSync(
        selectAction({
          [SECOND_TABLE_ID]: SelectType.table,
          [MEMO_ID]: SelectType.memo,
        })
      );
      await mountMenu({ type: ErdContextMenuType.table, tableId: TABLE_ID });

      await click(findItem(rootItems(), 'Delete'));

      expect(tableIds()).toEqual([SECOND_TABLE_ID]);
      expect(memoIds()).toEqual([MEMO_ID]);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('names the selection the table is one of and deletes all of it', async () => {
      seedNeighbors();
      app.store.dispatchSync(
        selectAction({
          [TABLE_ID]: SelectType.table,
          [MEMO_ID]: SelectType.memo,
        })
      );
      await mountMenu({ type: ErdContextMenuType.table, tableId: TABLE_ID });

      expect(labelsOf(rootItems()).at(-1)).toBe('Delete selectedDelete');
      await click(findItem(rootItems(), 'Delete selected'));

      expect(tableIds()).toEqual([SECOND_TABLE_ID]);
      expect(memoIds()).toEqual([]);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    /** Three columns, the first and the last selected, their table the whole selection. */
    function seedColumnSelection() {
      seedTable();
      app.store.dispatchSync(
        addColumnAction({ id: 'column-2', tableId: TABLE_ID }),
        addColumnAction({ id: 'column-3', tableId: TABLE_ID }),
        selectAction({ [TABLE_ID]: SelectType.table })
      );
      focusColumn();
      app.store.dispatchSync(
        focusColumnAction({
          tableId: TABLE_ID,
          columnId: 'column-3',
          focusType: FocusType.columnName,
          $mod: true,
          shiftKey: false,
        })
      );
    }

    it('names the selected columns when raised over one of them and deletes them', async () => {
      seedColumnSelection();
      await mountMenu({
        type: ErdContextMenuType.table,
        tableId: TABLE_ID,
        columnId: 'column-3',
      });

      expect(labelsOf(rootItems()).at(-1)).toBe('Delete columnsDelete');
      await click(findItem(rootItems(), 'Delete columns'));

      expect(tableIds()).toEqual([TABLE_ID]);
      expect(columnIds()).toEqual(['column-2']);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('names a lone selected column in the singular when raised over it, and deletes it', async () => {
      seedTable();
      app.store.dispatchSync(
        addColumnAction({ id: 'column-2', tableId: TABLE_ID }),
        selectAction({ [TABLE_ID]: SelectType.table })
      );
      focusColumn();
      await mountMenu({
        type: ErdContextMenuType.table,
        tableId: TABLE_ID,
        columnId: COLUMN_ID,
      });

      expect(labelsOf(rootItems()).at(-1)).toBe('Delete columnDelete');
      await click(findItem(rootItems(), 'Delete column'));

      expect(tableIds()).toEqual([TABLE_ID]);
      expect(columnIds()).toEqual(['column-2']);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('counts only the selected columns still in the table', async () => {
      seedColumnSelection();
      // The bare atom a peer, an agent or the undo of an add sends, which
      // leaves the column in the selection.
      app.store.dispatchSync(
        removeColumnAction({ id: COLUMN_ID, tableId: TABLE_ID })
      );
      await mountMenu({
        type: ErdContextMenuType.table,
        tableId: TABLE_ID,
        columnId: 'column-3',
      });

      expect(labelsOf(rootItems()).at(-1)).toBe('Delete columnDelete');
      await click(findItem(rootItems(), 'Delete column'));

      expect(columnIds()).toEqual(['column-2']);
    });

    it.each([
      ['off the rows', undefined],
      ['over a row outside the selection', 'column-2'],
    ])(
      'names the table, not its selected columns, when raised %s',
      async (_, columnId) => {
        seedColumnSelection();
        await mountMenu({
          type: ErdContextMenuType.table,
          tableId: TABLE_ID,
          columnId,
        });

        expect(labelsOf(rootItems()).at(-1)).toBe('DeleteDelete');
        await click(findItem(rootItems(), 'Delete'));

        expect(tableIds()).toEqual([]);
      }
    );

    it('goes back to the table at a zoom that draws names alone', async () => {
      seedTable();
      app.store.dispatchSync(selectAction({ [TABLE_ID]: SelectType.table }));
      focusColumn();
      app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
      await mountMenu({
        type: ErdContextMenuType.table,
        tableId: TABLE_ID,
        columnId: COLUMN_ID,
      });

      expect(labelsOf(rootItems()).at(-1)).toBe('DeleteDelete');
      await click(findItem(rootItems(), 'Delete'));

      expect(tableIds()).toEqual([]);
    });

    it('leaves the columns of another focused table to the key', async () => {
      seedNeighbors();
      app.store.dispatchSync(
        addColumnAction({ id: 'column-9', tableId: SECOND_TABLE_ID }),
        selectAction({ [SECOND_TABLE_ID]: SelectType.table }),
        focusColumnAction({
          tableId: SECOND_TABLE_ID,
          columnId: 'column-9',
          focusType: FocusType.columnName,
          $mod: false,
          shiftKey: false,
        })
      );
      await mountMenu({ type: ErdContextMenuType.table, tableId: TABLE_ID });

      expect(labelsOf(rootItems()).at(-1)).toBe('DeleteDelete');
      await click(findItem(rootItems(), 'Delete'));

      expect(tableIds()).toEqual([SECOND_TABLE_ID]);
    });

    it('follows the key when it is remapped', async () => {
      seedTable();
      app.keyBindingMap.removeSelection = [{ shortcut: 'Alt+KeyD' }];
      await mountMenu({ type: ErdContextMenuType.table, tableId: TABLE_ID });

      expect(labelsOf(rootItems()).at(-1)).toBe('DeleteAlt + D');
    });
  });

  it('toggles the focused column primary key', async () => {
    seedTable();
    focusColumn();
    await mountMenu({ type: ErdContextMenuType.table, tableId: TABLE_ID });

    await click(findItem(rootItems(), 'Primary Key'));

    const column = query(app.store.state.collections)
      .collection('tableColumnEntities')
      .selectById(COLUMN_ID);
    expect(bHas(column?.options ?? 0, ColumnOption.primaryKey)).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe('over a column selection', () => {
    const SECOND_ID = 'column-2';
    const THIRD_ID = 'column-3';

    const keys = () =>
      [COLUMN_ID, SECOND_ID, THIRD_ID].map(columnId =>
        bHas(
          query(app.store.state.collections)
            .collection('tableColumnEntities')
            .selectById(columnId)?.options ?? 0,
          ColumnOption.primaryKey
        )
      );

    /** Three columns, the focus on the second with the first selected too. */
    function seedSelection() {
      seedTable();
      app.store.dispatchSync(
        addColumnAction({ id: SECOND_ID, tableId: TABLE_ID }),
        addColumnAction({ id: THIRD_ID, tableId: TABLE_ID })
      );
      focusColumn();
      app.store.dispatchSync(
        focusColumnAction({
          tableId: TABLE_ID,
          columnId: SECOND_ID,
          focusType: FocusType.columnName,
          $mod: true,
          shiftKey: false,
        })
      );
    }

    it('names the selection while the focused column is one of several', async () => {
      seedSelection();
      await mountMenu({ type: ErdContextMenuType.table, tableId: TABLE_ID });

      expect(labelsOf(rootItems())[0]).toBe(
        'Primary Key on selected columnsAlt + K'
      );
    });

    it('keys every selected column and closes', async () => {
      seedSelection();
      await mountMenu({ type: ErdContextMenuType.table, tableId: TABLE_ID });

      await click(findItem(rootItems(), 'Primary Key on selected columns'));

      expect(keys()).toEqual([true, true, false]);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('goes back to the one column once the selection is that column alone', async () => {
      seedSelection();
      await mountMenu({ type: ErdContextMenuType.table, tableId: TABLE_ID });

      focusColumn();
      await flush();

      expect(labelsOf(rootItems())[0]).toBe('Primary KeyAlt + K');
      await click(findItem(rootItems(), 'Primary Key'));
      expect(keys()).toEqual([true, false, false]);
    });

    it('goes back to the one column once a selected column leaves the table', async () => {
      seedSelection();
      app.store.dispatchSync(
        changeColumnPrimaryKeyAction({
          tableId: TABLE_ID,
          id: SECOND_ID,
          value: true,
        })
      );
      await mountMenu({ type: ErdContextMenuType.table, tableId: TABLE_ID });
      expect(labelsOf(rootItems())[0]).toBe(
        'Primary Key on selected columnsAlt + K'
      );

      // The bare atom a peer, an agent or the undo of an add sends, which
      // leaves the column in the selection.
      app.store.dispatchSync(
        removeColumnAction({ id: COLUMN_ID, tableId: TABLE_ID })
      );
      await flush();

      expect(labelsOf(rootItems())[0]).toBe('Primary KeyAlt + K');
      await click(findItem(rootItems(), 'Primary Key'));
      expect(keys()).toEqual([false, false, false]);
    });
  });

  it('does nothing for primary key when no column is focused', async () => {
    seedTable();
    await mountMenu({ type: ErdContextMenuType.table, tableId: TABLE_ID });

    await click(findItem(rootItems(), 'Primary Key'));

    const column = query(app.store.state.collections)
      .collection('tableColumnEntities')
      .selectById(COLUMN_ID);
    expect(bHas(column?.options ?? 0, ColumnOption.primaryKey)).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('opens the table properties panel', async () => {
    seedTable();
    const openTableProperties = vi.fn();
    app.emitter.on({ openTableProperties });
    await mountMenu({ type: ErdContextMenuType.table, tableId: TABLE_ID });

    await click(findItem(rootItems(), 'Table Properties'));

    expect(openTableProperties).toHaveBeenCalledTimes(1);
    expect(openTableProperties.mock.calls[0][0].payload).toEqual({
      tableId: TABLE_ID,
    });
    expect(app.store.state.editor.openMap[Open.tableProperties]).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stands the Flow view on the table the menu was raised over (AC-51)', async () => {
    seedTable();
    await mountMenu({ type: ErdContextMenuType.table, tableId: TABLE_ID });

    await click(findItem(rootItems(), 'Focus on this table'));
    await flush();

    const { editor, settings } = app.store.state;
    expect(settings.canvasType).toBe(CanvasType.visualization);
    expect(editor.visualizationMode).toBe(VisualizationMode.flow);
    expect(editor.views.flow?.centerIds).toEqual([TABLE_ID]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stands the Flow view on the whole selection a menu was raised over one of', async () => {
    seedTable();
    app.store.dispatchSync(
      addTableAction({ id: 'table-2', ui: { x: 400, y: 0, zIndex: 2 } }),
      selectAction({
        [TABLE_ID]: SelectType.table,
        'table-2': SelectType.table,
      })
    );
    await mountMenu({ type: ErdContextMenuType.table, tableId: TABLE_ID });

    expect(labelsOf(rootItems())).toContain('Focus on selected tablesAlt + F');

    await click(findItem(rootItems(), 'Focus on selected tables'));
    await flush();

    const centerIds = app.store.state.editor.views.flow?.centerIds ?? [];
    expect([...centerIds].sort()).toEqual([TABLE_ID, 'table-2']);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stands the Flow view on the table alone when the selection does not hold it', async () => {
    seedTable();
    app.store.dispatchSync(
      addTableAction({ id: 'table-2', ui: { x: 400, y: 0, zIndex: 2 } }),
      addTableAction({ id: 'table-3', ui: { x: 800, y: 0, zIndex: 3 } }),
      selectAction({ 'table-2': SelectType.table, 'table-3': SelectType.table })
    );
    await mountMenu({ type: ErdContextMenuType.table, tableId: TABLE_ID });

    await click(findItem(rootItems(), 'Focus on this table'));
    await flush();

    expect(app.store.state.editor.views.flow?.centerIds).toEqual([TABLE_ID]);
  });

  it('opens the color picker at the pointer position', async () => {
    seedTable();
    const openColorPicker = vi.fn();
    app.emitter.on({ openColorPicker });
    await mountMenu({ type: ErdContextMenuType.table, tableId: TABLE_ID });

    await click(findItem(rootItems(), 'Color'), { clientX: 12, clientY: 34 });

    expect(openColorPicker).toHaveBeenCalledTimes(1);
    expect(openColorPicker.mock.calls[0][0].payload).toEqual({
      x: 12,
      y: 34,
      color: '',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe('Remove color', () => {
    const MEMO_ID = 'memo-1';

    function seedColors() {
      seedTable();
      app.store.dispatchSync(
        addTableAction({ id: 'table-2', ui: { x: 400, y: 0, zIndex: 2 } }),
        addMemoAction({ id: MEMO_ID, ui: { x: 0, y: 400, zIndex: 3 } }),
        changeTableColorAction({
          id: TABLE_ID,
          color: '#ff0000',
          prevColor: '',
        }),
        changeMemoColorAction({ id: MEMO_ID, color: '#00ff00', prevColor: '' })
      );
    }

    it('shows under Color while the selection holds a color, without an icon', async () => {
      seedColors();
      app.store.dispatchSync(selectAction({ [TABLE_ID]: SelectType.table }));
      await mountMenu({ type: ErdContextMenuType.table, tableId: TABLE_ID });

      expect(labelsOf(rootItems())).toEqual([
        'Primary KeyAlt + K',
        'Table PropertiesAlt + Space',
        'Focus on this tableAlt + F',
        'Color',
        'Remove color',
        'DeleteDelete',
      ]);
      expect(findItem(rootItems(), 'Remove color').querySelector('svg')).toBe(
        null
      );
    });

    it('clears the color of every selected table and memo, and closes', async () => {
      seedColors();
      app.store.dispatchSync(
        selectAction({
          [TABLE_ID]: SelectType.table,
          'table-2': SelectType.table,
          [MEMO_ID]: SelectType.memo,
        })
      );
      await mountMenu({ type: ErdContextMenuType.table, tableId: TABLE_ID });

      await click(findItem(rootItems(), 'Remove color'));

      const { tableEntities, memoEntities } = app.store.state.collections;
      expect(tableEntities[TABLE_ID].ui.color).toBe('');
      expect(memoEntities[MEMO_ID].ui.color).toBe('');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('stays out while no selected table or memo has a color', async () => {
      seedColors();
      app.store.dispatchSync(selectAction({ 'table-2': SelectType.table }));
      await mountMenu({ type: ErdContextMenuType.table, tableId: 'table-2' });

      expect(labelsOf(rootItems())).not.toContain('Remove color');
    });
  });

  it('does not open the color picker for an unknown table', async () => {
    const openColorPicker = vi.fn();
    app.emitter.on({ openColorPicker });
    await mountMenu({ type: ErdContextMenuType.table, tableId: 'missing' });

    await click(findItem(rootItems(), 'Color'));

    expect(openColorPicker).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores every table action when no table id is given', async () => {
    const openColorPicker = vi.fn();
    const openTableProperties = vi.fn();
    app.emitter.on({ openColorPicker, openTableProperties });
    await mountMenu({ type: ErdContextMenuType.table });

    for (const item of rootItems()) {
      await click(item);
    }

    expect(openColorPicker).not.toHaveBeenCalled();
    expect(openTableProperties).not.toHaveBeenCalled();
    expect(app.store.state.editor.views.flow).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ErdContextMenu / memo type', () => {
  const MEMO_ID = 'memo-1';
  const TABLE_ID = 'table-1';

  function seedMemo() {
    app.store.dispatchSync(
      addMemoAction({ id: MEMO_ID, ui: { x: 0, y: 0, zIndex: 1 } }),
      changeMemoColorAction({ id: MEMO_ID, color: '#ff8800', prevColor: '' }),
      addTableAction({ id: TABLE_ID, ui: { x: 400, y: 0, zIndex: 2 } })
    );
  }

  it('renders the memo level menu entries', async () => {
    seedMemo();
    await mountMenu({ type: ErdContextMenuType.memo, memoId: MEMO_ID });

    expect(labelsOf(rootItems())).toEqual(['Color', 'DeleteDelete']);
    expect(iconNameOf(findItem(rootItems(), 'Color'))).toBe('palette');
    expect(findItem(rootItems(), 'Delete').querySelector('svg')).toBeNull();
  });

  it('opens the color picker on the memo color at the pointer position', async () => {
    seedMemo();
    const openColorPicker = vi.fn();
    app.emitter.on({ openColorPicker });
    await mountMenu({ type: ErdContextMenuType.memo, memoId: MEMO_ID });

    await click(findItem(rootItems(), 'Color'), { clientX: 56, clientY: 78 });

    expect(openColorPicker).toHaveBeenCalledTimes(1);
    expect(openColorPicker.mock.calls[0][0].payload).toEqual({
      x: 56,
      y: 78,
      color: '#ff8800',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('offers Remove color under Color while the memo is a colored selection, and clears it', async () => {
    seedMemo();
    app.store.dispatchSync(selectAction({ [MEMO_ID]: SelectType.memo }));
    await mountMenu({ type: ErdContextMenuType.memo, memoId: MEMO_ID });

    expect(labelsOf(rootItems())).toEqual([
      'Color',
      'Remove color',
      'DeleteDelete',
    ]);
    await click(findItem(rootItems(), 'Remove color'));

    expect(app.store.state.collections.memoEntities[MEMO_ID].ui.color).toBe('');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not open the color picker for an unknown memo', async () => {
    const openColorPicker = vi.fn();
    app.emitter.on({ openColorPicker });
    await mountMenu({ type: ErdContextMenuType.memo, memoId: 'missing' });

    await click(findItem(rootItems(), 'Color'));

    expect(openColorPicker).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('deletes the memo it was raised over alone, and closes', async () => {
    seedMemo();
    app.store.dispatchSync(selectAction({ [TABLE_ID]: SelectType.table }));
    await mountMenu({ type: ErdContextMenuType.memo, memoId: MEMO_ID });

    await click(findItem(rootItems(), 'Delete'));

    expect(app.store.state.doc.memoIds).toEqual([]);
    expect(app.store.state.doc.tableIds).toEqual([TABLE_ID]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('names the memo alone while it is the whole selection', async () => {
    seedMemo();
    app.store.dispatchSync(selectAction({ [MEMO_ID]: SelectType.memo }));
    await mountMenu({ type: ErdContextMenuType.memo, memoId: MEMO_ID });

    expect(labelsOf(rootItems()).at(-1)).toBe('DeleteDelete');
    await click(findItem(rootItems(), 'Delete'));

    expect(app.store.state.doc.memoIds).toEqual([]);
    expect(app.store.state.doc.tableIds).toEqual([TABLE_ID]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('names the selection the memo is one of and deletes all of it', async () => {
    const OTHER_MEMO_ID = 'memo-2';
    seedMemo();
    app.store.dispatchSync(
      addMemoAction({ id: OTHER_MEMO_ID, ui: { x: 0, y: 400, zIndex: 3 } }),
      selectAction({ [MEMO_ID]: SelectType.memo, [TABLE_ID]: SelectType.table })
    );
    await mountMenu({ type: ErdContextMenuType.memo, memoId: MEMO_ID });

    expect(labelsOf(rootItems()).at(-1)).toBe('Delete selectedDelete');
    await click(findItem(rootItems(), 'Delete selected'));

    expect(app.store.state.doc.memoIds).toEqual([OTHER_MEMO_ID]);
    expect(app.store.state.doc.tableIds).toEqual([]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores every memo action when no memo id is given', async () => {
    seedMemo();
    const openColorPicker = vi.fn();
    app.emitter.on({ openColorPicker });
    await mountMenu({ type: ErdContextMenuType.memo });

    for (const item of rootItems()) {
      await click(item);
    }

    expect(openColorPicker).not.toHaveBeenCalled();
    expect(app.store.state.doc.memoIds).toEqual([MEMO_ID]);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ErdContextMenu / relationship type', () => {
  const RELATIONSHIP_ID = 'relationship-1';

  function seedRelationship() {
    app.store.dispatchSync(
      addRelationshipAction({
        id: RELATIONSHIP_ID,
        relationshipType: RelationshipType.ZeroOne,
        start: { tableId: 'table-a', columnIds: ['column-a'] },
        end: { tableId: 'table-b', columnIds: ['column-b'] },
      })
    );
  }

  it('renders the relationship level menu entries', async () => {
    seedRelationship();
    await mountMenu({
      type: ErdContextMenuType.relationship,
      relationshipId: RELATIONSHIP_ID,
    });

    expect(labelsOf(rootItems())).toEqual([
      'Relationship Type',
      'On Delete',
      'On Update',
      'Delete',
    ]);
  });

  it.each([
    ['On Delete', 'onDelete'],
    ['On Update', 'onUpdate'],
  ] as const)(
    'sets the %s action from its submenu, checking the one it holds',
    async (label, field) => {
      app.store.dispatchSync(
        changeDatabaseAction({ value: Database.PostgreSQL })
      );
      seedRelationship();
      await mountMenu({
        type: ErdContextMenuType.relationship,
        relationshipId: RELATIONSHIP_ID,
      });
      const checkedOf = (items: HTMLElement[]) =>
        labelsOf(items.filter(item => item.querySelector('svg')));

      let items = itemsOf(await openSubMenu(findItem(rootItems(), label)));

      expect(labelsOf(items)).toEqual([
        'Not set',
        'NO ACTION',
        'CASCADE',
        'SET NULL',
        'SET DEFAULT',
        'RESTRICT',
      ]);
      expect(checkedOf(items)).toEqual(['Not set']);

      await click(findItem(items, 'CASCADE'));

      const relationship = query(app.store.state.collections)
        .collection('relationshipEntities')
        .selectById(RELATIONSHIP_ID);
      expect(relationship?.[field]).toBe(ReferentialAction.cascade);
      expect(onClose).not.toHaveBeenCalled();

      items = itemsOf(await openSubMenu(findItem(rootItems(), label)));
      expect(checkedOf(items)).toEqual(['CASCADE']);
    }
  );

  it.each([
    ['MySQL', Database.MySQL, 'On Delete', ['SET DEFAULT not in MySQL']],
    [
      'Oracle',
      Database.Oracle,
      'On Update',
      [
        'NO ACTION not in Oracle',
        'CASCADE not in Oracle',
        'SET NULL not in Oracle',
        'SET DEFAULT not in Oracle',
        'RESTRICT not in Oracle',
      ],
    ],
  ] as const)(
    'notes the %s actions its DDL would drop, keeping them choosable',
    async (_name, database, label, noted) => {
      app.store.dispatchSync(changeDatabaseAction({ value: database }));
      seedRelationship();
      await mountMenu({
        type: ErdContextMenuType.relationship,
        relationshipId: RELATIONSHIP_ID,
      });

      const items = itemsOf(await openSubMenu(findItem(rootItems(), label)));

      // The note sits in the item's right slot, after the name.
      const notes = items.flatMap(item => {
        const note = item.querySelector('span')?.textContent ?? '';
        const [text] = labelsOf([item]);
        return note ? [`${text.slice(0, -note.length).trim()} ${note}`] : [];
      });
      expect(notes).toEqual(noted);

      await click(
        findItem(items, noted[noted.length - 1].split(' not in ')[0])
      );

      const relationship = query(app.store.state.collections)
        .collection('relationshipEntities')
        .selectById(RELATIONSHIP_ID);
      expect(
        relationship?.[label === 'On Delete' ? 'onDelete' : 'onUpdate']
      ).not.toBe(ReferentialAction.none);
    }
  );

  it('renders empty action submenus without a relationship id', async () => {
    await mountMenu({ type: ErdContextMenuType.relationship });

    for (const label of ['On Delete', 'On Update']) {
      const sub = await openSubMenu(findItem(rootItems(), label));

      expect(itemsOf(sub)).toHaveLength(0);
    }
  });

  it('changes the relationship type from the submenu: a choice keeps the menu open, an action closes it', async () => {
    seedRelationship();
    await mountMenu({
      type: ErdContextMenuType.relationship,
      relationshipId: RELATIONSHIP_ID,
    });

    const sub = await openSubMenu(findItem(rootItems(), 'Relationship Type'));
    const items = itemsOf(sub);

    expect(labelsOf(items)).toEqual([
      'Zero One',
      'Zero N',
      'One Only',
      'One N',
    ]);

    await click(findItem(items, 'One N'));

    const relationship = query(app.store.state.collections)
      .collection('relationshipEntities')
      .selectById(RELATIONSHIP_ID);
    expect(relationship?.relationshipType).toBe(RelationshipType.OneN);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders an empty relationship type submenu without a relationship id', async () => {
    await mountMenu({ type: ErdContextMenuType.relationship });

    const sub = await openSubMenu(findItem(rootItems(), 'Relationship Type'));

    expect(itemsOf(sub)).toHaveLength(0);
  });

  it('removes the relationship on delete', async () => {
    seedRelationship();
    await mountMenu({
      type: ErdContextMenuType.relationship,
      relationshipId: RELATIONSHIP_ID,
    });

    await click(findItem(rootItems(), 'Delete'));

    expect(app.store.state.doc.relationshipIds).not.toContain(RELATIONSHIP_ID);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores delete when no relationship id is given', async () => {
    seedRelationship();
    await mountMenu({ type: ErdContextMenuType.relationship });

    await click(findItem(rootItems(), 'Delete'));

    expect(app.store.state.doc.relationshipIds).toContain(RELATIONSHIP_ID);
    expect(onClose).not.toHaveBeenCalled();
  });
});
