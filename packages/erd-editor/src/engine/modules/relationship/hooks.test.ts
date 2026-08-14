import { AnyAction } from '@dineug/r-html';
import { Subject, Subscription } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ColumnOption,
  Direction,
  StartRelationshipType,
} from '@/constants/schema';
import { Clock } from '@/engine/clock';
import type { HookEffect } from '@/engine/hooks';
import { hooks } from '@/engine/modules/relationship/hooks';
import { createStore, Store } from '@/engine/store';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';

const [identificationHook, startRelationshipHook, relationshipSortHook] =
  hooks.map(([, effect]) => effect) as [HookEffect, HookEffect, HookEffect];

const stores: Store[] = [];
const subscriptions: Subscription[] = [];

const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
/** throttle window is 10ms (5ms for the sort hook) with trailing only. */
const settle = () => tick(50);

function createTestStore(): Store {
  const store = createStore({
    toWidth: text => text.length * 10,
    clock: new Clock(),
  });
  stores.push(store);
  return store;
}

async function run(effect: HookEffect, store: Store) {
  const action$ = new Subject<AnyAction>();
  subscriptions.push(effect(action$, () => store.state, store.context));
  await tick();

  return {
    fire: () => action$.next({ type: 'test.trigger', payload: undefined }),
  };
}

function addTable(store: Store, id: string, columnIds: string[] = []) {
  const table = createTable({ id, name: id, columnIds: [...columnIds] });
  store.state.collections.tableEntities[id] = table;
  store.state.doc.tableIds.push(id);
  return table;
}

function addColumn(store: Store, tableId: string, id: string, options = 0) {
  const column = createColumn({ id, tableId, name: id, options });
  store.state.collections.tableColumnEntities[id] = column;
  return column;
}

function addRelationship(
  store: Store,
  value: Parameters<typeof createRelationship>[0]
) {
  const relationship = createRelationship(value);
  store.state.collections.relationshipEntities[relationship.id] = relationship;
  store.state.doc.relationshipIds.push(relationship.id);
  return relationship;
}

const rel = (store: Store, id: string) =>
  store.state.collections.relationshipEntities[id];

afterEach(() => {
  subscriptions.splice(0).forEach(subscription => subscription.unsubscribe());
  stores.splice(0).forEach(store => store.destroy());
});

describe('relationship/hooks registration', () => {
  it('registers exactly three hooks', () => {
    expect(hooks).toHaveLength(3);
    for (const [pattern, effect] of hooks) {
      expect(Array.isArray(pattern)).toBe(true);
      expect(pattern.length).toBeGreaterThan(0);
      expect(typeof effect).toBe('function');
    }
  });

  it('subscribes the identification hook to primary-key related actions', () => {
    expect(hooks[0][0].map(String)).toEqual([
      'column.remove',
      'column.changePrimaryKey',
      'editor.loadJson',
      'editor.initialLoadJson',
    ]);
  });

  it('subscribes the start-relationship hook to notNull related actions', () => {
    expect(hooks[1][0].map(String)).toEqual([
      'column.remove',
      'column.changeNotNull',
      'editor.loadJson',
      'editor.initialLoadJson',
    ]);
  });

  it('subscribes the sort hook to every layout changing action', () => {
    expect(hooks[2][0].map(String)).toEqual([
      'settings.changeShow',
      'settings.changeMaxWidthComment',
      'relationship.add',
      'memo.move',
      'table.move',
      'table.moveTo',
      'table.changeName',
      'table.changeComment',
      'column.add',
      'column.remove',
      'column.changeName',
      'column.changeComment',
      'column.changeDataType',
      'column.changeDefault',
      'table.sort',
    ]);
  });
});

