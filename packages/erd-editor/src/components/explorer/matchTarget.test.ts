import { afterEach, describe, expect, it } from 'vite-plus/test';

import { seedFindDocument } from '@/__test-utils__/findSeed';
import { createTestAppContext } from '@/__test-utils__/index';
import type { AppContext } from '@/components/appContext';
import { withReplacement } from '@/components/explorer/matchTarget';
import { NameViewMode } from '@/constants/schema';
import { toNameViewModeAction } from '@/engine/modules/settings/atom.actions';
import { getTableRect, getTableWidths } from '@/konva/scene/metrics';
import { FindField, FindMatch } from '@/utils/find-replace';
import { toFieldAction } from '@/utils/find-replace/replaceActions';

const match = (field: FindField, id: string, tableId: string): FindMatch => ({
  field,
  id,
  tableId,
  slot: 0,
  text: 'user',
  start: 0,
  end: 4,
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

  it.each([['orders'], ['orders_user_id']])(
    'measures the table as the logical name reducer of %s leaves it, in the view of both',
    id => {
      const app = seeded();
      app.store.dispatchSync(
        toNameViewModeAction(app.store.state, NameViewMode.both, false)
      );
      const found = match(FindField.logicalName, id, 'orders');
      const value = 'Customer Account Identifier For Billing';
      const before = widthsOf(app.store.state);

      const projected = widthsOf(
        withReplacement(app.store.state, app.store.context, found, value)
      );
      app.store.dispatchSync(toFieldAction(found, value));

      expect(projected.box).toBeGreaterThan(before.box);
      expect(projected).toEqual(widthsOf(app.store.state));
    }
  );

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
        match(FindField.indexName, 'index', 'orders'),
        'x'
      )
    ).toBe(state);
    expect(
      withReplacement(
        state,
        context,
        match(FindField.tableGroupName, 'group', ''),
        'x'
      )
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
