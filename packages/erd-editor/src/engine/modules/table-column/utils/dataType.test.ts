import { describe, expect, it } from 'vite-plus/test';

import { Database } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { changeDatabaseAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { ChangeColumnValuePayload } from '@/engine/modules/table-column/actions';
import {
  addColumnAction,
  changeColumnDataTypeAction,
} from '@/engine/modules/table-column/atom.actions';
import { getDataTypeSyncColumns } from '@/engine/modules/table-column/utils/dataType';
import { createStore, Store } from '@/engine/store';

function setup() {
  return createStore({ toWidth: text => text.length * 10, clock: new Clock() });
}

function addTable(store: Store, id: string, columnIds: string[]) {
  store.dispatchSync(addTableAction({ id, ui: { x: 0, y: 0, zIndex: 1 } }));
  for (const columnId of columnIds) {
    store.dispatchSync(addColumnAction({ id: columnId, tableId: id }));
  }
}

function addRelationship(
  store: Store,
  id: string,
  start: { tableId: string; columnIds: string[] },
  end: { tableId: string; columnIds: string[] }
) {
  store.dispatchSync(
    addRelationshipAction({ id, relationshipType: 4, start, end })
  );
}

const payload = (
  id: string,
  tableId: string,
  value: string
): ChangeColumnValuePayload => ({ id, tableId, value });

describe('getDataTypeSyncColumns', () => {
  it('returns an empty list when the stack is empty', () => {
    const store = setup();
    const stack: ChangeColumnValuePayload[] = [];

    expect(getDataTypeSyncColumns(stack, store.state)).toEqual([]);
  });

  it('returns just the target when it has no relationships', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    const target = payload('c1', 't1', 'int');

    const result = getDataTypeSyncColumns([target], store.state);

    expect(result).toEqual([target]);
  });

  it('drains the stack it was handed', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2']);
    addRelationship(
      store,
      'r1',
      { tableId: 't1', columnIds: ['c1'] },
      { tableId: 't2', columnIds: ['c2'] }
    );

    const target = payload('c1', 't1', 'int');
    const stack = [target];

    getDataTypeSyncColumns(stack, store.state);

    expect(stack).toHaveLength(0);
  });

  it('follows a relationship from start to end', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2']);
    addRelationship(
      store,
      'r1',
      { tableId: 't1', columnIds: ['c1'] },
      { tableId: 't2', columnIds: ['c2'] }
    );

    const target = payload('c1', 't1', 'int');
    const result = getDataTypeSyncColumns([target], store.state);

    expect(result).toEqual([target, payload('c2', 't2', 'int')]);
  });

  it('follows a relationship from end back to start', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2']);
    addRelationship(
      store,
      'r1',
      { tableId: 't1', columnIds: ['c1'] },
      { tableId: 't2', columnIds: ['c2'] }
    );

    const target = payload('c2', 't2', 'varchar');
    const result = getDataTypeSyncColumns([target], store.state);

    expect(result).toEqual([target, payload('c1', 't1', 'varchar')]);
  });

  it('matches by column position, not by column identity', () => {
    const store = setup();
    addTable(store, 't1', ['c1', 'c2']);
    addTable(store, 't2', ['c3', 'c4']);
    addRelationship(
      store,
      'r1',
      { tableId: 't1', columnIds: ['c1', 'c2'] },
      { tableId: 't2', columnIds: ['c3', 'c4'] }
    );

    const target = payload('c2', 't1', 'int');
    const result = getDataTypeSyncColumns([target], store.state);

    expect(result).toEqual([target, payload('c4', 't2', 'int')]);
  });

  it('sends each column the value of the column it steps from', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2']);
    addTable(store, 't3', ['c3']);
    addTable(store, 't4', ['c4']);
    addRelationship(
      store,
      'r1',
      { tableId: 't1', columnIds: ['c1'] },
      { tableId: 't2', columnIds: ['c2'] }
    );
    addRelationship(
      store,
      'r2',
      { tableId: 't3', columnIds: ['c3'] },
      { tableId: 't4', columnIds: ['c4'] }
    );

    const result = getDataTypeSyncColumns(
      [payload('c3', 't3', 'bigint'), payload('c1', 't1', 'int')],
      store.state
    );

    expect(result).toEqual([
      payload('c1', 't1', 'int'),
      payload('c2', 't2', 'int'),
      payload('c3', 't3', 'bigint'),
      payload('c4', 't4', 'bigint'),
    ]);
  });

  it('walks a chain of relationships transitively', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2']);
    addTable(store, 't3', ['c3']);
    addRelationship(
      store,
      'r1',
      { tableId: 't1', columnIds: ['c1'] },
      { tableId: 't2', columnIds: ['c2'] }
    );
    addRelationship(
      store,
      'r2',
      { tableId: 't2', columnIds: ['c2'] },
      { tableId: 't3', columnIds: ['c3'] }
    );

    const target = payload('c1', 't1', 'int');
    const result = getDataTypeSyncColumns([target], store.state);

    expect(result.map(({ id }) => id).sort()).toEqual(['c1', 'c2', 'c3']);
    expect(result.every(({ value }) => value === 'int')).toBe(true);
  });

  it('terminates on a cycle and reports each column once', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2']);
    addRelationship(
      store,
      'r1',
      { tableId: 't1', columnIds: ['c1'] },
      { tableId: 't2', columnIds: ['c2'] }
    );
    addRelationship(
      store,
      'r2',
      { tableId: 't2', columnIds: ['c2'] },
      { tableId: 't1', columnIds: ['c1'] }
    );

    const target = payload('c1', 't1', 'int');
    const result = getDataTypeSyncColumns([target], store.state);

    expect(result.map(({ id }) => id)).toEqual(['c1', 'c2']);
  });

  it('ignores relationship ids that have no entity', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    store.state.doc.relationshipIds.push('ghost');

    const target = payload('c1', 't1', 'int');
    const result = getDataTypeSyncColumns([target], store.state);

    expect(result).toEqual([target]);
  });

  it('skips ids that are already present in the accumulator', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2']);
    addRelationship(
      store,
      'r1',
      { tableId: 't1', columnIds: ['c1'] },
      { tableId: 't2', columnIds: ['c2'] }
    );

    const seeded = payload('c1', 't1', 'seeded');
    const target = payload('c1', 't1', 'int');
    const result = getDataTypeSyncColumns([target], store.state, [seeded]);

    expect(result).toEqual([seeded]);
    expect(result).toHaveLength(1);
  });

  it('appends into the accumulator instance it was given', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);

    const payloads: ChangeColumnValuePayload[] = [];
    const target = payload('c1', 't1', 'int');
    const result = getDataTypeSyncColumns([target], store.state, payloads);

    expect(result).toBe(payloads);
    expect(payloads).toEqual([target]);
  });

  it('sends nothing to a position the other side of the relationship lacks', () => {
    const store = setup();
    addTable(store, 't1', ['c1', 'c2']);
    addTable(store, 't2', ['c3']);
    addRelationship(
      store,
      'r1',
      { tableId: 't1', columnIds: ['c1', 'c2'] },
      { tableId: 't2', columnIds: ['c3'] }
    );
    addRelationship(
      store,
      'r2',
      { tableId: 't2', columnIds: ['c3'] },
      { tableId: 't1', columnIds: ['c1', 'c2'] }
    );

    const target = payload('c2', 't1', 'int');
    const result = getDataTypeSyncColumns([target], store.state);

    expect(result).toEqual([target]);
  });
});

