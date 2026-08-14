import { html } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import IndexesColumn from '@/components/erd/table-properties/table-properties-indexes/indexes-column/IndexesColumn';
import * as styles from '@/components/erd/table-properties/table-properties-indexes/indexes-column/IndexesColumn.styles';
import { OrderType } from '@/constants/schema';
import { addIndexAction } from '@/engine/modules/index/atom.actions';
import {
  addIndexColumnAction,
  changeIndexColumnOrderTypeAction,
} from '@/engine/modules/index-column/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import type { Index } from '@/internal-types';

const TABLE_ID = 't1';
const INDEX_ID = 'i1';
const COLUMN_A = 'c1';
const COLUMN_B = 'c2';
const INDEX_COLUMN_A = 'ic1';
const INDEX_COLUMN_B = 'ic2';

const wait = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

const rowsOf = (mounted: Mounted) =>
  Array.from(
    mounted.container.querySelectorAll(`.${String(styles.row)}`)
  ) as HTMLElement[];

const orderCellOf = (row: HTMLElement) =>
  row.querySelector(`.${String(styles.orderType)}`) as HTMLElement;

const click = (el: Element) =>
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

const fire = (el: Element, type: string) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
};

function seed(app: AppContext): Index {
  const { store } = app;
  store.dispatchSync(
    addTableAction({ id: TABLE_ID, ui: { x: 0, y: 0, zIndex: 2 } })
  );
  store.dispatchSync(
    addColumnAction({ id: COLUMN_A, tableId: TABLE_ID }),
    addColumnAction({ id: COLUMN_B, tableId: TABLE_ID })
  );
  store.dispatchSync(
    changeColumnNameAction({
      id: COLUMN_A,
      tableId: TABLE_ID,
      value: 'user_id',
    }),
    changeColumnNameAction({ id: COLUMN_B, tableId: TABLE_ID, value: 'email' })
  );
  store.dispatchSync(addIndexAction({ id: INDEX_ID, tableId: TABLE_ID }));
  store.dispatchSync(
    addIndexColumnAction({
      id: INDEX_COLUMN_A,
      indexId: INDEX_ID,
      tableId: TABLE_ID,
      columnId: COLUMN_A,
    }),
    addIndexColumnAction({
      id: INDEX_COLUMN_B,
      indexId: INDEX_ID,
      tableId: TABLE_ID,
      columnId: COLUMN_B,
    })
  );

  return store.state.collections.indexEntities[INDEX_ID];
}

let app: AppContext;
let index: Index;
let mounted: Mounted | null = null;

beforeEach(() => {
  app = createTestAppContext();
  index = seed(app);
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  app.store.destroy();
});

