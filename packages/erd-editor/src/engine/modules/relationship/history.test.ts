import { AnyAction } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  Database,
  Direction,
  ReferentialAction,
  RelationshipType,
} from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { ActionType } from '@/engine/modules/relationship/actions';
import {
  addRelationshipAction,
  changeRelationshipColumnsAction,
  changeRelationshipOnDeleteAction,
  changeRelationshipOnUpdateAction,
  changeRelationshipTypeAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import { toForeignKeyActions } from '@/engine/modules/relationship/fkColumns';
import { relationshipPushUndoHistoryMap } from '@/engine/modules/relationship/history';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnNameAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import { createRxStore, RxStore } from '@/engine/rx-store';
import { createStore, Store } from '@/engine/store';

const stores: Store[] = [];

function createTestStore(): Store {
  const store = createStore({
    toWidth: text => text.length * 10,
    clock: new Clock(),
  });
  stores.push(store);
  return store;
}

function seed(store: Store) {
  store.dispatchSync(
    addRelationshipAction({
      id: 'r1',
      relationshipType: RelationshipType.ZeroN,
      start: { tableId: 't1', columnIds: ['c1', 'c2'] },
      end: { tableId: 't2', columnIds: ['c3'] },
    })
  );
}

afterEach(() => {
  stores.splice(0).forEach(store => store.destroy());
});

describe('relationship/history', () => {
  it('registers an undo builder for every relationship action type', () => {
    expect(Object.keys(relationshipPushUndoHistoryMap).slice().sort()).toEqual(
      Object.values(ActionType).slice().sort()
    );
  });

  describe('addRelationship', () => {
    it('undoes with a remove of the same id', () => {
      const store = createTestStore();
      const undoActions: AnyAction[] = [];

      relationshipPushUndoHistoryMap[ActionType.addRelationship](
        undoActions,
        addRelationshipAction({
          id: 'r1',
          relationshipType: RelationshipType.ZeroN,
          start: { tableId: 't1', columnIds: ['c1'] },
          end: { tableId: 't2', columnIds: ['c2'] },
        }),
        store.state
      );

      expect(undoActions).toHaveLength(1);
      expect(undoActions[0].type).toBe(ActionType.removeRelationship);
      expect(undoActions[0].payload).toEqual({ id: 'r1' });
    });

    it('does not need the entity to exist in the collection', () => {
      const store = createTestStore();
      const undoActions: AnyAction[] = [];

      relationshipPushUndoHistoryMap[ActionType.addRelationship](
        undoActions,
        addRelationshipAction({
          id: 'never-added',
          relationshipType: RelationshipType.OneN,
          start: { tableId: 't1', columnIds: [] },
          end: { tableId: 't2', columnIds: [] },
        }),
        store.state
      );

      expect(undoActions[0].payload).toEqual({ id: 'never-added' });
    });
  });

  describe('removeRelationship', () => {
    it('undoes with an add carrying the actions and only the tableId/columnIds of each point', () => {
      const store = createTestStore();
      seed(store);
      const undoActions: AnyAction[] = [];

      relationshipPushUndoHistoryMap[ActionType.removeRelationship](
        undoActions,
        removeRelationshipAction({ id: 'r1' }),
        store.state
      );

      expect(undoActions).toHaveLength(1);
      expect(undoActions[0].type).toBe(ActionType.addRelationship);
      expect(undoActions[0].payload).toEqual({
        id: 'r1',
        relationshipType: RelationshipType.ZeroN,
        onDelete: ReferentialAction.none,
        onUpdate: ReferentialAction.none,
        start: { tableId: 't1', columnIds: ['c1', 'c2'] },
        end: { tableId: 't2', columnIds: ['c3'] },
      });
    });

    it('carries the referential actions the relationship holds', () => {
      const store = createTestStore();
      seed(store);
      store.dispatchSync([
        changeRelationshipOnDeleteAction({
          id: 'r1',
          value: ReferentialAction.cascade,
        }),
        changeRelationshipOnUpdateAction({
          id: 'r1',
          value: ReferentialAction.setNull,
        }),
      ]);
      const undoActions: AnyAction[] = [];

      relationshipPushUndoHistoryMap[ActionType.removeRelationship](
        undoActions,
        removeRelationshipAction({ id: 'r1' }),
        store.state
      );

      expect(undoActions[0].payload.onDelete).toBe(ReferentialAction.cascade);
      expect(undoActions[0].payload.onUpdate).toBe(ReferentialAction.setNull);
    });

    it('drops the geometry of the points from the undo payload', () => {
      const store = createTestStore();
      seed(store);
      store.state.collections.relationshipEntities['r1'].start.x = 42;
      store.state.collections.relationshipEntities['r1'].end.direction =
        Direction.left;
      const undoActions: AnyAction[] = [];

      relationshipPushUndoHistoryMap[ActionType.removeRelationship](
        undoActions,
        removeRelationshipAction({ id: 'r1' }),
        store.state
      );

      expect(Object.keys(undoActions[0].payload.start).sort()).toEqual([
        'columnIds',
        'tableId',
      ]);
      expect(Object.keys(undoActions[0].payload.end).sort()).toEqual([
        'columnIds',
        'tableId',
      ]);
    });

    it('pushes nothing when the relationship is unknown', () => {
      const store = createTestStore();
      const undoActions: AnyAction[] = [];

      relationshipPushUndoHistoryMap[ActionType.removeRelationship](
        undoActions,
        removeRelationshipAction({ id: 'ghost' }),
        store.state
      );

      expect(undoActions).toHaveLength(0);
    });
  });

  describe('changeRelationshipType', () => {
    it('undoes with the value the relationship currently holds', () => {
      const store = createTestStore();
      seed(store);
      const undoActions: AnyAction[] = [];

      relationshipPushUndoHistoryMap[ActionType.changeRelationshipType](
        undoActions,
        changeRelationshipTypeAction({
          id: 'r1',
          value: RelationshipType.OneOnly,
        }),
        store.state
      );

      expect(undoActions).toHaveLength(1);
      expect(undoActions[0].type).toBe(ActionType.changeRelationshipType);
      expect(undoActions[0].payload).toEqual({
        id: 'r1',
        value: RelationshipType.ZeroN,
      });
    });

    it('reads the value at build time, not the value carried by the action', () => {
      const store = createTestStore();
      seed(store);
      store.dispatchSync(
        changeRelationshipTypeAction({
          id: 'r1',
          value: RelationshipType.OneN,
        })
      );
      const undoActions: AnyAction[] = [];

      relationshipPushUndoHistoryMap[ActionType.changeRelationshipType](
        undoActions,
        changeRelationshipTypeAction({
          id: 'r1',
          value: RelationshipType.ZeroOne,
        }),
        store.state
      );

      expect(undoActions[0].payload.value).toBe(RelationshipType.OneN);
    });

    it('pushes nothing when the relationship is unknown', () => {
      const store = createTestStore();
      const undoActions: AnyAction[] = [];

      relationshipPushUndoHistoryMap[ActionType.changeRelationshipType](
        undoActions,
        changeRelationshipTypeAction({
          id: 'ghost',
          value: RelationshipType.OneN,
        }),
        store.state
      );

      expect(undoActions).toHaveLength(0);
    });
  });

  describe.each([
    [
      'changeRelationshipOnDelete',
      ActionType.changeRelationshipOnDelete,
      changeRelationshipOnDeleteAction,
    ],
    [
      'changeRelationshipOnUpdate',
      ActionType.changeRelationshipOnUpdate,
      changeRelationshipOnUpdateAction,
    ],
  ] as const)('%s', (_name, type, changeAction) => {
    it('undoes with the value the relationship currently holds', () => {
      const store = createTestStore();
      seed(store);
      store.dispatchSync(
        changeAction({ id: 'r1', value: ReferentialAction.restrict })
      );
      const undoActions: AnyAction[] = [];

      relationshipPushUndoHistoryMap[type](
        undoActions,
        changeAction({ id: 'r1', value: ReferentialAction.cascade }),
        store.state
      );

      expect(undoActions).toHaveLength(1);
      expect(undoActions[0].type).toBe(type);
      expect(undoActions[0].payload).toEqual({
        id: 'r1',
        value: ReferentialAction.restrict,
      });
    });

    it('pushes nothing when the relationship is unknown', () => {
      const store = createTestStore();
      const undoActions: AnyAction[] = [];

      relationshipPushUndoHistoryMap[type](
        undoActions,
        changeAction({ id: 'ghost', value: ReferentialAction.cascade }),
        store.state
      );

      expect(undoActions).toHaveLength(0);
    });
  });

  describe('changeRelationshipColumns', () => {
    const edit = (start: string[], end: string[], endTableId = 't2') =>
      changeRelationshipColumnsAction({
        id: 'r1',
        start: { tableId: 't1', columnIds: start },
        end: { tableId: endTableId, columnIds: end },
      });

    it('undoes with copies of the lists the relationship holds before the batch', () => {
      const store = createTestStore();
      seed(store);
      const undoActions: AnyAction[] = [];

      relationshipPushUndoHistoryMap[ActionType.changeRelationshipColumns](
        undoActions,
        edit(['c1'], ['c9']),
        store.state
      );

      expect(undoActions).toHaveLength(1);
      expect(undoActions[0].type).toBe(ActionType.changeRelationshipColumns);
      expect(undoActions[0].payload).toEqual({
        id: 'r1',
        start: { tableId: 't1', columnIds: ['c1', 'c2'] },
        end: { tableId: 't2', columnIds: ['c3'] },
      });

      const entity = store.state.collections.relationshipEntities['r1'];
      expect(undoActions[0].payload.start.columnIds).not.toBe(
        entity.start.columnIds
      );
      expect(undoActions[0].payload.end.columnIds).not.toBe(
        entity.end.columnIds
      );
    });

    it('pushes nothing when the relationship is unknown', () => {
      const store = createTestStore();
      const undoActions: AnyAction[] = [];

      relationshipPushUndoHistoryMap[ActionType.changeRelationshipColumns](
        undoActions,
        edit(['c1'], ['c9']),
        store.state
      );

      expect(undoActions).toHaveLength(0);
    });

    it('pushes nothing for a write naming other tables, which the reducer ignores', () => {
      const store = createTestStore();
      seed(store);
      const undoActions: AnyAction[] = [];

      relationshipPushUndoHistoryMap[ActionType.changeRelationshipColumns](
        undoActions,
        edit(['c1'], ['c9'], 'tX'),
        store.state
      );

      expect(undoActions).toHaveLength(0);
    });
  });

  describe('changeRelationshipColumns through a real store', () => {
    const rxStores: RxStore[] = [];

    function createRxTestStore(): RxStore {
      const rxStore = createRxStore({
        toWidth: text => text.length * 10,
        clock: new Clock(),
      });
      rxStores.push(rxStore);
      return rxStore;
    }

    function seedMapping(rxStore: RxStore) {
      rxStore.dispatchSync(
        addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 2 } }),
        addTableAction({ id: 't2', ui: { x: 0, y: 0, zIndex: 2 } }),
        addColumnAction({ id: 'p1', tableId: 't1' }),
        changeColumnPrimaryKeyAction({ id: 'p1', tableId: 't1', value: true }),
        changeColumnNameAction({ id: 'p1', tableId: 't1', value: 'id' }),
        addColumnAction({ id: 'f1', tableId: 't2' }),
        addColumnAction({ id: 'f2', tableId: 't2' }),
        addRelationshipAction({
          id: 'r1',
          relationshipType: RelationshipType.ZeroN,
          start: { tableId: 't1', columnIds: ['p1'] },
          end: { tableId: 't2', columnIds: ['f1'] },
        })
      );
      vi.advanceTimersByTime(300);
    }

    function endsOf(rxStore: RxStore) {
      const { start, end } =
        rxStore.state.collections.relationshipEntities['r1'];
      return [start.columnIds, end.columnIds];
    }

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      rxStores.splice(0).forEach(rxStore => rxStore.destroy());
    });

    it('undoes to both lists of before the batch and redoes the edit, one entry', () => {
      const rxStore = createRxTestStore();
      seedMapping(rxStore);
      const size = rxStore.history.size;

      rxStore.dispatchSync(
        changeRelationshipColumnsAction({
          id: 'r1',
          start: { tableId: 't1', columnIds: ['p1'] },
          end: { tableId: 't2', columnIds: ['f2'] },
        })
      );
      vi.advanceTimersByTime(300);

      expect(endsOf(rxStore)).toEqual([['p1'], ['f2']]);
      expect(rxStore.history.size).toBe(size + 1);

      rxStore.undo();

      expect(endsOf(rxStore)).toEqual([['p1'], ['f1']]);
      expect(rxStore.state.doc.relationshipIds).toEqual(['r1']);

      rxStore.redo();

      expect(endsOf(rxStore)).toEqual([['p1'], ['f2']]);
    });

    it('takes back the columns a mapping edit adds with the edit in one undo', () => {
      const rxStore = createRxTestStore();
      seedMapping(rxStore);
      const size = rxStore.history.size;
      const parent = rxStore.state.collections.tableColumnEntities['p1'];

      rxStore.dispatchSync(
        ...toForeignKeyActions([parent], 't2', ['n1'], {
          startTableName: '',
          endColumnNames: ['', ''],
          database: Database.MySQL,
        }),
        changeRelationshipColumnsAction({
          id: 'r1',
          start: { tableId: 't1', columnIds: ['p1'] },
          end: { tableId: 't2', columnIds: ['n1'] },
        })
      );
      vi.advanceTimersByTime(300);

      expect(rxStore.state.collections.tableEntities['t2'].columnIds).toEqual([
        'f1',
        'f2',
        'n1',
      ]);
      expect(endsOf(rxStore)).toEqual([['p1'], ['n1']]);
      expect(rxStore.history.size).toBe(size + 1);

      const undone: string[][] = [];
      const unsubscribe = rxStore.subscribe(actions =>
        undone.push(actions.map(({ type }) => type))
      );
      rxStore.undo();
      unsubscribe();

      expect(undone).toHaveLength(1);
      expect(undone[0][0]).toBe('column.remove');
      expect(undone[0].at(-1)).toBe('relationship.changeColumns');
      expect(rxStore.state.collections.tableEntities['t2'].columnIds).toEqual([
        'f1',
        'f2',
      ]);
      expect(endsOf(rxStore)).toEqual([['p1'], ['f1']]);

      rxStore.redo();

      expect(rxStore.state.collections.tableEntities['t2'].columnIds).toEqual([
        'f1',
        'f2',
        'n1',
      ]);
      expect(endsOf(rxStore)).toEqual([['p1'], ['n1']]);
    });
  });

  it('round-trips add -> undo -> redo against a real store', () => {
    const store = createTestStore();
    seed(store);
    const undoActions: AnyAction[] = [];

    relationshipPushUndoHistoryMap[ActionType.removeRelationship](
      undoActions,
      removeRelationshipAction({ id: 'r1' }),
      store.state
    );
    store.dispatchSync({
      ...removeRelationshipAction({ id: 'r1' }),
      version: 2,
    });
    expect(store.state.doc.relationshipIds).toEqual([]);

    store.dispatchSync(undoActions.map(action => ({ ...action, version: 3 })));

    expect(store.state.doc.relationshipIds).toEqual(['r1']);
    expect(
      store.state.collections.relationshipEntities['r1'].relationshipType
    ).toBe(RelationshipType.ZeroN);
  });
});
