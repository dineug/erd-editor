import { AnyAction } from '@dineug/r-html';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import {
  addTableAction,
  changeTableColorAction,
  changeTableCommentAction,
  changeTableNameAction,
  changeZIndexAction,
  moveTableAction,
  moveToTableAction,
  removeTableAction,
  sortTableAction,
} from '@/engine/modules/table/atom.actions';
import { createStore, Store } from '@/engine/store';

const TABLE_A = 'table-a';
const TABLE_B = 'table-b';
const TABLE_C = 'table-c';

let store: Store;
let clock: Clock;

function versioned(action: AnyAction, version: number): AnyAction {
  return { ...action, version };
}

function addTable(id: string, version?: number) {
  const action = addTableAction({ id, ui: { x: 200, y: 100, zIndex: 2 } });
  store.dispatchSync(
    version === undefined ? action : versioned(action, version)
  );
}

function table(id: string) {
  return store.state.collections.tableEntities[id];
}

beforeEach(() => {
  clock = new Clock();
  store = createStore({ toWidth: text => text.length * 10, clock });
});

describe('table/atom.actions addTable', () => {
  it('creates the entity, registers the id and stamps the LWW add version', () => {
    store.dispatchSync(
      versioned(
        addTableAction({ id: TABLE_A, ui: { x: 11, y: 22, zIndex: 7 } }),
        3
      )
    );

    expect(store.state.doc.tableIds).toEqual([TABLE_A]);
    expect(table(TABLE_A).id).toBe(TABLE_A);
    expect(table(TABLE_A).ui).toMatchObject({ x: 11, y: 22, zIndex: 7 });
    expect(store.state.lww[TABLE_A]).toEqual(['tableEntities', 3, -1, {}]);
  });

  it('falls back to the current clock version when the action carries none', () => {
    clock.merge(9);
    store.dispatchSync(
      addTableAction({ id: TABLE_A, ui: { x: 0, y: 0, zIndex: 1 } })
    );

    expect(store.state.lww[TABLE_A][1]).toBe(9);
  });

  it('is idempotent: the entity is not replaced and the id is not duplicated', () => {
    addTable(TABLE_A, 1);
    store.dispatchSync(
      versioned(
        addTableAction({ id: TABLE_A, ui: { x: 999, y: 999, zIndex: 9 } }),
        2
      )
    );

    expect(store.state.doc.tableIds).toEqual([TABLE_A]);
    expect(table(TABLE_A).ui.x).toBe(200);
    expect(store.state.lww[TABLE_A][1]).toBe(2);
  });

  it('keeps the highest add version when an older add arrives late', () => {
    addTable(TABLE_A, 5);
    addTable(TABLE_A, 2);

    expect(store.state.lww[TABLE_A][1]).toBe(5);
  });

  it('does not re-register the id when a newer remove already won', () => {
    addTable(TABLE_A, 1);
    store.dispatchSync(versioned(removeTableAction({ id: TABLE_A }), 5));
    expect(store.state.doc.tableIds).toEqual([]);

    addTable(TABLE_A, 3);

    expect(store.state.doc.tableIds).toEqual([]);
    // the entity itself is still re-created by addOne — only the id list is
    // guarded by the LWW operator.
    expect(table(TABLE_A)).toBeDefined();
    expect(store.state.lww[TABLE_A]).toEqual(['tableEntities', 3, 5, {}]);
  });
});

describe('table/atom.actions moveTable', () => {
  it('moves every listed table and rounds to 4 decimals', () => {
    addTable(TABLE_A);
    addTable(TABLE_B);

    store.dispatchSync(
      moveTableAction({
        ids: [TABLE_A, TABLE_B],
        movementX: 10.123456789,
        movementY: -5.987654321,
      })
    );

    for (const id of [TABLE_A, TABLE_B]) {
      expect(table(id).ui.x).toBe(210.1235);
      expect(table(id).ui.y).toBe(94.0123);
    }
  });

  it('creates missing entities on the fly without registering their ids', () => {
    store.dispatchSync(
      moveTableAction({ ids: ['ghost'], movementX: 10, movementY: 20 })
    );

    expect(table('ghost')).toBeDefined();
    expect(table('ghost').ui.x).toBe(210);
    expect(table('ghost').ui.y).toBe(120);
    expect(store.state.doc.tableIds).toEqual([]);
    expect(store.state.lww.ghost).toBeUndefined();
  });

  it('accumulates repeated movements', () => {
    addTable(TABLE_A);

    store.dispatchSync(
      moveTableAction({ ids: [TABLE_A], movementX: 5, movementY: 5 })
    );
    store.dispatchSync(
      moveTableAction({ ids: [TABLE_A], movementX: -15, movementY: 10 })
    );

    expect(table(TABLE_A).ui.x).toBe(190);
    expect(table(TABLE_A).ui.y).toBe(115);
  });

  it('does nothing for an empty id list', () => {
    addTable(TABLE_A);

    store.dispatchSync(
      moveTableAction({ ids: [], movementX: 100, movementY: 100 })
    );

    expect(table(TABLE_A).ui.x).toBe(200);
  });
});

