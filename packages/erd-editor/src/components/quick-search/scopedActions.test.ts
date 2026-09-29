import { AnyAction } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { seedFindDocument } from '@/__test-utils__/findSeed';
import { createTestAppContext, flush } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import {
  Action,
  createScopeActions,
  MATCH_ACTION_LIMIT,
  rankPaletteActions,
  searchActions,
  TABLE_ACTION_LIMIT,
} from '@/components/quick-search/actions';
import {
  PaletteScope,
  parsePaletteQuery,
} from '@/components/quick-search/paletteQuery';
import {
  createFieldActions,
  createHelpActions,
  paletteRows,
  rankTableActions,
  scopeBase,
  SCOPED_ACTION_LIMIT,
  TEXT_FIELDS,
} from '@/components/quick-search/scopedActions';
import { CanvasType } from '@/constants/schema';
import {
  addMemoAction,
  changeMemoValueAction,
} from '@/engine/modules/memo/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import { openFindReplaceAction } from '@/utils/emitter';
import { FindField } from '@/utils/find-replace';

let app: AppContext;

const names = (actions: Action[]) => actions.map(action => action.name);

const pairs = (actions: Action[]) =>
  actions.map(({ name, keywords }) => [name, keywords]);

const visible = () =>
  createScopeActions(app).filter(action => action.filter?.(app) ?? true);

/** The rows the palette shows for a value typed or pasted in one go at its top level. */
const rowsFor = (value: string) => {
  const query = parsePaletteQuery(value);
  const base = scopeBase(visible(), query.scope);
  const found = query.keyword ? searchActions(base, query.keyword) : base;
  return paletteRows(app, found, query);
};

/** What a row hands Find and Replace when chosen. */
const handedOver = (action: Action | undefined) => {
  const opened: unknown[] = [];
  const off = app.emitter.on({
    openFindReplace: event => {
      opened.push(event);
    },
  });
  action?.perform?.(app);
  off();
  return opened;
};

const addTables = (count: number, name: (index: number) => string) => {
  const actions: AnyAction[] = [];
  for (let index = 0; index < count; index++) {
    actions.push(
      addTableAction({ id: `t${index}`, ui: { x: 0, y: 0, zIndex: 1 } }),
      changeTableNameAction({ id: `t${index}`, value: name(index) })
    );
  }
  app.store.dispatchSync(actions);
};

const addColumns = (
  tableId: string,
  count: number,
  name: (index: number) => string
) => {
  const actions: AnyAction[] = [];
  for (let index = 0; index < count; index++) {
    const id = `${tableId}_c${index}`;
    actions.push(
      addColumnAction({ id, tableId }),
      changeColumnNameAction({ id, tableId, value: name(index) })
    );
  }
  app.store.dispatchSync(actions);
};

const ERD_COMMANDS = [
  'Tab',
  'Database',
  'Import',
  'Export',
  'New Table',
  'New Memo',
  'Zero One',
  'Zero N',
  'One Only',
  'One N',
  'Auto Layout',
  'Find and Replace',
];

beforeEach(() => {
  app = createTestAppContext();
  seedFindDocument(app);
});

afterEach(() => {
  app.store.destroy();
});

describe('scopeBase', () => {
  it('hands the fuzzy search the whole level, its commands or its tables, and nothing for the rest', () => {
    const level = visible();

    expect(scopeBase(level, null)).toBe(level);
    expect(names(scopeBase(level, PaletteScope.commands))).toEqual(
      ERD_COMMANDS
    );
    expect(names(scopeBase(level, PaletteScope.tables))).toEqual([
      'orders',
      'users',
    ]);
    for (const scope of [
      PaletteScope.columns,
      PaletteScope.text,
      PaletteScope.help,
    ]) {
      expect(scopeBase(level, scope)).toEqual([]);
    }
  });
});

describe('paletteRows without a prefix', () => {
  it('lists the level for no keyword and the mixed ranking for one', () => {
    expect(names(rowsFor(''))).toEqual(names(visible()));

    const found = searchActions(visible(), 'user');
    expect(pairs(rowsFor('user'))).toEqual(
      pairs(rankPaletteActions(app, found, 'user'))
    );
    expect(names(rowsFor('user')).slice(0, 2)).toEqual(['users', 'user_id']);
  });
});

describe('paletteRows / > commands', () => {
  it('lists every command of the tab and no table or field', () => {
    expect(names(rowsFor('>'))).toEqual(ERD_COMMANDS);
    expect(names(rowsFor('> '))).toEqual(ERD_COMMANDS);
  });

  it('fuzzes the commands alone', () => {
    const rows = rowsFor('>auto');

    expect(rows[0].name).toBe('Auto Layout');
    expect(rows.every(row => !row.tableId)).toBe(true);
    expect(names(rowsFor('> auto'))).toEqual(names(rows));
    expect(names(rowsFor('>users'))).not.toContain('users');
    expect(rowsFor('>users').every(row => !row.tableId)).toBe(true);
    expect(names(rowsFor('>replace'))[0]).toBe('Find and Replace');
  });

  it('keeps to what the tab offers', () => {
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.generatorCode })
    );

    expect(names(rowsFor('>'))).toEqual([
      'Tab',
      'Language',
      'Table Name Case',
      'Column Name Case',
      'Find and Replace',
    ]);
  });
});

