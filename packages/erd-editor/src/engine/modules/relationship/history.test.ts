import { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { Direction, RelationshipType } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { ActionType } from '@/engine/modules/relationship/actions';
import {
  addRelationshipAction,
  changeRelationshipTypeAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import { relationshipPushUndoHistoryMap } from '@/engine/modules/relationship/history';
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
    it('undoes with an add carrying only the tableId/columnIds of each point', () => {
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
        start: { tableId: 't1', columnIds: ['c1', 'c2'] },
        end: { tableId: 't2', columnIds: ['c3'] },
      });
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
