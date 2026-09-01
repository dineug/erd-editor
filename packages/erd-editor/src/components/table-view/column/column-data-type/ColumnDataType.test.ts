import {
  createRef,
  FC,
  html,
  observable,
  render,
  useProvider,
} from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mount,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext, appContext, appDestroy } from '@/components/appContext';
import ColumnDataType from '@/components/table-view/column/column-data-type/ColumnDataType';
import * as styles from '@/components/table-view/column/column-data-type/ColumnDataType.styles';
import { Database } from '@/constants/schema';
import { SQLiteTypes } from '@/constants/sql/dataType/SQLite';
import {
  changeDatabaseAction,
  changeDatabaseNameAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';

const TABLE_ID = 'table-1';
const COLUMN_ID = 'column-1';

type Harness = {
  mounted: Mounted;
  state: { edit: boolean; focus: boolean; value: string; width: number };
  onInput: ReturnType<typeof vi.fn>;
  onBlur: ReturnType<typeof vi.fn>;
  onEditEnd: ReturnType<typeof vi.fn>;
  root: () => HTMLDivElement;
  input: () => HTMLInputElement | null;
  hintRows: () => HTMLDivElement[];
  hintNames: () => string[];
  selectedIndex: () => number;
  dataType: () => string | undefined;
};

let harness: Harness | null = null;

afterEach(() => {
  harness?.mounted.unmount();
  harness = null;
});

function nameOf(row: Element) {
  return Array.from(row.childNodes)
    .filter(
      node => !(node instanceof HTMLElement && node.classList.contains('kbd'))
    )
    .map(node => node.textContent ?? '')
    .join('')
    .trim();
}

async function setup(
  initial: Partial<{ edit: boolean; focus: boolean; value: string }> = {},
  app: AppContext = createTestAppContext()
): Promise<Harness> {
  app.store.dispatchSync(
    addTableAction({ id: TABLE_ID, ui: { x: 0, y: 0, zIndex: 2 } }),
    addColumnAction({ id: COLUMN_ID, tableId: TABLE_ID })
  );

  const state = observable({
    edit: initial.edit ?? false,
    focus: initial.focus ?? false,
    value: initial.value ?? '',
    width: 60,
  });
  const onInput = vi.fn();
  const onBlur = vi.fn();
  const onEditEnd = vi.fn();
  const appRef = createRef<AppContext>(app);

  const Wrapper: FC<any> = () => () =>
    html`<${ColumnDataType}
      app=${appRef}
      tableId=${TABLE_ID}
      columnId=${COLUMN_ID}
      edit=${state.edit}
      focus=${state.focus}
      width=${state.width}
      value=${state.value}
      .onInput=${onInput}
      .onBlur=${onBlur}
      .onEditEnd=${onEditEnd}
    />`;

  const mounted = mount(html`<${Wrapper} />`, app);
  await flush();

  const container = mounted.container;
  const hintRows = () =>
    Array.from(
      container.querySelectorAll<HTMLDivElement>(`.${styles.hintItem}`)
    );

  harness = {
    mounted,
    state,
    onInput,
    onBlur,
    onEditEnd,
    root: () => container.querySelector(`.${styles.root}`) as HTMLDivElement,
    input: () => container.querySelector('input'),
    hintRows,
    hintNames: () => hintRows().map(nameOf),
    selectedIndex: () =>
      hintRows().findIndex(row => row.classList.contains('selected')),
    dataType: () =>
      app.store.state.collections.tableColumnEntities[COLUMN_ID]?.dataType,
  };

  return harness;
}

async function type(h: Harness, value: string) {
  const input = h.input() as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await flush();
}

function keydown(h: Harness, key: string) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  const stopPropagation = vi.spyOn(event, 'stopPropagation');
  (h.input() as HTMLInputElement).dispatchEvent(event);
  return { event, stopPropagation };
}

