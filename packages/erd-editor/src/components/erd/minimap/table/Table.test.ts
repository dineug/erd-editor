import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import * as canvasTableStyles from '@/components/erd/canvas/table/Table.styles';
import Table from '@/components/erd/minimap/table/Table';
import { Show } from '@/constants/schema';
import { changeShowAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import type { Table as TableType } from '@/internal-types';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const createTable = (
  ui: Partial<TableType['ui']> = {},
  columnIds: string[] = []
): TableType => ({
  id: 'table-1',
  name: 'users',
  comment: '',
  columnIds,
  seqColumnIds: [...columnIds],
  ui: {
    x: 11,
    y: 22,
    zIndex: 5,
    widthName: 60,
    widthComment: 60,
    color: '',
    ...ui,
  },
  meta: { updateAt: 0, createAt: 0 },
});

const tableOf = () => mounted!.container.querySelector<HTMLElement>('.table')!;

describe('minimap Table', () => {
  it('renders an empty box carrying the shared canvas table class', async () => {
    mounted = await mountAndFlush(html`<${Table} table=${createTable()} />`);

    const el = tableOf();
    expect(el).toBeTruthy();
    expect(el.tagName).toBe('DIV');
    expect(el.classList.contains('table')).toBe(true);
    expect(el.classList.contains(String(canvasTableStyles.root))).toBe(true);
    expect(el.childElementCount).toBe(0);
    expect(el.textContent).toBe('');
  });

  it('places the box at the table position and z-index', async () => {
    mounted = await mountAndFlush(
      html`<${Table} table=${createTable({ x: 11, y: 22, zIndex: 5 })} />`
    );

    const el = tableOf();
    expect(el.style.left).toBe('11px');
    expect(el.style.top).toBe('22px');
    expect(el.style.zIndex).toBe('5');
  });

  it('sizes a column-less table from the default column widths', async () => {
    mounted = await mountAndFlush(html`<${Table} table=${createTable()} />`);

    const el = tableOf();
    // border + padding + default column widths + padding + border
    expect(el.style.width).toBe('365px');
    // border + padding + header + 0 columns + padding + border
    expect(el.style.height).toBe('56px');
  });

  it('grows the height by one column row per column id', async () => {
    mounted = await mountAndFlush(
      html`<${Table} table=${createTable({}, ['c1', 'c2', 'c3'])} />`
    );

    expect(tableOf().style.height).toBe(`${56 + 3 * 24}px`);
  });

  it('narrows the box when the store hides the comment columns', async () => {
    const app = createTestAppContext();
    mounted = await mountAndFlush(
      html`<${Table} table=${createTable()} />`,
      app
    );

    const before = tableOf().style.width;

    app.store.dispatchSync(
      changeShowAction({ show: Show.columnComment, value: false })
    );
    app.store.dispatchSync(
      changeShowAction({ show: Show.columnDataType, value: false })
    );
    await flush();

    const after = tableOf().style.width;
    expect(before).toBe('365px');
    expect(after).toBe('229px');
  });

  it('widens the box to fit the widest column registered in the store', async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(
      addTableAction({ id: 'table-1', ui: { x: 0, y: 0, zIndex: 1 } })
    );
    app.store.dispatchSync(
      addColumnAction({ tableId: 'table-1', id: 'column-1' })
    );

    const column = app.store.state.collections.tableColumnEntities['column-1'];
    column.ui.widthName = 400;

    mounted = await mountAndFlush(
      html`<${Table} table=${createTable({}, ['column-1'])} />`,
      app
    );

    // key/delete 32 + name 408 + comment 68 + dataType 68 + default 68
    // + notNull 43 = 687, plus 1 border + 8 padding on both sides
    expect(tableOf().style.width).toBe('705px');
  });
});
