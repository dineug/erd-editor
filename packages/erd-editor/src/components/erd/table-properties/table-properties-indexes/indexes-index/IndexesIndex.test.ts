import { html } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import IndexesIndex from '@/components/erd/table-properties/table-properties-indexes/indexes-index/IndexesIndex';
import * as styles from '@/components/erd/table-properties/table-properties-indexes/indexes-index/IndexesIndex.styles';
import { COLUMN_UNIQUE_WIDTH } from '@/constants/layout';
import { addIndexAction } from '@/engine/modules/index/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import type { Index } from '@/internal-types';

const TABLE_ID = 't1';
const INDEX_ID = 'i1';

const rowOf = (mounted: Mounted) =>
  mounted.container.querySelector(`.${String(styles.row)}`) as HTMLElement;

const uniqueOf = (mounted: Mounted) =>
  mounted.container.querySelector(
    `.${String(styles.unique)}`
  ) as HTMLElement | null;

const inputOf = (mounted: Mounted) =>
  mounted.container.querySelector('input') as HTMLInputElement;

const removeIconOf = (mounted: Mounted) =>
  mounted.container.querySelector(
    `.icon.${String(styles.iconButton)}`
  ) as HTMLElement;

const click = (el: Element) =>
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

function seedIndex(app: AppContext): Index {
  app.store.dispatchSync(
    addTableAction({ id: TABLE_ID, ui: { x: 0, y: 0, zIndex: 2 } })
  );
  app.store.dispatchSync(addIndexAction({ id: INDEX_ID, tableId: TABLE_ID }));
  return app.store.state.collections.indexEntities[INDEX_ID];
}

function template(index: Index, selected = false, onSelect = vi.fn()) {
  return html`
    <${IndexesIndex}
      index=${index}
      selected=${selected}
      .onSelect=${onSelect}
    />
  `;
}

let app: AppContext;
let index: Index;
let mounted: Mounted | null = null;

beforeEach(() => {
  app = createTestAppContext();
  index = seedIndex(app);
});

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  app.store.destroy();
});

describe('IndexesIndex', () => {
  describe('markup', () => {
    it('renders the row unselected by default', async () => {
      mounted = await mountAndFlush(template(index), app);
      const row = rowOf(mounted);

      expect(row).toBeTruthy();
      expect(row.classList.contains('selected')).toBe(false);
    });

    it('adds the selected class from its prop', async () => {
      mounted = await mountAndFlush(template(index, true), app);

      expect(rowOf(mounted).classList.contains('selected')).toBe(true);
    });

    it('renders the unique cell unchecked with its fixed width', async () => {
      mounted = await mountAndFlush(template(index), app);
      const unique = uniqueOf(mounted) as HTMLElement;

      expect(unique.textContent?.trim()).toBe('UQ');
      expect(unique.getAttribute('title')).toBe('Unique');
      expect(unique.style.width).toBe(`${COLUMN_UNIQUE_WIDTH}px`);
      expect(unique.classList.contains('checked')).toBe(false);
    });

    it('checks the unique cell for a unique index', async () => {
      mounted = await mountAndFlush(template(index), app);

      click(uniqueOf(mounted) as HTMLElement);
      await flush();

      expect(app.store.state.collections.indexEntities[INDEX_ID].unique).toBe(
        true
      );
      expect((uniqueOf(mounted) as HTMLElement).classList).toContain('checked');
    });

    it('renders the name input seeded from the index', async () => {
      mounted = await mountAndFlush(template(index), app);
      const input = inputOf(mounted);

      expect(input.getAttribute('placeholder')).toBe('name');
      expect(input.getAttribute('type')).toBe('text');
      expect(input.value).toBe('');
      expect(input.classList.contains(String(styles.input))).toBe(true);
    });

    it('renders the remove icon as a titled svg button', async () => {
      mounted = await mountAndFlush(template(index), app);
      const icon = removeIconOf(mounted);

      expect(icon).toBeTruthy();
      expect(icon.getAttribute('title')).toBe('Remove');
      expect(icon.querySelector('svg')).toBeTruthy();
    });
  });

  describe('selection', () => {
    it('reports itself through onSelect when the row is clicked', async () => {
      const onSelect = vi.fn();
      mounted = await mountAndFlush(template(index, false, onSelect), app);

      click(rowOf(mounted));
      await flush();

      expect(onSelect).toHaveBeenCalledExactlyOnceWith(index);
    });

    it('also selects when the unique cell is clicked, because the click bubbles', async () => {
      const onSelect = vi.fn();
      mounted = await mountAndFlush(template(index, false, onSelect), app);

      click(uniqueOf(mounted) as HTMLElement);
      await flush();

      expect(onSelect).toHaveBeenCalledExactlyOnceWith(index);
    });
  });

  describe('unique toggle', () => {
    it('flips the unique flag on every click of the unique cell', async () => {
      mounted = await mountAndFlush(template(index), app);

      click(uniqueOf(mounted) as HTMLElement);
      await flush();
      expect(app.store.state.collections.indexEntities[INDEX_ID].unique).toBe(
        true
      );

      click(uniqueOf(mounted) as HTMLElement);
      await flush();
      expect(app.store.state.collections.indexEntities[INDEX_ID].unique).toBe(
        false
      );
    });

    it('does not push the toggle onto the undo history', async () => {
      mounted = await mountAndFlush(template(index), app);
      const size = app.store.history.size;

      click(uniqueOf(mounted) as HTMLElement);
      await flush();

      expect(app.store.state.collections.indexEntities[INDEX_ID].unique).toBe(
        true
      );
      expect(app.store.history.size).toBe(size);
    });
  });

  describe('name', () => {
    it('writes the typed value back to the index name', async () => {
      mounted = await mountAndFlush(template(index), app);
      const input = inputOf(mounted);

      input.value = 'idx_users_name';
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await flush();

      expect(app.store.state.collections.indexEntities[INDEX_ID].name).toBe(
        'idx_users_name'
      );
    });

    it('ignores an input event without a target element', async () => {
      mounted = await mountAndFlush(template(index), app);
      const input = inputOf(mounted);

      input.value = 'ignored';
      const event = new InputEvent('input', { bubbles: true });
      Object.defineProperty(event, 'target', {
        configurable: true,
        get: () => null,
      });
      input.dispatchEvent(event);
      await flush();

      expect(app.store.state.collections.indexEntities[INDEX_ID].name).toBe('');
    });
  });

  describe('remove', () => {
    it('removes the index from the document and clears the selection', async () => {
      const onSelect = vi.fn();
      mounted = await mountAndFlush(template(index, true, onSelect), app);

      expect(app.store.state.doc.indexIds).toEqual([INDEX_ID]);

      click(removeIconOf(mounted));
      await flush();

      expect(onSelect).toHaveBeenCalledExactlyOnceWith(null);
      expect(app.store.state.doc.indexIds).toEqual([]);
    });

    it('stops the click from also selecting the row', async () => {
      const onSelect = vi.fn();
      mounted = await mountAndFlush(template(index, false, onSelect), app);

      click(removeIconOf(mounted));
      await flush();

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(null);
    });
  });
});
