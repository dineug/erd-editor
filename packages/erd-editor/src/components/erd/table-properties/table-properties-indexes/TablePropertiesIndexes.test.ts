import { FC, html, observable } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import * as checkboxStyles from '@/components/erd/table-properties/table-properties-indexes/indexes-checkbox-column/IndexesCheckboxColumn.styles';
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

/** Scoped to the left pane, the direct rows only, so no row of the right pane can match. */
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
    `.${String(styles.rightArea)} > .${String(styles.order)} > .${String(indexColumnStyles.root)}`
  ) as HTMLElement | null;

const orderOf = (mounted: Mounted) =>
  mounted.container.querySelector(
    `.${String(styles.rightArea)} > .${String(styles.order)}`
  ) as HTMLElement | null;

/** A pane's direct children, each named by what it is. */
const rowKindsOf = (pane: Element) =>
  Array.from(pane.children).map(row =>
    row.classList.contains(String(styles.sectionLabel))
      ? 'label'
      : row.classList.contains(String(keyStyles.row))
        ? 'key'
        : row.classList.contains(String(indexStyles.row))
          ? 'index'
          : row.classList.contains(String(styles.addIndexButtonArea))
            ? 'add'
            : row.classList.contains(String(styles.hint))
              ? 'hint'
              : row.classList.contains(String(styles.order))
                ? 'order'
                : row.querySelector(`.${String(separatorStyles.separator)}`)
                  ? 'separator'
                  : row.classList.contains(String(styles.columns))
                    ? 'columns'
                    : 'other'
  );

const leftOf = (mounted: Mounted) =>
  mounted.container.querySelector(`.${String(styles.leftArea)}`) as HTMLElement;

const rightOf = (mounted: Mounted) =>
  mounted.container.querySelector(
    `.${String(styles.rightArea)}`
  ) as HTMLElement;

const labelsOf = (pane: Element) =>
  Array.from(
    pane.querySelectorAll(`:scope > .${String(styles.sectionLabel)}`)
  ).map(label => label.firstElementChild?.textContent ?? '');

const hintsOf = (pane: Element) =>
  Array.from(pane.querySelectorAll(`.${String(styles.hint)}`)).map(
    hint => hint.textContent
  );