describe('table/atom.actions moveToTable', () => {
  it('sets absolute coordinates', () => {
    addTable(TABLE_A);

    store.dispatchSync(moveToTableAction({ id: TABLE_A, x: 42, y: -7 }));

    expect(table(TABLE_A).ui.x).toBe(42);
    expect(table(TABLE_A).ui.y).toBe(-7);
  });

  it('creates the entity when it is missing', () => {
    store.dispatchSync(moveToTableAction({ id: 'ghost', x: 1, y: 2 }));

    expect(table('ghost').ui).toMatchObject({ x: 1, y: 2 });
    expect(store.state.doc.tableIds).toEqual([]);
  });
});

describe('table/atom.actions removeTable', () => {
  it('unregisters the id and stamps the LWW remove version', () => {
    addTable(TABLE_A, 1);

    store.dispatchSync(versioned(removeTableAction({ id: TABLE_A }), 4));

    expect(store.state.doc.tableIds).toEqual([]);
    expect(store.state.lww[TABLE_A]).toEqual(['tableEntities', 1, 4, {}]);
    // the reducer only drops the id — the entity stays in the collection.
    expect(table(TABLE_A)).toBeDefined();
  });

  it('keeps the other ids in order', () => {
    addTable(TABLE_A, 1);
    addTable(TABLE_B, 1);
    addTable(TABLE_C, 1);

    store.dispatchSync(versioned(removeTableAction({ id: TABLE_B }), 2));

    expect(store.state.doc.tableIds).toEqual([TABLE_A, TABLE_C]);
  });

  it('is a no-op for an unknown id but still records the remove version', () => {
    store.dispatchSync(versioned(removeTableAction({ id: 'ghost' }), 6));

    expect(store.state.doc.tableIds).toEqual([]);
    expect(store.state.lww.ghost).toEqual(['tableEntities', -1, 6, {}]);
  });

  it('does not unregister the id when a newer add already won', () => {
    addTable(TABLE_A, 5);

    store.dispatchSync(versioned(removeTableAction({ id: TABLE_A }), 3));

    expect(store.state.doc.tableIds).toEqual([TABLE_A]);
    expect(store.state.lww[TABLE_A]).toEqual(['tableEntities', 5, 3, {}]);
  });

  it('uses the clock version when the action carries none', () => {
    clock.merge(12);
    addTable(TABLE_A, 1);

    store.dispatchSync(removeTableAction({ id: TABLE_A }));

    expect(store.state.doc.tableIds).toEqual([]);
    expect(store.state.lww[TABLE_A][2]).toBe(12);
  });
});

describe('table/atom.actions changeTableName', () => {
  it('sets the name and recalculates the name width', () => {
    addTable(TABLE_A);

    store.dispatchSync(
      versioned(changeTableNameAction({ id: TABLE_A, value: 'user_orders' }), 1)
    );

    expect(table(TABLE_A).name).toBe('user_orders');
    expect(table(TABLE_A).ui.widthName).toBe(110);
    expect(store.state.lww[TABLE_A][3]).toEqual({ name: 1 });
  });

  it('clamps the width to the column minimum for short names', () => {
    addTable(TABLE_A);

    store.dispatchSync(changeTableNameAction({ id: TABLE_A, value: 'ab' }));

    expect(table(TABLE_A).ui.widthName).toBe(60);
  });

  it('creates the entity when it is missing', () => {
    store.dispatchSync(changeTableNameAction({ id: 'ghost', value: 'orders' }));

    expect(table('ghost').name).toBe('orders');
    expect(store.state.doc.tableIds).toEqual([]);
  });

  it('ignores a name change carrying an older version', () => {
    addTable(TABLE_A);
    store.dispatchSync(
      versioned(changeTableNameAction({ id: TABLE_A, value: 'newer' }), 5)
    );
    store.dispatchSync(
      versioned(changeTableNameAction({ id: TABLE_A, value: 'older' }), 3)
    );

    expect(table(TABLE_A).name).toBe('newer');
    expect(store.state.lww[TABLE_A][3]).toEqual({ name: 5 });
  });

  it('applies a change carrying the same version (last writer wins)', () => {
    addTable(TABLE_A);
    store.dispatchSync(
      versioned(changeTableNameAction({ id: TABLE_A, value: 'first' }), 5)
    );
    store.dispatchSync(
      versioned(changeTableNameAction({ id: TABLE_A, value: 'second' }), 5)
    );

    expect(table(TABLE_A).name).toBe('second');
  });
});