describe('relationship/hooks identificationHook', () => {
  it('turns identification on when every end column is a primary key', async () => {
    const store = createTestStore();
    addTable(store, 't2', ['c1', 'c2']);
    addColumn(store, 't2', 'c1', ColumnOption.primaryKey);
    addColumn(store, 't2', 'c2', ColumnOption.primaryKey);
    addRelationship(store, {
      id: 'r1',
      start: { tableId: 't1', columnIds: [] },
      end: { tableId: 't2', columnIds: ['c1', 'c2'] },
    });

    const { fire } = await run(identificationHook, store);
    fire();
    expect(rel(store, 'r1').identification).toBe(false);

    await settle();

    expect(rel(store, 'r1').identification).toBe(true);
  });

  it('turns identification off when one end column is not a primary key', async () => {
    const store = createTestStore();
    addTable(store, 't2', ['c1', 'c2']);
    addColumn(store, 't2', 'c1', ColumnOption.primaryKey);
    addColumn(store, 't2', 'c2', ColumnOption.notNull);
    addRelationship(store, {
      id: 'r1',
      identification: true,
      start: { tableId: 't1', columnIds: [] },
      end: { tableId: 't2', columnIds: ['c1', 'c2'] },
    });

    const { fire } = await run(identificationHook, store);
    fire();
    await settle();

    expect(rel(store, 'r1').identification).toBe(false);
  });

  it('skips a relationship whose end table is gone', async () => {
    const store = createTestStore();
    addColumn(store, 'missing', 'c1', ColumnOption.primaryKey);
    addRelationship(store, {
      id: 'r1',
      start: { tableId: 't1', columnIds: [] },
      end: { tableId: 'missing', columnIds: ['c1'] },
    });

    const { fire } = await run(identificationHook, store);
    fire();
    await settle();

    expect(rel(store, 'r1').identification).toBe(false);
  });

  it('skips a relationship whose end columns no longer belong to the table', async () => {
    const store = createTestStore();
    addTable(store, 't2', ['other']);
    addColumn(store, 't2', 'c1', ColumnOption.primaryKey);
    addRelationship(store, {
      id: 'r1',
      identification: true,
      start: { tableId: 't1', columnIds: [] },
      end: { tableId: 't2', columnIds: ['c1'] },
    });

    const { fire } = await run(identificationHook, store);
    fire();
    await settle();

    expect(rel(store, 'r1').identification).toBe(true);
  });

  it('leaves the value alone when it already matches', async () => {
    const store = createTestStore();
    addTable(store, 't2', ['c1']);
    addColumn(store, 't2', 'c1', ColumnOption.primaryKey);
    addRelationship(store, {
      id: 'r1',
      identification: true,
      start: { tableId: 't1', columnIds: [] },
      end: { tableId: 't2', columnIds: ['c1'] },
    });

    const { fire } = await run(identificationHook, store);
    fire();
    await settle();

    expect(rel(store, 'r1').identification).toBe(true);
  });

  it('ignores relationships that are not listed in the document', async () => {
    const store = createTestStore();
    addTable(store, 't2', ['c1']);
    addColumn(store, 't2', 'c1', ColumnOption.primaryKey);
    const orphan = createRelationship({
      id: 'orphan',
      start: { tableId: 't1', columnIds: [] },
      end: { tableId: 't2', columnIds: ['c1'] },
    });
    store.state.collections.relationshipEntities['orphan'] = orphan;

    const { fire } = await run(identificationHook, store);
    fire();
    await settle();

    expect(rel(store, 'orphan').identification).toBe(false);
  });
});

describe('relationship/hooks startRelationshipHook', () => {
  it('uses dash when every end column is notNull', async () => {
    const store = createTestStore();
    addTable(store, 't2', ['c1']);
    addColumn(store, 't2', 'c1', ColumnOption.notNull);
    addRelationship(store, {
      id: 'r1',
      startRelationshipType: StartRelationshipType.ring,
      start: { tableId: 't1', columnIds: [] },
      end: { tableId: 't2', columnIds: ['c1'] },
    });

    const { fire } = await run(startRelationshipHook, store);
    fire();
    await settle();

    expect(rel(store, 'r1').startRelationshipType).toBe(
      StartRelationshipType.dash
    );
  });

  it('uses ring when one end column is nullable', async () => {
    const store = createTestStore();
    addTable(store, 't2', ['c1', 'c2']);
    addColumn(store, 't2', 'c1', ColumnOption.notNull);
    addColumn(store, 't2', 'c2', 0);
    addRelationship(store, {
      id: 'r1',
      start: { tableId: 't1', columnIds: [] },
      end: { tableId: 't2', columnIds: ['c1', 'c2'] },
    });

    expect(rel(store, 'r1').startRelationshipType).toBe(
      StartRelationshipType.dash
    );

    const { fire } = await run(startRelationshipHook, store);
    fire();
    await settle();

    expect(rel(store, 'r1').startRelationshipType).toBe(
      StartRelationshipType.ring
    );
  });

  it('skips a relationship whose end table is gone', async () => {
    const store = createTestStore();
    addColumn(store, 'missing', 'c1', 0);
    addRelationship(store, {
      id: 'r1',
      start: { tableId: 't1', columnIds: [] },
      end: { tableId: 'missing', columnIds: ['c1'] },
    });

    const { fire } = await run(startRelationshipHook, store);
    fire();
    await settle();

    expect(rel(store, 'r1').startRelationshipType).toBe(
      StartRelationshipType.dash
    );
  });

  it('skips a relationship with no resolvable end column', async () => {
    const store = createTestStore();
    addTable(store, 't2', []);
    addRelationship(store, {
      id: 'r1',
      start: { tableId: 't1', columnIds: [] },
      end: { tableId: 't2', columnIds: ['gone'] },
    });

    const { fire } = await run(startRelationshipHook, store);
    fire();
    await settle();

    expect(rel(store, 'r1').startRelationshipType).toBe(
      StartRelationshipType.dash
    );
  });

  it('leaves the value alone when it already matches', async () => {
    const store = createTestStore();
    addTable(store, 't2', ['c1']);
    addColumn(store, 't2', 'c1', 0);
    addRelationship(store, {
      id: 'r1',
      startRelationshipType: StartRelationshipType.ring,
      start: { tableId: 't1', columnIds: [] },
      end: { tableId: 't2', columnIds: ['c1'] },
    });

    const { fire } = await run(startRelationshipHook, store);
    fire();
    await settle();

    expect(rel(store, 'r1').startRelationshipType).toBe(
      StartRelationshipType.ring
    );
  });
});