/** What the Columns heading says, and whether it shows the lock. */
const statusOf = (mounted: Mounted) => {
  const status = rightOf(mounted).querySelector(
    `:scope > .${String(styles.sectionLabel)} .${String(styles.sectionStatus)}`
  ) as HTMLElement;

  return {
    text: status.lastElementChild?.textContent ?? '',
    lock: status.querySelector('.icon') !== null,
  };
};

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
      expect(addButton.textContent).toBe('Add Index');
      expect(
        addButton
          .querySelector('.icon')
          ?.classList.contains(String(styles.addIcon))
      ).toBe(true);
    });

    it('heads the indexes and the columns, and says a table without either is empty', async () => {
      mounted = await mountAndFlush(template(), app);

      expect(rowKindsOf(leftOf(mounted))).toEqual(['label', 'hint', 'add']);
      expect(labelsOf(leftOf(mounted))).toEqual(['Indexes']);
      expect(hintsOf(leftOf(mounted))).toEqual(['No indexes yet']);
      expect(rowKindsOf(rightOf(mounted))).toEqual(['label', 'columns']);
      expect(labelsOf(rightOf(mounted))).toEqual(['Columns']);
    });

    it('scrolls the column list sideways in a wrapper of its own', async () => {
      mounted = await mountAndFlush(template(), app);
      const wrapper = rightOf(mounted).children[1] as HTMLElement;

      expect(wrapper.classList.contains(String(styles.columns))).toBe(true);
      expect(wrapper.classList.contains('scrollbar')).toBe(true);
      expect(wrapper.children).toHaveLength(1);
      expect(
        wrapper.firstElementChild?.classList.contains(
          String(checkboxStyles.root)
        )
      ).toBe(true);
    });

    it('says a table with no columns has none, in place of the list', async () => {
      app.store.dispatchSync(
        addTableAction({ id: 't3', ui: { x: 0, y: 0, zIndex: 4 } })
      );
      mounted = await mountAndFlush(template('t3'), app);

      expect(rowKindsOf(rightOf(mounted))).toEqual(['label', 'hint']);
      expect(hintsOf(rightOf(mounted))).toEqual(['This table has no columns']);
      expect(checkboxesOf(mounted)).toHaveLength(0);
    });

    it('says the same of a table id that resolves to nothing', async () => {
      mounted = await mountAndFlush(template('missing'), app);

      expect(hintsOf(rightOf(mounted))).toEqual(['This table has no columns']);
      expect(statusOf(mounted).text).toBe('Add an index to choose its columns');
    });

    it('renders the checkbox column and no order at first', async () => {
      mounted = await mountAndFlush(template(), app);

      expect(checkboxesOf(mounted)).toHaveLength(1);
      expect(checkboxesOf(mounted)[0].disabled).toBe(true);
      expect(orderOf(mounted)).toBeNull();
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

    it('selects the clicked index and reveals its order', async () => {
      mounted = await mountAndFlush(template(), app);

      click(indexRowsOf(mounted)[0]);
      await flush();

      expect(
        indexRowsOf(mounted).map(row => row.classList.contains('selected'))
      ).toEqual([true, false]);
      expect(orderOf(mounted)).toBeTruthy();
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
      expect(orderOf(mounted)).toBeTruthy();

      const remove = indexRowsOf(mounted)[0].querySelector(
        `.${String(indexStyles.iconButton)}`
      ) as HTMLElement;
      click(remove);
      await flush();

      expect(indexRowsOf(mounted)).toHaveLength(1);
      expect(orderOf(mounted)).toBeNull();
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
      expect(orderOf(mounted)).toBeTruthy();

      switchTable(mounted);
      await flush();

      expect(indexRowsOf(mounted)).toHaveLength(0);
      expect(orderOf(mounted)).toBeNull();
      expect(checkboxesOf(mounted)[0].disabled).toBe(true);

      // The selection is scoped out while the other table shows, not erased.
      switchTable(mounted);
      await flush();

      expect(orderOf(mounted)).toBeTruthy();
      expect(
        indexRowsOf(mounted).map(row => row.classList.contains('selected'))
      ).toEqual([true]);
    });

    it('cannot put a column of the new table into the previous table index', async () => {
      mounted = await mountAndFlush(html`<${Host} />`, app);

      click(indexRowsOf(mounted)[0]);
      await flush();
      expect(orderOf(mounted)).toBeTruthy();

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
      expect(orderOf(mounted)).toBeTruthy();

      // A collaborator or an undo, rather than the row's own remove button.
      app.store.dispatchSync(removeIndexAction({ id: 'i1' }));
      await flush();

      expect(indexRowsOf(mounted)).toHaveLength(0);
      expect(orderOf(mounted)).toBeNull();
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
      const rowClasses = rowKindsOf(left);

      expect(rowClasses).toEqual([
        'label',
        'key',
        'key',
        'separator',
        'label',
        'index',
        'add',
      ]);
      expect(labelsOf(left)).toEqual(['Keys', 'Indexes']);
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
      expect(orderOf(mounted)).toBeNull();
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
      expect(orderOf(mounted)).toBeTruthy();
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

  describe('columns status', () => {
    const declareKeys = () => {
      app.store.dispatchSync(addColumnAction({ id: 'c3', tableId: TABLE_ID }));
      app.store.dispatchSync(
        changeColumnPrimaryKeyAction({
          id: 'c1',
          tableId: TABLE_ID,
          value: true,
        }),
        changeColumnUniqueAction({ id: 'c3', tableId: TABLE_ID, value: true })
      );
    };

    it('asks for an index first on a table with neither keys nor indexes', async () => {
      mounted = await mountAndFlush(template(), app);

      expect(statusOf(mounted)).toEqual({
        text: 'Add an index to choose its columns',
        lock: false,
      });
    });

    it('asks for an index to be picked on a table with indexes and no keys', async () => {
      app.store.dispatchSync(addIndexAction({ id: 'i1', tableId: TABLE_ID }));
      mounted = await mountAndFlush(template(), app);

      expect(statusOf(mounted)).toEqual({
        text: 'Select an index to edit its columns',
        lock: false,
      });
    });

    it('asks for a key or an index on a table that declares keys', async () => {
      declareKeys();
      mounted = await mountAndFlush(template(), app);

      expect(statusOf(mounted)).toEqual({
        text: 'Select a key or an index',
        lock: false,
      });
    });

    it('counts the columns of the picked index out of the whole table', async () => {
      app.store.dispatchSync(
        addColumnAction({ id: 'c3', tableId: TABLE_ID }),
        addIndexAction({ id: 'i1', tableId: TABLE_ID })
      );
      mounted = await mountAndFlush(template(), app);

      click(indexRowsOf(mounted)[0]);
      await flush();
      expect(statusOf(mounted)).toEqual({
        text: '0 of 2 selected',
        lock: false,
      });

      changeCheckbox(checkboxesOf(mounted)[1], true);
      await flush();
      expect(statusOf(mounted)).toEqual({
        text: '1 of 2 selected',
        lock: false,
      });
    });

    it('says a picked key is set by its columns, behind a lock', async () => {
      declareKeys();
      mounted = await mountAndFlush(template(), app);

      click(keyRowsOf(mounted)[0]);
      await flush();
      expect(statusOf(mounted)).toEqual({
        text: 'Read only: set by the PK flag on its columns',
        lock: true,
      });

      click(keyRowsOf(mounted)[1]);
      await flush();
      expect(statusOf(mounted)).toEqual({
        text: 'Read only: set by the UQ flag on its column',
        lock: true,
      });
    });

    it('titles nothing it adds Read Only, which an e2e locator keeps for the key rows', async () => {
      declareKeys();
      mounted = await mountAndFlush(template(), app);

      click(keyRowsOf(mounted)[0]);
      await flush();

      const locks = Array.from(
        mounted.container.querySelectorAll('[title="Read Only"]')
      );
      expect(locks).toHaveLength(2);
      expect(
        locks.every(lock =>
          keyRowsOf(mounted!).includes(lock.parentElement as HTMLElement)
        )
      ).toBe(true);
    });
  });

  describe('index order', () => {
    const keyed = (
      indexId: string,
      unique: boolean,
      ...columnIds: string[]
    ) => [
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
        value: unique,
      }),
    ];

    beforeEach(() => {
      app.store.dispatchSync(addColumnAction({ id: 'c3', tableId: TABLE_ID }));
    });

    it('shows no order while nothing or a key is picked', async () => {
      app.store.dispatchSync(
        changeColumnPrimaryKeyAction({
          id: 'c1',
          tableId: TABLE_ID,
          value: true,
        })
      );
      mounted = await mountAndFlush(template(), app);

      expect(orderOf(mounted)).toBeNull();

      click(keyRowsOf(mounted)[0]);
      await flush();

      expect(orderOf(mounted)).toBeNull();
    });

    it('heads the order of a picked index and says it drags once there are two rows', async () => {
      app.store.dispatchSync(...keyed('i1', true, 'c1', 'c3'));
      mounted = await mountAndFlush(template(), app);

      click(indexRowsOf(mounted)[0]);
      await flush();

      const order = orderOf(mounted) as HTMLElement;
      expect(rowKindsOf(rightOf(mounted))).toEqual([
        'label',
        'columns',
        'order',
      ]);
      expect(labelsOf(order)).toEqual(['Index order']);
      expect(
        order.querySelector(`.${String(styles.sectionStatus)}`)?.textContent
      ).toBe('Drag to reorder');
      expect(indexColumnRowsOf(mounted)).toHaveLength(2);
    });

    it('marks the order rows of an alternate key as the canvas marks its columns', async () => {
      app.store.dispatchSync(...keyed('i1', true, 'c3', 'c1'));
      mounted = await mountAndFlush(template(), app);

      click(indexRowsOf(mounted)[0]);
      await flush();

      expect(
        indexColumnRowsOf(mounted).map(
          row =>
            row.querySelector(`.${String(indexColumnStyles.mark)}`)
              ?.textContent ?? null
        )
      ).toEqual(['AK1.1', 'AK1.2']);
    });

    it('marks nothing on the order of an index that is no alternate key', async () => {
      app.store.dispatchSync(...keyed('i1', false, 'c1', 'c3'));
      mounted = await mountAndFlush(template(), app);

      click(indexRowsOf(mounted)[0]);
      await flush();

      expect(
        orderOf(mounted)?.querySelector(`.${String(indexColumnStyles.mark)}`)
      ).toBeNull();
    });

    it('leaves the drag hint off a single row', async () => {
      app.store.dispatchSync(...keyed('i1', false, 'c1'));
      mounted = await mountAndFlush(template(), app);

      click(indexRowsOf(mounted)[0]);
      await flush();

      expect(
        orderOf(mounted)?.querySelector(`.${String(styles.sectionStatus)}`)
      ).toBeNull();
      expect(indexColumnRowsOf(mounted)).toHaveLength(1);
    });

    it('says how to fill the order of an index with no columns yet', async () => {
      app.store.dispatchSync(addIndexAction({ id: 'i1', tableId: TABLE_ID }));
      mounted = await mountAndFlush(template(), app);

      click(indexRowsOf(mounted)[0]);
      await flush();

      const order = orderOf(mounted) as HTMLElement;
      expect(hintsOf(order)).toEqual(['Check columns above to add them']);
      expect(indexColumnRootOf(mounted)).toBeNull();

      changeCheckbox(checkboxesOf(mounted)[0], true);
      await flush();

      expect(hintsOf(orderOf(mounted) as HTMLElement)).toEqual([]);
      expect(indexColumnRowsOf(mounted)).toHaveLength(1);
    });
  });

  describe('read only', () => {
    const readonlyTemplate = (tableId = TABLE_ID) =>
      html`<${TablePropertiesIndexes} tableId=${tableId} readonly=${true} />`;

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
    ];

    beforeEach(() => {
      app.store.dispatchSync(addColumnAction({ id: 'c3', tableId: TABLE_ID }));
    });

    it('offers no add row and asks for nothing it cannot do', async () => {
      mounted = await mountAndFlush(readonlyTemplate(), app);

      expect(addButtonOf(mounted)).toBeNull();
      expect(rowKindsOf(leftOf(mounted))).toEqual(['label', 'hint']);
      expect(hintsOf(leftOf(mounted))).toEqual(['No indexes']);
      expect(statusOf(mounted).text).toBe('This table has no keys or indexes');
    });

    it('asks only to see the columns of an index', async () => {
      app.store.dispatchSync(...keyed('i1', 'c1', 'c3'));
      mounted = await mountAndFlush(readonlyTemplate(), app);

      expect(statusOf(mounted).text).toBe('Select an index to see its columns');
    });

    it('still picks an index and shows its columns and order, every box disabled', async () => {
      app.store.dispatchSync(...keyed('i1', 'c1', 'c3'));
      mounted = await mountAndFlush(readonlyTemplate(), app);

      click(indexRowsOf(mounted)[0]);
      await flush();

      expect(indexRowsOf(mounted)[0].classList.contains('selected')).toBe(true);
      expect(statusOf(mounted).text).toBe('2 of 2 selected');
      expect(checkboxesOf(mounted).map(box => box.checked)).toEqual([
        true,
        true,
      ]);
      expect(checkboxesOf(mounted).every(box => box.disabled)).toBe(true);
      expect(indexColumnRowsOf(mounted)).toHaveLength(2);
      expect(
        indexColumnRowsOf(mounted).every(
          row => row.getAttribute('draggable') === 'false'
        )
      ).toBe(true);
      expect(
        orderOf(mounted)?.querySelector(`.${String(styles.sectionStatus)}`)
      ).toBeNull();
    });

    it('draws no remove button and leaves the name untypeable', async () => {
      app.store.dispatchSync(...keyed('i1', 'c1'));
      mounted = await mountAndFlush(readonlyTemplate(), app);
      const [row] = indexRowsOf(mounted);

      expect(row.querySelector('[title="Remove"]')).toBeNull();
      expect(row.querySelector('input')?.readOnly).toBe(true);
    });

    it('says an index with no columns has none rather than asking to check one', async () => {
      app.store.dispatchSync(...keyed('i1'));
      mounted = await mountAndFlush(readonlyTemplate(), app);

      click(indexRowsOf(mounted)[0]);
      await flush();

      expect(hintsOf(orderOf(mounted) as HTMLElement)).toEqual([
        'This index has no columns',
      ]);
    });
  });
});
