import { FC, html, observable } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import * as indexColumnStyles from '@/components/erd/table-properties/table-properties-indexes/indexes-column/IndexesColumn.styles';
import * as indexStyles from '@/components/erd/table-properties/table-properties-indexes/indexes-index/IndexesIndex.styles';
import * as keyStyles from '@/components/erd/table-properties/table-properties-indexes/indexes-key/IndexesKey.styles';
import TablePropertiesIndexes from '@/components/erd/table-properties/table-properties-indexes/TablePropertiesIndexes';
import * as styles from '@/components/erd/table-properties/table-properties-indexes/TablePropertiesIndexes.styles';
import * as separatorStyles from '@/components/primitives/separator/Separator.styles';
import {
  addIndexAction,
  changeIndexUniqueAction,
  removeIndexAction,
} from '@/engine/modules/index/atom.actions';
import { addIndexColumnAction } from '@/engine/modules/index-column/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnPrimaryKeyAction,
  changeColumnUniqueAction,
} from '@/engine/modules/table-column/atom.actions';

const TABLE_ID = 't1';
const OTHER_TABLE_ID = 't2';

const template = (tableId = TABLE_ID) =>
  html`<${TablePropertiesIndexes} tableId=${tableId} />`;

/**
 * Mirrors Erd.tsx: the table tab strip swaps tableId while the panel — and
 * with it whatever this component has selected — stays mounted.
 */
const Host: FC = () => {
  const hostState = observable({ tableId: TABLE_ID });
  const handleSwitchTable = () => {
    hostState.tableId =
      hostState.tableId === TABLE_ID ? OTHER_TABLE_ID : TABLE_ID;
  };

  return () => html`
    <div class="switch-table" @click=${handleSwitchTable}></div>
    <${TablePropertiesIndexes} tableId=${hostState.tableId} />
  `;
};

/**
 * IndexesIndex.styles.row and Column.styles.root declare the same top level
 * block, so r-html hands both of them the same generated class name. Scope the
 * lookup to the left pane so the checkbox rows of the right pane cannot match.
 */
const indexRowsOf = (mounted: Mounted) =>
  Array.from(
    mounted.container.querySelectorAll(
      `.${String(styles.leftArea)} > .${String(indexStyles.row)}`
    )
  ) as HTMLElement[];

const keyRowsOf = (mounted: Mounted) =>
  Array.from(
    mounted.container.querySelectorAll(
      `.${String(styles.leftArea)} > .${String(keyStyles.row)}`
    )
  ) as HTMLElement[];

const addButtonOf = (mounted: Mounted) =>
  mounted.container.querySelector(
    `.${String(styles.addIndexButtonArea)}`
  ) as HTMLElement;

const indexColumnRootOf = (mounted: Mounted) =>
  mounted.container.querySelector(
    `.${String(styles.rightArea)} > .${String(indexColumnStyles.root)}`
  ) as HTMLElement | null;

const checkboxesOf = (mounted: Mounted) =>
  Array.from(
    mounted.container.querySelectorAll('input[type="checkbox"]')
  ) as HTMLInputElement[];

const click = (el: Element) =>
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

/**
 * Mirrors a real click: the browser flips the checked property before the
 * change event, which is what sets the input's dirty checkedness flag.
 */
const changeCheckbox = (input: HTMLInputElement, checked: boolean) => {
  input.checked = checked;
  input.dispatchEvent(new InputEvent('change', { bubbles: true }));
};

const indexColumnRowsOf = (mounted: Mounted) =>
  Array.from(indexColumnRootOf(mounted)?.children ?? []);

function seed(app: AppContext) {
  const { store } = app;
  store.dispatchSync(
    addTableAction({ id: TABLE_ID, ui: { x: 0, y: 0, zIndex: 2 } }),
    addTableAction({ id: OTHER_TABLE_ID, ui: { x: 0, y: 0, zIndex: 3 } })
  );
  store.dispatchSync(
    addColumnAction({ id: 'c1', tableId: TABLE_ID }),
    addColumnAction({ id: 'c2', tableId: OTHER_TABLE_ID })
  );
}

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

