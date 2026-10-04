import { AnyAction } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { seedFindDocument } from '@/__test-utils__/findSeed';
import {
  IME_CHOSEONG,
  IME_CLUSTERS,
  IME_SAYONG,
  seedClusterTables,
  seedHangulDocument,
} from '@/__test-utils__/hangulSeed';
import { createTestAppContext, flush } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import {
  Action,
  createScopeActions,
  searchActions,
} from '@/components/quick-search/actions';
import {
  PaletteScope,
  parsePaletteQuery,
} from '@/components/quick-search/paletteQuery';
import {
  createFieldActions,
  createHelpActions,
  createPrefixActions,
  paletteRows,
  rankTableActions,
  scopeBase,
  SCOPED_ACTION_LIMIT,
  TEXT_FIELDS,
} from '@/components/quick-search/scopedActions';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import {
  changeOpenMapAction,
  changeViewportAction,
} from '@/engine/modules/editor/atom.actions';
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
  changeColumnCommentAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import { toScreenPoint } from '@/konva/scene/viewport';
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
  'Import and Add',
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

/** A name holding history from index 42, past the 40 at which Fuse still lets a hit start. */
const LONG_TABLE_NAME = 'application_user_notification_preferences_history';

beforeEach(() => {
  app = createTestAppContext();
  seedFindDocument(app);
});

afterEach(() => {
  app.store.destroy();
});