describe('paletteRows / # tables', () => {
  it('lists every table by name and fuzzes them alone', () => {
    expect(names(rowsFor('#'))).toEqual(['orders', 'users']);
    expect(rowsFor('#us')[0].name).toBe('users');
    expect(rowsFor('#us').every(row => row.tableId)).toBe(true);
    // A column or a command naming the keyword stays out.
    expect(rowsFor('#email')).toEqual([]);
    expect(rowsFor('#auto')).toEqual([]);
  });

  it('lists more tables than the mixed list, capped, and hands the rest to Find and Replace', () => {
    const count = SCOPED_ACTION_LIMIT + 20;
    addTables(count, index => `item_${index}`);
    expect(SCOPED_ACTION_LIMIT).toBeGreaterThan(TABLE_ACTION_LIMIT);

    const rows = rowsFor('#item');
    const last = rows.at(-1);

    expect(rows.filter(row => row.tableId)).toHaveLength(SCOPED_ACTION_LIMIT);
    expect(last?.name).toBe(`Show all ${count} matches in Find and Replace`);
    expect(handedOver(last)).toEqual([
      openFindReplaceAction({ query: 'item', fields: [FindField.tableName] }),
    ]);
  });

  it('caps an empty keyword too, with nothing to hand over', () => {
    addTables(SCOPED_ACTION_LIMIT + 20, index => `item_${index}`);

    const rows = rowsFor('#');

    expect(rows).toHaveLength(SCOPED_ACTION_LIMIT);
    expect(rows.every(row => row.tableId)).toBe(true);
  });

  it('puts the tables holding the keyword first and hands over none that only fuzz to it', () => {
    const found: Action[] = [
      { name: 'orders_archive', tableId: 'a' },
      { name: 'user_orders', tableId: 'b' },
    ];

    expect(names(rankTableActions(app, found, 'user'))).toEqual([
      'user_orders',
      'orders_archive',
    ]);

    const loose = Array.from(
      { length: SCOPED_ACTION_LIMIT + 5 },
      (_, index): Action => ({ name: `loose_${index}`, tableId: `l${index}` })
    );
    expect(rankTableActions(app, loose, 'lsoe')).toHaveLength(
      SCOPED_ACTION_LIMIT
    );
  });

  it('stays quick over a schema of hundreds of tables', () => {
    addTables(600, index => `table_${index}_items`);

    const started = performance.now();
    const rows = rowsFor('#items');
    const elapsed = performance.now() - started;

    expect(rows.at(-1)?.name).toBe('Show all 600 matches in Find and Replace');
    // Not a benchmark, only a guard against a search that grows past linear.
    expect(elapsed).toBeLessThan(5000);
  });
});

describe('paletteRows / @ columns', () => {
  it('lists the columns named like the keyword in any table, and no comment or memo', () => {
    expect(pairs(rowsFor('@user'))).toEqual([
      ['user_id', 'orders.user_id · Column'],
    ]);
    // login email is a comment, which the column scope leaves out.
    expect(pairs(rowsFor('@em'))).toEqual([['email', 'users.email · Column']]);
    expect(names(rowsFor('@ em'))).toEqual(['email']);
  });

  it('narrows by table before the first dot', () => {
    expect(names(rowsFor('@users.em'))).toEqual(['email']);
    expect(names(rowsFor('@orders.em'))).toEqual([]);
    expect(names(rowsFor('@ord.id'))).toEqual(['order_id', 'user_id']);
    expect(names(rowsFor('@users.'))).toEqual(['id', 'email']);
    expect(names(rowsFor('@nothing.'))).toEqual([]);
    expect(names(rowsFor('@.em'))).toEqual(['email']);
  });

  it('lists every column of every table for no keyword, the unnamed ones too', () => {
    addColumns('users', 1, () => '');

    expect(pairs(rowsFor('@'))).toEqual([
      ['order_id', 'orders.order_id · Column'],
      ['user_id', 'orders.user_id · Column'],
      ['total', 'orders.total · Column'],
      ['id', 'users.id · Column'],
      ['email', 'users.email · Column'],
      ['unnamed', 'users.unnamed · Column'],
    ]);
  });

  it('stands the reader on the column cell picked, from any tab', async () => {
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.schemaSQL })
    );
    const [email] = rowsFor('@users.email');

    email.perform?.(app);
    await flush();

    expect(app.store.state.settings.canvasType).toBe(CanvasType.ERD);
    expect(app.store.state.editor.focusTable).toMatchObject({
      tableId: 'users',
      columnId: 'email',
      focusType: 'columnName',
    });
  });

  it('caps the list and hands the column part to Find and Replace over column names', () => {
    const count = SCOPED_ACTION_LIMIT + 20;
    addColumns('users', count, index => `col_${index}`);
    addColumns('orders', 10, index => `col_${index}`);

    const rows = rowsFor('@col');

    expect(rows).toHaveLength(SCOPED_ACTION_LIMIT + 1);
    expect(rows.at(-1)?.name).toBe(
      `Show all ${count + 10} matches in Find and Replace`
    );
    expect(handedOver(rows.at(-1))).toEqual([
      openFindReplaceAction({ query: 'col', fields: [FindField.columnName] }),
    ]);
  });

  it('leaves the table part behind when it hands a table.column search over, the count the panel opens on', () => {
    addColumns('users', SCOPED_ACTION_LIMIT + 20, index => `col_${index}`);
    addColumns('orders', 10, index => `col_${index}`);

    const rows = rowsFor('@users.col');
    const last = rows.at(-1);

    expect(
      rows.slice(0, -1).every(row => row.keywords?.startsWith('users.'))
    ).toBe(true);
    expect(last?.name).toBe(
      `Show all ${SCOPED_ACTION_LIMIT + 30} matches in Find and Replace`
    );
    expect(handedOver(last)).toEqual([
      openFindReplaceAction({ query: 'col', fields: [FindField.columnName] }),
    ]);
    expect(rowsFor('@orders.col')).toHaveLength(10);
  });

  it('hands nothing over when there is no column part, however many columns it lists', () => {
    addColumns('users', SCOPED_ACTION_LIMIT + 20, index => `col_${index}`);

    const rows = rowsFor('@users.');

    expect(rows).toHaveLength(SCOPED_ACTION_LIMIT);
    expect(names(rows).some(name => name.startsWith('Show all'))).toBe(false);
  });
});

