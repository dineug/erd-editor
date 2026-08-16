import { AnyAction } from '@dineug/r-html';
import { Subject, Subscription } from 'rxjs';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import {
  initialLoadJsonAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
import { hooks } from '@/engine/modules/table/hooks';
import { createStore, Store } from '@/engine/store';

const TABLE_A = 'table-a';
const TABLE_B = 'table-b';
const COLUMN_A = 'column-a';
const RELATIONSHIP = 'relationship-a';

const THROTTLE_WAIT = 40;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const running: Subscription[] = [];

function runHook(store: Store) {
  const [, effect] = hooks[0];
  const action$ = new Subject<AnyAction>();
  running.push(effect(action$, () => store.state, store.context));
  return { action$ };
}

function createFixture(toWidth = (text: string) => text.length * 10) {
  const store = createStore({ toWidth, clock: new Clock() });

  const json = JSON.stringify({
    version: '3.0.0',
    doc: {
      tableIds: [TABLE_A, TABLE_B],
      relationshipIds: [RELATIONSHIP],
    },
    collections: {
      tableEntities: {
        [TABLE_A]: {
          id: TABLE_A,
          name: 'user_accounts',
          comment: '',
          columnIds: [COLUMN_A],
          ui: { x: 100, y: 100, widthName: 999, widthComment: 999 },
        },
        [TABLE_B]: {
          id: TABLE_B,
          name: 'orders',
          comment: 'the orders',
          columnIds: [],
          ui: { x: 900, y: 400, widthName: 1, widthComment: 1 },
        },
      },
      tableColumnEntities: {
        [COLUMN_A]: {
          id: COLUMN_A,
          tableId: TABLE_A,
          name: 'created_at',
          dataType: 'timestamp',
          default: 'now()',
          comment: 'when',
          ui: {
            widthName: 1,
            widthDataType: 1,
            widthDefault: 1,
            widthComment: 1,
          },
        },
      },
      relationshipEntities: {
        [RELATIONSHIP]: {
          id: RELATIONSHIP,
          start: { tableId: TABLE_A, columnIds: [COLUMN_A], x: 0, y: 0 },
          end: { tableId: TABLE_B, columnIds: [], x: 0, y: 0 },
        },
      },
    },
  });

  store.dispatchSync(loadJsonAction({ value: json }));

  return store;
}

afterEach(() => {
  running
    .splice(0, running.length)
    .forEach(subscription => subscription.unsubscribe());
});

describe('table/hooks', () => {
  it('reacts to both loadJson variants', () => {
    expect(hooks).toHaveLength(1);

    const [pattern, effect] = hooks[0];
    expect(pattern).toEqual([loadJsonAction, initialLoadJsonAction]);
    expect(pattern.map(String)).toEqual([
      'editor.loadJson',
      'editor.initialLoadJson',
    ]);
    expect(typeof effect).toBe('function');
  });

  it('recalculates every table and column width after loadJson', async () => {
    const store = createFixture();
    const { action$ } = runHook(store);

    expect(store.state.collections.tableEntities[TABLE_A].ui.widthName).toBe(
      999
    );

    action$.next(loadJsonAction({ value: '{}' }));
    await delay(THROTTLE_WAIT);

    const tableA = store.state.collections.tableEntities[TABLE_A];
    const tableB = store.state.collections.tableEntities[TABLE_B];
    const columnA = store.state.collections.tableColumnEntities[COLUMN_A];

    expect(tableA.ui.widthName).toBe(130);
    expect(tableA.ui.widthComment).toBe(60);
    expect(tableB.ui.widthName).toBe(60);
    expect(tableB.ui.widthComment).toBe(100);
    expect(columnA.ui.widthName).toBe(100);
    expect(columnA.ui.widthDataType).toBe(90);
    expect(columnA.ui.widthDefault).toBe(60);
    expect(columnA.ui.widthComment).toBe(60);

    store.destroy();
  });

  it('re-sorts the relationship end points onto the table borders', async () => {
    const store = createFixture();
    const { action$ } = runHook(store);

    const relationship =
      store.state.collections.relationshipEntities[RELATIONSHIP];
    expect(relationship.start).toMatchObject({ x: 0, y: 0 });
    expect(relationship.end).toMatchObject({ x: 0, y: 0 });

    action$.next(initialLoadJsonAction({ value: '{}' }));
    await delay(THROTTLE_WAIT);

    // both end points land on the border box of their own table
    expect(relationship.start.x).toBeGreaterThanOrEqual(100);
    expect(relationship.start.y).toBeGreaterThanOrEqual(100);
    expect(relationship.end.x).toBeGreaterThanOrEqual(900);
    expect(relationship.end.y).toBeGreaterThanOrEqual(400);
    expect(relationship.start.x + relationship.start.y).toBeGreaterThan(200);
    expect(relationship.end.x + relationship.end.y).toBeGreaterThan(1300);

    store.destroy();
  });

  it('throttles a burst of actions into a single recalculation', async () => {
    let calls = 0;
    const store = createFixture(text => {
      calls++;
      return text.length * 10;
    });
    const { action$ } = runHook(store);
    calls = 0;

    action$.next(loadJsonAction({ value: '{}' }));
    action$.next(loadJsonAction({ value: '{}' }));
    action$.next(initialLoadJsonAction({ value: '{}' }));
    await delay(THROTTLE_WAIT);

    // 2 tables * 2 widths + 1 column * 4 widths
    expect(calls).toBe(8);

    store.destroy();
  });

  it('does not run the trailing recalculation before the throttle window', async () => {
    let calls = 0;
    const store = createFixture(text => {
      calls++;
      return text.length * 10;
    });
    const { action$ } = runHook(store);
    calls = 0;

    action$.next(loadJsonAction({ value: '{}' }));

    expect(calls).toBe(0);

    await delay(THROTTLE_WAIT);
    expect(calls).toBe(8);

    store.destroy();
  });

  it('runs again for a burst that lands after the throttle window', async () => {
    let calls = 0;
    const store = createFixture(text => {
      calls++;
      return text.length * 10;
    });
    const { action$ } = runHook(store);
    calls = 0;

    action$.next(loadJsonAction({ value: '{}' }));
    await delay(THROTTLE_WAIT);
    action$.next(loadJsonAction({ value: '{}' }));
    await delay(THROTTLE_WAIT);

    expect(calls).toBe(16);

    store.destroy();
  });
});
