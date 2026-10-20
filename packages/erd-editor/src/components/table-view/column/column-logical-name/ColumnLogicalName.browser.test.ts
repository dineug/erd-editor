// The logical name editor in a real Chromium: real keys, and a Korean IME's
// own composition over CDP, which hands the input each step of a syllable.

import { addCSSHost, FC, html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { cdp, userEvent } from 'vite-plus/test/browser/context';

import {
  createTestAppContext,
  flush,
  mount,
  type Mounted,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import ColumnLogicalName from '@/components/table-view/column/column-logical-name/ColumnLogicalName';
import * as styles from '@/components/table-view/column/column-logical-name/ColumnLogicalName.styles';
import { INPUT_HEIGHT } from '@/constants/layout';
import { addDictionaryAction } from '@/engine/modules/dictionary/atom.actions';
import { TERM_COMPLETION_LIMIT } from '@/engine/modules/dictionary/termIndex';
import {
  addTableAction,
  changeTableLogicalNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnLogicalNameAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import { removeColumnAction$ } from '@/engine/modules/table-column/generator.actions';

/** The keys the list reads, which the spec listens for past the editor. */
const LIST_KEYS = new Set(['ArrowUp', 'ArrowDown', 'Enter', 'Escape']);

const TABLE = 'table-1';
const COLUMN = 'column-1';
const DOMAIN = 'domain-1';

/** The two Input commands the spec sends, which the provider's session types only under its own config. */
type ImeSession = {
  send: (method: string, params: Record<string, unknown>) => Promise<unknown>;
};

const session = () => cdp() as unknown as ImeSession;

type Fixture = {
  app: AppContext;
  mounted: Mounted;
  /** Takes the editor down once, as a cell moving on does. */
  unmount: () => void;
  input: HTMLInputElement;
  onBlur: ReturnType<typeof vi.fn>;
  onEditEnd: ReturnType<typeof vi.fn>;
  /** The table and column batches dispatched since the editor opened, by their types. */
  batches: string[][];
  /** The list keys the editor's parent heard, in order. */
  heard: string[];
};

const teardowns: Array<() => void> = [];

afterEach(() => {
  teardowns.splice(0).forEach(teardown => teardown());
});

type Seed = {
  terms?: Array<{ name: string; physicalName?: string; domainId?: string }>;
  /** The table's own logical name editor rather than the column's. */
  header?: boolean;
  logicalName?: string;
};

/**
 * A table and its column, the terms given and one domain, and the editor open
 * over the column's logical name, or the table's, in a shadow root that holds
 * its styles. Each key writes the logical name back, as the overlay does.
 */
async function setup({
  terms = [],
  header = false,
  logicalName = '',
}: Seed = {}): Promise<Fixture> {
  const app = createTestAppContext();
  const { store } = app;
  store.dispatchSync(
    addTableAction({ id: TABLE, ui: { x: 0, y: 0, zIndex: 2 } }),
    addColumnAction({ id: COLUMN, tableId: TABLE }),
    addDictionaryAction({
      kind: 'domain',
      id: DOMAIN,
      values: { name: 'Identifier', dataType: 'BIGINT' },
    }),
    ...terms.map((values, index) =>
      addDictionaryAction({ kind: 'term', id: `term-${index}`, values })
    ),
    header
      ? changeTableLogicalNameAction({ id: TABLE, value: logicalName })
      : changeColumnLogicalNameAction({
          tableId: TABLE,
          id: COLUMN,
          value: logicalName,
        })
  );

  const host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  addCSSHost(shadow);

  const onBlur = vi.fn();
  const onEditEnd = vi.fn();
  const onInput = (event: InputEvent) => {
    const value = (event.target as HTMLInputElement).value;
    store.dispatch(
      header
        ? changeTableLogicalNameAction({ id: TABLE, value })
        : changeColumnLogicalNameAction({ tableId: TABLE, id: COLUMN, value })
    );
  };

  const Wrapper: FC = () => () => {
    const { tableEntities, tableColumnEntities } = store.state.collections;
    const value = header
      ? tableEntities[TABLE].logicalName
      : tableColumnEntities[COLUMN].logicalName;

    return html`<${ColumnLogicalName}
      tableId=${TABLE}
      columnId=${header ? null : COLUMN}
      width=${120}
      value=${value}
      placeholder="logical"
      .onInput=${onInput}
      .onBlur=${onBlur}
      .onEditEnd=${onEditEnd}
    />`;
  };

  const mounted = mount(html`<${Wrapper} />`, app, shadow);
  await flush();

  const batches: string[][] = [];
  const unsubscribe = store.subscribe(actions => {
    const types = actions.map(({ type }) => type);
    if (types.some(type => /^(table|column)\./.test(type))) {
      batches.push(types);
    }
  });

  const heard: string[] = [];
  const listen = (event: KeyboardEvent) => {
    LIST_KEYS.has(event.key) && heard.push(event.key);
  };
  mounted.container.addEventListener('keydown', listen);

  let open = true;
  const unmount = () => {
    if (!open) return;
    open = false;
    mounted.unmount();
  };

  teardowns.push(() => {
    unsubscribe();
    mounted.container.removeEventListener('keydown', listen);
    unmount();
    host.remove();
  });

  const input = mounted.container.querySelector('input') as HTMLInputElement;
  return { app, mounted, unmount, input, onBlur, onEditEnd, batches, heard };
}

const rowsOf = ({ mounted }: Fixture) =>
  Array.from(
    mounted.container.querySelectorAll<HTMLElement>(`.${styles.hintItem}`)
  );

/** A row's term name, without the shortcut badge sharing the line with it. */
const namesOf = (fixture: Fixture) =>
  rowsOf(fixture).map(row =>
    (row.querySelector(':scope > span')?.textContent ?? '').trim()
  );

const selectedOf = (fixture: Fixture) =>
  rowsOf(fixture).findIndex(row => row.classList.contains('selected'));

const listOf = ({ mounted }: Fixture) =>
  mounted.container.querySelector<HTMLElement>(`.${styles.hint}`);

const columnOf = ({ app }: Fixture) =>
  app.store.state.collections.tableColumnEntities[COLUMN];

const tableOf = ({ app }: Fixture) =>
  app.store.state.collections.tableEntities[TABLE];

const type = async (text: string) => {
  await userEvent.keyboard(text);
  await flush();
};

const press = async (keys: string) => {
  await userEvent.keyboard(keys);
  await flush();
};

/** Closes the editor the way a cell moving on does, and waits for what that sent. */
const close = async (fixture: Fixture) => {
  fixture.unmount();
  await flush();
};

/** The syllable an IME is building, shown in the input and not yet committed. */
const compose = async (text: string) => {
  await session().send('Input.imeSetComposition', {
    text,
    selectionStart: text.length,
    selectionEnd: text.length,
  });
  await flush();
};

/** The IME finishing the syllable it was building, as the next key does. */
const commit = async (text: string) => {
  await session().send('Input.insertText', { text });
  await flush();
};

const MEMBER_TERMS = [
  'Member no',
  'Member name',
  'Member grade',
  'Member email',
  'Member age',
  'Member code',
  'Member id',
  'Member join date',
  'Member phone',
  'Order no',
].map(name => ({ name }));

describe('the term list under a logical name editor', () => {
  it('lists at most eight terms whose names start with what is typed, in name order', async () => {
    const fixture = await setup({ terms: MEMBER_TERMS });

    await type('mem');

    expect(namesOf(fixture)).toEqual([
      'Member age',
      'Member code',
      'Member email',
      'Member grade',
      'Member id',
      'Member join date',
      'Member name',
      'Member no',
    ]);
    expect(rowsOf(fixture)).toHaveLength(TERM_COMPLETION_LIMIT);
    expect(selectedOf(fixture)).toBe(-1);
    expect(columnOf(fixture).logicalName).toBe('mem');

    const list = listOf(fixture) as HTMLElement;
    const style = getComputedStyle(list);
    expect(style.position).toBe('absolute');
    expect(style.top).toBe(`${INPUT_HEIGHT}px`);
    expect(list.scrollHeight).toBe(list.clientHeight);
  });

  it('shows no list for a start no term has, nor while the term sheet is empty', async () => {
    const listed = await setup({ terms: MEMBER_TERMS });
    await type('xyz');
    expect(listOf(listed)).toBeNull();

    await userEvent.fill(listed.input, '');
    await flush();
    expect(listOf(listed)).toBeNull();

    const empty = await setup();
    await type('mem');
    expect(listOf(empty)).toBeNull();
    expect(columnOf(empty).logicalName).toBe('mem');
  });

  it('walks the rows round with the arrows, keeping the caret where it was', async () => {
    const fixture = await setup({ terms: MEMBER_TERMS });
    await type('member n');
    expect(namesOf(fixture)).toEqual(['Member name', 'Member no']);

    await press('{ArrowDown}');
    expect(selectedOf(fixture)).toBe(0);
    await press('{ArrowDown}');
    expect(selectedOf(fixture)).toBe(1);
    await press('{ArrowDown}');
    expect(selectedOf(fixture)).toBe(0);
    await press('{ArrowUp}');
    expect(selectedOf(fixture)).toBe(1);

    expect(fixture.input.selectionStart).toBe('member n'.length);
  });

  it('writes the term Enter picks with the name and domain it derives in one dispatch, and ends the edit', async () => {
    const fixture = await setup({
      terms: [
        { name: 'Member no', physicalName: 'mbr_no', domainId: DOMAIN },
        { name: 'Member name', physicalName: 'mbr_nm' },
      ],
    });
    await type('member');
    fixture.batches.length = 0;

    await press('{ArrowDown}{ArrowDown}{Enter}');

    expect(fixture.batches).toEqual([
      [
        'column.changeLogicalName',
        'column.changeName',
        'column.changeNameDerived',
        'column.changeDomain',
        'column.changeDataType',
      ],
    ]);
    expect(columnOf(fixture)).toMatchObject({
      logicalName: 'Member no',
      name: 'mbr_no',
      domainId: DOMAIN,
      dataType: 'BIGINT',
    });
    expect(fixture.onEditEnd).toHaveBeenCalledTimes(1);
    expect(fixture.heard).not.toContain('Enter');
    expect(listOf(fixture)).toBeNull();

    await close(fixture);
    expect(fixture.batches).toHaveLength(1);
  });

  it('leaves an Enter on no row to the editor, which keeps the text typed', async () => {
    const fixture = await setup({ terms: MEMBER_TERMS });
    await type('member');

    await press('{Enter}');

    expect(fixture.heard).toEqual(['Enter']);
    expect(fixture.onEditEnd).not.toHaveBeenCalled();
    expect(columnOf(fixture).logicalName).toBe('member');
  });

  it('picks the row a press lands on, the caret kept in the input', async () => {
    const fixture = await setup({
      terms: [{ name: 'Member no', physicalName: 'mbr_no' }],
    });
    await type('mem');

    await userEvent.click(rowsOf(fixture)[0]);
    await flush();

    expect(columnOf(fixture)).toMatchObject({
      logicalName: 'Member no',
      name: 'mbr_no',
    });
    expect((fixture.input.getRootNode() as ShadowRoot).activeElement).toBe(
      fixture.input
    );
    expect(fixture.input.value).toBe('Member no');
    expect(fixture.onBlur).not.toHaveBeenCalled();
    expect(listOf(fixture)).toBeNull();
  });

  it('closes the list alone on Escape, which goes no further, and hands the next Escape on', async () => {
    const fixture = await setup({ terms: MEMBER_TERMS });
    await type('mem');

    await press('{Escape}');

    expect(listOf(fixture)).toBeNull();
    expect(fixture.heard).toEqual([]);
    expect(columnOf(fixture).logicalName).toBe('mem');

    await press('{Escape}');
    expect(fixture.heard).toEqual(['Escape']);

    await type('e');
    expect(namesOf(fixture)).toEqual([]);
    await press('{Backspace}');
    expect(namesOf(fixture)).toHaveLength(TERM_COMPLETION_LIMIT);
  });

  it('leaves the keys an IME composition holds to it, and lists the terms each step spells', async () => {
    const fixture = await setup({
      terms: [{ name: '회원번호' }, { name: '회원명' }, { name: '주문번호' }],
    });
    const composing: boolean[] = [];
    fixture.input.addEventListener('keydown', event =>
      composing.push(event.isComposing)
    );

    await compose('회');
    expect(namesOf(fixture)).toEqual(['회원명', '회원번호']);
    await commit('회');
    await compose('원');
    expect(namesOf(fixture)).toEqual(['회원명', '회원번호']);

    await press('{ArrowDown}');
    await press('{Enter}');
    expect(composing).toEqual([true, true]);
    expect(fixture.onEditEnd).not.toHaveBeenCalled();
    expect(selectedOf(fixture)).toBe(-1);
    expect(namesOf(fixture)).toEqual(['회원명', '회원번호']);

    await commit('원');
    await press('{ArrowDown}{ArrowDown}{Enter}');

    expect(columnOf(fixture).logicalName).toBe('회원번호');
    expect(fixture.onEditEnd).toHaveBeenCalledTimes(1);
  });
});

describe('the name a logical name editor derives as it closes', () => {
  const TERMS = [{ name: 'Member no', physicalName: 'mbr_no' }];

  it('derives once on a logical name other than it opened with, in a dispatch of its own', async () => {
    const fixture = await setup({ terms: TERMS });
    await type('Member no');
    await press('{Escape}');
    fixture.batches.length = 0;

    await close(fixture);

    expect(fixture.batches).toEqual([
      ['column.changeName', 'column.changeNameDerived'],
    ]);
    expect(columnOf(fixture)).toMatchObject({
      name: 'mbr_no',
      logicalName: 'Member no',
    });
  });

  it('sends nothing on the logical name it opened with, though keys changed it between', async () => {
    const fixture = await setup({ terms: TERMS, logicalName: 'Member no' });
    await press('{Backspace}');
    await type('o');
    fixture.batches.length = 0;

    await close(fixture);

    expect(fixture.batches).toEqual([]);
    expect(columnOf(fixture).name).toBe('');
  });

  it('leaves a name typed by hand as it is', async () => {
    const fixture = await setup({ terms: TERMS });
    fixture.app.store.dispatchSync(
      changeColumnNameAction({ tableId: TABLE, id: COLUMN, value: 'member' })
    );
    await type('Member no');
    fixture.batches.length = 0;

    await close(fixture);

    expect(fixture.batches).toEqual([]);
    expect(columnOf(fixture).name).toBe('member');
  });

  it('derives nothing for a column gone from its table, or once the editor is destroyed', async () => {
    const removed = await setup({ terms: TERMS });
    await type('Member no');
    removed.app.store.dispatchSync(removeColumnAction$(TABLE, [COLUMN]));
    removed.batches.length = 0;
    await close(removed);
    expect(removed.batches).toEqual([]);

    const destroyed = await setup({ terms: TERMS });
    await type('Member no');
    destroyed.batches.length = 0;
    destroyed.app.lifecycle.destroyed = true;
    await close(destroyed);
    expect(destroyed.batches).toEqual([]);
    expect(columnOf(destroyed).name).toBe('');
  });

  it('writes and derives a table header name the same way', async () => {
    const fixture = await setup({ terms: TERMS, header: true });
    await type('mem');
    expect(namesOf(fixture)).toEqual(['Member no']);
    fixture.batches.length = 0;

    await press('{ArrowDown}{Enter}');

    expect(fixture.batches).toEqual([
      [
        'table.changeLogicalName',
        'table.changeName',
        'table.changeNameDerived',
      ],
    ]);
    expect(tableOf(fixture)).toMatchObject({
      logicalName: 'Member no',
      name: 'mbr_no',
      nameDerived: true,
    });

    await close(fixture);
    expect(fixture.batches).toHaveLength(1);

    const typed = await setup({ terms: TERMS, header: true });
    await type('Member no');
    await press('{Escape}');
    typed.batches.length = 0;
    await close(typed);
    expect(typed.batches).toEqual([
      ['table.changeName', 'table.changeNameDerived'],
    ]);
  });
});

describe('the focus of a logical name editor', () => {
  it('ends the edit a turn after the caret leaves it, and not when a press keeps it inside', async () => {
    const fixture = await setup({ terms: MEMBER_TERMS });
    await type('mem');

    const list = listOf(fixture) as HTMLElement;
    const press = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });
    list.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
    list.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));

    const root = fixture.input.parentElement as HTMLElement;
    root.focus();
    await vi.waitFor(() =>
      expect((fixture.input.getRootNode() as ShadowRoot).activeElement).toBe(
        fixture.input
      )
    );
    expect(fixture.onBlur).not.toHaveBeenCalled();

    fixture.input.blur();
    await vi.waitFor(() => expect(fixture.onBlur).toHaveBeenCalledTimes(1));
  });

  it('answers a focusout still waiting as it closes, so no later cell hears it', async () => {
    const fixture = await setup({ terms: MEMBER_TERMS });

    fixture.input.blur();
    fixture.unmount();

    expect(fixture.onBlur).toHaveBeenCalledTimes(1);
  });

  it('keeps a wheel over a list that has nothing to scroll for the canvas', async () => {
    const fixture = await setup({ terms: MEMBER_TERMS });
    await type('mem');
    const outer = vi.fn();
    fixture.mounted.container.addEventListener('wheel', outer);

    listOf(fixture)?.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 40, bubbles: true })
    );

    expect(outer).toHaveBeenCalledTimes(1);
  });
});
