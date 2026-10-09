import { AnyAction } from '@dineug/r-html';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import {
  addTableGroupAction,
  changeTableGroupColorAction,
  changeTableGroupNameAction,
  changeTableGroupZIndexAction,
  moveTableGroupAction,
  moveToTableGroupAction,
  removeTableGroupAction,
  resizeTableGroupAction,
} from '@/engine/modules/table-group/atom.actions';
import { createStore, Store } from '@/engine/store';

const UI = { x: 10, y: 20, width: 300, height: 200, zIndex: 2 };

function createTestStore(): Store {
  return createStore({ toWidth: text => text.length * 10, clock: new Clock() });
}

function at(action: AnyAction, version: number): AnyAction {
  return { ...action, version };
}

function groupOf(store: Store, id: string) {
  return store.state.collections.tableGroupEntities[id];
}

function lwwOf(store: Store, id: string) {
  return store.state.lww[id];
}

let store: Store;

beforeEach(() => {
  store = createTestStore();
});

describe('addTableGroup', () => {
  it('creates the entity with its rect, registers the id and opens an lww tuple', () => {
    store.dispatchSync(addTableGroupAction({ id: 'g1', ui: UI }));

    const group = groupOf(store, 'g1');
    expect(store.state.doc.tableGroupIds).toEqual(['g1']);
    expect(group.name).toBe('');
    expect(group.color).toBe('');
    expect(group.ui).toEqual(UI);
    expect(lwwOf(store, 'g1')).toEqual(['tableGroupEntities', 0, -1, {}]);
  });

  it('takes the color the add carries', () => {
    store.dispatchSync(
      addTableGroupAction({ id: 'g1', color: '#0090ff', ui: UI })
    );

    expect(groupOf(store, 'g1').color).toBe('#0090ff');
  });

  it('is idempotent: a second add neither replaces the entity nor duplicates the id', () => {
    store.dispatchSync(addTableGroupAction({ id: 'g1', ui: UI }));
    store.dispatchSync(
      at(addTableGroupAction({ id: 'g1', ui: { ...UI, x: 99 } }), 4)
    );

    expect(store.state.doc.tableGroupIds).toEqual(['g1']);
    expect(groupOf(store, 'g1').ui.x).toBe(10);
    expect(lwwOf(store, 'g1')[1]).toBe(4);
  });

  it('does not list an id removed at a newer version, whatever order the two arrive in', () => {
    store.dispatchSync(at(removeTableGroupAction({ id: 'g1' }), 5));
    store.dispatchSync(at(addTableGroupAction({ id: 'g1', ui: UI }), 3));

    expect(store.state.doc.tableGroupIds).toEqual([]);
    expect(groupOf(store, 'g1')).toBeDefined();
    expect(lwwOf(store, 'g1')).toEqual(['tableGroupEntities', 3, 5, {}]);
  });

  it('lists an id again once an add newer than its removal arrives', () => {
    store.dispatchSync(at(addTableGroupAction({ id: 'g1', ui: UI }), 1));
    store.dispatchSync(at(removeTableGroupAction({ id: 'g1' }), 2));
    store.dispatchSync(at(addTableGroupAction({ id: 'g1', ui: UI }), 3));

    expect(store.state.doc.tableGroupIds).toEqual(['g1']);
  });

  it('falls back to the clock version when the action carries none', () => {
    store.context.clock.merge(9);

    store.dispatchSync(addTableGroupAction({ id: 'g1', ui: UI }));

    expect(lwwOf(store, 'g1')[1]).toBe(9);
  });
});

