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
import { ColumnOption, Database, RelationshipType } from '@/constants/schema';
import { focusColumnAction } from '@/engine/modules/editor/atom.actions';
import { FocusType } from '@/engine/modules/editor/state';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { changeDatabaseAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
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
};

async function mountMenu({ type, relationshipId, tableId }: MountOptions = {}) {
  mounted = await mountAndFlush(
    html`
      <${Wrapper}
        children=${html`
          <${ErdContextMenu}
            type=${type ?? ErdContextMenuType.ERD}
            relationshipId=${relationshipId}
            tableId=${tableId}
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
  const item = items.find(el =>
    (el.textContent ?? '').replace(/\s+/g, ' ').includes(label)
  );
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
      'Relationship',
      'View Option',
      'Database',
      'Import',
      'Export',
      'Automatic Table Placement',
      'Diff Viewer',
    ]);
  });

  it('adds a table and closes the menu', async () => {
    await mountMenu();

    await click(findItem(rootItems(), 'New Table'));

    expect(app.store.state.doc.tableIds).toHaveLength(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('adds a memo and closes the menu', async () => {
    await mountMenu();

    await click(findItem(rootItems(), 'New Memo'));

    expect(app.store.state.doc.memoIds).toHaveLength(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens automatic table placement', async () => {
    await mountMenu();

    await click(findItem(rootItems(), 'Automatic Table Placement'));

    expect(app.store.state.editor.openMap[Open.automaticTablePlacement]).toBe(
      true
    );
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
      'Auto Increment',
      'Relationship',
    ]);

    const before = app.store.state.settings.show;
    await click(items[0]);

    expect(app.store.state.settings.show).not.toBe(before);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('changes the database from the database submenu', async () => {
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
      'Color',
    ]);
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

    expect(labelsOf(rootItems())).toEqual(['Relationship Type', 'Delete']);
  });

  it('changes the relationship type from the submenu', async () => {
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