describe('relationship/hooks relationshipSortHook', () => {
  it('recomputes the anchor points of a relationship between two tables', async () => {
    const store = createTestStore();
    const start = addTable(store, 't1', []);
    const end = addTable(store, 't2', []);
    start.ui.x = 0;
    start.ui.y = 0;
    end.ui.x = 600;
    end.ui.y = 0;
    addRelationship(store, {
      id: 'r1',
      start: { tableId: 't1', columnIds: [] },
      end: { tableId: 't2', columnIds: [] },
    });

    const { fire } = await run(relationshipSortHook, store);
    fire();
    await settle();

    const relationship = rel(store, 'r1');
    expect(relationship.start.direction).toBe(Direction.right);
    expect(relationship.end.direction).toBe(Direction.left);
    expect(relationship.start.x).toBeGreaterThan(0);
    expect(relationship.end.x).toBe(600);
  });

  it('anchors a self relationship to the top and right of its table', async () => {
    const store = createTestStore();
    const table = addTable(store, 't1', []);
    table.ui.x = 100;
    table.ui.y = 50;
    addRelationship(store, {
      id: 'r1',
      start: { tableId: 't1', columnIds: [] },
      end: { tableId: 't1', columnIds: [] },
    });

    const { fire } = await run(relationshipSortHook, store);
    fire();
    await settle();

    const relationship = rel(store, 'r1');
    expect(relationship.start.direction).toBe(Direction.top);
    expect(relationship.end.direction).toBe(Direction.right);
    expect(relationship.end.y).toBe(relationship.start.y + 20);
    expect(relationship.end.x).toBe(relationship.start.x + 20);
  });

  it('leaves a relationship pointing at a missing table untouched', async () => {
    const store = createTestStore();
    addTable(store, 't1', []);
    addRelationship(store, {
      id: 'r1',
      start: { tableId: 't1', columnIds: [] },
      end: { tableId: 'gone', columnIds: [] },
    });

    const { fire } = await run(relationshipSortHook, store);
    fire();
    await settle();

    const relationship = rel(store, 'r1');
    expect(relationship.start.x).toBe(0);
    expect(relationship.start.y).toBe(0);
    expect(relationship.start.direction).toBe(Direction.bottom);
  });

  it('does not run synchronously on the triggering action', async () => {
    const store = createTestStore();
    const start = addTable(store, 't1', []);
    const end = addTable(store, 't2', []);
    start.ui.x = 0;
    end.ui.x = 600;
    addRelationship(store, {
      id: 'r1',
      start: { tableId: 't1', columnIds: [] },
      end: { tableId: 't2', columnIds: [] },
    });

    const { fire } = await run(relationshipSortHook, store);
    fire();

    expect(rel(store, 'r1').start.x).toBe(0);

    await settle();

    expect(rel(store, 'r1').start.x).not.toBe(0);
  });

  it('collapses a burst of triggers into a single trailing run', async () => {
    const store = createTestStore();
    const start = addTable(store, 't1', []);
    const end = addTable(store, 't2', []);
    start.ui.x = 0;
    end.ui.x = 600;
    addRelationship(store, {
      id: 'r1',
      start: { tableId: 't1', columnIds: [] },
      end: { tableId: 't2', columnIds: [] },
    });

    const { fire } = await run(relationshipSortHook, store);
    fire();
    fire();
    fire();
    await settle();

    expect(rel(store, 'r1').start.direction).toBe(Direction.right);
  });
});
