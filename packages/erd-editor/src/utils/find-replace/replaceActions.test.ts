import {
  type AnyAction,
  type CompositionAction,
  compositionActionsFlat,
} from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import { FIND_SEED, seedFindDocument } from '@/__test-utils__/findSeed';
import type { AppContext } from '@/components/appContext';
import { ColumnOption } from '@/constants/schema';
import { ChangeActionTypes, HistoryActionTypes } from '@/engine/actions';
import { changeTableNameDerivedAction } from '@/engine/modules/table/atom.actions';
import { changeColumnNameDerivedAction } from '@/engine/modules/table-column/atom.actions';
import { bHas } from '@/utils/bit';
import {
  createMatcher,
  DEFAULT_FIND_OPTIONS,
  FindField,
  FindFieldList,
  findMatches,
  FindOptions,
  Matcher,
  toFieldAction,
  toReplaceActions,
} from '@/utils/find-replace';

let app: AppContext;

/** The atom actions a dispatch of these would reduce, read off the store as it stands. */
const flat = (actions: CompositionAction[]) =>
  compositionActionsFlat(
    app.store.state,
    app.store.context,
    actions
  ) as AnyAction[];

/** Where a field action lands: a column of the seed for a column name, which must exist. */
const atOf = (field: FindField) =>
  field === FindField.columnName
    ? { id: 'users_id', tableId: 'users' }
    : { id: 'users', tableId: 'users' };

/** Turns the derived flags of the users table and its id column on. */
function deriveUsers() {
  app.store.dispatchSync(
    changeTableNameDerivedAction({ id: 'users', value: true }),
    changeColumnNameDerivedAction({
      id: 'users_id',
      tableId: 'users',
      value: true,
    })
  );
}

const matcherOf = (query: string, options: Partial<FindOptions> = {}) =>
  createMatcher(query, { ...DEFAULT_FIND_OPTIONS, ...options })
    .matcher as Matcher;

/** Every text a search covers, keyed by where it is, as the document now holds it. */
function texts() {
  const { collections } = app.store.state;
  return {
    tables: Object.fromEntries(
      FIND_SEED.tables.map(({ id }) => [
        id,
        [
          collections.tableEntities[id].name,
          collections.tableEntities[id].comment,
        ],
      ])
    ),
    columns: Object.fromEntries(
      FIND_SEED.tables.flatMap(({ columns }) =>
        columns.map(({ id }) => [
          id,
          [
            collections.tableColumnEntities[id].name,
            collections.tableColumnEntities[id].comment,
          ],
        ])
      )
    ),
    memo: collections.memoEntities[FIND_SEED.memo.id].value,
  };
}

beforeEach(() => {
  app = createTestAppContext();
  seedFindDocument(app);
});

afterEach(() => {
  app.store.destroy();
});

describe('toFieldAction', () => {
  it('writes each field but a name through the atom action an edit by hand dispatches', () => {
    const at = { id: 'c', tableId: 't' };
    const names: FindField[] = [FindField.tableName, FindField.columnName];

    expect(
      FindFieldList.filter(field => !names.includes(field)).map(field =>
        toFieldAction({ ...at, field }, 'v')
      )
    ).toEqual([
      { type: 'table.changeComment', payload: { id: 'c', value: 'v' } },
      {
        type: 'column.changeComment',
        payload: { id: 'c', tableId: 't', value: 'v' },
      },
      { type: 'memo.changeValue', payload: { id: 'c', value: 'v' } },
      {
        type: 'index.changeName',
        payload: { id: 'c', tableId: 't', value: 'v' },
      },
      { type: 'tableGroup.changeName', payload: { id: 'c', value: 'v' } },
    ]);
  });

  it('writes a name through the generator a rename by hand sends, turning a derived flag off', () => {
    const named = () => [
      toFieldAction(
        { field: FindField.tableName, ...atOf(FindField.tableName) },
        'v'
      ),
      toFieldAction(
        { field: FindField.columnName, ...atOf(FindField.columnName) },
        'v'
      ),
    ];

    expect(flat(named())).toEqual([
      { type: 'table.changeName', payload: { id: 'users', value: 'v' } },
      {
        type: 'column.changeName',
        payload: { id: 'users_id', tableId: 'users', value: 'v' },
      },
    ]);

    deriveUsers();

    expect(flat(named())).toEqual([
      { type: 'table.changeName', payload: { id: 'users', value: 'v' } },
      {
        type: 'table.changeNameDerived',
        payload: { id: 'users', value: false },
      },
      {
        type: 'column.changeName',
        payload: { id: 'users_id', tableId: 'users', value: 'v' },
      },
      {
        type: 'column.changeNameDerived',
        payload: { id: 'users_id', tableId: 'users', value: false },
      },
    ]);
  });

  it('writes only types that are saved, undone and sent to every peer', () => {
    deriveUsers();
    const types = flat(
      FindFieldList.map(field => toFieldAction({ field, ...atOf(field) }, 'v'))
    ).map(({ type }) => type);

    expect(types).toContain('column.changeNameDerived');
    for (const type of types) {
      expect(ChangeActionTypes).toContain(type);
      expect(HistoryActionTypes).toContain(type);
    }
  });
});