describe('scopeBase', () => {
  it('hands the fuzzy search the commands with no prefix, the tables after #, and nothing for the rest', () => {
    const level = visible();

    expect(names(scopeBase(level, null))).toEqual(ERD_COMMANDS);
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
  /** Whether a row is the document's: a table, or a column, comment or memo saying where it is. */
  const isDocumentRow = (row: Action) =>
    Boolean(row.tableId || row.keywords?.includes(' · '));

  it('lists the commands alone for no keyword', () => {
    expect(names(rowsFor(''))).toEqual(ERD_COMMANDS);
    expect(names(rowsFor(' '))).toEqual(ERD_COMMANDS);
    expect(names(visible())).toEqual([...ERD_COMMANDS, 'orders', 'users']);
  });

  it('keeps to what the tab offers', () => {
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.generatorCode })
    );

    expect(names(rowsFor(''))).toEqual([
      'Tab',
      'Language',
      'Table Name Case',
      'Column Name Case',
      'Find and Replace',
    ]);
  });

  it('searches the commands for a > typed first, a character like any other', () => {
    const rows = rowsFor('>auto');

    expect(rows[0].name).toBe('Auto Layout');
    expect(rows.some(isDocumentRow)).toBe(false);
    // No command holds >auto as typed, so the word is offered as it stands.
    expect(rows.slice(-3).map(row => row.insert)).toEqual([
      '#>auto',
      '@>auto',
      ':>auto',
    ]);
    expect(rowsFor('>users').some(isDocumentRow)).toBe(false);
  });

  it('fuzzes the commands alone, however many tables, columns, comments and memos hold the keyword', () => {
    expect(rowsFor('auto')[0].name).toBe('Auto Layout');
    expect(names(rowsFor('replace'))[0]).toBe('Find and Replace');

    for (const keyword of ['user', 'users', 'us', 'id', 'login', 'Every']) {
      const rows = rowsFor(keyword);
      expect(rows.some(isDocumentRow)).toBe(false);
      expect(names(rows).some(name => name.startsWith('Show all'))).toBe(false);
    }
  });

  it('offers the keyword to the prefixes that search the document once no command holds it', () => {
    const rows = rowsFor('orders');

    expect(rows.map(({ name, insert }) => [name, insert])).toEqual([
      ['Search tables for "orders"', '#orders'],
      ['Search columns for "orders"', '@orders'],
      ['Search comments & memos for "orders"', ':orders'],
    ]);
    for (const row of rows) {
      expect(row.icon).toBeTruthy();
      expect(row.perform).toBeUndefined();
      expect(row.next).toBeUndefined();
    }
    expect(rowsFor('  orders ')).toHaveLength(3);
    expect(createPrefixActions('users.em').map(row => row.insert)).toEqual([
      '#users.em',
      '@users.em',
      ':users.em',
    ]);
  });

  it('lists the commands a word only fuzzes to, then offers the word to the prefixes', () => {
    expect(names(rowsFor('tables'))).toEqual([
      'New Table',
      'Database',
      'Search tables for "tables"',
      'Search columns for "tables"',
      'Search comments & memos for "tables"',
    ]);

    // Names a schema may give its tables, which Fuse still fuzzes to commands.
    for (const keyword of ['memos', 'layouts', 'imports', 'exports', 'zones']) {
      const rows = rowsFor(keyword);
      const commands = rows.slice(0, -3);

      expect(commands.length).toBeGreaterThan(0);
      expect(commands.every(row => row.insert === undefined)).toBe(true);
      expect(rows.slice(-3).map(row => row.insert)).toEqual([
        `#${keyword}`,
        `@${keyword}`,
        `:${keyword}`,
      ]);
    }
  });

  it('offers a table name that fuzzes to no command to the prefixes alone', () => {
    for (const keyword of ['users', 'posts', 'roles', 'accounts', 'notes']) {
      expect(rowsFor(keyword).map(row => row.insert)).toEqual([
        `#${keyword}`,
        `@${keyword}`,
        `:${keyword}`,
      ]);
    }
  });

  it('offers no prefix while a command listed holds the keyword, in its name or keywords, or by its Hangul letters', () => {
    const held = ['auto', 'LAYOUT', 'new t', 'relationship', 'rename'];
    for (const keyword of held) {
      const offers = rowsFor(keyword).some(row => row.insert !== undefined);
      expect(offers).toBe(false);
    }

    const choseong = parsePaletteQuery('ㅅㅇㅈ');
    const korean: Action[] = [{ name: '사용자 추가' }];
    expect(paletteRows(app, korean, choseong)).toEqual(korean);
    expect(names(paletteRows(app, [{ name: 'Tab' }], choseong))).toEqual([
      'Tab',
      'Search tables for "ㅅㅇㅈ"',
      'Search columns for "ㅅㅇㅈ"',
      'Search comments & memos for "ㅅㅇㅈ"',
    ]);
  });

  it('types in a query each of those rows lists the document by', () => {
    const [tables, columns, text] = rowsFor('email');

    expect(names(rowsFor(tables.insert as string))).toEqual([]);
    expect(pairs(rowsFor(columns.insert as string))).toEqual([
      ['email', 'users.email · Column'],
    ]);
    expect(pairs(rowsFor(text.insert as string))).toEqual([
      ['login email', 'users.email · Column comment'],
    ]);
    expect(rowsFor(rowsFor('orders')[0].insert as string)[0].name).toBe(
      'orders'
    );
  });

  it('offers nothing after a prefix whose scope holds no row', () => {
    for (const value of ['#email', '@qqqq', ':qqqq']) {
      expect(rowsFor(value)).toEqual([]);
    }
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

  it('lists the tables up to its cap and hands the rest to Find and Replace', () => {
    const count = SCOPED_ACTION_LIMIT + 20;
    addTables(count, index => `item_${index}`);

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

  it('goes to a table holding the keyword past index 40 of its name', () => {
    addTables(1, () => LONG_TABLE_NAME);

    for (const typed of ['#history', '#_history', '#preferences']) {
      expect(names(rowsFor(typed))).toEqual([LONG_TABLE_NAME]);
    }
    expect(names(rowsFor('#us'))).not.toContain('orders');
  });

  it('hands those tables over to Find and Replace past its cap', () => {
    const count = SCOPED_ACTION_LIMIT + 5;
    addTables(count, index => `${LONG_TABLE_NAME}_${index}`);

    const rows = rowsFor('#history');
    const last = rows.at(-1);

    expect(rows.filter(row => row.tableId)).toHaveLength(SCOPED_ACTION_LIMIT);
    expect(last?.name).toBe(`Show all ${count} matches in Find and Replace`);
    expect(handedOver(last)).toEqual([
      openFindReplaceAction({
        query: 'history',
        fields: [FindField.tableName],
      }),
    ]);
  });

  it('hands nothing over for the word a table with no name is listed by, which the panel never finds', () => {
    addTables(SCOPED_ACTION_LIMIT + 5, () => '');

    const rows = rowsFor('#unn');

    expect(rows).toHaveLength(SCOPED_ACTION_LIMIT);
    expect(names(rows).some(name => name.startsWith('Show all'))).toBe(false);
  });

  it('names the one match it hands over in the singular', () => {
    // Every table with no name is listed as unnamed, which holds the keyword.
    addTables(SCOPED_ACTION_LIMIT + 5, () => '');
    app.store.dispatchSync(
      addTableAction({ id: 'named', ui: { x: 0, y: 0, zIndex: 1 } }),
      changeTableNameAction({ id: 'named', value: 'x_name' })
    );

    const last = rowsFor('#name').at(-1);

    expect(last?.name).toBe('Show 1 match in Find and Replace');
    expect(handedOver(last)).toEqual([
      openFindReplaceAction({ query: 'name', fields: [FindField.tableName] }),
    ]);
  });

  it.each([Open.automaticTablePlacement, Open.diffViewer, Open.timeTravel])(
    'leaves the hand-off out under %s, which keeps Find and Replace shut',
    key => {
      addTables(SCOPED_ACTION_LIMIT + 20, index => `item_${index}`);
      const shown = () =>
        rowsFor('#item').filter(row => row.filter?.(app) ?? true);
      expect(shown().at(-1)?.tableId).toBeUndefined();

      app.store.dispatchSync(changeOpenMapAction({ [key]: true }));

      expect(shown()).toHaveLength(SCOPED_ACTION_LIMIT);
      expect(shown().every(row => row.tableId)).toBe(true);
    }
  );

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

  it('lands the column clear of an open Find and Replace panel', async () => {
    app.store.dispatchSync(
      changeViewportAction({ width: 800, height: 600 }),
      changeOpenMapAction({ [Open.findReplace]: true })
    );
    const { orders } = app.store.state.collections.tableEntities;
    // On screen whole, the column's table still stands under the panel.
    expect(toScreenPoint(app.store.state.settings, orders.ui).x).toBe(60);

    const [userId] = rowsFor('@orders.user_id');
    userId.perform?.(app);
    await flush();

    const { settings, collections } = app.store.state;
    expect(
      toScreenPoint(settings, collections.tableEntities.orders.ui).x
    ).toBeGreaterThanOrEqual(16 + 380 + 16);
    expect(app.store.state.editor.focusTable).toMatchObject({
      tableId: 'orders',
      columnId: 'orders_user_id',
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

describe('paletteRows / : comments and memos', () => {
  it('lists the table comments, column comments and memos holding the keyword, and no name', () => {
    expect(pairs(rowsFor(':user'))).toEqual([
      ['user id', 'users.id · Column comment'],
      ['Every user_id points at users.id', 'Memo'],
    ]);
    expect(pairs(rowsFor(': orders'))).toEqual([
      ['Customer orders', 'orders · Table comment'],
    ]);
    expect(rowsFor(':email')).toHaveLength(1);
  });

  it('lists every text there is for no keyword, and skips the empty ones', () => {
    expect(names(rowsFor(':'))).toEqual([
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

    const rows = rowsFor(':user');
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
      ['Tables', '#'],
      ['Columns', '@'],
      ['Comments & memos', ':'],
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
    expect(createHelpActions()).toHaveLength(3);
  });
});

describe('paletteRows / Hangul', () => {
  const STEPS = [...IME_SAYONG, ...IME_CHOSEONG];

  const addMemos = (count: number, value: (index: number) => string) => {
    const actions: AnyAction[] = [];
    for (let index = 0; index < count; index++) {
      const id = `ko-${app.store.state.doc.memoIds.length}-${index}`;
      actions.push(
        addMemoAction({ id, ui: { x: 0, y: 0, zIndex: 1 } }),
        changeMemoValueAction({ id, value: value(index) })
      );
    }
    app.store.dispatchSync(actions);
  };

  const hasShowAll = (actions: Action[]) =>
    names(actions).some(name => name.startsWith('Show all'));

  beforeEach(() => {
    app.store.destroy();
    app = createTestAppContext();
    seedHangulDocument(app);
  });

  it('keeps 사용자 in every scope at each step an IME hands over, and offers each step to them with no prefix', () => {
    for (const step of STEPS) {
      expect(rowsFor(step).map(row => row.insert)).toEqual([
        `#${step}`,
        `@${step}`,
        `:${step}`,
      ]);
      expect(names(rowsFor(`#${step}`))).toContain('사용자');
      expect(names(rowsFor(`@${step}`))).toContain('사용자');
      expect(names(rowsFor(`:${step}`))).toContain('주문한 사용자');
      expect(rowsFor(`#${step}`).every(row => row.tableId)).toBe(true);
    }
  });

  it('keeps a name in every scope through each cluster a Windows IME composes of its initials', () => {
    seedClusterTables(app);

    for (const [name, steps] of IME_CLUSTERS) {
      for (const step of steps) {
        for (const prefix of ['#', '@', ':']) {
          expect(names(rowsFor(`${prefix}${step}`))).toContain(name);
        }
      }
    }
    expect(names(rowsFor('#ㅄ'))).toEqual(['부서', '배송지']);
  });

  it('goes to a table by its initials, and to a column by the syllables typed so far', () => {
    expect(names(rowsFor('#ㅈㅁ'))).toEqual(['주문 내역']);
    expect(names(rowsFor('#사요'))).toEqual(['사용자']);
    expect(pairs(rowsFor('@사'))).toEqual([
      ['사용자', '주문 내역.사용자 · Column'],
      ['상품명', '상품.상품명 · Column'],
    ]);
  });

  it('reads the table part of a column search by its Hangul letters too', () => {
    const ofUsers = ['아이디', '이름', '이메일'];

    expect(names(rowsFor('@사용자.'))).toEqual(ofUsers);
    expect(names(rowsFor('@ㅅㅇㅈ.ㅇ'))).toEqual(ofUsers);
    expect(names(rowsFor('@ㅈㅁ.ㅅ'))).toEqual(['사용자']);
    expect(names(rowsFor('@사요.'))).toEqual(ofUsers);
  });

  it('lists the comments and the memo spelled, and no name', () => {
    expect(pairs(rowsFor(':ㅅㅇㅈ'))).toEqual([
      ['사용자 고유 번호', '사용자.아이디 · Column comment'],
      ['사용자 한 명이 여러 주문을 남긴다', 'Memo'],
      ['주문한 사용자', '주문 내역.사용자 · Column comment'],
    ]);
  });

  it('lists the fields an IME step or the initials spell whole, from the start, then inside, each tier in document order', () => {
    const fields = [FindField.columnName, ...TEXT_FIELDS];

    expect(names(createFieldActions(app, fields, 'ㅅㅇㅈ'))).toEqual([
      '사용자',
      '사용자 고유 번호',
      '사용자 한 명이 여러 주문을 남긴다',
      '주문한 사용자',
    ]);
    expect(names(createFieldActions(app, fields, '사요'))).toEqual([
      '사용자 고유 번호',
      '사용자',
      '사용자 한 명이 여러 주문을 남긴다',
      '주문한 사용자',
    ]);
    // 상품명 holds 상 as typed; 사용 only spells it across two syllables.
    expect(names(createFieldActions(app, fields, '상'))).toEqual([
      '상품명',
      '사용자 고유 번호',
      '사용자',
      '사용자 한 명이 여러 주문을 남긴다',
      '주문한 사용자',
    ]);
  });

  it('lists a column holding the keyword as typed above one its letters spell across syllables', () => {
    expect(pairs(rowsFor('@상'))).toEqual([
      ['상품명', '상품.상품명 · Column'],
      ['사용자', '주문 내역.사용자 · Column'],
    ]);
  });

  it('hands # over past its limit only for a keyword the table names hold as typed', () => {
    addTables(SCOPED_ACTION_LIMIT + 5, index => `사용자_${index}`);

    for (const keyword of ['#ㅅㅇㅈ', '#사요']) {
      const rows = rowsFor(keyword);
      expect(rows).toHaveLength(SCOPED_ACTION_LIMIT);
      expect(hasShowAll(rows)).toBe(false);
    }

    const last = rowsFor('#사용').at(-1);
    expect(last?.name).toBe(
      `Show all ${SCOPED_ACTION_LIMIT + 6} matches in Find and Replace`
    );
    expect(handedOver(last)).toEqual([
      openFindReplaceAction({ query: '사용', fields: [FindField.tableName] }),
    ]);
  });

  it('hands @ over past its limit only for a keyword the column names hold as typed', () => {
    addColumns('orders', SCOPED_ACTION_LIMIT + 5, index => `사용자_${index}`);

    expect(rowsFor('@ㅅㅇㅈ')).toHaveLength(SCOPED_ACTION_LIMIT);
    expect(hasShowAll(rowsFor('@ㅅㅇㅈ'))).toBe(false);
    expect(rowsFor('@사용').at(-1)?.name).toBe(
      `Show all ${SCOPED_ACTION_LIMIT + 6} matches in Find and Replace`
    );
  });

  it('hands " over when the limit leaves out a text holding the keyword as typed, and not before', () => {
    addMemos(SCOPED_ACTION_LIMIT, index => `사용자 메모 ${index}`);

    expect(rowsFor(':ㅅㅇㅈ')).toHaveLength(SCOPED_ACTION_LIMIT);
    expect(hasShowAll(rowsFor(':ㅅㅇㅈ'))).toBe(false);
    expect(hasShowAll(rowsFor(':상'))).toBe(false);

    // 상 spells 사용 in every memo above; this one holds it as typed, so it
    // goes first and the limit leaves out only memos it spells.
    addMemos(1, () => '상품 설명');
    expect(names(rowsFor(':상'))[0]).toBe('상품 설명');
    expect(hasShowAll(rowsFor(':상'))).toBe(false);

    addMemos(SCOPED_ACTION_LIMIT, index => `상품 설명 ${index}`);
    const last = rowsFor(':상').at(-1);
    expect(last?.name).toBe(
      `Show all ${SCOPED_ACTION_LIMIT + 1} matches in Find and Replace`
    );
    expect(handedOver(last)).toEqual([
      openFindReplaceAction({ query: '상', fields: TEXT_FIELDS }),
    ]);
  });

  it('stays quick over hundreds of Korean tables and thousands of columns', () => {
    const actions: AnyAction[] = [];
    // Every text differs, so the first keystroke spells them all afresh.
    for (let table = 0; table < 600; table++) {
      const tableId = `ko${table}`;
      actions.push(
        addTableAction({ id: tableId, ui: { x: 0, y: 0, zIndex: 1 } }),
        changeTableNameAction({ id: tableId, value: `주문_${table}_내역` })
      );
      for (let column = 0; column < 10; column++) {
        const id = `${tableId}c${column}`;
        actions.push(
          addColumnAction({ id, tableId }),
          changeColumnNameAction({
            id,
            tableId,
            value: `사용자_${table}_${column}`,
          }),
          changeColumnCommentAction({
            id,
            tableId,
            value: `${table}번 표 ${column}번 사용자 설명`,
          })
        );
      }
    }
    app.store.dispatchSync(actions);

    const started = performance.now();
    for (const prefix of ['', '#', '@', ':']) {
      for (const step of [...STEPS, 'ㅈㅁ']) {
        rowsFor(`${prefix}${step}`);
      }
    }
    const elapsed = performance.now() - started;

    expect(rowsFor('#ㅈㅁ')).toHaveLength(SCOPED_ACTION_LIMIT);
    expect(rowsFor('@ㅅㅇㅈ')).toHaveLength(SCOPED_ACTION_LIMIT);
    // Not a benchmark, only a guard against a search that grows past linear.
    expect(elapsed).toBeLessThan(5000);
  });
});
