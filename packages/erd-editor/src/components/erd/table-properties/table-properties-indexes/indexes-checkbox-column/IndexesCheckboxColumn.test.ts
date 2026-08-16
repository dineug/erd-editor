import { html } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import IndexesCheckboxColumn from '@/components/erd/table-properties/table-properties-indexes/indexes-checkbox-column/IndexesCheckboxColumn';
import * as styles from '@/components/erd/table-properties/table-properties-indexes/indexes-checkbox-column/IndexesCheckboxColumn.styles';
import {
  COLUMN_AUTO_INCREMENT_WIDTH,
  COLUMN_UNIQUE_WIDTH,
} from '@/constants/layout';
import { Show } from '@/constants/schema';
import { addIndexAction } from '@/engine/modules/index/atom.actions';
import { addIndexColumnAction } from '@/engine/modules/index-column/atom.actions';
import { changeShowAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnNameAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import type { Index } from '@/internal-types';
import { calcTableWidths } from '@/utils/calcTable';

const TABLE_ID = 't1';
const INDEX_ID = 'i1';
const COLUMN_A = 'c1';
const COLUMN_B = 'c2';

const rowsOf = (mounted: Mounted) =>
  Array.from(
    mounted.container.querySelectorAll('.column-row')
  ) as HTMLElement[];

const checkboxesOf = (mounted: Mounted) =>
  Array.from(
    mounted.container.querySelectorAll('input[type="checkbox"]')
  ) as HTMLInputElement[];

const cellTextsOf = (row: HTMLElement) =>
  Array.from(row.children).map(el => el.textContent?.trim() ?? '');

const changeCheckbox = (input: HTMLInputElement, checked: boolean) => {
  input.checked = checked;
  input.dispatchEvent(new InputEvent('change', { bubbles: true }));
};

function seed(app: AppContext) {
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
}

const indexOf = (app: AppContext): Index =>
  app.store.state.collections.indexEntities[INDEX_ID];

let app: AppContext;
let mounted: Mounted | null = null;

beforeEach(() => {
  app = createTestAppContext();
  seed(app);
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  app.store.destroy();
});

describe('IndexesCheckboxColumn', () => {
  describe('markup', () => {
    it('renders nothing when the table id does not resolve', async () => {
      mounted = await mountAndFlush(
        html`
          <${IndexesCheckboxColumn}
            tableId=${'missing'}
            index=${indexOf(app)}
          />
        `,
        app
      );

      expect(mounted.container.querySelector('.column-row')).toBeNull();
      expect(
        mounted.container.querySelector(`.${String(styles.root)}`)
      ).toBeNull();
    });

    it('renders a scrollable root with one row per table column', async () => {
      mounted = await mountAndFlush(
        html`
          <${IndexesCheckboxColumn} tableId=${TABLE_ID} index=${indexOf(app)} />
        `,
        app
      );

      const root = mounted.container.querySelector(
        `.${String(styles.root)}`
      ) as HTMLElement;

      expect(root).toBeTruthy();
      expect(root.classList.contains('scrollbar')).toBe(true);
      expect(rowsOf(mounted)).toHaveLength(2);
    });

    it('renders the checkbox, the key icon and the configured column order', async () => {
      mounted = await mountAndFlush(
        html`
          <${IndexesCheckboxColumn} tableId=${TABLE_ID} index=${indexOf(app)} />
        `,
        app
      );

      const [first] = rowsOf(mounted);

      expect(cellTextsOf(first)).toEqual([
        '',
        '',
        'user_id',
        'dataType',
        'NULL',
        'default',
        'comment',
      ]);
      expect(first.children[1].classList.contains('icon')).toBe(true);
    });

    it('marks the key icon as a primary key', async () => {
      app.store.dispatchSync(
        changeColumnPrimaryKeyAction({
          id: COLUMN_A,
          tableId: TABLE_ID,
          value: true,
        })
      );
      mounted = await mountAndFlush(
        html`
          <${IndexesCheckboxColumn} tableId=${TABLE_ID} index=${indexOf(app)} />
        `,
        app
      );

      expect(rowsOf(mounted)[0].children[1].classList.contains('pk')).toBe(
        true
      );
      expect(rowsOf(mounted)[1].children[1].classList.contains('pk')).toBe(
        false
      );
    });

    it('sizes the editable cells from the calculated table widths', async () => {
      const widths = calcTableWidths(
        app.store.state.collections.tableEntities[TABLE_ID],
        app.store.state
      );
      mounted = await mountAndFlush(
        html`
          <${IndexesCheckboxColumn} tableId=${TABLE_ID} index=${indexOf(app)} />
        `,
        app
      );

      const inputs = Array.from(
        rowsOf(mounted)[0].querySelectorAll('.edit-input')
      ) as HTMLElement[];

      expect(inputs.map(el => el.style.width)).toEqual([
        `${widths.name}px`,
        `${widths.dataType}px`,
        `${widths.default}px`,
        `${widths.comment}px`,
      ]);
    });

    it('adds the unique and auto increment cells when they are shown', async () => {
      app.store.dispatchSync(
        changeShowAction({ show: Show.columnUnique, value: true }),
        changeShowAction({ show: Show.columnAutoIncrement, value: true })
      );
      mounted = await mountAndFlush(
        html`
          <${IndexesCheckboxColumn} tableId=${TABLE_ID} index=${indexOf(app)} />
        `,
        app
      );

      const [first] = rowsOf(mounted);
      expect(cellTextsOf(first)).toEqual([
        '',
        '',
        'user_id',
        'dataType',
        'NULL',
        'UQ',
        'AI',
        'default',
        'comment',
      ]);

      const unique = first.querySelector('[title="Unique"]') as HTMLElement;
      const autoIncrement = first.querySelector(
        '[title="Auto Increment"]'
      ) as HTMLElement;
      expect(unique.style.width).toBe(`${COLUMN_UNIQUE_WIDTH}px`);
      expect(autoIncrement.style.width).toBe(
        `${COLUMN_AUTO_INCREMENT_WIDTH}px`
      );
    });

    it('drops every optional cell when its show flag is turned off', async () => {
      app.store.dispatchSync(
        changeShowAction({ show: Show.columnDataType, value: false }),
        changeShowAction({ show: Show.columnNotNull, value: false }),
        changeShowAction({ show: Show.columnDefault, value: false }),
        changeShowAction({ show: Show.columnComment, value: false })
      );
      mounted = await mountAndFlush(
        html`
          <${IndexesCheckboxColumn} tableId=${TABLE_ID} index=${indexOf(app)} />
        `,
        app
      );

      expect(cellTextsOf(rowsOf(mounted)[0])).toEqual(['', '', 'user_id']);
    });
  });

  describe('checkbox state', () => {
    it('disables every checkbox while no index is selected', async () => {
      mounted = await mountAndFlush(
        html`<${IndexesCheckboxColumn} tableId=${TABLE_ID} index=${null} />`,
        app
      );

      const checkboxes = checkboxesOf(mounted);
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes.every(input => input.disabled)).toBe(true);
      expect(checkboxes.every(input => !input.checked)).toBe(true);
    });

    it('enables the checkboxes and reflects the index columns already set', async () => {
      app.store.dispatchSync(
        addIndexColumnAction({
          id: 'ic1',
          indexId: INDEX_ID,
          tableId: TABLE_ID,
          columnId: COLUMN_B,
        })
      );
      mounted = await mountAndFlush(
        html`
          <${IndexesCheckboxColumn} tableId=${TABLE_ID} index=${indexOf(app)} />
        `,
        app
      );

      const checkboxes = checkboxesOf(mounted);
      expect(checkboxes.every(input => input.disabled)).toBe(false);
      expect(checkboxes.map(input => input.checked)).toEqual([false, true]);
    });
  });

  describe('toggling an index column', () => {
    it('adds the column to the index when checked', async () => {
      mounted = await mountAndFlush(
        html`
          <${IndexesCheckboxColumn} tableId=${TABLE_ID} index=${indexOf(app)} />
        `,
        app
      );

      changeCheckbox(checkboxesOf(mounted)[0], true);
      await flush();

      const { indexColumnIds } = indexOf(app);
      expect(indexColumnIds).toHaveLength(1);
      expect(
        app.store.state.collections.indexColumnEntities[indexColumnIds[0]]
          .columnId
      ).toBe(COLUMN_A);
      expect(checkboxesOf(mounted)[0].checked).toBe(true);
    });

    it('removes the column from the index when unchecked', async () => {
      app.store.dispatchSync(
        addIndexColumnAction({
          id: 'ic1',
          indexId: INDEX_ID,
          tableId: TABLE_ID,
          columnId: COLUMN_A,
        })
      );
      mounted = await mountAndFlush(
        html`
          <${IndexesCheckboxColumn} tableId=${TABLE_ID} index=${indexOf(app)} />
        `,
        app
      );

      changeCheckbox(checkboxesOf(mounted)[0], false);
      await flush();

      expect(indexOf(app).indexColumnIds).toEqual([]);
      expect(checkboxesOf(mounted)[0].checked).toBe(false);
    });

    it('reuses the previous index column id when the same column is re-added', async () => {
      mounted = await mountAndFlush(
        html`
          <${IndexesCheckboxColumn} tableId=${TABLE_ID} index=${indexOf(app)} />
        `,
        app
      );

      changeCheckbox(checkboxesOf(mounted)[0], true);
      await flush();
      const [firstId] = indexOf(app).indexColumnIds;

      changeCheckbox(checkboxesOf(mounted)[0], false);
      await flush();
      changeCheckbox(checkboxesOf(mounted)[0], true);
      await flush();

      expect(indexOf(app).indexColumnIds).toEqual([firstId]);
    });

    it('keeps the toggle out of the undo history', async () => {
      mounted = await mountAndFlush(
        html`
          <${IndexesCheckboxColumn} tableId=${TABLE_ID} index=${indexOf(app)} />
        `,
        app
      );
      const size = app.store.history.size;

      changeCheckbox(checkboxesOf(mounted)[0], true);
      await flush();

      expect(indexOf(app).indexColumnIds).toHaveLength(1);
      expect(app.store.history.size).toBe(size);
    });

    it('ignores a change event without a target element', async () => {
      mounted = await mountAndFlush(
        html`
          <${IndexesCheckboxColumn} tableId=${TABLE_ID} index=${indexOf(app)} />
        `,
        app
      );

      const input = checkboxesOf(mounted)[0];
      input.checked = true;
      const event = new InputEvent('change', { bubbles: true });
      Object.defineProperty(event, 'target', {
        configurable: true,
        get: () => null,
      });
      input.dispatchEvent(event);
      await flush();

      expect(indexOf(app).indexColumnIds).toEqual([]);
    });
  });
});
