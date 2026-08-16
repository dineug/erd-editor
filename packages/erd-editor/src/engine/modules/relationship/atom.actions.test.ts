import { query } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  Direction,
  RelationshipType,
  StartRelationshipType,
} from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { ActionType } from '@/engine/modules/relationship/actions';
import {
  addRelationshipAction,
  changeRelationshipTypeAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
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

function versioned(action: AnyAction, version: number): AnyAction {
  return { ...action, version };
}

function relationship(store: Store, id: string) {
  return query(store.state.collections)
    .collection('relationshipEntities')
    .selectById(id);
}

const addPayload = {
  id: 'r1',
  relationshipType: RelationshipType.ZeroN,
  start: { tableId: 't1', columnIds: ['c1'] },
  end: { tableId: 't2', columnIds: ['c2'] },
};

afterEach(() => {
  stores.splice(0).forEach(store => store.destroy());
});

describe('relationship/atom.actions addRelationship', () => {
  it('creates the entity, registers the id and stamps the lww add version', () => {
    const store = createTestStore();

    store.dispatchSync(addRelationshipAction(addPayload));

    const entity = relationship(store, 'r1')!;
    expect(entity).toBeDefined();
    expect(entity.id).toBe('r1');
    expect(entity.relationshipType).toBe(RelationshipType.ZeroN);
    expect(entity.start.tableId).toBe('t1');
    expect(entity.start.columnIds).toEqual(['c1']);
    expect(entity.end.tableId).toBe('t2');
    expect(entity.end.columnIds).toEqual(['c2']);
    expect(store.state.doc.relationshipIds).toEqual(['r1']);
    expect(store.state.lww['r1']).toEqual(['relationshipEntities', 0, -1, {}]);
  });

  it('fills the geometry defaults that the payload does not carry', () => {
    const store = createTestStore();

    store.dispatchSync(addRelationshipAction(addPayload));

    const entity = relationship(store, 'r1')!;
    expect(entity.identification).toBe(false);
    expect(entity.startRelationshipType).toBe(StartRelationshipType.dash);
    expect(entity.start.x).toBe(0);
    expect(entity.start.y).toBe(0);
    expect(entity.start.direction).toBe(Direction.bottom);
    expect(entity.end.direction).toBe(Direction.bottom);
  });

  it('uses the action version when one is supplied', () => {
    const store = createTestStore();

    store.dispatchSync(versioned(addRelationshipAction(addPayload), 7));

    expect(store.state.lww['r1'][1]).toBe(7);
  });

  it('falls back to the clock version when the action carries none', () => {
    const store = createTestStore();
    store.context.clock.merge(12);

    store.dispatchSync(addRelationshipAction(addPayload));

    expect(store.state.lww['r1'][1]).toBe(12);
  });

  it('is idempotent for a repeated id: no duplicate entity and no duplicate doc id', () => {
    const store = createTestStore();

    store.dispatchSync(versioned(addRelationshipAction(addPayload), 1));
    const first = relationship(store, 'r1');

    store.dispatchSync(
      versioned(
        addRelationshipAction({
          ...addPayload,
          relationshipType: RelationshipType.OneN,
        }),
        2
      )
    );

    expect(relationship(store, 'r1')).toBe(first);
    expect(relationship(store, 'r1')!.relationshipType).toBe(
      RelationshipType.ZeroN
    );
    expect(store.state.doc.relationshipIds).toEqual(['r1']);
    expect(store.state.lww['r1'][1]).toBe(2);
  });

  it('does not re-register an id that was removed at a newer version', () => {
    const store = createTestStore();

    store.dispatchSync(versioned(addRelationshipAction(addPayload), 1));
    store.dispatchSync(versioned(removeRelationshipAction({ id: 'r1' }), 5));
    expect(store.state.doc.relationshipIds).toEqual([]);

    // stale add arriving late: removeVersion 5 wins over version 3
    store.dispatchSync(versioned(addRelationshipAction(addPayload), 3));

    expect(store.state.doc.relationshipIds).toEqual([]);
    expect(store.state.lww['r1'][1]).toBe(3);
    expect(store.state.lww['r1'][2]).toBe(5);
  });

  it('keeps the highest add version when an older add arrives afterwards', () => {
    const store = createTestStore();

    store.dispatchSync(versioned(addRelationshipAction(addPayload), 9));
    store.dispatchSync(versioned(addRelationshipAction(addPayload), 4));

    expect(store.state.lww['r1'][1]).toBe(9);
  });
});

describe('relationship/atom.actions removeRelationship', () => {
  it('drops the id from the document and stamps the lww remove version', () => {
    const store = createTestStore();
    store.dispatchSync(versioned(addRelationshipAction(addPayload), 1));

    store.dispatchSync(versioned(removeRelationshipAction({ id: 'r1' }), 2));

    expect(store.state.doc.relationshipIds).toEqual([]);
    expect(store.state.lww['r1'][2]).toBe(2);
  });

  it('keeps the entity in the collection as a tombstone', () => {
    const store = createTestStore();
    store.dispatchSync(versioned(addRelationshipAction(addPayload), 1));

    store.dispatchSync(versioned(removeRelationshipAction({ id: 'r1' }), 2));

    expect(relationship(store, 'r1')).toBeDefined();
  });

  it('leaves sibling ids untouched', () => {
    const store = createTestStore();
    store.dispatchSync(addRelationshipAction(addPayload));
    store.dispatchSync(addRelationshipAction({ ...addPayload, id: 'r2' }));

    store.dispatchSync(versioned(removeRelationshipAction({ id: 'r1' }), 3));

    expect(store.state.doc.relationshipIds).toEqual(['r2']);
  });

  it('creates a tombstone for an id that was never added', () => {
    const store = createTestStore();

    store.dispatchSync(versioned(removeRelationshipAction({ id: 'ghost' }), 4));

    expect(store.state.doc.relationshipIds).toEqual([]);
    expect(store.state.lww['ghost']).toEqual([
      'relationshipEntities',
      -1,
      4,
      {},
    ]);
  });

  it('ignores a remove that is older than the add version', () => {
    const store = createTestStore();
    store.dispatchSync(versioned(addRelationshipAction(addPayload), 8));

    store.dispatchSync(versioned(removeRelationshipAction({ id: 'r1' }), 3));

    expect(store.state.doc.relationshipIds).toEqual(['r1']);
    expect(store.state.lww['r1'][2]).toBe(3);
  });

  it('keeps the highest remove version when an older remove arrives afterwards', () => {
    const store = createTestStore();
    store.dispatchSync(versioned(addRelationshipAction(addPayload), 1));

    store.dispatchSync(versioned(removeRelationshipAction({ id: 'r1' }), 6));
    store.dispatchSync(versioned(removeRelationshipAction({ id: 'r1' }), 2));

    expect(store.state.lww['r1'][2]).toBe(6);
  });

  it('falls back to the clock version', () => {
    const store = createTestStore();
    store.dispatchSync(addRelationshipAction(addPayload));
    store.context.clock.merge(5);

    store.dispatchSync(removeRelationshipAction({ id: 'r1' }));

    expect(store.state.lww['r1'][2]).toBe(5);
    expect(store.state.doc.relationshipIds).toEqual([]);
  });
});

describe('relationship/atom.actions changeRelationshipType', () => {
  it('replaces the relationship type and records the field version', () => {
    const store = createTestStore();
    store.dispatchSync(addRelationshipAction(addPayload));

    store.dispatchSync(
      versioned(
        changeRelationshipTypeAction({
          id: 'r1',
          value: RelationshipType.OneOnly,
        }),
        3
      )
    );

    expect(relationship(store, 'r1')!.relationshipType).toBe(
      RelationshipType.OneOnly
    );
    expect(store.state.lww['r1'][3]).toEqual({ relationshipType: 3 });
  });

  it('bumps the entity updateAt timestamp', () => {
    const store = createTestStore();
    store.dispatchSync(addRelationshipAction(addPayload));
    const before = relationship(store, 'r1')!.meta.updateAt;

    store.dispatchSync(
      changeRelationshipTypeAction({ id: 'r1', value: RelationshipType.OneN })
    );

    expect(relationship(store, 'r1')!.meta.updateAt).toBeGreaterThanOrEqual(
      before
    );
  });

  it('ignores a change that is older than the recorded field version', () => {
    const store = createTestStore();
    store.dispatchSync(addRelationshipAction(addPayload));

    store.dispatchSync(
      versioned(
        changeRelationshipTypeAction({
          id: 'r1',
          value: RelationshipType.OneOnly,
        }),
        10
      )
    );
    store.dispatchSync(
      versioned(
        changeRelationshipTypeAction({
          id: 'r1',
          value: RelationshipType.OneN,
        }),
        4
      )
    );

    expect(relationship(store, 'r1')!.relationshipType).toBe(
      RelationshipType.OneOnly
    );
    expect(store.state.lww['r1'][3]).toEqual({ relationshipType: 10 });
  });

  it('applies a change carrying the same version as the recorded one', () => {
    const store = createTestStore();
    store.dispatchSync(addRelationshipAction(addPayload));

    store.dispatchSync(
      versioned(
        changeRelationshipTypeAction({
          id: 'r1',
          value: RelationshipType.OneOnly,
        }),
        5
      )
    );
    store.dispatchSync(
      versioned(
        changeRelationshipTypeAction({
          id: 'r1',
          value: RelationshipType.OneN,
        }),
        5
      )
    );

    expect(relationship(store, 'r1')!.relationshipType).toBe(
      RelationshipType.OneN
    );
  });

  it('records the field version even for an unknown relationship id', () => {
    const store = createTestStore();

    expect(() =>
      store.dispatchSync(
        versioned(
          changeRelationshipTypeAction({
            id: 'ghost',
            value: RelationshipType.OneN,
          }),
          2
        )
      )
    ).not.toThrow();

    expect(relationship(store, 'ghost')).toBeUndefined();
    expect(store.state.lww['ghost']).toEqual([
      'relationshipEntities',
      -1,
      -1,
      { relationshipType: 2 },
    ]);
  });

  it('falls back to the clock version', () => {
    const store = createTestStore();
    store.dispatchSync(addRelationshipAction(addPayload));
    store.context.clock.merge(11);

    store.dispatchSync(
      changeRelationshipTypeAction({
        id: 'r1',
        value: RelationshipType.ZeroOne,
      })
    );

    expect(store.state.lww['r1'][3]).toEqual({ relationshipType: 11 });
    expect(relationship(store, 'r1')!.relationshipType).toBe(
      RelationshipType.ZeroOne
    );
  });
});

describe('relationship/atom.actions reducer registry', () => {
  it('dispatches through the store by action type only', () => {
    const store = createTestStore();

    store.dispatchSync({
      type: ActionType.addRelationship,
      payload: addPayload,
    } as AnyAction);

    expect(store.state.doc.relationshipIds).toEqual(['r1']);
  });
});