describe('table/atom.actions changeTableComment', () => {
  it('sets the comment and recalculates the comment width', () => {
    addTable(TABLE_A);

    store.dispatchSync(
      versioned(
        changeTableCommentAction({ id: TABLE_A, value: 'a long comment' }),
        2
      )
    );

    expect(table(TABLE_A).comment).toBe('a long comment');
    expect(table(TABLE_A).ui.widthComment).toBe(140);
    expect(store.state.lww[TABLE_A][3]).toEqual({ comment: 2 });
  });

  it('clamps the width to the column minimum for an empty comment', () => {
    addTable(TABLE_A);

    store.dispatchSync(changeTableCommentAction({ id: TABLE_A, value: '' }));

    expect(table(TABLE_A).ui.widthComment).toBe(60);
  });

  it('creates the entity when it is missing and ignores older versions', () => {
    store.dispatchSync(
      versioned(changeTableCommentAction({ id: 'ghost', value: 'newer' }), 4)
    );
    store.dispatchSync(
      versioned(changeTableCommentAction({ id: 'ghost', value: 'older' }), 1)
    );

    expect(table('ghost').comment).toBe('newer');
  });
});

describe('table/atom.actions changeTableColor', () => {
  it('sets the color under the "ui.color" LWW path', () => {
    addTable(TABLE_A);

    store.dispatchSync(
      versioned(
        changeTableColorAction({
          id: TABLE_A,
          color: '#ff0000',
          prevColor: '',
        }),
        3
      )
    );

    expect(table(TABLE_A).ui.color).toBe('#ff0000');
    expect(store.state.lww[TABLE_A][3]).toEqual({ 'ui.color': 3 });
  });

  it('ignores a color change carrying an older version', () => {
    addTable(TABLE_A);
    store.dispatchSync(
      versioned(
        changeTableColorAction({ id: TABLE_A, color: '#111', prevColor: '' }),
        8
      )
    );
    store.dispatchSync(
      versioned(
        changeTableColorAction({
          id: TABLE_A,
          color: '#222',
          prevColor: '#111',
        }),
        2
      )
    );

    expect(table(TABLE_A).ui.color).toBe('#111');
  });

  it('creates the entity when it is missing', () => {
    store.dispatchSync(
      changeTableColorAction({ id: 'ghost', color: '#abc', prevColor: '' })
    );

    expect(table('ghost').ui.color).toBe('#abc');
  });
});

describe('table/atom.actions changeZIndex', () => {
  it('sets zIndex without touching the LWW register', () => {
    addTable(TABLE_A, 1);

    store.dispatchSync(changeZIndexAction({ id: TABLE_A, zIndex: 42 }));

    expect(table(TABLE_A).ui.zIndex).toBe(42);
    expect(store.state.lww[TABLE_A]).toEqual(['tableEntities', 1, -1, {}]);
  });

  it('creates the entity when it is missing', () => {
    store.dispatchSync(changeZIndexAction({ id: 'ghost', zIndex: 5 }));

    expect(table('ghost').ui.zIndex).toBe(5);
  });
});

describe('table/atom.actions sortTable', () => {
  function seedForSort() {
    addTable(TABLE_A, 1);
    addTable(TABLE_B, 1);
    addTable(TABLE_C, 1);
    // 2 / 0 / 1 columns — the entities themselves are irrelevant to the layout
    // math, only the column count is.
    table(TABLE_A).columnIds.push('c1', 'c2');
    table(TABLE_C).columnIds.push('c3');
  }

  it('lays tables out left to right ordered by column count', () => {
    seedForSort();

    store.dispatchSync(sortTableAction());

    // B (0 cols), C (1 col), A (2 cols)
    expect(table(TABLE_B).ui).toMatchObject({ x: 50, y: 50 });
    expect(table(TABLE_C).ui).toMatchObject({ x: 495, y: 50 });
    expect(table(TABLE_A).ui).toMatchObject({ x: 940, y: 50 });
  });

  it('wraps to the next row when the canvas width is exceeded', () => {
    seedForSort();
    store.state.settings.width = 600;

    store.dispatchSync(sortTableAction());

    expect(table(TABLE_B).ui).toMatchObject({ x: 50, y: 50 });
    expect(table(TABLE_C).ui).toMatchObject({ x: 50, y: 186 });
    expect(table(TABLE_A).ui).toMatchObject({ x: 50, y: 346 });
  });

  it('keeps the row height when a later table in the row is not taller', () => {
    // equal column counts -> equal heights, so the row height never grows
    addTable(TABLE_A, 1);
    addTable(TABLE_B, 1);
    addTable(TABLE_C, 1);

    store.dispatchSync(sortTableAction());

    expect(table(TABLE_A).ui).toMatchObject({ x: 50, y: 50 });
    expect(table(TABLE_B).ui).toMatchObject({ x: 495, y: 50 });
    expect(table(TABLE_C).ui).toMatchObject({ x: 940, y: 50 });
  });

  it('ignores registered ids without an entity and is a no-op when empty', () => {
    store.state.doc.tableIds.push('ghost');

    expect(() => store.dispatchSync(sortTableAction())).not.toThrow();
    expect(store.state.collections.tableEntities).toEqual({});
  });
});