describe('removeTableGroup', () => {
  it('unlists the id and keeps the entity as a tombstone', () => {
    store.dispatchSync(at(addTableGroupAction({ id: 'g1', ui: UI }), 1));
    store.dispatchSync(at(removeTableGroupAction({ id: 'g1' }), 2));

    expect(store.state.doc.tableGroupIds).toEqual([]);
    expect(groupOf(store, 'g1')).toBeDefined();
    expect(lwwOf(store, 'g1')).toEqual(['tableGroupEntities', 1, 2, {}]);
  });

  it('leaves the id listed when the add it meets is newer', () => {
    store.dispatchSync(at(addTableGroupAction({ id: 'g1', ui: UI }), 5));
    store.dispatchSync(at(removeTableGroupAction({ id: 'g1' }), 3));

    expect(store.state.doc.tableGroupIds).toEqual(['g1']);
  });

  it('falls back to the clock version and ignores an unknown id in the list', () => {
    store.context.clock.merge(4);

    store.dispatchSync(removeTableGroupAction({ id: 'ghost' }));

    expect(store.state.doc.tableGroupIds).toEqual([]);
    expect(lwwOf(store, 'ghost')[2]).toBe(4);
  });
});

describe('moveTableGroup', () => {
  it('shifts every listed group by the step and rounds to 4 decimals', () => {
    store.dispatchSync(
      addTableGroupAction({ id: 'g1', ui: UI }),
      addTableGroupAction({ id: 'g2', ui: { ...UI, x: 0, y: 0 } })
    );

    store.dispatchSync(
      moveTableGroupAction({
        ids: ['g1', 'g2'],
        movementX: 1.123456,
        movementY: -2.5,
      })
    );

    expect(groupOf(store, 'g1').ui).toMatchObject({ x: 11.1235, y: 17.5 });
    expect(groupOf(store, 'g2').ui).toMatchObject({ x: 1.1235, y: -2.5 });
  });

  it('adds up concurrent steps whatever their versions, a move being relative', () => {
    store.dispatchSync(addTableGroupAction({ id: 'g1', ui: UI }));

    store.dispatchSync(
      at(moveTableGroupAction({ ids: ['g1'], movementX: 5, movementY: 0 }), 9)
    );
    store.dispatchSync(
      at(moveTableGroupAction({ ids: ['g1'], movementX: 0, movementY: 7 }), 2)
    );

    expect(groupOf(store, 'g1').ui).toMatchObject({ x: 15, y: 27 });
  });

  it('creates a group it has not seen at the default rect before moving it', () => {
    store.dispatchSync(
      moveTableGroupAction({ ids: ['ghost'], movementX: 10, movementY: 10 })
    );

    expect(groupOf(store, 'ghost').ui).toMatchObject({ x: 210, y: 110 });
    expect(store.state.doc.tableGroupIds).toEqual([]);
  });
});

describe('moveToTableGroup', () => {
  it('places the group at the point and keeps its size', () => {
    store.dispatchSync(addTableGroupAction({ id: 'g1', ui: UI }));

    store.dispatchSync(moveToTableGroupAction({ id: 'g1', x: -50, y: 75 }));

    expect(groupOf(store, 'g1').ui).toEqual({ ...UI, x: -50, y: 75 });
  });

  it('creates a group it has not seen', () => {
    store.dispatchSync(moveToTableGroupAction({ id: 'ghost', x: 1, y: 2 }));

    expect(groupOf(store, 'ghost').ui).toMatchObject({ x: 1, y: 2 });
  });
});

describe('resizeTableGroup', () => {
  it('writes the whole rect', () => {
    store.dispatchSync(addTableGroupAction({ id: 'g1', ui: UI }));

    store.dispatchSync(
      resizeTableGroupAction({ id: 'g1', x: 0, y: 5, width: 640, height: 480 })
    );

    expect(groupOf(store, 'g1').ui).toEqual({
      x: 0,
      y: 5,
      width: 640,
      height: 480,
      zIndex: 2,
    });
  });

  it('creates a group it has not seen', () => {
    store.dispatchSync(
      resizeTableGroupAction({ id: 'ghost', x: 1, y: 2, width: 3, height: 4 })
    );

    expect(groupOf(store, 'ghost').ui).toMatchObject({ width: 3, height: 4 });
  });
});