describe('getDataTypeSyncColumns and serial keys', () => {
  function setupChain(database: number) {
    const store = setup();
    store.dispatchSync(changeDatabaseAction({ value: database }));
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2']);
    addTable(store, 't3', ['c3']);
    addTable(store, 't4', ['c4']);
    addRelationship(
      store,
      'r1',
      { tableId: 't1', columnIds: ['c1'] },
      { tableId: 't2', columnIds: ['c2'] }
    );
    addRelationship(
      store,
      'r2',
      { tableId: 't2', columnIds: ['c2'] },
      { tableId: 't3', columnIds: ['c3'] }
    );
    addRelationship(
      store,
      'r3',
      { tableId: 't1', columnIds: ['c1'] },
      { tableId: 't4', columnIds: ['c4'] }
    );
    return store;
  }

  const setType = (store: Store, id: string, tableId: string, value: string) =>
    store.dispatchSync(changeColumnDataTypeAction({ id, tableId, value }));

  it('sends the foreign keys of a serial key the integer it stores, all the way down', () => {
    const store = setupChain(Database.PostgreSQL);

    const result = getDataTypeSyncColumns(
      [payload('c1', 't1', 'bigserial')],
      store.state
    );

    expect(result).toEqual([
      payload('c1', 't1', 'bigserial'),
      payload('c4', 't4', 'bigint'),
      payload('c2', 't2', 'bigint'),
      payload('c3', 't3', 'bigint'),
    ]);
  });

  it('maps a bare serial by the document database', () => {
    const mysql = setupChain(Database.MySQL);
    const oracle = setupChain(Database.Oracle);
    const target = payload('c1', 't1', 'SERIAL');

    expect(getDataTypeSyncColumns([target], mysql.state)).toContainEqual(
      payload('c2', 't2', 'BIGINT UNSIGNED')
    );
    expect(getDataTypeSyncColumns([target], oracle.state)).toContainEqual(
      payload('c2', 't2', 'SERIAL')
    );
  });

  it('stops a foreign key change at a serial key, which keeps its type', () => {
    const store = setupChain(Database.PostgreSQL);
    setType(store, 'c1', 't1', 'serial');

    const target = payload('c2', 't2', 'bigint');
    const result = getDataTypeSyncColumns([target], store.state);

    expect(result).toEqual([target, payload('c3', 't3', 'bigint')]);
  });

  it('tells a serial key by its name without case or spaces', () => {
    const store = setupChain(Database.Oracle);
    setType(store, 'c1', 't1', ' SMALLSERIAL ');

    const target = payload('c4', 't4', 'number');

    expect(getDataTypeSyncColumns([target], store.state)).toEqual([target]);
  });

  it('writes back to a key whose type only starts like a serial one', () => {
    const store = setupChain(Database.PostgreSQL);
    setType(store, 'c1', 't1', 'serial primary key');

    const target = payload('c2', 't2', 'bigint');
    const result = getDataTypeSyncColumns([target], store.state);

    expect(result.map(({ id }) => id)).toEqual(['c2', 'c3', 'c1', 'c4']);
    expect(result.every(({ value }) => value === 'bigint')).toBe(true);
  });

  it('sends a serial written into a foreign key back as it is and down mapped', () => {
    const store = setupChain(Database.PostgreSQL);

    const target = payload('c4', 't4', 'serial');
    const result = getDataTypeSyncColumns([target], store.state);

    expect(result).toEqual([
      target,
      payload('c1', 't1', 'serial'),
      payload('c2', 't2', 'integer'),
      payload('c3', 't3', 'integer'),
    ]);
  });

  it('writes back to a key column the collection no longer holds', () => {
    const store = setupChain(Database.PostgreSQL);
    delete store.state.collections.tableColumnEntities['c1'];

    const target = payload('c2', 't2', 'bigint');
    const result = getDataTypeSyncColumns([target], store.state);

    expect(result).toContainEqual(payload('c1', 't1', 'bigint'));
  });

  // Only a step back to a key stops at serial: a column that is a serial key in
  // one relationship and a foreign key in another still takes the forward step.
  it('writes a serial column the change reaches as a foreign key', () => {
    const store = setup();
    store.dispatchSync(changeDatabaseAction({ value: Database.PostgreSQL }));
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2']);
    addRelationship(
      store,
      'r1',
      { tableId: 't1', columnIds: ['c1'] },
      { tableId: 't2', columnIds: ['c2'] }
    );
    addRelationship(
      store,
      'r2',
      { tableId: 't2', columnIds: ['c2'] },
      { tableId: 't1', columnIds: ['c1'] }
    );
    setType(store, 'c1', 't1', 'serial');

    const target = payload('c2', 't2', 'bigint');
    const result = getDataTypeSyncColumns([target], store.state);

    expect(result).toEqual([target, payload('c1', 't1', 'bigint')]);
  });
});

