import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import { seedFindDocument } from '@/__test-utils__/findSeed';
import type { AppContext } from '@/components/appContext';
import { ChangeActionTypes } from '@/engine/actions';
import { ActionType as EditorActionType } from '@/engine/modules/editor/actions';
import { ActionType as MemoActionType } from '@/engine/modules/memo/actions';
import {
  changeMemoValueAction,
  removeMemoAction,
} from '@/engine/modules/memo/atom.actions';
import { ActionType as TableActionType } from '@/engine/modules/table/actions';
import { removeTableAction } from '@/engine/modules/table/atom.actions';
import { ActionType as ColumnActionType } from '@/engine/modules/table-column/actions';
import { changeColumnCommentAction } from '@/engine/modules/table-column/atom.actions';
import {
  createMatcher,
  DEFAULT_FIND_OPTIONS,
  FindField,
  FindFieldList,
  FindMatch,
  findMatches,
  FindTextActionTypes,
  indexAfter,
  Matcher,
  nextReplace,
  rematchField,
  ReplaceRun,
  resumeRun,
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

  it('finds the same whole words whichever order the alternatives of a regular expression come in', () => {
    const whole = { ...DEFAULT_FIND_OPTIONS, regex: true, wholeWord: true };
    const found = (query: string) =>
      findMatches(
        app.store.state,
        createMatcher(query, whole).matcher as Matcher
      ).map(({ text, start, end }) => text.slice(start, end));

    expect(found('user|user_id')).toEqual(['user_id', 'user', 'user_id']);
    expect(found('user_id|user')).toEqual(found('user|user_id'));
  });

  it('finds nothing in an empty field', () => {
    expect(
      findMatches(app.store.state, matcherOf('e'), [FindField.tableComment])
        .map(({ id }) => id)
        .every(id => id === 'orders')
    ).toBe(true);
  });
});

describe('FindTextActionTypes', () => {
  it('names actions the engine has, every one an edit a host saves or a load', () => {
    const known = new Set<string>([
      ...Object.values(TableActionType),
      ...Object.values(ColumnActionType),
      ...Object.values(MemoActionType),
      ...Object.values(EditorActionType),
    ]);
    const loads = [
      'editor.initialLoadJson',
      'editor.initialClear',
      'editor.validationIds',
    ];

    for (const type of FindTextActionTypes) {
      expect(known.has(type)).toBe(true);
      expect(ChangeActionTypes.includes(type) || loads.includes(type)).toBe(
        true
      );
    }
  });

  it('leaves out what moves, colours, sizes, scrolls, zooms, hovers or selects', () => {
    for (const type of [
      'table.move',
      'table.moveTo',
      'table.changeColor',
      'table.changeZIndex',
      'column.changeDataType',
      'memo.move',
      'memo.resize',
      'memo.changeColor',
      'settings.scrollTo',
      'settings.streamScrollTo',
      'settings.changeZoomLevel',
      'editor.hoverColumnMap',
      'editor.select',
      'editor.focusTable',
      'editor.changeOpenMap',
    ]) {
      expect(FindTextActionTypes).not.toContain(type);
    }
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

describe('nextReplace', () => {
  /** One press of Replace on the match given: the text it leaves, what that holds, and where it goes on to. */
  const press = (
    matches: FindMatch[],
    matcher: Matcher,
    match: FindMatch,
    replacement: string,
    run: Parameters<typeof nextReplace>[3]
  ) => {
    const { value } = matcher.replace(match.text, replacement, match.start);
    const after = rematchField(matches, matcher, match, value);
    return { after, ...nextReplace(after, match, value, run) };
  };

  it('goes on past what the replacement wrote, and marks where the run began', () => {
    const matcher = matcherOf('user');
    const matches = findMatches(app.store.state, matcher);

    const step = press(matches, matcher, matches[0], 'super_user', null);

    expect(places([step.after[step.index]])).toEqual(['tableName:users@0']);
    expect(step.run).toEqual({
      field: FindField.columnName,
      id: 'orders_user_id',
      slot: 4,
      start: 0,
      text: 'super_user_id',
      wrapped: false,
    });

    // A press in another field leaves the text the run knows its own by.
    const next = step.after[step.index];
    const second = press(step.after, matcher, next, 'super_user', step.run);
    expect(second.run).toEqual(step.run);
  });

  it('wraps to the first match while the run has not come back to where it began', () => {
    const matcher = matcherOf('user');
    const matches = findMatches(app.store.state, matcher);
    const last = matches[4];

    const step = press(matches, matcher, last, 'member', {
      ...last,
      wrapped: false,
    });

    expect(step.index).toBe(0);
    expect(step.run.wrapped).toBe(true);
  });

  it('stops once a run that wrapped comes back to where it began', () => {
    const matcher = matcherOf('Customer');
    const matches = findMatches(app.store.state, matcher);

    const step = press(matches, matcher, matches[0], 'Big Customer', null);

    expect(step.after).toHaveLength(1);
    expect(step.index).toBe(-1);
    expect(step.run).toEqual({
      field: FindField.tableComment,
      id: 'orders',
      slot: 1,
      start: 0,
      text: 'Big Customer orders',
      wrapped: true,
    });
  });

  it('moves where the run began with a replacement written before it in the same field', () => {
    app.store.dispatchSync(
      changeMemoValueAction({ id: 'note', value: 'users users' })
    );
    const matcher = createMatcher('users?', {
      ...DEFAULT_FIND_OPTIONS,
      regex: true,
    }).matcher as Matcher;
    const matches = findMatches(app.store.state, matcher, [FindField.memo]);

    const first = press(matches, matcher, matches[1], 'user', null);
    expect(first.index).toBe(0);
    expect(first.run).toMatchObject({ slot: 0, start: 6, wrapped: true });

    const second = press(
      first.after,
      matcher,
      first.after[0],
      'user',
      first.run
    );

    // The run began at the second word, which now starts at 5.
    expect(second.index).toBe(-1);
    expect(second.run).toMatchObject({ start: 5, text: 'user user' });
  });
});

describe('resumeRun', () => {
  /** A run that began at the memo's first word and has wrapped since. */
  const memoRun = (): ReplaceRun => ({
    field: FindField.memo,
    id: 'note',
    slot: 14,
    start: 0,
    text: 'Every user_id points at users.id',
    wrapped: true,
  });

  it('finds the field of a run again where a table removed before it moved it', () => {
    app.store.dispatchSync(removeTableAction({ id: 'users' }));

    expect(resumeRun(app.store.state, FindFieldList, memoRun())).toEqual({
      ...memoRun(),
      slot: 8,
    });
  });

  it('lets a run go once its field is gone', () => {
    app.store.dispatchSync(removeMemoAction({ id: 'note' }));

    expect(resumeRun(app.store.state, FindFieldList, memoRun())).toBeNull();
  });

  it('lets a run go once its field holds a text the run did not leave', () => {
    app.store.dispatchSync(
      changeMemoValueAction({ id: 'note', value: 'Every user_id' })
    );

    expect(resumeRun(app.store.state, FindFieldList, memoRun())).toBeNull();
  });

  it('has nothing to resume without a run', () => {
    expect(resumeRun(app.store.state, FindFieldList, null)).toBeNull();
  });
});