describe('ColumnDataType', () => {
  describe('rendering', () => {
    it('renders a focusable root wrapping the EditInput', async () => {
      const h = await setup();
      const root = h.root();

      expect(root).toBeTruthy();
      expect(root.getAttribute('tabindex')).toBe('-1');
      expect(root.querySelector('.edit-input')).toBeTruthy();
    });

    it('renders read-only text and no hint popup while not editing', async () => {
      const h = await setup({ value: 'VARCHAR' });

      expect(h.input()).toBeNull();
      expect(h.mounted.container.textContent).toContain('VARCHAR');
      expect(h.mounted.container.querySelector(`.${styles.hint}`)).toBeNull();
    });

    it('renders an input and an empty hint popup while editing', async () => {
      const h = await setup({ edit: true });

      expect(h.input()).toBeTruthy();
      expect(h.input()?.getAttribute('placeholder')).toBe('dataType');
      expect(h.mounted.container.querySelector(`.${styles.hint}`)).toBeTruthy();
      expect(h.hintRows()).toHaveLength(0);
    });

    it('sizes the input from the width prop', async () => {
      const h = await setup({ edit: true });

      expect(h.input()?.style.width).toBe('60px');
    });
  });

  describe('hint search', () => {
    it('builds hints from the current database on input', async () => {
      const h = await setup({ edit: true });

      await type(h, 'INT');

      expect(h.hintRows().length).toBeGreaterThan(0);
      expect(h.hintNames()).toContain('INT');
      expect(h.onInput).toHaveBeenCalledTimes(1);
    });

    it('renders a Tab kbd badge on every hint row', async () => {
      const h = await setup({ edit: true });

      await type(h, 'INT');
      const [row] = h.hintRows();

      expect(row.querySelector('.kbd')?.textContent?.trim()).toBe('Tab');
    });

    it('highlights the matched substring of each hint', async () => {
      const h = await setup({ edit: true, value: 'INT' });

      await type(h, 'INT');
      const highlighted = h
        .hintRows()
        .flatMap(row => Array.from(row.querySelectorAll('span')))
        .map(span => span.textContent);

      expect(highlighted.length).toBeGreaterThan(0);
      expect(highlighted).toContain('INT');
    });

    it('clears hints when the input is emptied', async () => {
      const h = await setup({ edit: true });

      await type(h, 'INT');
      expect(h.hintRows().length).toBeGreaterThan(0);

      await type(h, '   ');
      expect(h.hintRows()).toHaveLength(0);
    });

    it('produces no hints for a term that matches nothing', async () => {
      const h = await setup({ edit: true });

      await type(h, 'zzzzzzzzzz');

      expect(h.hintRows()).toHaveLength(0);
    });
  });

  describe('hint selection', () => {
    it('dispatches changeColumnDataTypeAction$ and clears hints on click', async () => {
      const h = await setup({ edit: true });

      await type(h, 'INT');
      const [row] = h.hintRows();
      const expected = nameOf(row);

      row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flush();

      expect(h.dataType()).toBe(expected);
      expect(h.hintRows()).toHaveLength(0);
    });

    it('holds a press on the list, so the canvas routing never sees it', async () => {
      const h = await setup({ edit: true });

      await type(h, 'INT');
      const [row] = h.hintRows();
      const event = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
      });
      const stopPropagation = vi.spyOn(event, 'stopPropagation');

      row.dispatchEvent(event);

      expect(stopPropagation).toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(true);
    });

    it('holds the same press arriving as touch', async () => {
      const h = await setup({ edit: true });

      await type(h, 'INT');
      const [row] = h.hintRows();
      const event = new Event('touchstart', {
        bubbles: true,
        cancelable: true,
      });
      const stopPropagation = vi.spyOn(event, 'stopPropagation');

      row.dispatchEvent(event);

      // Left cancellable, because preventing it is what would swallow the
      // click a tap is otherwise about to synthesise.
      expect(stopPropagation).toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('moves the selection down and wraps around with ArrowDown', async () => {
      const h = await setup({ edit: true });

      await type(h, 'INT');
      const total = h.hintRows().length;

      for (let i = 0; i < total; i++) {
        keydown(h, 'ArrowDown');
        await flush();
        expect(h.selectedIndex()).toBe(i);
      }

      keydown(h, 'ArrowDown');
      await flush();
      expect(h.selectedIndex()).toBe(0);
    });

    it('moves the selection up from nothing to the last hint with ArrowUp', async () => {
      const h = await setup({ edit: true });

      await type(h, 'INT');
      const last = h.hintRows().length - 1;

      keydown(h, 'ArrowUp');
      await flush();
      expect(h.selectedIndex()).toBe(last);

      keydown(h, 'ArrowUp');
      await flush();
      expect(h.selectedIndex()).toBe(last - 1);
    });

    it('prevents the default caret move only while hints exist', async () => {
      const h = await setup({ edit: true });

      const before = keydown(h, 'ArrowDown');
      expect(before.event.defaultPrevented).toBe(false);

      await type(h, 'INT');

      const after = keydown(h, 'ArrowDown');
      expect(after.event.defaultPrevented).toBe(true);

      const up = keydown(h, 'ArrowUp');
      expect(up.event.defaultPrevented).toBe(true);
    });

    it('resets the selection with ArrowLeft', async () => {
      const h = await setup({ edit: true });

      await type(h, 'INT');
      keydown(h, 'ArrowDown');
      await flush();
      expect(h.selectedIndex()).toBe(0);

      const left = keydown(h, 'ArrowLeft');
      await flush();

      expect(h.selectedIndex()).toBe(-1);
      expect(left.event.defaultPrevented).toBe(false);
    });

    it('ignores ArrowRight while nothing is selected', async () => {
      const h = await setup({ edit: true });

      await type(h, 'INT');
      const { event } = keydown(h, 'ArrowRight');
      await flush();

      expect(event.defaultPrevented).toBe(false);
      expect(h.dataType()).toBe('');
      expect(h.hintRows().length).toBeGreaterThan(0);
    });

    it('applies the selected hint with ArrowRight', async () => {
      const h = await setup({ edit: true });

      await type(h, 'INT');
      keydown(h, 'ArrowDown');
      await flush();
      const expected = h.hintNames()[0];

      const { event } = keydown(h, 'ArrowRight');
      await flush();

      expect(event.defaultPrevented).toBe(true);
      expect(h.dataType()).toBe(expected);
      expect(h.hintRows()).toHaveLength(0);
    });

    it('ignores Tab while nothing is selected', async () => {
      const h = await setup({ edit: true });

      await type(h, 'INT');
      const { event, stopPropagation } = keydown(h, 'Tab');
      await flush();

      expect(event.defaultPrevented).toBe(false);
      expect(stopPropagation).not.toHaveBeenCalled();
      expect(h.dataType()).toBe('');
    });

    it('applies the selected hint with Tab and swallows the event', async () => {
      const h = await setup({ edit: true });

      await type(h, 'INT');
      keydown(h, 'ArrowDown');
      keydown(h, 'ArrowDown');
      await flush();
      const expected = h.hintNames()[1];

      const { event, stopPropagation } = keydown(h, 'Tab');
      await flush();

      expect(event.defaultPrevented).toBe(true);
      expect(stopPropagation).toHaveBeenCalled();
      expect(h.dataType()).toBe(expected);
      expect(h.onEditEnd).not.toHaveBeenCalled();
    });

    it('ignores Enter while nothing is selected', async () => {
      const h = await setup({ edit: true });

      await type(h, 'INT');
      const { event, stopPropagation } = keydown(h, 'Enter');
      await flush();

      expect(stopPropagation).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
      expect(h.onEditEnd).not.toHaveBeenCalled();
    });

    it('applies the selected hint with Enter and ends editing', async () => {
      const h = await setup({ edit: true });

      await type(h, 'INT');
      keydown(h, 'ArrowDown');
      await flush();
      const expected = h.hintNames()[0];

      const { event, stopPropagation } = keydown(h, 'Enter');
      await flush();

      expect(stopPropagation).toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
      expect(h.dataType()).toBe(expected);
      expect(h.onEditEnd).toHaveBeenCalledTimes(1);
    });

    it('ignores keys that are not autocomplete keys', async () => {
      const h = await setup({ edit: true });

      await type(h, 'INT');
      keydown(h, 'ArrowDown');
      await flush();

      const { event } = keydown(h, 'a');
      await flush();

      expect(event.defaultPrevented).toBe(false);
      expect(h.selectedIndex()).toBe(0);
      expect(h.dataType()).toBe('');
    });

    it('does nothing when a hint index no longer resolves to a hint', async () => {
      const h = await setup({ edit: true });

      await type(h, 'INT');
      keydown(h, 'ArrowDown');
      await flush();

      await type(h, 'zzzzzzzzzz');
      const { event } = keydown(h, 'ArrowRight');
      await flush();

      expect(event.defaultPrevented).toBe(false);
      expect(h.dataType()).toBe('');
    });
  });

  describe('focus handling', () => {
    it('does nothing on focusout while not editing', async () => {
      const h = await setup();

      h.root().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(h.onBlur).not.toHaveBeenCalled();
    });

    it('calls onBlur when focus leaves the component while editing', async () => {
      const h = await setup({ edit: true });

      h.root().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(h.onBlur).toHaveBeenCalledTimes(1);
      expect(h.onBlur.mock.calls[0][0].type).toBe('focusout');
    });

    it('restores the caret instead of blurring when focus stays inside', async () => {
      const h = await setup({ edit: true, value: 'INT' });
      const input = h.input() as HTMLInputElement;
      const focus = vi.spyOn(input, 'focus');

      h.root().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      h.root().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(h.onBlur).not.toHaveBeenCalled();
      expect(focus).toHaveBeenCalled();
      expect(input.selectionStart).toBe('INT'.length);
    });

    it('accepts a plain focus event as the re-entry signal', async () => {
      const h = await setup({ edit: true });
      const input = h.input() as HTMLInputElement;
      const focus = vi.spyOn(input, 'focus');

      h.root().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      h.root().dispatchEvent(new FocusEvent('focus'));
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(h.onBlur).not.toHaveBeenCalled();
      expect(focus).toHaveBeenCalled();
    });

    it('debounces repeated focusout events into a single blur', async () => {
      const h = await setup({ edit: true });

      h.root().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      h.root().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      h.root().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(h.onBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe('prop and settings watchers', () => {
    it('clears hints when editing stops', async () => {
      const h = await setup({ edit: true });

      await type(h, 'INT');
      expect(h.hintRows().length).toBeGreaterThan(0);

      h.state.edit = false;
      await flush();
      expect(h.hintRows()).toHaveLength(0);

      h.state.edit = true;
      await flush();
      expect(h.hintRows()).toHaveLength(0);
    });

    it('leaves hints alone when an unrelated prop changes', async () => {
      const h = await setup({ edit: true });

      await type(h, 'INT');
      const before = h.hintNames();

      h.state.width = 120;
      await flush();

      expect(h.hintNames()).toEqual(before);
      expect(h.input()?.style.width).toBe('120px');
    });

    it('recomputes hints from the value prop when the database changes', async () => {
      const h = await setup({ edit: true, value: 'INT' });

      expect(h.hintRows()).toHaveLength(0);

      h.mounted.app.store.dispatchSync(
        changeDatabaseAction({ value: Database.SQLite })
      );
      await flush();

      const names = h.hintNames();
      expect(names.length).toBeGreaterThan(0);
      expect(names).toContain('INTEGER');
      const sqlite = SQLiteTypes.map(hint => hint.name);
      expect(names.filter(name => !sqlite.includes(name))).toEqual([]);
    });

    it('ignores settings changes other than the database', async () => {
      const h = await setup({ edit: true, value: 'INT' });

      h.mounted.app.store.dispatchSync(
        changeDatabaseNameAction({ value: 'shop' })
      );
      await flush();

      expect(h.mounted.app.store.state.settings.databaseName).toBe('shop');
      expect(h.hintRows()).toHaveLength(0);
    });

    it('renders no hints when the database has no hint table', async () => {
      const h = await setup({ edit: true, value: 'INT' });
      const { settings } = h.mounted.app.store.state;

      settings.database = 0;
      await flush();
      expect(h.hintRows()).toHaveLength(0);

      await type(h, 'INT');
      expect(h.hintRows()).toHaveLength(0);
    });
  });

  describe('app context resolution', () => {
    it('falls back to the app prop when no provider is in the tree', async () => {
      const app = createTestAppContext();
      app.store.dispatchSync(
        addTableAction({ id: TABLE_ID, ui: { x: 0, y: 0, zIndex: 2 } }),
        addColumnAction({ id: COLUMN_ID, tableId: TABLE_ID }),
        changeDatabaseAction({ value: Database.SQLite })
      );

      const container = document.createElement('div');
      document.body.append(container);
      const appRef = createRef(app);

      render(
        container,
        html`<${ColumnDataType}
          app=${appRef}
          tableId=${TABLE_ID}
          columnId=${COLUMN_ID}
          edit=${true}
          focus=${false}
          width=${60}
          value=${''}
        />`
      );
      await flush();

      const input = container.querySelector('input') as HTMLInputElement;
      input.value = 'INT';
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await flush();

      const names = Array.from(
        container.querySelectorAll(`.${styles.hintItem}`)
      ).map(nameOf);

      expect(names).toContain('INTEGER');

      render(container, null);
      container.remove();
      appDestroy(app);
    });

    it('prefers a provided appContext over the app prop', async () => {
      const provided = createTestAppContext();
      const fallback = createTestAppContext();
      provided.store.dispatchSync(
        addTableAction({ id: TABLE_ID, ui: { x: 0, y: 0, zIndex: 2 } }),
        addColumnAction({ id: COLUMN_ID, tableId: TABLE_ID })
      );
      fallback.store.dispatchSync(
        changeDatabaseAction({ value: Database.SQLite })
      );

      const container = document.createElement('div');
      document.body.append(container);
      // useProvider accepts a bare HTMLElement at runtime, but its public type only admits a component Context.
      const provider = useProvider(container as any, appContext, provided);
      const appRef = createRef(fallback);

      render(
        container,
        html`<${ColumnDataType}
          app=${appRef}
          tableId=${TABLE_ID}
          columnId=${COLUMN_ID}
          edit=${true}
          focus=${false}
          width=${60}
          value=${''}
        />`
      );
      await flush();

      const input = container.querySelector('input') as HTMLInputElement;
      input.value = 'BIGINT';
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await flush();

      const names = Array.from(
        container.querySelectorAll(`.${styles.hintItem}`)
      ).map(nameOf);

      expect(names).toContain('BIGINT');

      render(container, null);
      provider.destroy();
      container.remove();
      appDestroy(provided);
      appDestroy(fallback);
    });
  });
});
