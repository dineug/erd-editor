import { describe, expect, it } from 'vite-plus/test';

import { Database } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  isSerialType,
  toReferenceDataType,
} from '@/engine/modules/relationship/referenceType';
import { changeDatabaseAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { ChangeColumnValuePayload } from '@/engine/modules/table-column/actions';
import {
  addColumnAction,
  changeColumnDataTypeAction,
} from '@/engine/modules/table-column/atom.actions';
import {
  type DataTypeSyncRelationship,
  getDataTypeSyncColumns,
} from '@/engine/modules/table-column/utils/dataType';
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

describe('getDataTypeSyncColumns with settled columns', () => {
  function relatedPair() {
    const store = setup();
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2', 'c3']);
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
      { tableId: 't2', columnIds: ['c3'] }
    );
    return store;
  }

  it('keeps each settled column at its own value, whichever the stack pops first', () => {
    const store = relatedPair();
    const key = payload('c1', 't1', 'bigint');
    const foreignKey = payload('c2', 't2', 'numeric');

    const result = getDataTypeSyncColumns(
      [key, foreignKey],
      store.state,
      [],
      undefined,
      new Set(['c1', 'c2'])
    );

    expect(result).toEqual([foreignKey, payload('c3', 't2', 'numeric'), key]);
  });

  it('lets the last settled column overwrite the first without them', () => {
    const store = relatedPair();

    const result = getDataTypeSyncColumns(
      [payload('c1', 't1', 'bigint'), payload('c2', 't2', 'numeric')],
      store.state
    );

    expect(result).toContainEqual(payload('c1', 't1', 'numeric'));
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

describe('getDataTypeSyncColumns from many columns at once', () => {
  // The walk as it read each relationship for every column it popped, which a
  // domain linked by thousands of columns made seconds of proxy reads.
  function walkEachRelationship(
    stack: ChangeColumnValuePayload[],
    state: Store['state'],
    relationships: DataTypeSyncRelationship[],
    settledIds: ReadonlySet<string>
  ): ChangeColumnValuePayload[] {
    const payloads: ChangeColumnValuePayload[] = [];
    const { database } = state.settings;
    for (let target = stack.pop(); target; target = stack.pop()) {
      const { id: targetId, value } = target;
      if (payloads.some(({ id }) => id === targetId)) continue;
      payloads.push(target);
      const foreignKeyValue = toReferenceDataType(value, database);
      for (const { start, end } of relationships) {
        const startIndex = start.columnIds.indexOf(targetId);
        if (startIndex !== -1) {
          const id = end.columnIds[startIndex];
          if (id === undefined || settledIds.has(id)) continue;
          stack.push({ id, tableId: end.tableId, value: foreignKeyValue });
          continue;
        }
        const endIndex = end.columnIds.indexOf(targetId);
        if (endIndex === -1) continue;
        const id = start.columnIds[endIndex];
        if (id === undefined || settledIds.has(id)) continue;
        const column = state.collections.tableColumnEntities[id];
        if (column && isSerialType(column.dataType)) continue;
        stack.push({ id, tableId: start.tableId, value });
      }
    }
    return payloads;
  }

  function randomGraph(seed: number) {
    let a = seed;
    const random = () => {
      a = (a * 1103515245 + 12345) % 2147483648;
      return a / 2147483648;
    };
    const pick = <T>(list: T[]) => list[Math.floor(random() * list.length)];
    const store = setup();
    store.dispatchSync(changeDatabaseAction({ value: Database.PostgreSQL }));
    const columns: Array<{ id: string; tableId: string }> = [];
    for (let t = 0; t < 12; t++) {
      const ids = Array.from({ length: 4 }, (_, c) => `c${t}_${c}`);
      addTable(store, `t${t}`, ids);
      ids.forEach(id => columns.push({ id, tableId: `t${t}` }));
    }
    for (const { id, tableId } of columns) {
      if (random() < 0.2) {
        store.dispatchSync(
          changeColumnDataTypeAction({ id, tableId, value: 'serial' })
        );
      }
    }
    // Uneven ends, a column twice on one end and on both ends of one
    // relationship, so every branch of the walk is taken.
    const end = () => {
      const table = `t${Math.floor(random() * 12)}`;
      const own = columns.filter(({ tableId }) => tableId === table);
      const length = 1 + Math.floor(random() * 3);
      return {
        tableId: table,
        columnIds: Array.from({ length }, () =>
          random() < 0.1 ? pick(columns).id : pick(own).id
        ),
      };
    };
    const relationships = Array.from({ length: 30 }, () => ({
      start: end(),
      end: end(),
    }));
    const settledIds = new Set(
      columns.filter(() => random() < 0.15).map(({ id }) => id)
    );
    const stack = columns
      .filter(() => random() < 0.4)
      .map(({ id, tableId }) =>
        payload(id, tableId, pick(['int', 'bigserial', 'text', 'serial']))
      );
    return { store, relationships, settledIds, stack };
  }

  it('lists what a walk of every relationship for each column lists, in its order', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { store, relationships, settledIds, stack } = randomGraph(seed);

      expect(
        getDataTypeSyncColumns(
          [...stack],
          store.state,
          [],
          relationships,
          settledIds
        )
      ).toEqual(
        walkEachRelationship([...stack], store.state, relationships, settledIds)
      );
    }
  });

  it("reads each relationship's columns once, however many columns it starts from", () => {
    const store = setup();
    let reads = 0;
    const counted = (tableId: string, columnIds: string[]) => ({
      tableId,
      get columnIds() {
        reads += 1;
        return columnIds;
      },
    });
    const relationships: DataTypeSyncRelationship[] = [];
    const stack: ChangeColumnValuePayload[] = [];
    for (let t = 1; t <= 50; t++) {
      addTable(store, `t${t}`, [`k${t}`, `f${t}`]);
      relationships.push({
        start: counted(`t${t - 1}`, [`k${t - 1}`]),
        end: counted(`t${t}`, [`f${t}`]),
      });
      stack.push(payload(`k${t}`, `t${t}`, 'bigint'));
    }

    const result = getDataTypeSyncColumns(
      stack,
      store.state,
      [],
      relationships
    );

    expect(result).toHaveLength(99);
    expect(reads).toBe(relationships.length * 2);
  });
});
