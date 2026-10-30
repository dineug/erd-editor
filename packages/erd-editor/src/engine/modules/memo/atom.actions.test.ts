import { AnyAction } from '@dineug/r-html';
import { pick } from 'es-toolkit';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { MEMO_MIN_HEIGHT, MEMO_MIN_WIDTH } from '@/constants/layout';
import { Clock } from '@/engine/clock';
import type { ReplicaEngineContext } from '@/engine/context';
import { POSITION_REGISTER, SIZE_REGISTER } from '@/engine/geometryRegisters';
import {
  addMemoAction,
  changeMemoColorAction,
  changeMemoValueAction,
  changeZIndexAction,
  moveMemoAction,
  moveToMemoAction,
  removeMemoAction,
  resizeMemoAction,
} from '@/engine/modules/memo/atom.actions';
import { createStore, Store } from '@/engine/store';
import { Tag } from '@/engine/tag';

function createTestStore(): Store {
  return createStore({ toWidth: text => text.length * 10, clock: new Clock() });
}

function at(action: AnyAction, version: number): AnyAction {
  return { ...action, version };
}

function memoOf(store: Store, id: string) {
  return store.state.collections.memoEntities[id];
}

function lwwOf(store: Store, id: string) {
  return store.state.lww[id];
}

let store: Store;

beforeEach(() => {
  store = createTestStore();
});

describe('addMemo', () => {
  it('creates the entity, registers the id and opens an lww tuple', () => {
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 5, y: 7, zIndex: 3 } })
    );

    const memo = memoOf(store, 'm1');
    expect(store.state.doc.memoIds).toEqual(['m1']);
    expect(memo.id).toBe('m1');
    expect(memo.value).toBe('');
    expect(memo.ui.x).toBe(5);
    expect(memo.ui.y).toBe(7);
    expect(memo.ui.zIndex).toBe(3);
    expect(memo.ui.width).toBe(MEMO_MIN_WIDTH);
    expect(memo.ui.height).toBe(MEMO_MIN_HEIGHT);
    expect(lwwOf(store, 'm1')).toEqual(['memoEntities', 0, -1, {}]);
  });

  it('uses the explicit action version when one is provided', () => {
    store.dispatchSync(
      at(addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 2 } }), 7)
    );

    expect(lwwOf(store, 'm1')[1]).toBe(7);
  });

  it('falls back to the clock version when the action carries none', () => {
    store.context.clock.merge(9);

    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 2 } })
    );

    expect(lwwOf(store, 'm1')[1]).toBe(9);
  });

  it('is idempotent: a second add neither replaces the entity nor duplicates the id', () => {
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 5, y: 7, zIndex: 3 } })
    );
    store.dispatchSync(
      at(addMemoAction({ id: 'm1', ui: { x: 99, y: 99, zIndex: 9 } }), 4)
    );

    expect(store.state.doc.memoIds).toEqual(['m1']);
    expect(memoOf(store, 'm1').ui.x).toBe(5);
    expect(lwwOf(store, 'm1')[1]).toBe(4);
  });

  it('does not re-register an id that was already removed at a newer version', () => {
    store.dispatchSync(at(removeMemoAction({ id: 'm1' }), 5));
    store.dispatchSync(
      at(addMemoAction({ id: 'm1', ui: { x: 1, y: 2, zIndex: 2 } }), 3)
    );

    expect(store.state.doc.memoIds).toEqual([]);
    expect(memoOf(store, 'm1')).toBeDefined();
    expect(lwwOf(store, 'm1')).toEqual(['memoEntities', 3, 5, {}]);
  });
});

describe('moveMemo', () => {
  it('shifts every listed memo and rounds to 4 decimals', () => {
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 10, y: 20, zIndex: 2 } }),
      addMemoAction({ id: 'm2', ui: { x: 0, y: 0, zIndex: 2 } })
    );

    store.dispatchSync(
      moveMemoAction({
        ids: ['m1', 'm2'],
        movementX: 1.123456,
        movementY: -2.5,
      })
    );

    expect(memoOf(store, 'm1').ui.x).toBe(11.1235);
    expect(memoOf(store, 'm1').ui.y).toBe(17.5);
    expect(memoOf(store, 'm2').ui.x).toBe(1.1235);
    expect(memoOf(store, 'm2').ui.y).toBe(-2.5);
  });

  it('creates missing memos at the default point before moving them', () => {
    store.dispatchSync(
      moveMemoAction({ ids: ['ghost'], movementX: 10, movementY: 5 })
    );

    const memo = memoOf(store, 'ghost');
    expect(memo).toBeDefined();
    expect(memo.ui.x).toBe(210);
    expect(memo.ui.y).toBe(105);
    expect(store.state.doc.memoIds).toEqual([]);
  });

  it('is a no-op for an empty id list', () => {
    store.dispatchSync(
      moveMemoAction({ ids: [], movementX: 10, movementY: 10 })
    );

    expect(store.state.collections.memoEntities).toEqual({});
  });
});

