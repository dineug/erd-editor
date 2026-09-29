import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import { seedFindDocument } from '@/__test-utils__/findSeed';
import type { AppContext } from '@/components/appContext';
import { removeMemoAction } from '@/engine/modules/memo/atom.actions';
import { removeTableAction } from '@/engine/modules/table/atom.actions';
import { changeColumnCommentAction } from '@/engine/modules/table-column/atom.actions';
import {
  createMatcher,
  DEFAULT_FIND_OPTIONS,
  FindField,
  FindFieldList,
  FindMatch,
  findMatches,
  indexAfter,
  Matcher,
  rematchField,
  walkFields,
} from '@/utils/find-replace';

let app: AppContext;

const matcherOf = (query: string) =>
  createMatcher(query, DEFAULT_FIND_OPTIONS).matcher as Matcher;

/** Where each match was found, in the order the search gives them. */
const places = (matches: FindMatch[]) =>
  matches.map(({ field, id, start }) => `${field}:${id}@${start}`);

beforeEach(() => {
  app = createTestAppContext();
  seedFindDocument(app);
});

afterEach(() => {
  app.store.destroy();
});

describe('walkFields', () => {
  it('walks each table, then its columns, then the memos, numbering the slots', () => {
    const fields = walkFields(app.store.state, FindFieldList);

    expect(fields.map(({ field, id }) => `${field}:${id}`)).toEqual([
      'tableName:orders',
      'tableComment:orders',
      'columnName:order_id',
      'columnComment:order_id',
      'columnName:orders_user_id',
      'columnComment:orders_user_id',
      'columnName:total',
      'columnComment:total',
      'tableName:users',
      'tableComment:users',
      'columnName:users_id',
      'columnComment:users_id',
      'columnName:email',
      'columnComment:email',
      'memo:note',
    ]);
    expect(fields.map(({ slot }) => slot)).toEqual(
      fields.map((_, index) => index)
    );
    expect(fields[4]).toMatchObject({ tableId: 'orders', text: 'user_id' });
    expect(fields[14]).toMatchObject({ tableId: '', text: expect.any(String) });
  });

  it('walks only the fields asked for, and no column at all when neither column field is', () => {
    expect(
      walkFields(app.store.state, [FindField.tableName, FindField.memo]).map(
        ({ id }) => id
      )
    ).toEqual(['orders', 'users', 'note']);
    expect(
      walkFields(app.store.state, [FindField.columnComment]).map(({ id }) => id)
    ).toEqual(['order_id', 'orders_user_id', 'total', 'users_id', 'email']);
  });

  it('leaves out what the document removed, whose record stays behind', () => {
    app.store.dispatchSync(
      removeTableAction({ id: 'orders' }),
      removeMemoAction({ id: 'note' })
    );

    expect(
      walkFields(app.store.state, FindFieldList).map(({ id }) => id)
    ).toEqual(['users', 'users', 'users_id', 'users_id', 'email', 'email']);
  });
});

describe('findMatches', () => {
  it('gives every occurrence in every field, in document order', () => {
    const matches = findMatches(app.store.state, matcherOf('user'));

    expect(places(matches)).toEqual([
      'columnName:orders_user_id@0',
      'tableName:users@0',
      'columnComment:users_id@0',
      'memo:note@6',
      'memo:note@24',
    ]);
    expect(matches[0]).toMatchObject({
      tableId: 'orders',
      text: 'user_id',
      start: 0,
      end: 4,
      slot: 4,
    });
  });

  it('looks only in the fields given', () => {
    expect(
      places(findMatches(app.store.state, matcherOf('user'), [FindField.memo]))
    ).toEqual(['memo:note@6', 'memo:note@24']);
  });

  it('finds nothing in an empty field', () => {
    expect(
      findMatches(app.store.state, matcherOf('e'), [FindField.tableComment])
        .map(({ id }) => id)
        .every(id => id === 'orders')
    ).toBe(true);
  });
});

describe('rematchField', () => {
  it('searches the new value of the one field again and keeps every other', () => {
    const matcher = matcherOf('user');
    const matches = findMatches(app.store.state, matcher);
    const memo = matches.find(match => match.field === FindField.memo)!;

    const next = rematchField(matches, matcher, memo, 'a user and a user');

    expect(places(next)).toEqual([
      ...places(matches.filter(match => match.slot < memo.slot)),
      'memo:note@2',
      'memo:note@13',
    ]);
    expect(next.at(-1)).toMatchObject({ text: 'a user and a user', end: 17 });
  });

  it('drops the field that no longer holds the query', () => {
    const matcher = matcherOf('user');
    const matches = findMatches(app.store.state, matcher);
    const [first] = matches;

    const next = rematchField(matches, matcher, first, 'member_id');

    expect(places(next)).toEqual(places(matches.slice(1)));
  });

  it('is what the search finds once the store holds the value', () => {
    const matcher = matcherOf('user');
    const matches = findMatches(app.store.state, matcher);
    const comment = matches.find(
      match => match.field === FindField.columnComment
    )!;

    const next = rematchField(matches, matcher, comment, 'the user of users');
    app.store.dispatchSync(
      changeColumnCommentAction({
        id: comment.id,
        tableId: comment.tableId,
        value: 'the user of users',
      })
    );

    expect(next).toEqual(findMatches(app.store.state, matcher));
  });
});

describe('indexAfter', () => {
  const matches = () => findMatches(app.store.state, matcherOf('user'));

  it('goes to the next match in the same field past the offset', () => {
    expect(indexAfter(matches(), 14, 7)).toBe(4);
  });

  it('goes on to a later field', () => {
    expect(indexAfter(matches(), 4, 4)).toBe(1);
  });

  it('wraps to the first match past the last one', () => {
    expect(indexAfter(matches(), 14, 30)).toBe(0);
  });

  it('has nowhere to go without a match', () => {
    expect(indexAfter([], 0, 0)).toBe(-1);
  });
});
