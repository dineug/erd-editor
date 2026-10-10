import { query } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  Direction,
  ReferentialAction,
  RelationshipType,
  StartRelationshipType,
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

  it('leaves the referential actions unset when the payload carries none', () => {
    const store = createTestStore();

    store.dispatchSync(addRelationshipAction(addPayload));

    expect(relationship(store, 'r1')!.onDelete).toBe(ReferentialAction.none);
    expect(relationship(store, 'r1')!.onUpdate).toBe(ReferentialAction.none);
  });

  it('keeps the referential actions the payload carries', () => {
    const store = createTestStore();

    store.dispatchSync(
      addRelationshipAction({
        ...addPayload,
        onDelete: ReferentialAction.cascade,
        onUpdate: ReferentialAction.restrict,
      })
    );

    expect(relationship(store, 'r1')!.onDelete).toBe(ReferentialAction.cascade);
    expect(relationship(store, 'r1')!.onUpdate).toBe(
      ReferentialAction.restrict
    );
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

describe.each([
  ['onDelete', changeRelationshipOnDeleteAction] as const,
  ['onUpdate', changeRelationshipOnUpdateAction] as const,
])('relationship/atom.actions change %s', (path, changeAction) => {
  it('replaces the action and records the field version', () => {
    const store = createTestStore();
    store.dispatchSync(addRelationshipAction(addPayload));

    store.dispatchSync(
      versioned(changeAction({ id: 'r1', value: ReferentialAction.setNull }), 3)
    );

    expect(relationship(store, 'r1')![path]).toBe(ReferentialAction.setNull);
    expect(store.state.lww['r1'][3]).toEqual({ [path]: 3 });
  });

  it('ignores a change that is older than the recorded field version', () => {
    const store = createTestStore();
    store.dispatchSync(addRelationshipAction(addPayload));

    store.dispatchSync(
      versioned(changeAction({ id: 'r1', value: ReferentialAction.cascade }), 9)
    );
    store.dispatchSync(
      versioned(
        changeAction({ id: 'r1', value: ReferentialAction.restrict }),
        4
      )
    );

    expect(relationship(store, 'r1')![path]).toBe(ReferentialAction.cascade);
  });

  it('keeps each field a register of its own', () => {
    const store = createTestStore();
    store.dispatchSync(addRelationshipAction(addPayload));

    store.dispatchSync(
      versioned(
        changeAction({ id: 'r1', value: ReferentialAction.noAction }),
        6
      )
    );
    store.dispatchSync(
      versioned(
        changeRelationshipTypeAction({
          id: 'r1',
          value: RelationshipType.OneN,
        }),
        2
      )
    );

    expect(relationship(store, 'r1')![path]).toBe(ReferentialAction.noAction);
    expect(relationship(store, 'r1')!.relationshipType).toBe(
      RelationshipType.OneN
    );
  });

  it('falls back to the clock version', () => {
    const store = createTestStore();
    store.dispatchSync(addRelationshipAction(addPayload));
    store.context.clock.merge(11);

    store.dispatchSync(
      changeAction({ id: 'r1', value: ReferentialAction.setDefault })
    );

    expect(store.state.lww['r1'][3]).toEqual({ [path]: 11 });
    expect(relationship(store, 'r1')![path]).toBe(ReferentialAction.setDefault);
  });
});

describe('relationship/atom.actions changeRelationshipColumns', () => {
  type Ends = [startColumnIds: string[], endColumnIds: string[]];

  function changeColumns(
    [startColumnIds, endColumnIds]: Ends,
    version?: number
  ) {
    const action = changeRelationshipColumnsAction({
      id: 'r1',
      start: { tableId: 't1', columnIds: startColumnIds },
      end: { tableId: 't2', columnIds: endColumnIds },
    });
    return version === undefined ? action : versioned(action, version);
  }

  function seeded(): Store {
    const store = createTestStore();
    store.dispatchSync(versioned(addRelationshipAction(addPayload), 1));
    return store;
  }

  function endsOf(store: Store, id = 'r1'): Ends {
    const entity = relationship(store, id)!;
    return [entity.start.columnIds, entity.end.columnIds];
  }

  function permutations<T>(items: T[]): T[][] {
    if (items.length <= 1) return [items];
    return items.flatMap((item, index) =>
      permutations([...items.slice(0, index), ...items.slice(index + 1)]).map(
        rest => [item, ...rest]
      )
    );
  }

  it('replaces both lists under one register named columns', () => {
    const store = seeded();

    store.dispatchSync(
      changeColumns(
        [
          ['c1', 'c5'],
          ['c2', 'c6'],
        ],
        3
      )
    );

    expect(endsOf(store)).toEqual([
      ['c1', 'c5'],
      ['c2', 'c6'],
    ]);
    expect(store.state.lww['r1'][3]).toEqual({ columns: 3 });
  });

  it('ignores a write older than the register', () => {
    const store = seeded();

    store.dispatchSync(changeColumns([['c1'], ['c7']], 5));
    store.dispatchSync(changeColumns([['c1'], ['c9']], 3));

    expect(endsOf(store)).toEqual([['c1'], ['c7']]);
    expect(store.state.lww['r1'][3]).toEqual({ columns: 5 });
  });

  it('lets a newer write win whatever its lists', () => {
    const store = seeded();

    store.dispatchSync(changeColumns([['c1'], ['c9']], 3));
    store.dispatchSync(changeColumns([['c1'], ['c0']], 4));

    expect(endsOf(store)).toEqual([['c1'], ['c0']]);
    expect(store.state.lww['r1'][3]).toEqual({ columns: 4 });
  });

  it('settles two writes at one version on the greater lists in either order', () => {
    const writes: Ends[] = [
      [['c1'], ['c7']],
      [['c1'], ['c2']],
    ];

    for (const order of permutations(writes)) {
      const store = seeded();
      for (const write of order) store.dispatchSync(changeColumns(write, 3));

      expect(endsOf(store)).toEqual([['c1'], ['c7']]);
      expect(store.state.lww['r1'][3]).toEqual({ columns: 3 });
    }
  });

  it('settles three writes at one version on one state in all six orders', () => {
    const writes: Ends[] = [
      [['c1'], ['c7']],
      [
        ['c1', 'c5'],
        ['c2', 'c6'],
      ],
      [['c1'], ['c10']],
    ];
    const greatest = writes
      .map(ends => JSON.stringify(ends))
      .sort()
      .at(-1);
    const ends = new Set<string>();

    for (const order of permutations(writes)) {
      const store = seeded();
      for (const write of order) store.dispatchSync(changeColumns(write, 3));
      ends.add(JSON.stringify(endsOf(store)));
    }

    expect([...ends]).toEqual([greatest]);
    expect(greatest).toBe(JSON.stringify([['c1'], ['c7']]));
  });

  it('compares the lists as JSON text, so a code unit decides between two names', () => {
    const store = seeded();

    store.dispatchSync(changeColumns([['c1'], ['ä']], 3));
    store.dispatchSync(changeColumns([['c1'], ['z']], 3));

    expect(endsOf(store)).toEqual([['c1'], ['ä']]);
  });

  it('ignores a write naming other tables before the register moves', () => {
    for (const [start, end] of [
      ['tX', 't2'],
      ['t1', 'tX'],
    ]) {
      const store = seeded();

      store.dispatchSync(
        versioned(
          changeRelationshipColumnsAction({
            id: 'r1',
            start: { tableId: start, columnIds: ['c1'] },
            end: { tableId: end, columnIds: ['c9'] },
          }),
          5
        )
      );

      expect(endsOf(store)).toEqual([['c1'], ['c2']]);
      expect(store.state.lww['r1'][3]).toEqual({});

      store.dispatchSync(changeColumns([['c1'], ['c3']], 4));

      expect(endsOf(store)).toEqual([['c1'], ['c3']]);
      expect(store.state.lww['r1'][3]).toEqual({ columns: 4 });

      store.dispatchSync(changeColumns([['c1'], ['c0']], 5));

      expect(endsOf(store)).toEqual([['c1'], ['c0']]);
    }
  });

  it('records the register alone for a relationship it does not hold', () => {
    const store = createTestStore();

    expect(() =>
      store.dispatchSync(
        versioned(
          changeRelationshipColumnsAction({
            id: 'ghost',
            start: { tableId: 't1', columnIds: ['c1'] },
            end: { tableId: 't2', columnIds: ['c9'] },
          }),
          2
        )
      )
    ).not.toThrow();

    expect(relationship(store, 'ghost')).toBeUndefined();
    expect(store.state.doc.relationshipIds).toEqual([]);
    expect(store.state.lww['ghost']).toEqual([
      'relationshipEntities',
      -1,
      -1,
      { columns: 2 },
    ]);
  });

  it('lets the add that follows an edit it overtook build the entity from its own payload', () => {
    const store = createTestStore();

    store.dispatchSync(changeColumns([['c1'], ['c9']], 3));
    store.dispatchSync(versioned(addRelationshipAction(addPayload), 2));

    expect(endsOf(store)).toEqual([['c1'], ['c2']]);
    expect(store.state.lww['r1'][3]).toEqual({ columns: 3 });
  });

  it('keeps the id, the place in the document and the other registers', () => {
    const store = createTestStore();
    store.dispatchSync(
      versioned(addRelationshipAction({ ...addPayload, id: 'r0' }), 1)
    );
    store.dispatchSync(versioned(addRelationshipAction(addPayload), 1));
    store.dispatchSync(
      versioned(addRelationshipAction({ ...addPayload, id: 'r2' }), 1)
    );
    store.dispatchSync(
      versioned(
        changeRelationshipOnDeleteAction({
          id: 'r1',
          value: ReferentialAction.cascade,
        }),
        2
      )
    );

    store.dispatchSync(changeColumns([['c1'], ['c9']], 3));

    const entity = relationship(store, 'r1')!;
    expect(entity.id).toBe('r1');
    expect(store.state.doc.relationshipIds).toEqual(['r0', 'r1', 'r2']);
    expect(entity.relationshipType).toBe(RelationshipType.ZeroN);
    expect(entity.onDelete).toBe(ReferentialAction.cascade);
    expect(entity.start.tableId).toBe('t1');
    expect(entity.end.tableId).toBe('t2');
    expect(store.state.lww['r1'][3]).toEqual({ onDelete: 2, columns: 3 });
  });

  it('writes new arrays, leaving the lists an undo entry captured as they were', () => {
    const store = seeded();
    const undoActions: AnyAction[] = [];
    relationshipPushUndoHistoryMap[ActionType.removeRelationship](
      undoActions,
      removeRelationshipAction({ id: 'r1' }),
      store.state
    );
    const action = changeColumns([['c1'], ['c9']], 2);

    store.dispatchSync(action);

    expect(undoActions[0].payload.start.columnIds).toEqual(['c1']);
    expect(undoActions[0].payload.end.columnIds).toEqual(['c2']);
    expect(relationship(store, 'r1')!.end.columnIds).not.toBe(
      action.payload.end.columnIds
    );
    expect(relationship(store, 'r1')!.start.columnIds).not.toBe(
      action.payload.start.columnIds
    );
  });

  it('edits a removed relationship, which the undo of the remove brings back edited', () => {
    const store = seeded();
    const undoActions: AnyAction[] = [];
    relationshipPushUndoHistoryMap[ActionType.removeRelationship](
      undoActions,
      removeRelationshipAction({ id: 'r1' }),
      store.state
    );
    store.dispatchSync(versioned(removeRelationshipAction({ id: 'r1' }), 2));

    store.dispatchSync(changeColumns([['c1'], ['c9']], 3));

    expect(store.state.doc.relationshipIds).toEqual([]);
    expect(endsOf(store)).toEqual([['c1'], ['c9']]);

    store.dispatchSync(undoActions.map(action => versioned(action, 4)));

    expect(store.state.doc.relationshipIds).toEqual(['r1']);
    expect(endsOf(store)).toEqual([['c1'], ['c9']]);
  });

  it('falls back to the clock version', () => {
    const store = seeded();
    store.context.clock.merge(11);

    store.dispatchSync(changeColumns([['c1'], ['c9']]));

    expect(store.state.lww['r1'][3]).toEqual({ columns: 11 });
    expect(endsOf(store)).toEqual([['c1'], ['c9']]);
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