describe('moveToMemo', () => {
  it('sets an absolute position', () => {
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 10, y: 20, zIndex: 2 } })
    );

    store.dispatchSync(moveToMemoAction({ id: 'm1', x: -4, y: 88 }));

    expect(memoOf(store, 'm1').ui.x).toBe(-4);
    expect(memoOf(store, 'm1').ui.y).toBe(88);
  });

  it('creates the memo when it does not exist yet', () => {
    store.dispatchSync(moveToMemoAction({ id: 'ghost', x: 1, y: 2 }));

    expect(memoOf(store, 'ghost').ui).toMatchObject({ x: 1, y: 2 });
  });
});

describe('memo position register', () => {
  const position = () => pick(memoOf(store, 'm1').ui, ['x', 'y']);
  const register = () => lwwOf(store, 'm1')?.[3][POSITION_REGISTER];

  beforeEach(() => {
    store.dispatchSync(
      at(addMemoAction({ id: 'm1', ui: { x: 10, y: 20, zIndex: 2 } }), 1)
    );
  });

  it('lands the same absolute move twice as once, and refuses an older one (AC-M1)', () => {
    const moveTo = at(moveToMemoAction({ id: 'm1', x: 40, y: 60 }), 5);

    store.dispatchSync(moveTo);
    store.dispatchSync(moveTo);
    store.dispatchSync(at(moveToMemoAction({ id: 'm1', x: -1, y: -1 }), 4));

    expect(position()).toEqual({ x: 40, y: 60 });
    expect(register()).toBe(5);
  });

  it('raises the register with the store’s own step', () => {
    store.dispatchSync(
      at(moveMemoAction({ ids: ['m1'], movementX: 5, movementY: 5 }), 7)
    );
    store.dispatchSync(at(moveToMemoAction({ id: 'm1', x: 0, y: 0 }), 6));

    expect(position()).toEqual({ x: 15, y: 25 });
    expect(register()).toBe(7);
  });

  it('adds a peer’s step and a replica’s outside the register', () => {
    store.dispatchSync({
      ...at(moveMemoAction({ ids: ['m1'], movementX: 5, movementY: 5 }), 7),
      tags: Tag.shared,
    });
    expect(position()).toEqual({ x: 15, y: 25 });
    expect(register()).toBeUndefined();

    const replicaContext: ReplicaEngineContext = {
      toWidth: text => text.length * 10,
      clock: new Clock(),
      remote: true,
    };
    store = createStore(replicaContext);
    store.dispatchSync(
      at(addMemoAction({ id: 'm1', ui: { x: 10, y: 20, zIndex: 2 } }), 1)
    );
    store.dispatchSync(
      at(moveMemoAction({ ids: ['m1'], movementX: 5, movementY: 5 }), 7)
    );

    expect(position()).toEqual({ x: 15, y: 25 });
    expect(register()).toBeUndefined();
  });
});

describe('removeMemo', () => {
  it('unregisters the id from the document', () => {
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 2 } })
    );

    store.dispatchSync(at(removeMemoAction({ id: 'm1' }), 1));

    expect(store.state.doc.memoIds).toEqual([]);
    expect(lwwOf(store, 'm1')).toEqual(['memoEntities', 0, 1, {}]);
  });

  it('leaves the entity itself in the collection (tombstone by id only)', () => {
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 2 } })
    );

    store.dispatchSync(at(removeMemoAction({ id: 'm1' }), 1));

    expect(memoOf(store, 'm1')).toBeDefined();
  });

  it('removes when the add and remove versions are equal', () => {
    store.dispatchSync(
      at(addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 2 } }), 5)
    );

    store.dispatchSync(at(removeMemoAction({ id: 'm1' }), 5));

    expect(store.state.doc.memoIds).toEqual([]);
    expect(lwwOf(store, 'm1')).toEqual(['memoEntities', 5, 5, {}]);
  });

  it('ignores a remove that is older than the add', () => {
    store.dispatchSync(
      at(addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 2 } }), 5)
    );

    store.dispatchSync(at(removeMemoAction({ id: 'm1' }), 3));

    expect(store.state.doc.memoIds).toEqual(['m1']);
    expect(lwwOf(store, 'm1')).toEqual(['memoEntities', 5, 3, {}]);
  });

  it('only opens a tombstone tuple for an unknown id', () => {
    store.dispatchSync(at(removeMemoAction({ id: 'nope' }), 2));

    expect(store.state.doc.memoIds).toEqual([]);
    expect(lwwOf(store, 'nope')).toEqual(['memoEntities', -1, 2, {}]);
  });

  it('keeps sibling ids intact when removing from the middle', () => {
    store.dispatchSync(
      addMemoAction({ id: 'a', ui: { x: 0, y: 0, zIndex: 2 } }),
      addMemoAction({ id: 'b', ui: { x: 0, y: 0, zIndex: 2 } }),
      addMemoAction({ id: 'c', ui: { x: 0, y: 0, zIndex: 2 } })
    );

    store.dispatchSync(at(removeMemoAction({ id: 'b' }), 1));

    expect(store.state.doc.memoIds).toEqual(['a', 'c']);
  });
});

