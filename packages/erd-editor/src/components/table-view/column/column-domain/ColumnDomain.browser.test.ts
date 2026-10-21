import { generateOrderKeys } from '@dineug/erd-editor-schema';
// The domain picker in a real Chromium: real keys and presses over its list,
// and a Korean IME's own composition over CDP while a name is searched.
import { addCSSHost, html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { cdp, userEvent } from 'vite-plus/test/browser/context';

import {
  createTestAppContext,
  flush,
  mount,
  type Mounted,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import ColumnDomain from '@/components/table-view/column/column-domain/ColumnDomain';
import * as styles from '@/components/table-view/column/column-logical-name/ColumnLogicalName.styles';
import { DATA_TYPE_HINT_ROW_HEIGHT } from '@/constants/layout';
import {
  addDictionaryAction,
  removeDictionaryAction,
} from '@/engine/modules/dictionary/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnDataTypeAction,
  changeColumnDomainAction,
} from '@/engine/modules/table-column/atom.actions';

const TABLE = 'table-1';
const COLUMN = 'column-1';

/** The keys the picker reads, which the spec listens for past it. */
const PICKER_KEYS = new Set(['ArrowUp', 'ArrowDown', 'Enter', 'Escape']);

/** The two Input commands the spec sends, which the provider's session types only under its own config. */
type ImeSession = {
  send: (method: string, params: Record<string, unknown>) => Promise<unknown>;
};

const session = () => cdp() as unknown as ImeSession;

type Fixture = {
  app: AppContext;
  mounted: Mounted;
  input: HTMLInputElement;
  onBlur: ReturnType<typeof vi.fn>;
  onEditEnd: ReturnType<typeof vi.fn>;
  /** The column batches dispatched since the picker opened, by their types. */
  batches: string[][];
  /** The picker keys the picker's parent heard, in order. */
  heard: string[];
};

const teardowns: Array<() => void> = [];

afterEach(() => {
  teardowns.splice(0).forEach(teardown => teardown());
});

type DomainSeed = { id: string; name: string; dataType: string };

const DOMAINS: DomainSeed[] = [
  { id: 'id', name: 'Identifier', dataType: 'BIGINT' },
  { id: 'name', name: 'Name', dataType: 'VARCHAR(100)' },
  { id: 'blank', name: ' ', dataType: 'TEXT' },
  { id: 'nick', name: 'Nickname', dataType: 'VARCHAR(30)' },
  { id: 'amount', name: 'Amount', dataType: 'DECIMAL(18,2)' },
];

/**
 * A table and its column, linked to the domain given, the domains given, and
 * the picker open over the column in a shadow root that holds its styles.
 */
async function setup({
  domains = DOMAINS,
  linked = '',
}: { domains?: DomainSeed[]; linked?: string } = {}): Promise<Fixture> {
  const app = createTestAppContext();
  const { store } = app;
  const linkedType = domains.find(({ id }) => id === linked)?.dataType ?? '';
  // Each domain keyed in the order given, as a document's rows are.
  const keys = generateOrderKeys(null, null, domains.length);
  store.dispatchSync(
    addTableAction({ id: TABLE, ui: { x: 0, y: 0, zIndex: 2 } }),
    addColumnAction({ id: COLUMN, tableId: TABLE }),
    ...domains.map(({ id, ...values }, index) =>
      addDictionaryAction({
        kind: 'domain',
        id,
        values: { ...values, order: keys[index] },
      })
    ),
    changeColumnDomainAction({ tableId: TABLE, id: COLUMN, value: linked }),
    changeColumnDataTypeAction({
      tableId: TABLE,
      id: COLUMN,
      value: linkedType,
    })
  );

  const host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  addCSSHost(shadow);

  const onBlur = vi.fn();
  const onEditEnd = vi.fn();
  const mounted = mount(
    html`<${ColumnDomain}
      tableId=${TABLE}
      columnId=${COLUMN}
      width=${120}
      placeholder="Domain"
      .onBlur=${onBlur}
      .onEditEnd=${onEditEnd}
    />`,
    app,
    shadow
  );
  await flush();

  const batches: string[][] = [];
  const unsubscribe = store.subscribe(actions => {
    const types = actions.map(({ type }) => type);
    if (types.some(type => type.startsWith('column.'))) batches.push(types);
  });

  const heard: string[] = [];
  const listen = (event: KeyboardEvent) => {
    PICKER_KEYS.has(event.key) && heard.push(event.key);
  };
  mounted.container.addEventListener('keydown', listen);

  teardowns.push(() => {
    unsubscribe();
    mounted.container.removeEventListener('keydown', listen);
    mounted.unmount();
    host.remove();
  });

  const input = mounted.container.querySelector('input') as HTMLInputElement;
  return { app, mounted, input, onBlur, onEditEnd, batches, heard };
}

const rowsOf = ({ mounted }: Fixture) =>
  Array.from(
    mounted.container.querySelectorAll<HTMLElement>(`.${styles.hintItem}`)
  );

/** Each row's name, without the shortcut badge sharing the line with it. */
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

const press = async (keys: string) => {
  await userEvent.keyboard(keys);
  await flush();
};

describe('the domain picker', () => {
  it('opens on no text and on the row of the domain linked, None first and every named domain after it', async () => {
    const fixture = await setup({ linked: 'nick' });

    expect(fixture.input.value).toBe('');
    expect(fixture.input.placeholder).toBe('Domain');
    expect(namesOf(fixture)).toEqual([
      'None',
      'Identifier',
      'Name',
      'Nickname',
      'Amount',
    ]);
    expect(selectedOf(fixture)).toBe(3);

    const unlinked = await setup();
    expect(selectedOf(unlinked)).toBe(0);
  });

  it('searches the names in any case, on the first match, and writes nothing typed', async () => {
    const fixture = await setup();

    await press('NAM');

    expect(namesOf(fixture)).toEqual(['Name', 'Nickname']);
    expect(selectedOf(fixture)).toBe(0);
    expect(fixture.batches).toEqual([]);
    expect(columnOf(fixture)).toMatchObject({
      name: '',
      logicalName: '',
      dataType: '',
      domainId: '',
    });

    await press('zzz');
    expect(listOf(fixture)).toBeNull();
    await press('{Enter}');
    expect(fixture.heard).toEqual(['Enter']);
    expect(fixture.onEditEnd).not.toHaveBeenCalled();
    expect(fixture.batches).toEqual([]);
  });

  it('links the domain Enter picks with its type in one dispatch, and ends the edit', async () => {
    const fixture = await setup();

    await press('{ArrowDown}{ArrowDown}{Enter}');

    expect(fixture.batches).toEqual([
      ['column.changeDomain', 'column.changeDataType'],
    ]);
    expect(columnOf(fixture)).toMatchObject({
      domainId: 'name',
      dataType: 'VARCHAR(100)',
    });
    expect(fixture.onEditEnd).toHaveBeenCalledTimes(1);
    expect(fixture.heard).toEqual(['ArrowDown', 'ArrowDown']);
  });

  it('unlinks through None, keeping the type the domain gave', async () => {
    const fixture = await setup({ linked: 'id' });
    expect(selectedOf(fixture)).toBe(1);

    await press('{ArrowUp}{Enter}');

    expect(fixture.batches).toEqual([['column.changeDomain']]);
    expect(columnOf(fixture)).toMatchObject({
      domainId: '',
      dataType: 'BIGINT',
    });
  });

  it('links the row a press lands on, the caret kept in the input', async () => {
    const fixture = await setup();
    await press('amo');

    await userEvent.click(rowsOf(fixture)[0]);
    await flush();

    expect(columnOf(fixture).domainId).toBe('amount');
    expect(fixture.onEditEnd).toHaveBeenCalledTimes(1);
    expect(fixture.onBlur).not.toHaveBeenCalled();
    expect((fixture.input.getRootNode() as ShadowRoot).activeElement).toBe(
      fixture.input
    );
  });

  it('offers no row while the domain sheet lists no named domain, leaving Enter to the editor', async () => {
    const empty = await setup({ domains: [] });
    expect(listOf(empty)).toBeNull();

    await press('{Enter}');
    expect(empty.heard).toEqual(['Enter']);
    expect(empty.batches).toEqual([]);

    const blank = await setup({
      domains: [{ id: 'blank', name: '', dataType: 'TEXT' }],
    });
    expect(listOf(blank)).toBeNull();
  });

  it('leaves out a domain the sheet no longer lists, and the link to it', async () => {
    const fixture = await setup({ linked: 'name' });
    expect(selectedOf(fixture)).toBe(2);
    fixture.app.store.dispatchSync(
      removeDictionaryAction({ kind: 'domain', id: 'name' })
    );

    await press('x{Backspace}');

    expect(namesOf(fixture)).toEqual([
      'None',
      'Identifier',
      'Nickname',
      'Amount',
    ]);
    expect(selectedOf(fixture)).toBe(0);
  });

  it('leaves the keys an IME composition holds to it, and searches each step it spells', async () => {
    const fixture = await setup({
      domains: [
        { id: 'code', name: '식별자', dataType: 'BIGINT' },
        { id: 'amount', name: '금액', dataType: 'DECIMAL(18,2)' },
      ],
    });
    const composing: boolean[] = [];
    fixture.input.addEventListener('keydown', event =>
      composing.push(event.isComposing)
    );

    await session().send('Input.imeSetComposition', {
      text: '식',
      selectionStart: 1,
      selectionEnd: 1,
    });
    await flush();
    expect(namesOf(fixture)).toEqual(['식별자']);

    await press('{ArrowDown}');
    await press('{Enter}');
    expect(composing).toEqual([true, true]);
    expect(fixture.batches).toEqual([]);

    await session().send('Input.insertText', { text: '식' });
    await flush();
    await press('{Enter}');

    expect(columnOf(fixture).domainId).toBe('code');
  });

  it('keeps the keyboard row in view and a wheel the list scrolls by off the canvas', async () => {
    const many = Array.from({ length: 15 }, (_, index) => ({
      id: `d${index}`,
      name: `Domain ${String(index).padStart(2, '0')}`,
      dataType: 'INT',
    }));
    const fixture = await setup({ domains: many, linked: 'd14' });
    const list = listOf(fixture) as HTMLElement;

    expect(list.scrollHeight).toBe(16 * DATA_TYPE_HINT_ROW_HEIGHT);
    expect(list.clientHeight).toBeLessThan(list.scrollHeight);
    expect(selectedOf(fixture)).toBe(15);
    expect(list.scrollTop).toBe(list.scrollHeight - list.clientHeight);

    await press('{ArrowDown}');
    expect(selectedOf(fixture)).toBe(0);
    expect(list.scrollTop).toBe(0);

    const outer = vi.fn();
    fixture.mounted.container.addEventListener('wheel', outer);
    list.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, bubbles: true }));
    list.dispatchEvent(
      new WheelEvent('wheel', { deltaX: 40, deltaY: 0, bubbles: true })
    );
    list.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 40, ctrlKey: true, bubbles: true })
    );
    expect(outer).toHaveBeenCalledTimes(2);
  });

  it('ends the edit a turn after the caret leaves it', async () => {
    const fixture = await setup();

    fixture.input.blur();

    await vi.waitFor(() => expect(fixture.onBlur).toHaveBeenCalledTimes(1));
    expect(fixture.batches).toEqual([]);
  });
});
