import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import { FIND_SEED, seedFindDocument } from '@/__test-utils__/findSeed';
import type { AppContext } from '@/components/appContext';
import { ChangeActionTypes, HistoryActionTypes } from '@/engine/actions';
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
  it('writes each field through the atom action an edit by hand dispatches', () => {
    const at = { id: 'c', tableId: 't' };

    expect(
      FindFieldList.map(field => toFieldAction({ ...at, field }, 'v'))
    ).toEqual([
      { type: 'table.changeName', payload: { id: 'c', value: 'v' } },
      { type: 'table.changeComment', payload: { id: 'c', value: 'v' } },
      {
        type: 'column.changeName',
        payload: { id: 'c', tableId: 't', value: 'v' },
      },
      {
        type: 'column.changeComment',
        payload: { id: 'c', tableId: 't', value: 'v' },
      },
      { type: 'memo.changeValue', payload: { id: 'c', value: 'v' } },
    ]);
  });

  it('writes only types that are saved, undone and sent to every peer', () => {
    const types = FindFieldList.map(
      field => toFieldAction({ field, id: 'c', tableId: 't' }, 'v').type
    );

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

    expect(toReplaceActions(matches, matcher, 'member').actions).toEqual([
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
});
