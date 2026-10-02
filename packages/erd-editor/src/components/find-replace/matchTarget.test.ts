import { afterEach, describe, expect, it } from 'vite-plus/test';

import { seedFindDocument } from '@/__test-utils__/findSeed';
import { createTestAppContext } from '@/__test-utils__/index';
import type { AppContext } from '@/components/appContext';
import {
  toErdTarget,
  withReplacement,
} from '@/components/find-replace/matchTarget';
import { FocusType } from '@/engine/modules/editor/state';
import { getTableRect, getTableWidths } from '@/konva/scene/metrics';
import { FindField, FindMatch, toFieldAction } from '@/utils/find-replace';

const match = (field: FindField, id: string, tableId: string): FindMatch => ({
  field,
  id,
  tableId,
  slot: 0,
  text: 'user',
  start: 0,
  end: 4,
});

describe('toErdTarget', () => {
  /** The match the four fields below are found as, which a jump scrolls a cell too wide to. */
  const range = { text: 'user', start: 0, end: 4 };

  it('rings the cell each kind of text is edited in, carrying the match', () => {
    expect(toErdTarget(match(FindField.tableName, 't', 't'))).toEqual({
      kind: 'table',
      tableId: 't',
      focusType: FocusType.tableName,
      range,
    });
    expect(toErdTarget(match(FindField.tableComment, 't', 't'))).toEqual({
      kind: 'table',
      tableId: 't',
      focusType: FocusType.tableComment,
      range,
    });
    expect(toErdTarget(match(FindField.columnName, 'c', 't'))).toEqual({
      kind: 'column',
      tableId: 't',
      columnId: 'c',
      focusType: FocusType.columnName,
      range,
    });
    expect(toErdTarget(match(FindField.columnComment, 'c', 't'))).toEqual({
      kind: 'column',
      tableId: 't',
      columnId: 'c',
      focusType: FocusType.columnComment,
      range,
    });
  });

  it('carries where in its text the match stands', () => {
    const found = {
      ...match(FindField.columnComment, 'c', 't'),
      text: 'the user id',
      start: 4,
      end: 8,
    };

    expect(toErdTarget(found)).toMatchObject({
      range: { text: 'the user id', start: 4, end: 8 },
    });
  });

  it('selects the memo a memo match is in', () => {
    expect(toErdTarget(match(FindField.memo, 'm', ''))).toEqual({
      kind: 'memo',
      memoId: 'm',
    });
  });
});

describe('withReplacement', () => {
  const apps: AppContext[] = [];

  afterEach(() => {
    apps.splice(0).forEach(app => app.store.destroy());
  });

  const seeded = () => {
    const app = createTestAppContext();
    apps.push(app);
    seedFindDocument(app);
    return app;
  };

  /** The widths the orders table is laid out against, and the width of the box its size cache keeps. */
  const widthsOf = (state: AppContext['store']['state']) => {
    const { orders } = state.collections.tableEntities;
    return {
      ...getTableWidths(state, orders),
      box: getTableRect(state, orders).width,
    };
  };

  it.each([
    [FindField.tableName, 'orders'],
    [FindField.tableComment, 'orders'],
    [FindField.columnName, 'orders_user_id'],
    [FindField.columnComment, 'orders_user_id'],
  ])('measures the table as the %s reducer leaves it', (field, id) => {
    const app = seeded();
    const found = match(field, id, 'orders');
    const value = 'customer_account_identifier_for_billing';
    // Measured once first, so a size cached for the table as it was is there to go stale.
    const before = widthsOf(app.store.state);

    const projected = widthsOf(
      withReplacement(app.store.state, app.store.context, found, value)
    );
    app.store.dispatchSync(toFieldAction(found, value));

    expect(projected.box).toBeGreaterThan(before.box);
    expect(projected).toEqual(widthsOf(app.store.state));
  });

  it('leaves the state as it is for a memo, or for a table or column gone', () => {
    const app = seeded();
    const { state, context } = app.store;

    expect(
      withReplacement(state, context, match(FindField.memo, 'note', ''), 'x')
    ).toBe(state);
    expect(
      withReplacement(
        state,
        context,
        match(FindField.tableName, 'gone', 'gone'),
        'x'
      )
    ).toBe(state);
    expect(
      withReplacement(
        state,
        context,
        match(FindField.columnName, 'gone', 'orders'),
        'x'
      )
    ).toBe(state);
  });
});
