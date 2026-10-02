import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import { seedFindDocument } from '@/__test-utils__/findSeed';
import type { AppContext } from '@/components/appContext';
import { changeTableNameAction } from '@/engine/modules/table/atom.actions';
import { changeColumnNameAction } from '@/engine/modules/table-column/atom.actions';
import {
  describeMatch,
  FindField,
  FindFieldLabel,
  FindFieldList,
  FindMatch,
  locationOf,
  snippetOf,
} from '@/utils/find-replace';

let app: AppContext;

const match = (overrides: Partial<FindMatch>): FindMatch => ({
  field: FindField.tableName,
  id: 'orders',
  tableId: 'orders',
  slot: 0,
  text: '',
  start: 0,
  end: 0,
  ...overrides,
});

beforeEach(() => {
  app = createTestAppContext();
  seedFindDocument(app);
});

afterEach(() => {
  app.store.destroy();
});

describe('FindFieldLabel', () => {
  it('names every field a search covers', () => {
    expect(FindFieldList.map(field => FindFieldLabel[field])).toEqual([
      'Table',
      'Table comment',
      'Column',
      'Column comment',
      'Memo',
    ]);
  });
});

describe('locationOf', () => {
  it('names the table of a table field and the table and column of a column field', () => {
    const { state } = app.store;

    expect(locationOf(state, match({ field: FindField.tableName }))).toBe(
      'orders'
    );
    expect(locationOf(state, match({ field: FindField.tableComment }))).toBe(
      'orders'
    );
    expect(
      locationOf(
        state,
        match({ field: FindField.columnComment, id: 'orders_user_id' })
      )
    ).toBe('orders.user_id');
  });

  it('gives a memo no location, since it has no name', () => {
    expect(
      locationOf(
        app.store.state,
        match({ field: FindField.memo, id: 'note', tableId: '' })
      )
    ).toBe('');
  });

  it('calls a blank or missing name unnamed', () => {
    app.store.dispatchSync(
      changeTableNameAction({ id: 'orders', value: '  ' }),
      changeColumnNameAction({ id: 'total', tableId: 'orders', value: '' })
    );
    const { state } = app.store;

    expect(
      locationOf(state, match({ field: FindField.columnName, id: 'total' }))
    ).toBe('unnamed.unnamed');
    expect(
      locationOf(
        state,
        match({ field: FindField.columnName, id: 'gone', tableId: 'gone' })
      )
    ).toBe('unnamed.unnamed');
  });
});

describe('describeMatch', () => {
  it('follows the location with the kind of text, and gives a memo its kind alone', () => {
    const { state } = app.store;

    expect(
      describeMatch(
        state,
        match({ field: FindField.columnComment, id: 'orders_user_id' })
      )
    ).toBe('orders.user_id · Column comment');
    expect(
      describeMatch(
        state,
        match({ field: FindField.memo, id: 'note', tableId: '' })
      )
    ).toBe('Memo');
  });
});

describe('snippetOf', () => {
  it('keeps a short text whole, with the range where it was', () => {
    expect(snippetOf({ text: 'user_id', start: 0, end: 4 })).toEqual({
      text: 'user_id',
      start: 0,
      end: 4,
    });
  });

  it('cuts a long text to the words around the match and marks each cut', () => {
    const text = `${'a'.repeat(100)} user ${'b'.repeat(200)}`;
    const snippet = snippetOf({ text, start: 101, end: 105 }, 10, 30);

    expect(snippet.text.startsWith('…')).toBe(true);
    expect(snippet.text.endsWith('…')).toBe(true);
    expect(snippet.text.length).toBe(32);
    expect(snippet.text.slice(snippet.start, snippet.end)).toBe('user');
  });

  it('keeps a text that fits whole, however far into it the match is', () => {
    const text = 'login email of the user';

    expect(snippetOf({ text, start: 19, end: 23 }, 4, 64)).toEqual({
      text,
      start: 19,
      end: 23,
    });
  });

  it('cuts at the start of a word rather than inside one', () => {
    const text = `${'word '.repeat(30)}user`;
    const start = text.length - 4;
    const snippet = snippetOf({ text, start, end: text.length }, 7, 20);

    expect(snippet.text).toBe('…word word word user');
    expect(snippet.text.slice(snippet.start, snippet.end)).toBe('user');
  });

  it('puts a text of several lines on one', () => {
    const snippet = snippetOf({
      text: 'first\nsecond user',
      start: 13,
      end: 17,
    });

    expect(snippet.text).toBe('first second user');
    expect(snippet.text.slice(snippet.start, snippet.end)).toBe('user');
  });

  /** Whether a text holds half of a surrogate pair on its own. */
  const splitsAPair = (text: string) => /\p{Cs}/u.test(text);

  it('starts on a whole character where the cut before the match falls inside a pair', () => {
    const text = `${'😀'.repeat(20)}user${'y'.repeat(200)}`;
    const snippet = snippetOf({ text, start: 40, end: 44 }, 5, 30);

    expect(splitsAPair(snippet.text)).toBe(false);
    expect(snippet.text.startsWith('…😀😀😀')).toBe(true);
    expect(snippet.text.slice(snippet.start, snippet.end)).toBe('user');
  });

  it('ends on a whole character where the cut after the match falls inside a pair', () => {
    const text = `user${'😀'.repeat(60)}`;
    const snippet = snippetOf({ text, start: 0, end: 4 }, 0, 9);

    expect(snippet.text).toBe('user😀😀😀…');
    expect(snippet.text.slice(snippet.start, snippet.end)).toBe('user');
  });

  it('keeps the mark on a range that itself starts or ends inside a pair', () => {
    const text = '😀'.repeat(50);
    const snippet = snippetOf({ text, start: 41, end: 45 }, 0, 2);

    expect(snippet.text).toBe(`…${text.slice(41, 45)}…`);
    expect(snippet.text.slice(snippet.start, snippet.end)).toBe(
      text.slice(41, 45)
    );
  });

  it('reaches past the length asked for to keep a long match whole', () => {
    const text = `x${'u'.repeat(50)}`;
    const snippet = snippetOf({ text, start: 1, end: 51 }, 0, 10);

    expect(snippet.text.slice(snippet.start, snippet.end)).toBe('u'.repeat(50));
  });
});