describe('getDataTypeSyncColumns over the relationships it is handed', () => {
  it('follows a relationship the document does not hold yet', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2']);

    const target = payload('c1', 't1', 'int');
    const result = getDataTypeSyncColumns(
      [target],
      store.state,
      [],
      [
        {
          start: { tableId: 't1', columnIds: ['c1'] },
          end: { tableId: 't2', columnIds: ['c2'] },
        },
      ]
    );

    expect(result).toEqual([target, payload('c2', 't2', 'int')]);
  });

  it('follows no relationship of the document left out of the list', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2', 'c3']);
    addRelationship(
      store,
      'r1',
      { tableId: 't1', columnIds: ['c1'] },
      { tableId: 't2', columnIds: ['c2'] }
    );
    const relationship = store.state.collections.relationshipEntities.r1;

    const target = payload('c1', 't1', 'int');
    const result = getDataTypeSyncColumns(
      [target],
      store.state,
      [],
      [
        {
          start: relationship.start,
          end: { ...relationship.end, columnIds: ['c3'] },
        },
      ]
    );

    expect(result).toEqual([target, payload('c3', 't2', 'int')]);
  });

  it('reads the document relationships when the list is left out', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2']);
    addRelationship(
      store,
      'r1',
      { tableId: 't1', columnIds: ['c1'] },
      { tableId: 't2', columnIds: ['c2'] }
    );

    const target = payload('c1', 't1', 'int');

    expect(getDataTypeSyncColumns([target], store.state, [], [])).toEqual([
      target,
    ]);
    expect(getDataTypeSyncColumns([target], store.state)).toEqual([
      target,
      payload('c2', 't2', 'int'),
    ]);
  });
});
