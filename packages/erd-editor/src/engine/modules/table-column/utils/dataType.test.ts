import { describe, expect, it } from 'vitest';

import { Clock } from '@/engine/clock';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { ChangeColumnValuePayload } from '@/engine/modules/table-column/actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
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

    expect(
      getDataTypeSyncColumns(stack, store.state, payload('c1', 't1', 'int'))
    ).toEqual([]);
  });

  it('returns just the target when it has no relationships', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    const target = payload('c1', 't1', 'int');

    const result = getDataTypeSyncColumns([target], store.state, target);

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

    getDataTypeSyncColumns(stack, store.state, target);

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
    const result = getDataTypeSyncColumns([target], store.state, target);

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
    const result = getDataTypeSyncColumns([target], store.state, target);

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
    const result = getDataTypeSyncColumns([target], store.state, target);

    expect(result).toEqual([target, payload('c4', 't2', 'int')]);
  });

  it('propagates the value of `payload`, not of the popped target', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2']);
    addRelationship(
      store,
      'r1',
      { tableId: 't1', columnIds: ['c1'] },
      { tableId: 't2', columnIds: ['c2'] }
    );

    const result = getDataTypeSyncColumns(
      [payload('c1', 't1', 'stale')],
      store.state,
      payload('c1', 't1', 'bigint')
    );

    expect(result).toEqual([
      payload('c1', 't1', 'stale'),
      payload('c2', 't2', 'bigint'),
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
    const result = getDataTypeSyncColumns([target], store.state, target);

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
    const result = getDataTypeSyncColumns([target], store.state, target);

    expect(result.map(({ id }) => id)).toEqual(['c1', 'c2']);
  });

  it('ignores relationship ids that have no entity', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);
    store.state.doc.relationshipIds.push('ghost');

    const target = payload('c1', 't1', 'int');
    const result = getDataTypeSyncColumns([target], store.state, target);

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
    const result = getDataTypeSyncColumns([target], store.state, target, [
      seeded,
    ]);

    expect(result).toEqual([seeded]);
    expect(result).toHaveLength(1);
  });

  it('appends into the accumulator instance it was given', () => {
    const store = setup();
    addTable(store, 't1', ['c1']);

    const payloads: ChangeColumnValuePayload[] = [];
    const target = payload('c1', 't1', 'int');
    const result = getDataTypeSyncColumns(
      [target],
      store.state,
      target,
      payloads
    );

    expect(result).toBe(payloads);
    expect(payloads).toEqual([target]);
  });

  it('emits a payload with an undefined id when the two sides are unbalanced', () => {
    // Suspicious behaviour, asserted as-is: `end.columnIds[index]` can be
    // undefined when the relationship sides have different lengths, and the
    // resulting payload is still pushed.
    const store = setup();
    addTable(store, 't1', ['c1', 'c2']);
    addTable(store, 't2', ['c3']);
    addRelationship(
      store,
      'r1',
      { tableId: 't1', columnIds: ['c1', 'c2'] },
      { tableId: 't2', columnIds: ['c3'] }
    );

    const target = payload('c2', 't1', 'int');
    const result = getDataTypeSyncColumns([target], store.state, target);

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({ id: undefined, tableId: 't2', value: 'int' });
  });
});