describe('TablePropertiesIndexes', () => {
  describe('layout', () => {
    it('renders the two panes and the add index button', async () => {
      mounted = await mountAndFlush(template(), app);

      expect(
        mounted.container.querySelector(`.${String(styles.leftArea)}`)
      ).toBeTruthy();
      expect(
        mounted.container.querySelector(`.${String(styles.rightArea)}`)
      ).toBeTruthy();

      const addButton = addButtonOf(mounted);
      expect(addButton.getAttribute('title')).toBe('Add Index');
      expect(addButton.querySelector('.icon svg')).toBeTruthy();
    });

    it('renders the checkbox column and no index column pane at first', async () => {
      mounted = await mountAndFlush(template(), app);

      expect(checkboxesOf(mounted)).toHaveLength(1);
      expect(checkboxesOf(mounted)[0].disabled).toBe(true);
      expect(indexColumnRootOf(mounted)).toBeNull();
    });
  });

  describe('index list', () => {
    it('lists only the indexes that belong to the table', async () => {
      app.store.dispatchSync(
        addIndexAction({ id: 'i1', tableId: TABLE_ID }),
        addIndexAction({ id: 'i2', tableId: OTHER_TABLE_ID }),
        addIndexAction({ id: 'i3', tableId: TABLE_ID })
      );
      mounted = await mountAndFlush(template(), app);

      expect(indexRowsOf(mounted)).toHaveLength(2);
    });

    it('lists nothing when the table has no index yet', async () => {
      app.store.dispatchSync(
        addIndexAction({ id: 'i2', tableId: OTHER_TABLE_ID })
      );
      mounted = await mountAndFlush(template(), app);

      expect(indexRowsOf(mounted)).toHaveLength(0);
    });

    it('appends a new index for the table when the add button is clicked', async () => {
      mounted = await mountAndFlush(template(), app);

      click(addButtonOf(mounted));
      await flush();

      expect(indexRowsOf(mounted)).toHaveLength(1);
      const [id] = app.store.state.doc.indexIds;
      expect(app.store.state.collections.indexEntities[id].tableId).toBe(
        TABLE_ID
      );
    });

    it('keeps the added index out of the undo history', async () => {
      mounted = await mountAndFlush(template(), app);
      const size = app.store.history.size;

      click(addButtonOf(mounted));
      await flush();

      expect(app.store.state.doc.indexIds).toHaveLength(1);
      expect(app.store.history.size).toBe(size);
    });
  });

  describe('selection', () => {
    beforeEach(() => {
      app.store.dispatchSync(
        addIndexAction({ id: 'i1', tableId: TABLE_ID }),
        addIndexAction({ id: 'i2', tableId: TABLE_ID })
      );
    });

    it('selects the clicked index and reveals its index column pane', async () => {
      mounted = await mountAndFlush(template(), app);

      click(indexRowsOf(mounted)[0]);
      await flush();

      expect(
        indexRowsOf(mounted).map(row => row.classList.contains('selected'))
      ).toEqual([true, false]);
      expect(indexColumnRootOf(mounted)).toBeTruthy();
      expect(checkboxesOf(mounted)[0].disabled).toBe(false);
    });

    it('moves the selection to another index', async () => {
      mounted = await mountAndFlush(template(), app);

      click(indexRowsOf(mounted)[0]);
      await flush();
      click(indexRowsOf(mounted)[1]);
      await flush();

      expect(
        indexRowsOf(mounted).map(row => row.classList.contains('selected'))
      ).toEqual([false, true]);
    });

    it('rebinds the checkbox column when the selection moves to another index', async () => {
      mounted = await mountAndFlush(template(), app);

      click(indexRowsOf(mounted)[0]);
      await flush();
      changeCheckbox(checkboxesOf(mounted)[0], true);
      await flush();

      expect(checkboxesOf(mounted)[0].checked).toBe(true);
      expect(indexColumnRowsOf(mounted)).toHaveLength(1);

      click(indexRowsOf(mounted)[1]);
      await flush();

      expect(checkboxesOf(mounted)[0].checked).toBe(false);
      expect(indexColumnRowsOf(mounted)).toHaveLength(0);
    });

    it('clears the selection when the selected index is removed', async () => {
      mounted = await mountAndFlush(template(), app);

      click(indexRowsOf(mounted)[0]);
      await flush();
      expect(indexColumnRootOf(mounted)).toBeTruthy();

      const remove = indexRowsOf(mounted)[0].querySelector(
        `.${String(indexStyles.iconButton)}`
      ) as HTMLElement;
      click(remove);
      await flush();

      expect(indexRowsOf(mounted)).toHaveLength(1);
      expect(indexColumnRootOf(mounted)).toBeNull();
      expect(checkboxesOf(mounted)[0].disabled).toBe(true);
      expect(checkboxesOf(mounted)[0].checked).toBe(false);
    });
  });

  describe('selection outliving what it points at', () => {
    beforeEach(() => {
      app.store.dispatchSync(addIndexAction({ id: 'i1', tableId: TABLE_ID }));
    });

    const switchTable = (mounted: Mounted) =>
      click(mounted.container.querySelector('.switch-table') as HTMLElement);

    it('stops applying the selection once the panel switches table', async () => {
      mounted = await mountAndFlush(html`<${Host} />`, app);

      click(indexRowsOf(mounted)[0]);
      await flush();
      expect(indexColumnRootOf(mounted)).toBeTruthy();

      switchTable(mounted);
      await flush();

      expect(indexRowsOf(mounted)).toHaveLength(0);
      expect(indexColumnRootOf(mounted)).toBeNull();
      expect(checkboxesOf(mounted)[0].disabled).toBe(true);

      // The selection is scoped out while the other table shows, not erased.
      switchTable(mounted);
      await flush();

      expect(indexColumnRootOf(mounted)).toBeTruthy();
      expect(
        indexRowsOf(mounted).map(row => row.classList.contains('selected'))
      ).toEqual([true]);
    });

    it('cannot put a column of the new table into the previous table index', async () => {
      mounted = await mountAndFlush(html`<${Host} />`, app);

      click(indexRowsOf(mounted)[0]);
      await flush();
      expect(indexColumnRootOf(mounted)).toBeTruthy();

      switchTable(mounted);
      await flush();

      changeCheckbox(checkboxesOf(mounted)[0], true);
      await flush();

      const { indexEntities, indexColumnEntities } =
        app.store.state.collections;
      expect(indexEntities['i1'].indexColumnIds).toEqual([]);
      expect(indexColumnEntities).toEqual({});
    });

    it('drops the selection when the selected index is removed elsewhere', async () => {
      mounted = await mountAndFlush(template(), app);

      click(indexRowsOf(mounted)[0]);
      await flush();
      expect(indexColumnRootOf(mounted)).toBeTruthy();

      // A collaborator or an undo, rather than the row's own remove button.
      app.store.dispatchSync(removeIndexAction({ id: 'i1' }));
      await flush();

      expect(indexRowsOf(mounted)).toHaveLength(0);
      expect(indexColumnRootOf(mounted)).toBeNull();
      expect(checkboxesOf(mounted)[0].disabled).toBe(true);
    });
  });

  describe('keys the columns declare', () => {
    beforeEach(() => {
      app.store.dispatchSync(
        addColumnAction({ id: 'c3', tableId: TABLE_ID }),
        addColumnAction({ id: 'c4', tableId: TABLE_ID })
      );
      app.store.dispatchSync(
        changeColumnPrimaryKeyAction({
          id: 'c1',
          tableId: TABLE_ID,
          value: true,
        }),
        changeColumnUniqueAction({ id: 'c4', tableId: TABLE_ID, value: true }),
        addIndexAction({ id: 'i1', tableId: TABLE_ID })
      );
    });

    it('lists the primary key and each unique column above the indexes', async () => {
      mounted = await mountAndFlush(template(), app);
      const left = mounted.container.querySelector(
        `.${String(styles.leftArea)}`
      ) as HTMLElement;
      const rowClasses = Array.from(left.children).map(row =>
        row.classList.contains(String(keyStyles.row))
          ? 'key'
          : row.classList.contains(String(indexStyles.row))
            ? 'index'
            : row.classList.contains(String(styles.addIndexButtonArea))
              ? 'add'
              : row.querySelector(`.${String(separatorStyles.separator)}`)
                ? 'separator'
                : 'other'
      );

      expect(rowClasses).toEqual(['key', 'key', 'separator', 'index', 'add']);
      expect(keyRowsOf(mounted).map(row => row.textContent)).toEqual([
        'PKPK_',
        'UQUQ__',
      ]);
      expect(keyRowsOf(mounted).some(row => row.querySelector('input'))).toBe(
        false
      );
    });

    it('shows the columns of a selected key checked, every box disabled', async () => {
      mounted = await mountAndFlush(template(), app);

      click(keyRowsOf(mounted)[1]);
      await flush();

      expect(
        keyRowsOf(mounted).map(row => row.classList.contains('selected'))
      ).toEqual([false, true]);
      expect(checkboxesOf(mounted).map(box => box.checked)).toEqual([
        false,
        false,
        true,
      ]);
      expect(checkboxesOf(mounted).every(box => box.disabled)).toBe(true);
      expect(indexColumnRootOf(mounted)).toBeNull();
    });

    it('writes nothing when a box of a selected key is changed', async () => {
      mounted = await mountAndFlush(template(), app);

      click(keyRowsOf(mounted)[0]);
      await flush();
      changeCheckbox(checkboxesOf(mounted)[1], true);
      await flush();

      expect(app.store.state.collections.indexColumnEntities).toEqual({});
    });

    it('moves one selection between a key and an index', async () => {
      mounted = await mountAndFlush(template(), app);

      click(keyRowsOf(mounted)[0]);
      await flush();
      click(indexRowsOf(mounted)[0]);
      await flush();

      expect(
        keyRowsOf(mounted).map(row => row.classList.contains('selected'))
      ).toEqual([false, false]);
      expect(indexRowsOf(mounted)[0].classList.contains('selected')).toBe(true);
      expect(checkboxesOf(mounted).every(box => !box.disabled)).toBe(true);
      expect(indexColumnRootOf(mounted)).toBeTruthy();
    });

    it('drops the row and the selection when its column stops declaring it', async () => {
      mounted = await mountAndFlush(template(), app);

      click(keyRowsOf(mounted)[1]);
      await flush();
      app.store.dispatchSync(
        changeColumnUniqueAction({ id: 'c4', tableId: TABLE_ID, value: false })
      );
      await flush();

      expect(keyRowsOf(mounted)).toHaveLength(1);
      expect(checkboxesOf(mounted).some(box => box.checked)).toBe(false);
    });

    it('numbers each unique index over several columns as its alternate key', async () => {
      const keyed = (indexId: string, ...columnIds: string[]) => [
        addIndexAction({ id: indexId, tableId: TABLE_ID }),
        ...columnIds.map(columnId =>
          addIndexColumnAction({
            id: `${indexId}-${columnId}`,
            indexId,
            tableId: TABLE_ID,
            columnId,
          })
        ),
        changeIndexUniqueAction({
          id: indexId,
          tableId: TABLE_ID,
          value: true,
        }),
      ];
      app.store.dispatchSync(
        ...keyed('i2', 'c3', 'c4'),
        ...keyed('i3', 'c3'),
        ...keyed('i4', 'c1', 'c3')
      );
      mounted = await mountAndFlush(template(), app);

      expect(
        indexRowsOf(mounted).map(row => [
          row.querySelector(`.${String(indexStyles.alternateKey)}`)
            ?.textContent ?? null,
          row
            .querySelector(`.${String(indexStyles.alternateKey)}`)
            ?.getAttribute('title') ?? null,
        ])
      ).toEqual([
        [null, null],
        ['AK2', 'Alternate Key 2'],
        [null, null],
        ['AK1', 'Alternate Key 1'],
      ]);
    });
  });
});
