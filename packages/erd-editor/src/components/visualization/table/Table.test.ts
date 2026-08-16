import { html } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import * as styles from '@/components/erd/canvas/table/Table.styles';
import Table from '@/components/visualization/table/Table';
import { Show } from '@/constants/schema';
import { changeShowAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableColorAction,
  changeTableCommentAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import type { Table as TableEntity } from '@/internal-types';
import { calcTableHeight, calcTableWidths } from '@/utils/calcTable';

const TABLE_ID = 't1';

let app: AppContext;
let table: TableEntity;
let mounted: Mounted | null = null;

function tableTemplate(
  entity: TableEntity,
  columnId: string | null = null,
  x = 120,
  y = 240
) {
  return html`
    <${Table} table=${entity} columnId=${columnId} x=${x} y=${y} />
  `;
}

const rootOf = (m: Mounted) =>
  m.container.querySelector('.table') as HTMLElement;

const rowsOf = (m: Mounted) =>
  Array.from(m.container.querySelectorAll('.column-row')) as HTMLElement[];

const headerInputs = (m: Mounted) =>
  Array.from(
    (
      m.container.querySelector(`.${String(styles.headerInputWrap)}`) as
        | HTMLElement
        | undefined
    )?.querySelectorAll('.edit-input') ?? []
  ) as HTMLElement[];

function addColumn(id: string, name: string) {
  app.store.dispatchSync(
    addColumnAction({ id, tableId: TABLE_ID }),
    changeColumnNameAction({ id, tableId: TABLE_ID, value: name })
  );
}

beforeEach(() => {
  app = createTestAppContext();
  app.store.dispatchSync(
    addTableAction({ id: TABLE_ID, ui: { x: 0, y: 0, zIndex: 2 } }),
    changeTableNameAction({ id: TABLE_ID, value: 'users' })
  );
  table = app.store.state.collections.tableEntities[TABLE_ID];
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  app.store.destroy();
});

describe('visualization Table', () => {
  describe('root element', () => {
    it('renders a fixed positioned preview at the given coordinates', async () => {
      mounted = await mountAndFlush(tableTemplate(table), app);
      const root = rootOf(mounted);

      expect(root).toBeTruthy();
      expect(root.classList.contains('table')).toBe(true);
      expect(root.classList.contains(String(styles.root))).toBe(true);
      expect(root.getAttribute('data-id')).toBe(TABLE_ID);
      expect(root.style.position).toBe('fixed');
      expect(root.style.left).toBe('120px');
      expect(root.style.top).toBe('240px');
    });

    it('sizes itself from the shared table measurement helpers', async () => {
      addColumn('c1', 'id');
      addColumn('c2', 'name');
      mounted = await mountAndFlush(tableTemplate(table), app);
      const root = rootOf(mounted);

      expect(root.style.width).toBe(
        `${calcTableWidths(table, app.store.state).width}px`
      );
      expect(root.style.height).toBe(`${calcTableHeight(table)}px`);
    });

    it('grows in height as columns are added', async () => {
      mounted = await mountAndFlush(tableTemplate(table), app);
      const before = rootOf(mounted).style.height;

      addColumn('c1', 'id');
      await flush();

      expect(rootOf(mounted).style.height).not.toBe(before);
      expect(rootOf(mounted).style.height).toBe(`${calcTableHeight(table)}px`);
    });

    it('moves when the x and y props change', async () => {
      mounted = await mountAndFlush(tableTemplate(table, null, 10, 20), app);

      expect(rootOf(mounted).style.left).toBe('10px');
      expect(rootOf(mounted).style.top).toBe('20px');
    });
  });

  describe('header', () => {
    it('paints the color bar from the table ui color', async () => {
      app.store.dispatchSync(
        changeTableColorAction({
          id: TABLE_ID,
          color: '#ff0000',
          prevColor: '',
        })
      );
      mounted = await mountAndFlush(tableTemplate(table), app);
      const bar = rootOf(mounted).querySelector(
        '.table-header-color'
      ) as HTMLElement;

      expect(bar).toBeTruthy();
      expect(bar.classList.contains(String(styles.headerColor))).toBe(true);
      expect(bar.style.backgroundColor).toBe('#ff0000');
    });

    it('renders the table name with its measured width', async () => {
      mounted = await mountAndFlush(tableTemplate(table), app);
      const [name] = headerInputs(mounted);

      expect(name.textContent?.trim()).toBe('users');
      expect(name.style.width).toBe(`${table.ui.widthName}px`);
    });

    it('renders the comment input while table comments are shown', async () => {
      app.store.dispatchSync(
        changeTableCommentAction({ id: TABLE_ID, value: 'main table' })
      );
      mounted = await mountAndFlush(tableTemplate(table), app);
      const inputs = headerInputs(mounted);

      expect(inputs).toHaveLength(2);
      expect(inputs[1].textContent?.trim()).toBe('main table');
      expect(inputs[1].style.width).toBe(`${table.ui.widthComment}px`);
    });

    it('drops the comment input when table comments are hidden', async () => {
      mounted = await mountAndFlush(tableTemplate(table), app);
      expect(headerInputs(mounted)).toHaveLength(2);

      app.store.dispatchSync(
        changeShowAction({ show: Show.tableComment, value: false })
      );
      await flush();

      expect(headerInputs(mounted)).toHaveLength(1);
    });

    it('leaves the header button area empty in the preview', async () => {
      mounted = await mountAndFlush(tableTemplate(table), app);
      const buttons = rootOf(mounted).querySelector(
        `.${String(styles.headerButtonWrap)}`
      ) as HTMLElement;

      expect(buttons).toBeTruthy();
      expect(buttons.children).toHaveLength(0);
    });
  });

  describe('columns', () => {
    it('renders no rows for a table without columns', async () => {
      mounted = await mountAndFlush(tableTemplate(table), app);

      expect(rowsOf(mounted)).toHaveLength(0);
    });

    it('renders one row per column, in the table column order', async () => {
      addColumn('c1', 'id');
      addColumn('c2', 'name');
      mounted = await mountAndFlush(tableTemplate(table), app);

      expect(rowsOf(mounted).map(row => row.getAttribute('data-id'))).toEqual([
        'c1',
        'c2',
      ]);
    });

    it('selects only the row matching the columnId prop', async () => {
      addColumn('c1', 'id');
      addColumn('c2', 'name');
      mounted = await mountAndFlush(tableTemplate(table, 'c2'), app);

      expect(
        rowsOf(mounted).map(row => row.hasAttribute('data-selected'))
      ).toEqual([false, true]);
    });

    it('selects nothing when the columnId prop is null', async () => {
      addColumn('c1', 'id');
      mounted = await mountAndFlush(tableTemplate(table, null), app);

      expect(rowsOf(mounted)[0].hasAttribute('data-selected')).toBe(false);
    });

    it('hands every row the shared column widths of the table', async () => {
      addColumn('c1', 'a-long-column-name');
      addColumn('c2', 'b');
      mounted = await mountAndFlush(tableTemplate(table), app);

      const widths = calcTableWidths(table, app.store.state);
      const nameCells = rowsOf(mounted).map(
        row =>
          row.querySelectorAll('.column-col:not(.icon)')[0]
            .firstElementChild as HTMLElement
      );

      expect(nameCells.map(cell => cell.style.width)).toEqual([
        `${widths.name}px`,
        `${widths.name}px`,
      ]);
    });

    it('adds a row when a column is appended to the table', async () => {
      addColumn('c1', 'id');
      mounted = await mountAndFlush(tableTemplate(table), app);
      expect(rowsOf(mounted)).toHaveLength(1);

      addColumn('c2', 'name');
      await flush();

      expect(rowsOf(mounted)).toHaveLength(2);
    });
  });
});
