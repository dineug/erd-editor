import { html } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import * as indexColumnStyles from '@/components/erd/table-properties/table-properties-indexes/indexes-column/IndexesColumn.styles';
import * as indexStyles from '@/components/erd/table-properties/table-properties-indexes/indexes-index/IndexesIndex.styles';
import TablePropertiesIndexes from '@/components/erd/table-properties/table-properties-indexes/TablePropertiesIndexes';
import * as styles from '@/components/erd/table-properties/table-properties-indexes/TablePropertiesIndexes.styles';
import { addIndexAction } from '@/engine/modules/index/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';

const TABLE_ID = 't1';
const OTHER_TABLE_ID = 't2';

const template = (tableId = TABLE_ID) =>
  html`<${TablePropertiesIndexes} tableId=${tableId} />`;

/**
 * `IndexesIndex.styles.row` and `Column.styles.root` declare the same top level
 * block, so r-html hands both of them the same generated class name. Scope the
 * lookup to the left pane so the checkbox rows of the right pane cannot match.
 */
const indexRowsOf = (mounted: Mounted) =>
  Array.from(
    mounted.container.querySelectorAll(
      `.${String(styles.leftArea)} > .${String(indexStyles.row)}`
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

function seed(app: AppContext) {
  const { store } = app;
  store.dispatchSync(
    addTableAction({ id: TABLE_ID, ui: { x: 0, y: 0, zIndex: 2 } }),
    addTableAction({ id: OTHER_TABLE_ID, ui: { x: 0, y: 0, zIndex: 3 } })
  );
  store.dispatchSync(addColumnAction({ id: 'c1', tableId: TABLE_ID }));
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
    });
  });
});