describe('changeTableGroupName', () => {
  it('writes the name through the name register', () => {
    store.dispatchSync(addTableGroupAction({ id: 'g1', ui: UI }));

    store.dispatchSync(
      at(changeTableGroupNameAction({ id: 'g1', value: 'billing' }), 3)
    );

    expect(groupOf(store, 'g1').name).toBe('billing');
    expect(lwwOf(store, 'g1')[3]).toEqual({ name: 3 });
  });

  it('keeps the newer name whatever order two writes arrive in', () => {
    store.dispatchSync(addTableGroupAction({ id: 'g1', ui: UI }));

    store.dispatchSync(
      at(changeTableGroupNameAction({ id: 'g1', value: 'newer' }), 8)
    );
    store.dispatchSync(
      at(changeTableGroupNameAction({ id: 'g1', value: 'older' }), 5)
    );

    expect(groupOf(store, 'g1').name).toBe('newer');
    expect(lwwOf(store, 'g1')[3]).toEqual({ name: 8 });
  });

  it('lets a write of the same version land, as every register does', () => {
    store.dispatchSync(
      at(changeTableGroupNameAction({ id: 'g1', value: 'first' }), 4),
      at(changeTableGroupNameAction({ id: 'g1', value: 'second' }), 4)
    );

    expect(groupOf(store, 'g1').name).toBe('second');
  });

  it('creates a group it has not seen and falls back to the clock version', () => {
    store.context.clock.merge(6);

    store.dispatchSync(changeTableGroupNameAction({ id: 'ghost', value: 'x' }));

    expect(groupOf(store, 'ghost').name).toBe('x');
    expect(lwwOf(store, 'ghost')[3]).toEqual({ name: 6 });
  });
});

describe('changeTableGroupColor', () => {
  it('writes the color through its own register, apart from the name', () => {
    store.dispatchSync(addTableGroupAction({ id: 'g1', ui: UI }));

    store.dispatchSync(
      at(changeTableGroupNameAction({ id: 'g1', value: 'billing' }), 9),
      at(
        changeTableGroupColorAction({
          id: 'g1',
          color: '#ff8800',
          prevColor: '',
        }),
        3
      )
    );

    expect(groupOf(store, 'g1').color).toBe('#ff8800');
    expect(lwwOf(store, 'g1')[3]).toEqual({ name: 9, color: 3 });
  });

  it('refuses a color older than the one it holds', () => {
    store.dispatchSync(
      at(
        changeTableGroupColorAction({
          id: 'g1',
          color: '#111111',
          prevColor: '',
        }),
        7
      ),
      at(
        changeTableGroupColorAction({
          id: 'g1',
          color: '#222222',
          prevColor: '#111111',
        }),
        6
      )
    );

    expect(groupOf(store, 'g1').color).toBe('#111111');
  });

  it('falls back to the clock version when the action carries none', () => {
    store.context.clock.merge(2);

    store.dispatchSync(
      changeTableGroupColorAction({ id: 'g1', color: '#123456', prevColor: '' })
    );

    expect(lwwOf(store, 'g1')[3]).toEqual({ color: 2 });
  });
});

describe('changeTableGroupZIndex', () => {
  it('writes the zIndex as given, through no register', () => {
    store.dispatchSync(addTableGroupAction({ id: 'g1', ui: UI }));

    store.dispatchSync(changeTableGroupZIndexAction({ id: 'g1', zIndex: 12 }));

    expect(groupOf(store, 'g1').ui.zIndex).toBe(12);
    expect(lwwOf(store, 'g1')[3]).toEqual({});
  });

  it('creates a group it has not seen', () => {
    store.dispatchSync(
      changeTableGroupZIndexAction({ id: 'ghost', zIndex: 3 })
    );

    expect(groupOf(store, 'ghost').ui.zIndex).toBe(3);
  });
});
