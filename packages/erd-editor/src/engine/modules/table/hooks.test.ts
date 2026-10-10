import { AnyAction } from '@dineug/r-html';
import { Subject, Subscription } from 'rxjs';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { RelationshipType } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  drawStartAddRelationshipAction,
  drawStartRelationshipAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
import { removeTableAction } from '@/engine/modules/table/atom.actions';
import { hooks } from '@/engine/modules/table/hooks';
import { createStore, Store } from '@/engine/store';

const TABLE_A = 'table-a';
const TABLE_B = 'table-b';
const COLUMN_A = 'column-a';
const RELATIONSHIP = 'relationship-a';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const running: Subscription[] = [];

function runHook(store: Store) {
  const [, effect] = hooks[0];
  const action$ = new Subject<AnyAction>();
  running.push(effect(action$, () => store.state, store.context));
  return { action$ };
}

function createFixture() {
  const store = createStore({
    toWidth: text => text.length * 10,
    clock: new Clock(),
  });

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

describe('table/hooks, a draw out of a removed table', () => {
  /** A draw armed and started from TABLE_A, then one table removed. */
  async function removeDuringDraw(tableId: string) {
    const store = createFixture();
    const { action$ } = runHook(store);
    store.dispatchSync(
      drawStartRelationshipAction({ relationshipType: RelationshipType.OneN }),
      drawStartAddRelationshipAction({ tableId: TABLE_A })
    );

    const remove = removeTableAction({ id: tableId });
    store.dispatchSync(remove);
    action$.next(remove);
    await delay(0);

    return store;
  }

  it('reacts to a table removal alone: a load writes what it derives itself', () => {
    expect(hooks.map(([pattern]) => pattern.map(String))).toEqual([
      ['table.remove'],
    ]);
  });

  it('ends the draw once the table it starts from is removed', async () => {
    const store = await removeDuringDraw(TABLE_A);

    expect(store.state.doc.tableIds).toEqual([TABLE_B]);
    expect(store.state.editor.drawRelationship).toBeNull();

    store.destroy();
  });

  it('leaves the draw armed when another table is removed', async () => {
    const store = await removeDuringDraw(TABLE_B);

    expect(store.state.editor.drawRelationship?.start?.tableId).toBe(TABLE_A);

    store.destroy();
  });
});