describe('IndexesColumn', () => {
  describe('markup', () => {
    it('renders one draggable row per index column, in order', async () => {
      mounted = await mountAndFlush(
        html`<${IndexesColumn} index=${index} />`,
        app
      );

      const rows = rowsOf(mounted);
      expect(rows).toHaveLength(2);
      expect(rows.map(row => row.dataset.id)).toEqual([
        INDEX_COLUMN_A,
        INDEX_COLUMN_B,
      ]);
      expect(rows.every(row => row.getAttribute('draggable') === 'true')).toBe(
        true
      );
    });

    it('renders the drag handle, the order type cell and the column name', async () => {
      mounted = await mountAndFlush(
        html`<${IndexesColumn} index=${index} />`,
        app
      );

      const [first] = rowsOf(mounted);
      const order = orderCellOf(first);

      expect(first.querySelector('.icon svg')).toBeTruthy();
      expect(order.textContent?.trim()).toBe('ASC');
      expect(order.getAttribute('title')).toBe('Ascending');
      expect(order.style.width).toBe('40px');
      expect(order.classList.contains('checked')).toBe(true);
      expect(first.lastElementChild?.textContent?.trim()).toBe('user_id');
    });

    it('renders an empty order cell for an unknown order type', async () => {
      app.store.dispatchSync(
        changeIndexColumnOrderTypeAction({
          id: INDEX_COLUMN_A,
          indexId: INDEX_ID,
          columnId: COLUMN_A,
          value: 0,
        })
      );
      mounted = await mountAndFlush(
        html`<${IndexesColumn} index=${index} />`,
        app
      );

      const order = orderCellOf(rowsOf(mounted)[0]);
      expect(order.textContent?.trim()).toBe('');
      expect(order.getAttribute('title') ?? '').toBe('');
    });

    it('renders nothing but the root when the index has no columns', async () => {
      app.store.dispatchSync(addIndexAction({ id: 'i2', tableId: TABLE_ID }));
      const empty = app.store.state.collections.indexEntities['i2'];

      mounted = await mountAndFlush(
        html`<${IndexesColumn} index=${empty} />`,
        app
      );

      const root = mounted.container.querySelector(
        `.${String(styles.root)}`
      ) as HTMLElement;
      expect(root).toBeTruthy();
      expect(rowsOf(mounted)).toHaveLength(0);
    });
  });

  describe('order type', () => {
    it('cycles ASC to DESC and back on click', async () => {
      mounted = await mountAndFlush(
        html`<${IndexesColumn} index=${index} />`,
        app
      );

      click(orderCellOf(rowsOf(mounted)[0]).parentElement as HTMLElement);
      await flush();
      expect(
        app.store.state.collections.indexColumnEntities[INDEX_COLUMN_A]
          .orderType
      ).toBe(OrderType.DESC);
      expect(orderCellOf(rowsOf(mounted)[0]).textContent?.trim()).toBe('DESC');
      expect(orderCellOf(rowsOf(mounted)[0]).getAttribute('title')).toBe(
        'Descending'
      );

      click(orderCellOf(rowsOf(mounted)[0]).parentElement as HTMLElement);
      await flush();
      expect(
        app.store.state.collections.indexColumnEntities[INDEX_COLUMN_A]
          .orderType
      ).toBe(OrderType.ASC);
    });

    it('keeps the order type change out of the undo history', async () => {
      mounted = await mountAndFlush(
        html`<${IndexesColumn} index=${index} />`,
        app
      );
      const size = app.store.history.size;

      click(orderCellOf(rowsOf(mounted)[0]).parentElement as HTMLElement);
      await flush();

      expect(app.store.history.size).toBe(size);
    });
  });

  describe('drag and drop', () => {
    it('prevents the default of dragenter and dragover on the root', async () => {
      mounted = await mountAndFlush(
        html`<${IndexesColumn} index=${index} />`,
        app
      );
      const root = mounted.container.querySelector(
        `.${String(styles.root)}`
      ) as HTMLElement;

      expect(fire(root, 'dragenter').defaultPrevented).toBe(true);
      expect(fire(root, 'dragover').defaultPrevented).toBe(true);
    });

    it('marks the dragged row and mutes hover on every row', async () => {
      mounted = await mountAndFlush(
        html`<${IndexesColumn} index=${index} />`,
        app
      );
      const rows = rowsOf(mounted);

      fire(rows[0], 'dragstart');

      expect(rows[0].classList.contains('dragging')).toBe(true);
      expect(rows.every(row => row.classList.contains('none-hover'))).toBe(
        true
      );

      fire(rows[0], 'dragend');
      await flush();

      expect(rows[0].classList.contains('dragging')).toBe(false);
      expect(rows.some(row => row.classList.contains('none-hover'))).toBe(
        false
      );
    });

    it('ignores a dragstart whose target carries no data-id', async () => {
      mounted = await mountAndFlush(
        html`<${IndexesColumn} index=${index} />`,
        app
      );
      const rows = rowsOf(mounted);
      const handle = rows[0].querySelector('.icon') as HTMLElement;

      fire(handle, 'dragstart');

      expect(rows[0].classList.contains('dragging')).toBe(false);
      expect(rows[0].classList.contains('none-hover')).toBe(false);
    });

    it('ignores a dragstart without a target element', async () => {
      mounted = await mountAndFlush(
        html`<${IndexesColumn} index=${index} />`,
        app
      );
      const rows = rowsOf(mounted);

      const event = new Event('dragstart', { bubbles: true });
      Object.defineProperty(event, 'target', {
        configurable: true,
        get: () => null,
      });
      rows[0].dispatchEvent(event);

      expect(rows[0].classList.contains('dragging')).toBe(false);
    });

    it('moves the dragged column in front of the row it hovers', async () => {
      mounted = await mountAndFlush(
        html`<${IndexesColumn} index=${index} />`,
        app
      );
      const rows = rowsOf(mounted);

      fire(rows[1], 'dragstart');
      fire(rows[0], 'dragover');
      await wait(120);
      await flush();

      expect(
        app.store.state.collections.indexEntities[INDEX_ID].indexColumnIds
      ).toEqual([INDEX_COLUMN_B, INDEX_COLUMN_A]);
      expect(rowsOf(mounted).map(row => row.dataset.id)).toEqual([
        INDEX_COLUMN_B,
        INDEX_COLUMN_A,
      ]);

      fire(rows[1], 'dragend');
    });

    it('does not move anything when the row hovers itself', async () => {
      mounted = await mountAndFlush(
        html`<${IndexesColumn} index=${index} />`,
        app
      );
      const rows = rowsOf(mounted);

      fire(rows[0], 'dragstart');
      fire(rows[0], 'dragover');
      await wait(120);
      await flush();

      expect(
        app.store.state.collections.indexEntities[INDEX_ID].indexColumnIds
      ).toEqual([INDEX_COLUMN_A, INDEX_COLUMN_B]);

      fire(rows[0], 'dragend');
    });

    it('stops listening for moves once the drag ends', async () => {
      mounted = await mountAndFlush(
        html`<${IndexesColumn} index=${index} />`,
        app
      );
      const rows = rowsOf(mounted);

      fire(rows[1], 'dragstart');
      fire(rows[1], 'dragend');
      fire(rows[0], 'dragover');
      await wait(120);
      await flush();

      expect(
        app.store.state.collections.indexEntities[INDEX_ID].indexColumnIds
      ).toEqual([INDEX_COLUMN_A, INDEX_COLUMN_B]);
    });
  });
});
