import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { diffState } from '@/components/erd/diff-viewer/diff';
import TreeViewer from '@/components/erd/diff-viewer/tree-viewer/TreeViewer';
import * as styles from '@/components/erd/diff-viewer/tree-viewer/TreeViewer.styles';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import {
  addTableAction,
  changeTableCommentAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnDataTypeAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';

type ColumnSeed = { id: string; name: string; dataType?: string };

type TableSeed = {
  id: string;
  name: string;
  comment?: string;
  x?: number;
  y?: number;
  columns?: ColumnSeed[];
};

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

function createApp(tables: TableSeed[]): AppContext {
  const app = createTestAppContext();
  app.store.dispatchSync(changeViewportAction({ width: 1000, height: 800 }));

  tables.forEach(table => {
    app.store.dispatchSync(
      addTableAction({
        id: table.id,
        ui: { x: table.x ?? 0, y: table.y ?? 0, zIndex: 1 },
      })
    );
    app.store.dispatchSync(
      changeTableNameAction({ id: table.id, value: table.name })
    );
    if (table.comment !== undefined) {
      app.store.dispatchSync(
        changeTableCommentAction({ id: table.id, value: table.comment })
      );
    }

    (table.columns ?? []).forEach(column => {
      app.store.dispatchSync(
        addColumnAction({ tableId: table.id, id: column.id })
      );
      app.store.dispatchSync(
        changeColumnNameAction({
          tableId: table.id,
          id: column.id,
          value: column.name,
        })
      );
      if (column.dataType !== undefined) {
        app.store.dispatchSync(
          changeColumnDataTypeAction({
            tableId: table.id,
            id: column.id,
            value: column.dataType,
          })
        );
      }
    });
  });

  return app;
}

async function mountTree(prevTables: TableSeed[], tables: TableSeed[]) {
  const prevApp = createApp(prevTables);
  const app = createApp(tables);
  const [prevDiffMap, diffMap] = diffState(
    prevApp.store.state,
    app.store.state
  );

  mounted = await mountAndFlush(
    html`<${TreeViewer}
      prevApp=${prevApp}
      prevDiffMap=${prevDiffMap}
      app=${app}
      diffMap=${diffMap}
    />`
  );

  return { prevApp, app };
}

const tableRows = () =>
  Array.from(
    mounted!.container.querySelectorAll<HTMLElement>(`.${String(styles.table)}`)
  );
const columnRows = () =>
  Array.from(
    mounted!.container.querySelectorAll<HTMLElement>(
      `.${String(styles.column)}`
    )
  );
const labelOf = (row: HTMLElement) =>
  row.querySelector<HTMLElement>(`.${String(styles.ellipsis)}`)?.textContent;
const diffClassOf = (row: HTMLElement) => {
  const icon = row.querySelector<HTMLElement>(`.${String(styles.icon)}`)!;
  if (icon.classList.contains('diff-cross')) return 'cross';
  if (icon.classList.contains('diff-insert')) return 'insert';
  if (icon.classList.contains('diff-delete')) return 'delete';
  return 'none';
};

describe('TreeViewer', () => {
  it('renders an empty tree root when nothing differs', async () => {
    await mountTree(
      [{ id: 'p1', name: 'users' }],
      [{ id: 'n1', name: 'users' }]
    );

    const root = mounted!.container.querySelector<HTMLElement>(
      `.${String(styles.root)}`
    );
    expect(root).toBeTruthy();
    expect(tableRows()).toHaveLength(0);
    expect(columnRows()).toHaveLength(0);
  });

  it('lists a renamed table as one delete row and one insert row, sorted by name', async () => {
    await mountTree(
      [{ id: 'p1', name: 'users' }],
      [{ id: 'n1', name: 'members' }]
    );

    const rows = tableRows();
    expect(rows.map(labelOf)).toEqual(['members', 'users']);
    expect(rows.map(diffClassOf)).toEqual(['insert', 'delete']);
    expect(columnRows()).toHaveLength(0);
  });

  it('marks a table whose comment changed as a cross row', async () => {
    await mountTree(
      [{ id: 'p1', name: 'users', comment: 'old' }],
      [{ id: 'n1', name: 'users', comment: 'new' }]
    );

    const rows = tableRows();
    expect(rows).toHaveLength(1);
    expect(labelOf(rows[0])).toBe('users');
    expect(diffClassOf(rows[0])).toBe('cross');
  });

  it('renders a plain table row for a table that only lost a column', async () => {
    await mountTree(
      [
        {
          id: 'p1',
          name: 'users',
          columns: [
            { id: 'pc1', name: 'id' },
            { id: 'pc2', name: 'legacy' },
          ],
        },
      ],
      [{ id: 'n1', name: 'users', columns: [{ id: 'nc1', name: 'id' }] }]
    );

    const rows = tableRows();
    expect(rows).toHaveLength(1);
    expect(diffClassOf(rows[0])).toBe('none');
    // the plain row still renders the fallback table icon
    expect(rows[0].querySelector('svg')).toBeTruthy();

    const columns = columnRows();
    expect(columns.map(labelOf)).toEqual(['legacy']);
    expect(columns.map(diffClassOf)).toEqual(['delete']);
  });

  it('renders a cross column row when a matched column changed its data type', async () => {
    await mountTree(
      [
        {
          id: 'p1',
          name: 'users',
          columns: [{ id: 'pc1', name: 'id', dataType: 'int' }],
        },
      ],
      [
        {
          id: 'n1',
          name: 'users',
          columns: [{ id: 'nc1', name: 'id', dataType: 'bigint' }],
        },
      ]
    );

    const columns = columnRows();
    expect(columns.map(labelOf)).toEqual(['id']);
    expect(columns.map(diffClassOf)).toEqual(['cross']);
    expect(tableRows().map(diffClassOf)).toEqual(['none']);
  });

  it('lists both the removed and the added column of a reworked table', async () => {
    await mountTree(
      [
        {
          id: 'p1',
          name: 'users',
          columns: [
            { id: 'pc1', name: 'id' },
            { id: 'pc2', name: 'legacy' },
          ],
        },
      ],
      [
        {
          id: 'n1',
          name: 'users',
          columns: [
            { id: 'nc1', name: 'id' },
            { id: 'nc2', name: 'fresh' },
          ],
        },
      ]
    );

    const columns = columnRows();
    expect(columns.map(labelOf)).toEqual(['legacy', 'fresh']);
    expect(columns.map(diffClassOf)).toEqual(['delete', 'insert']);
  });

  it('lists a brand new table together with its columns as inserts', async () => {
    await mountTree(
      [],
      [
        {
          id: 'n1',
          name: 'posts',
          columns: [
            { id: 'nc1', name: 'id' },
            { id: 'nc2', name: 'title' },
          ],
        },
      ]
    );

    expect(tableRows().map(labelOf)).toEqual(['posts']);
    expect(tableRows().map(diffClassOf)).toEqual(['insert']);
    expect(columnRows().map(labelOf)).toEqual(['id', 'title']);
    expect(columnRows().map(diffClassOf)).toEqual(['insert', 'insert']);
  });

  it('lists a removed table together with its columns as deletes', async () => {
    await mountTree(
      [{ id: 'p1', name: 'posts', columns: [{ id: 'pc1', name: 'id' }] }],
      []
    );

    expect(tableRows().map(diffClassOf)).toEqual(['delete']);
    expect(columnRows().map(labelOf)).toEqual(['id']);
    expect(columnRows().map(diffClassOf)).toEqual(['delete']);
  });

  it('falls back to "unnamed" for blank table and column names', async () => {
    await mountTree(
      [],
      [{ id: 'n1', name: '  ', columns: [{ id: 'nc1', name: '' }] }]
    );

    expect(tableRows().map(labelOf)).toEqual(['unnamed']);
    expect(columnRows().map(labelOf)).toEqual(['unnamed']);
  });

  it('reports nothing when a column is added to an otherwise untouched table', async () => {
    // known gap: the added column never reaches the tree because the table
    // itself has no diff entry and the insert branch skips matched names.
    await mountTree(
      [{ id: 'p1', name: 'users', columns: [{ id: 'pc1', name: 'id' }] }],
      [
        {
          id: 'n1',
          name: 'users',
          columns: [
            { id: 'nc1', name: 'id' },
            { id: 'nc2', name: 'email' },
          ],
        },
      ]
    );

    expect(tableRows()).toHaveLength(0);
    expect(columnRows()).toHaveLength(0);
  });

  it('scrolls and selects on both sides when a cross row is clicked', async () => {
    const { prevApp, app } = await mountTree(
      [{ id: 'p1', name: 'users', comment: 'old', x: 700, y: 500 }],
      [{ id: 'n1', name: 'users', comment: 'new', x: 700, y: 500 }]
    );

    tableRows()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(prevApp.store.state.editor.selectedMap.p1).toBeTruthy();
    expect(app.store.state.editor.selectedMap.n1).toBeTruthy();
    expect(prevApp.store.state.editor.focusTable?.tableId).toBe('p1');
    expect(app.store.state.editor.focusTable?.tableId).toBe('n1');
    expect(prevApp.store.state.settings.scrollLeft).toBe(-500);
    expect(prevApp.store.state.settings.scrollTop).toBe(-400);
    expect(app.store.state.settings.scrollLeft).toBe(-500);
    expect(app.store.state.settings.scrollTop).toBe(-400);
  });

  it('moves only the previous side for a delete only row', async () => {
    const { prevApp, app } = await mountTree(
      [{ id: 'p1', name: 'users', x: 700, y: 500 }],
      [{ id: 'n1', name: 'members', x: 700, y: 500 }]
    );

    const usersRow = tableRows().find(row => labelOf(row) === 'users')!;
    usersRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(prevApp.store.state.editor.selectedMap.p1).toBeTruthy();
    expect(prevApp.store.state.settings.scrollLeft).toBe(-500);
    expect(app.store.state.editor.selectedMap.n1).toBeFalsy();
    expect(app.store.state.settings.scrollLeft).toBe(0);
  });

  it('moves only the new side for an insert only row', async () => {
    const { prevApp, app } = await mountTree(
      [{ id: 'p1', name: 'users', x: 700, y: 500 }],
      [{ id: 'n1', name: 'members', x: 700, y: 500 }]
    );

    const membersRow = tableRows().find(row => labelOf(row) === 'members')!;
    membersRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(app.store.state.editor.selectedMap.n1).toBeTruthy();
    expect(app.store.state.settings.scrollLeft).toBe(-500);
    expect(prevApp.store.state.editor.selectedMap.p1).toBeFalsy();
    expect(prevApp.store.state.settings.scrollLeft).toBe(0);
  });

  it('clicking a column row moves to its owning table', async () => {
    const { prevApp, app } = await mountTree(
      [
        {
          id: 'p1',
          name: 'users',
          x: 700,
          y: 500,
          columns: [{ id: 'pc1', name: 'id', dataType: 'int' }],
        },
      ],
      [
        {
          id: 'n1',
          name: 'users',
          x: 700,
          y: 500,
          columns: [{ id: 'nc1', name: 'id', dataType: 'bigint' }],
        },
      ]
    );

    columnRows()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(prevApp.store.state.editor.selectedMap.p1).toBeTruthy();
    expect(app.store.state.editor.selectedMap.n1).toBeTruthy();
  });

  it('ignores a click whose table has vanished from the collection', async () => {
    const { prevApp, app } = await mountTree(
      [{ id: 'p1', name: 'users', comment: 'old', x: 700, y: 500 }],
      [{ id: 'n1', name: 'users', comment: 'new', x: 700, y: 500 }]
    );

    delete (prevApp.store.state.collections.tableEntities as any).p1;
    delete (app.store.state.collections.tableEntities as any).n1;

    tableRows()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flush();

    expect(prevApp.store.state.settings.scrollLeft).toBe(0);
    expect(app.store.state.settings.scrollLeft).toBe(0);
    expect(prevApp.store.state.editor.selectedMap.p1).toBeFalsy();
  });
});