describe('changeMemoValue', () => {
  it('replaces the value and records the "value" path version', () => {
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 2 } })
    );

    store.dispatchSync(at(changeMemoValueAction({ id: 'm1', value: 'hi' }), 3));

    expect(memoOf(store, 'm1').value).toBe('hi');
    expect(lwwOf(store, 'm1')[3]).toEqual({ value: 3 });
  });

  it('creates the memo when it is unknown', () => {
    store.dispatchSync(changeMemoValueAction({ id: 'ghost', value: 'hi' }));

    expect(memoOf(store, 'ghost').value).toBe('hi');
    expect(store.state.doc.memoIds).toEqual([]);
  });

  it('accepts a write at the same version (last write wins)', () => {
    store.dispatchSync(at(changeMemoValueAction({ id: 'm1', value: 'a' }), 4));
    store.dispatchSync(at(changeMemoValueAction({ id: 'm1', value: 'b' }), 4));

    expect(memoOf(store, 'm1').value).toBe('b');
    expect(lwwOf(store, 'm1')[3]).toEqual({ value: 4 });
  });

  it('rejects a write that is older than the recorded path version', () => {
    store.dispatchSync(
      at(changeMemoValueAction({ id: 'm1', value: 'new' }), 5)
    );
    store.dispatchSync(
      at(changeMemoValueAction({ id: 'm1', value: 'old' }), 3)
    );

    expect(memoOf(store, 'm1').value).toBe('new');
    expect(lwwOf(store, 'm1')[3]).toEqual({ value: 5 });
  });
});

describe('changeMemoColor', () => {
  it('replaces ui.color and records the "ui.color" path version', () => {
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 2 } })
    );

    store.dispatchSync(
      at(changeMemoColorAction({ id: 'm1', color: '#fff', prevColor: '' }), 2)
    );

    expect(memoOf(store, 'm1').ui.color).toBe('#fff');
    expect(lwwOf(store, 'm1')[3]).toEqual({ 'ui.color': 2 });
  });

  it('ignores the prevColor payload entirely', () => {
    store.dispatchSync(
      changeMemoColorAction({ id: 'm1', color: '#123', prevColor: '#999' })
    );

    expect(memoOf(store, 'm1').ui.color).toBe('#123');
  });

  it('rejects a stale color write', () => {
    store.dispatchSync(
      at(changeMemoColorAction({ id: 'm1', color: '#new', prevColor: '' }), 6)
    );
    store.dispatchSync(
      at(changeMemoColorAction({ id: 'm1', color: '#old', prevColor: '' }), 1)
    );

    expect(memoOf(store, 'm1').ui.color).toBe('#new');
  });
});

describe('resizeMemo', () => {
  it('writes position and size at once, each through its register', () => {
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 2 } })
    );

    store.dispatchSync(
      at(resizeMemoAction({ id: 'm1', x: 3, y: 4, width: 300, height: 200 }), 6)
    );

    expect(memoOf(store, 'm1').ui).toMatchObject({
      x: 3,
      y: 4,
      width: 300,
      height: 200,
    });
    expect(lwwOf(store, 'm1')[3]).toEqual({
      [POSITION_REGISTER]: 6,
      [SIZE_REGISTER]: 6,
    });
  });

  it('keeps a newer move’s point and takes its own size from an older resize, whichever arrives first (AC-P5)', () => {
    const moveTo = at(moveToMemoAction({ id: 'm1', x: 90, y: 80 }), 7);
    const resize = at(
      resizeMemoAction({ id: 'm1', x: 3, y: 4, width: 300, height: 200 }),
      6
    );

    for (const order of [
      [moveTo, resize],
      [resize, moveTo],
    ]) {
      store = createTestStore();
      store.dispatchSync(
        addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 2 } })
      );
      order.forEach(action => store.dispatchSync(action));

      expect(memoOf(store, 'm1').ui).toMatchObject({
        x: 90,
        y: 80,
        width: 300,
        height: 200,
      });
    }
  });

  it('creates the memo when it is unknown', () => {
    store.dispatchSync(
      resizeMemoAction({ id: 'ghost', x: 1, y: 1, width: 10, height: 20 })
    );

    expect(memoOf(store, 'ghost').ui).toMatchObject({ width: 10, height: 20 });
  });
});

describe('changeZIndex', () => {
  it('updates only the zIndex', () => {
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 8, y: 9, zIndex: 2 } })
    );

    store.dispatchSync(changeZIndexAction({ id: 'm1', zIndex: 42 }));

    expect(memoOf(store, 'm1').ui.zIndex).toBe(42);
    expect(memoOf(store, 'm1').ui.x).toBe(8);
    expect(memoOf(store, 'm1').ui.y).toBe(9);
  });

  it('creates the memo when it is unknown', () => {
    store.dispatchSync(changeZIndexAction({ id: 'ghost', zIndex: 11 }));

    expect(memoOf(store, 'ghost').ui.zIndex).toBe(11);
  });
});