describe('paletteRows / " comments and memos', () => {
  it('lists the table comments, column comments and memos holding the keyword, and no name', () => {
    expect(pairs(rowsFor('"user'))).toEqual([
      ['user id', 'users.id · Column comment'],
      ['Every user_id points at users.id', 'Memo'],
    ]);
    expect(pairs(rowsFor('" orders'))).toEqual([
      ['Customer orders', 'orders · Table comment'],
    ]);
    expect(rowsFor('"email')).toHaveLength(1);
  });

  it('lists every text there is for no keyword, and skips the empty ones', () => {
    expect(names(rowsFor('"'))).toEqual([
      'Customer orders',
      'primary id',
      'buyer of the order',
      'user id',
      'login email',
      'Every user_id points at users.id',
    ]);
  });

  it('caps the list and hands the search over with the comment and memo scopes', () => {
    const actions: AnyAction[] = [];
    for (let index = 0; index <= SCOPED_ACTION_LIMIT; index++) {
      actions.push(
        addMemoAction({ id: `m${index}`, ui: { x: 0, y: 0, zIndex: 1 } }),
        changeMemoValueAction({ id: `m${index}`, value: 'many user' })
      );
    }
    app.store.dispatchSync(actions);

    const rows = rowsFor('"user');
    const last = rows.at(-1);

    expect(rows).toHaveLength(SCOPED_ACTION_LIMIT + 1);
    // Every memo added, and the seed's column comment and its memo's two.
    expect(last?.name).toBe(
      `Show all ${SCOPED_ACTION_LIMIT + 4} matches in Find and Replace`
    );
    expect(handedOver(last)).toEqual([
      openFindReplaceAction({ query: 'user', fields: TEXT_FIELDS }),
    ]);
    expect(TEXT_FIELDS).toEqual([
      FindField.tableComment,
      FindField.columnComment,
      FindField.memo,
    ]);
  });

  it('builds the same rows for the kinds it is handed', () => {
    expect(names(createFieldActions(app, [FindField.memo], 'user'))).toEqual([
      'Every user_id points at users.id',
    ]);
    expect(
      names(createFieldActions(app, [FindField.columnName], '', 'orders'))
    ).toEqual(['order_id', 'user_id', 'total']);
  });
});

describe('paletteRows / ? help', () => {
  it('lists the prefixes, each typing its own when chosen', () => {
    const rows = rowsFor('?');

    expect(rows.map(({ name, insert }) => [name, insert])).toEqual([
      ['Commands', '>'],
      ['Tables', '#'],
      ['Columns', '@'],
      ['Comments & memos', '"'],
    ]);
    for (const row of rows) {
      expect(row.keywords).toBeTruthy();
      expect(row.icon).toBeTruthy();
      expect(row.perform).toBeUndefined();
    }
  });

  it('fuzzes the prefixes by what follows the question mark', () => {
    expect(rowsFor('?column')[0].name).toBe('Columns');
    expect(names(createHelpActions('memos'))).toContain('Comments & memos');
    expect(createHelpActions()).toHaveLength(4);
  });
});

describe('the mixed list beside the scoped ones', () => {
  it('keeps its own limits', () => {
    expect(MATCH_ACTION_LIMIT).toBeLessThan(SCOPED_ACTION_LIMIT);
  });
});