describe('toReplaceActions', () => {
  it('writes each field once, with all of its occurrences replaced', () => {
    const matcher = matcherOf('user');
    const matches = findMatches(app.store.state, matcher);

    expect(flat(toReplaceActions(matches, matcher, 'member').actions)).toEqual([
      {
        type: 'column.changeName',
        payload: {
          id: 'orders_user_id',
          tableId: 'orders',
          value: 'member_id',
        },
      },
      { type: 'table.changeName', payload: { id: 'users', value: 'members' } },
      {
        type: 'column.changeComment',
        payload: { id: 'users_id', tableId: 'users', value: 'member id' },
      },
      {
        type: 'memo.changeValue',
        payload: { id: 'note', value: 'Every member_id points at members.id' },
      },
    ]);
  });

  it('replaces just the occurrence given', () => {
    const matcher = matcherOf('user');
    const matches = findMatches(app.store.state, matcher);
    const second = matches.find(
      ({ field, start }) => field === FindField.memo && start === 24
    );

    expect(toReplaceActions(matches, matcher, 'member', second)).toEqual({
      actions: [
        {
          type: 'memo.changeValue',
          payload: { id: 'note', value: 'Every user_id points at members.id' },
        },
      ],
      replaced: 1,
    });
  });

  it('replaces every whole word a regular expression finds, whichever alternative comes first', () => {
    const matcher = matcherOf('user|user_id', { regex: true, wholeWord: true });

    app.store.dispatchSync(
      toReplaceActions(findMatches(app.store.state, matcher), matcher, 'member')
        .actions
    );

    expect(texts().columns.orders_user_id[0]).toBe('member');
    expect(texts().columns.users_id[1]).toBe('member id');
    expect(texts().memo).toBe('Every member points at users.id');
  });

  it('replaces a whole word with a separator at its edge where it stands in the document', () => {
    const replaceAll = (query: string, replacement: string) => {
      const matcher = matcherOf(query, { wholeWord: true });
      app.store.dispatchSync(
        toReplaceActions(
          findMatches(app.store.state, matcher),
          matcher,
          replacement
        ).actions
      );
    };

    replaceAll('.id', '_id');
    replaceAll('user ', 'member ');

    expect(texts().memo).toBe('Every user_id points at users_id');
    expect(texts().columns.users_id[1]).toBe('member id');
    expect(texts().columns.orders_user_id[0]).toBe('user_id');
  });

  it('writes nothing where the replacement leaves the text as it was', () => {
    const matcher = matcherOf('user', { matchCase: true });
    const matches = findMatches(app.store.state, matcher);

    expect(toReplaceActions(matches, matcher, 'user')).toEqual({
      actions: [],
      replaced: 0,
    });
    expect(toReplaceActions(matches, matcher, 'user', matches[0])).toEqual({
      actions: [],
      replaced: 0,
    });
  });

  it('counts the matches a replacement changes, not the fields it writes', () => {
    const counted = (query: string, replacement: string) => {
      const matcher = matcherOf(query, { regex: true });
      return toReplaceActions(
        findMatches(app.store.state, matcher),
        matcher,
        replacement
      );
    };

    expect(counted('user', 'member').replaced).toBe(5);
    expect(counted('(user)', '$1')).toEqual({ actions: [], replaced: 0 });
    // Two of the five already read users; the memo holds one of each.
    const plural = counted('users?', 'users');
    expect(plural.replaced).toBe(3);
    expect(plural.actions).toHaveLength(3);
  });

  it('lands as one history entry, which one undo takes back whole', () => {
    const before = texts();
    const matcher = matcherOf('user');

    app.store.dispatchSync(
      toReplaceActions(findMatches(app.store.state, matcher), matcher, 'member')
        .actions
    );

    expect(texts()).toEqual({
      tables: { orders: ['orders', 'Customer orders'], users: ['members', ''] },
      columns: {
        order_id: ['order_id', 'primary id'],
        orders_user_id: ['member_id', 'buyer of the order'],
        total: ['total', ''],
        users_id: ['id', 'member id'],
        email: ['email', 'login email'],
      },
      memo: 'Every member_id points at members.id',
    });
    expect(app.store.history.hasUndo()).toBe(true);

    app.store.undo();

    expect(texts()).toEqual(before);
    expect(app.store.history.hasUndo()).toBe(false);

    app.store.redo();

    expect(texts().memo).toBe('Every member_id points at members.id');
  });

  it('turns the derived flags of the names it writes off, within its one history entry', () => {
    deriveUsers();
    const matcher = matcherOf('users?', { regex: true, wholeWord: true });
    const derived = () => [
      app.store.state.collections.tableEntities.users.nameDerived,
      bHas(
        app.store.state.collections.tableColumnEntities.users_id.options,
        ColumnOption.nameDerived
      ),
    ];
    const historySize = app.store.history.size;

    app.store.dispatchSync(
      toReplaceActions(
        findMatches(app.store.state, matcher),
        matcher,
        'members'
      ).actions
    );

    expect(texts().tables.users[0]).toBe('members');
    expect(derived()).toEqual([false, true]);
    expect(app.store.history.size).toBe(historySize + 1);

    app.store.undo();

    expect(texts().tables.users[0]).toBe('users');
    expect(derived()).toEqual([true, true]);
  });
});
