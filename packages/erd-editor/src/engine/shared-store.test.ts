import { AnyAction } from '@dineug/r-html';
import {
  afterEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vite-plus/test';

import type { ErdEditorElement } from '@/components/erd-editor/ErdEditor';
import { RelationshipType } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { EngineContext } from '@/engine/context';
import { getLWWAction } from '@/engine/modules/editor/atom.actions';
import { duplicateAction$ } from '@/engine/modules/editor/generator.actions';
import { addIndexAction } from '@/engine/modules/index/atom.actions';
import { addIndexColumnAction } from '@/engine/modules/index-column/atom.actions';
import {
  addMemoAction,
  resizeMemoAction,
} from '@/engine/modules/memo/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { changeZoomLevelAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableColorAction,
} from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import { createRxStore, RxStore } from '@/engine/rx-store';
import {
  createSharedStore,
  SharedStore,
  SharedStoreConfig,
  SharedStoreInternalOptions,
} from '@/engine/shared-store';
import { Tag } from '@/engine/tag';
import { bHas } from '@/utils/bit';

type Fixture = {
  store: RxStore;
  shared: SharedStore;
  seen: Array<Array<AnyAction>>;
  types: () => string[];
  reset: () => void;
};

const created: Array<{ store: RxStore; shared: SharedStore }> = [];

const addTable = (id: string) =>
  addTableAction({ id, ui: { x: 200, y: 100, zIndex: 2 } });

function createContext(): EngineContext {
  return {
    toWidth: (text: string) => text.length * 10,
    clock: new Clock(),
  };
}

function make(config?: Parameters<typeof createSharedStore>[1]): Fixture {
  const store = createRxStore(createContext());
  const shared = createSharedStore(store, config);
  created.push({ store, shared });
  const seen: Array<Array<AnyAction>> = [];

  return {
    store,
    shared,
    seen,
    types: () => seen.flat().map(action => action.type),
    reset: () => {
      seen.length = 0;
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  while (created.length) {
    const entry = created.pop();
    try {
      entry?.shared.destroy();
    } catch {
      // already destroyed by the test
    }
    // a shared store only borrows the editor store, so it never tears it down
    try {
      entry?.store.destroy();
    } catch {
      // already destroyed by the test
    }
  }
});

describe('createSharedStore', () => {
  it('exposes a frozen surface', () => {
    const { shared } = make();

    expect(Object.isFrozen(shared)).toBe(true);
    expect(typeof shared.connection).toBe('function');
    expect(typeof shared.disconnect).toBe('function');
    expect(typeof shared.subscribe).toBe('function');
  });

  it('requests the remote LWW register on the first subscribe only', () => {
    const fixture = make();
    const first: Array<Array<AnyAction>> = [];
    const second: Array<Array<AnyAction>> = [];

    fixture.shared.subscribe(actions => first.push(actions));
    expect(first.flat().map(action => action.type)).toEqual(['editor.getLWW']);

    fixture.shared.subscribe(actions => second.push(actions));
    expect(second).toHaveLength(0);
  });

  it('broadcasts store actions tagged as shared with the editor meta', () => {
    const fixture = make({ getNickname: () => 'nick' });
    fixture.shared.subscribe(actions => fixture.seen.push(actions));
    fixture.reset();

    fixture.store.dispatchSync(addTable('t1'));

    const action = fixture.seen.flat().find(a => a.type === 'table.add');
    expect(action).toBeTruthy();
    expect(bHas(action!.tags!, Tag.shared)).toBe(true);
    expect(bHas(action!.tags!, Tag.following)).toBe(false);
    expect(action!.meta).toMatchObject({
      editorId: fixture.store.state.editor.id,
      nickname: 'nick',
    });
  });

  it('leaves the nickname undefined when no resolver is configured', () => {
    const fixture = make();
    fixture.shared.subscribe(actions => fixture.seen.push(actions));
    fixture.reset();

    fixture.store.dispatchSync(addTable('t1'));

    const action = fixture.seen.flat().find(a => a.type === 'table.add');
    expect(action!.meta?.nickname).toBeUndefined();
  });

  it('adds the following tag to viewport-following actions', () => {
    const fixture = make();
    fixture.shared.subscribe(actions => fixture.seen.push(actions));
    fixture.reset();

    fixture.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));

    const action = fixture.seen
      .flat()
      .find(a => a.type === 'settings.changeZoomLevel');
    expect(action).toBeTruthy();
    expect(bHas(action!.tags!, Tag.following)).toBe(true);
    expect(bHas(action!.tags!, Tag.shared)).toBe(true);
  });

  it('ignores actions that are already tagged shared', () => {
    const fixture = make();
    fixture.shared.subscribe(actions => fixture.seen.push(actions));
    fixture.reset();

    fixture.store.dispatchSync({
      ...addTable('t1'),
      tags: Tag.shared,
    });

    expect(fixture.store.state.doc.tableIds).toEqual(['t1']);
    expect(fixture.seen).toHaveLength(0);
  });

  it('ignores actions that are not shareable', () => {
    const fixture = make();
    fixture.shared.subscribe(actions => fixture.seen.push(actions));
    fixture.reset();

    fixture.store.dispatchSync({ type: 'editor.selectAll', payload: {} });

    expect(fixture.seen).toHaveLength(0);
  });

  it('broadcasts a duplicate as entity actions, without the selection framing', () => {
    const fixture = make();
    fixture.store.dispatchSync(addTable('t1'));
    fixture.shared.subscribe(actions => fixture.seen.push(actions));
    fixture.reset();

    fixture.store.dispatchSync(
      duplicateAction$({
        tableIds: ['t1'],
        memoIds: [],
        offset: { x: 50, y: 50 },
        escapeCollision: true,
      })
    );

    const types = fixture.types();
    expect(types).toContain('table.add');
    expect(types).toContain('table.changeName');
    // Selection is local: a peer pasting must not move anyone else's cursor.
    expect(types).not.toContain('editor.select');
    expect(types).not.toContain('editor.unselectAll');
    expect(types).not.toContain('editor.focusTableEnd');
  });

  it('broadcasts the duplicated relationship and indexes', () => {
    const fixture = make();
    fixture.store.dispatchSync(addTable('t1'));
    fixture.store.dispatchSync(addColumnAction({ id: 'c1', tableId: 't1' }));
    fixture.store.dispatchSync(addColumnAction({ id: 'c2', tableId: 't1' }));
    fixture.store.dispatchSync(
      addRelationshipAction({
        id: 'r1',
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: 't1', columnIds: ['c1'] },
        end: { tableId: 't1', columnIds: ['c2'] },
      })
    );
    fixture.store.dispatchSync(addIndexAction({ id: 'i1', tableId: 't1' }));
    fixture.store.dispatchSync(
      addIndexColumnAction({
        id: 'ic1',
        indexId: 'i1',
        tableId: 't1',
        columnId: 'c1',
      })
    );
    fixture.shared.subscribe(actions => fixture.seen.push(actions));
    fixture.reset();

    fixture.store.dispatchSync(
      duplicateAction$({
        tableIds: ['t1'],
        memoIds: [],
        offset: { x: 50, y: 50 },
        escapeCollision: true,
      })
    );

    const types = fixture.types();
    expect(types).toContain('relationship.add');
    expect(types).toContain('index.add');
    expect(types).toContain('indexColumn.add');
    expect(types).not.toContain('editor.select');
    expect(types).not.toContain('editor.unselectAll');
    expect(types).not.toContain('editor.focusTableEnd');
  });

  it('carries the duplicate colour on the add payload rather than a change action', () => {
    const fixture = make();
    fixture.store.dispatchSync(
      addTableAction({
        id: 't1',
        ui: { x: 200, y: 100, zIndex: 2, color: '#ff0000' },
      })
    );
    fixture.shared.subscribe(actions => fixture.seen.push(actions));
    fixture.reset();

    fixture.store.dispatchSync(
      duplicateAction$({
        tableIds: ['t1'],
        memoIds: [],
        offset: { x: 50, y: 50 },
        escapeCollision: true,
      })
    );

    // table.changeColor is a stream action; sending one here would reach the
    // peer as a second, debounced command and cost them an extra undo.
    expect(fixture.types()).not.toContain('table.changeColor');
    const add = fixture.seen
      .flat()
      .find(action => action.type === 'table.add') as any;
    expect(add.payload.ui.color).toBe('#ff0000');
  });

  describe('circuit breaker', () => {
    it('buffers actions produced before the first subscriber arrives', () => {
      const fixture = make();

      fixture.store.dispatchSync(addTable('t1'));
      fixture.shared.subscribe(actions => fixture.seen.push(actions));

      expect(fixture.types()).toEqual(['table.add', 'editor.getLWW']);
    });

    it('buffers while disconnected and flushes on reconnect', () => {
      const fixture = make();
      fixture.shared.subscribe(actions => fixture.seen.push(actions));
      fixture.reset();

      fixture.shared.disconnect();
      fixture.store.dispatchSync(addTable('t1'));
      expect(fixture.seen).toHaveLength(0);

      fixture.shared.connection();
      expect(fixture.types()).toEqual(['table.add']);
    });

    it('stops delivering once the last subscriber unsubscribes', () => {
      const fixture = make();
      const off = fixture.shared.subscribe(actions =>
        fixture.seen.push(actions)
      );
      fixture.reset();

      off();
      fixture.store.dispatchSync(addTable('t1'));

      expect(fixture.seen).toHaveLength(0);
      expect(fixture.store.state.doc.tableIds).toEqual(['t1']);
    });
  });

  describe('dispatch', () => {
    it('dispatchSync forwards to the underlying store', () => {
      const fixture = make();

      fixture.shared.dispatchSync(addTable('t1'));

      expect(fixture.store.state.doc.tableIds).toEqual(['t1']);
    });

    it('dispatch forwards asynchronously', async () => {
      const fixture = make();

      fixture.shared.dispatch(addTable('t1'));
      expect(fixture.store.state.doc.tableIds).toEqual([]);

      await Promise.resolve();
      await Promise.resolve();
      expect(fixture.store.state.doc.tableIds).toEqual(['t1']);
    });

    it('answers a remote getLWW with the local LWW register', () => {
      const fixture = make();
      fixture.shared.subscribe(actions => fixture.seen.push(actions));
      fixture.store.dispatchSync(addTable('t1'));
      fixture.reset();

      fixture.shared.dispatchSync(getLWWAction());

      const merge = fixture.seen
        .flat()
        .find(action => action.type === 'editor.mergeLWW');
      expect(merge).toBeTruthy();
      expect(Object.keys(merge!.payload.lww)).toContain('t1');
      expect(merge!.version).toBe(fixture.store.context.clock.getVersion());
    });

    it('answers a remote getLWW passed as an array', () => {
      const fixture = make();
      fixture.shared.subscribe(actions => fixture.seen.push(actions));
      fixture.store.dispatchSync(addTable('t1'));
      fixture.reset();

      fixture.shared.dispatch([getLWWAction()]);

      expect(fixture.types()).toContain('editor.mergeLWW');
    });

    it('does not answer getLWW when the register is empty', () => {
      const fixture = make();
      fixture.shared.subscribe(actions => fixture.seen.push(actions));
      fixture.reset();

      fixture.shared.dispatchSync(getLWWAction());

      expect(fixture.types()).toEqual(['editor.getLWW']);
    });

    it('does not answer when the action is not getLWW', () => {
      const fixture = make();
      fixture.shared.subscribe(actions => fixture.seen.push(actions));
      fixture.store.dispatchSync(addTable('t1'));
      fixture.reset();

      fixture.shared.dispatchSync(addTable('t2'));

      expect(fixture.types()).toEqual(['table.add']);
    });
  });

  it('compresses shared mouse tracker streams', () => {
    vi.useFakeTimers();
    const fixture = make();
    fixture.shared.subscribe(actions => fixture.seen.push(actions));
    fixture.reset();

    const track = (x: number) =>
      fixture.store.dispatchSync({
        type: 'editor.sharedMouseTracker',
        payload: { x, y: x },
        meta: { editorId: 'remote' },
      });

    // leading emission of the 100ms throttle window
    track(1);
    // throttled: buffered until the trailing edge closes the window
    track(2);
    track(3);
    vi.advanceTimersByTime(150);
    track(4);
    vi.advanceTimersByTime(150);

    const trackers = fixture.seen
      .flat()
      .filter(action => action.type === 'editor.sharedMouseTracker');
    expect(trackers.map(action => action.payload.x)).toEqual([1, 3, 4]);
  });

  it('destroy tears down its own subscriptions and leaves the borrowed store alive', () => {
    const fixture = make();
    fixture.shared.subscribe(actions => fixture.seen.push(actions));
    fixture.reset();

    fixture.shared.destroy();
    fixture.store.dispatchSync(addTable('t1'));

    expect(fixture.seen).toHaveLength(0);
    expect(fixture.store.state.doc.tableIds).toEqual(['t1']);
  });
});

/** A store pair built the way a headless peer builds it, with manual stream flushing. */
function makeManual(): Fixture {
  const store = createRxStore(createContext(), { manualStreamFlush: true });
  const shared = createSharedStore(store, undefined, {
    manualStreamFlush: true,
  });
  created.push({ store, shared });
  const seen: Array<Array<AnyAction>> = [];

  return {
    store,
    shared,
    seen,
    types: () => seen.flat().map(action => action.type),
    reset: () => {
      seen.length = 0;
    },
  };
}

describe('createSharedStore stream flushing', () => {
  const recolor = (color: string, prevColor: string) =>
    changeTableColorAction({ id: 't1', color, prevColor });

  it('keeps each compressor settling for 200 ms without the flag, unless flushStreamBuffers sends the batch first', () => {
    vi.useFakeTimers();
    const fixture = make();
    fixture.store.dispatchSync(addTable('t1'));
    fixture.shared.subscribe(actions => fixture.seen.push(actions));
    fixture.reset();

    fixture.store.dispatchSync(recolor('#f00', ''));
    // One quiet period on each side of the circuit breaker.
    vi.advanceTimersByTime(399);
    expect(fixture.seen).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(fixture.types()).toEqual(['table.changeColor']);

    fixture.reset();
    fixture.store.dispatchSync(recolor('#0f0', '#f00'));
    vi.advanceTimersByTime(100);
    expect(fixture.seen).toHaveLength(0);

    fixture.shared.flushStreamBuffers();
    expect(fixture.types()).toEqual(['table.changeColor']);
  });

  it('sends a stream batch on one flushStreamBuffers call under the flag, without advancing timers', () => {
    vi.useFakeTimers();
    const fixture = makeManual();
    fixture.store.dispatchSync(addTable('t1'));
    fixture.shared.subscribe(actions => fixture.seen.push(actions));
    fixture.reset();

    fixture.store.dispatchSync(recolor('#f00', ''));
    expect(fixture.seen).toHaveLength(0);

    fixture.shared.flushStreamBuffers();

    expect(fixture.seen).toHaveLength(1);
    expect(fixture.types()).toEqual(['table.changeColor']);
    expect(fixture.seen[0][0].payload).toEqual({
      id: 't1',
      color: '#f00',
      prevColor: '',
    });

    vi.advanceTimersByTime(10_000);
    expect(fixture.seen).toHaveLength(1);
  });

  it('sends exactly one batch for a lone memo.resize, which records no history', () => {
    const fixture = makeManual();
    fixture.store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 1 } })
    );
    fixture.shared.subscribe(actions => fixture.seen.push(actions));
    fixture.reset();
    const size = fixture.store.history.size;

    fixture.store.dispatchSync(
      resizeMemoAction({ id: 'm1', x: 0, y: 0, width: 240, height: 160 })
    );
    fixture.store.flushStreamBuffers();
    fixture.shared.flushStreamBuffers();

    expect(fixture.store.history.size).toBe(size);
    expect(fixture.seen).toHaveLength(1);
    expect(fixture.types()).toEqual(['memo.resize']);
    expect(fixture.seen[0][0].version).toBe(
      fixture.store.context.clock.getVersion()
    );
  });

  it('sends one batch and records one entry for each flushed color change', () => {
    const fixture = makeManual();
    fixture.store.dispatchSync(addTable('t1'));
    fixture.shared.subscribe(actions => fixture.seen.push(actions));
    fixture.reset();
    const size = fixture.store.history.size;

    fixture.store.dispatchSync(recolor('#f00', ''));
    fixture.store.flushStreamBuffers();
    fixture.shared.flushStreamBuffers();
    fixture.store.dispatchSync(recolor('#0f0', '#f00'));
    fixture.store.flushStreamBuffers();
    fixture.shared.flushStreamBuffers();

    expect(fixture.seen).toHaveLength(2);
    expect(fixture.types()).toEqual(['table.changeColor', 'table.changeColor']);
    expect(fixture.store.history.size).toBe(size + 2);
  });

  it('never sends an empty batch, however often it is flushed', () => {
    const fixture = makeManual();
    fixture.store.dispatchSync(addTable('t1'));
    fixture.shared.subscribe(actions => fixture.seen.push(actions));
    fixture.reset();

    fixture.shared.flushStreamBuffers();
    fixture.shared.flushStreamBuffers();
    expect(fixture.seen).toEqual([]);

    fixture.store.dispatchSync(recolor('#f00', ''));
    fixture.shared.flushStreamBuffers();
    fixture.shared.flushStreamBuffers();
    fixture.shared.flushStreamBuffers();

    expect(fixture.seen).toHaveLength(1);
    expect(fixture.seen.every(actions => actions.length > 0)).toBe(true);
  });

  it('takes a flushStreamBuffers call after destroy without throwing', () => {
    const plain = make();
    const manual = makeManual();
    manual.store.dispatchSync(addTable('t1'));
    manual.shared.subscribe(actions => manual.seen.push(actions));
    manual.reset();
    manual.store.dispatchSync(recolor('#f00', ''));

    plain.shared.destroy();
    manual.shared.destroy();

    expect(() => plain.shared.flushStreamBuffers()).not.toThrow();
    expect(() => manual.shared.flushStreamBuffers()).not.toThrow();
    expect(manual.seen).toEqual([]);
  });

  it('keeps the flag out of the config the element forwards from getSharedStore', () => {
    type ElementConfig = NonNullable<
      Parameters<ErdEditorElement['getSharedStore']>[0]
    >;

    expectTypeOf<keyof SharedStoreConfig>().toEqualTypeOf<'getNickname'>();
    expectTypeOf<keyof ElementConfig>().toEqualTypeOf<
      'getNickname' | 'mouseTracker' | 'focusTracker'
    >();
    expectTypeOf(createSharedStore)
      .parameter(2)
      .toEqualTypeOf<SharedStoreInternalOptions | undefined>();
    expect(Object.keys(makeManual().shared)).toContain('flushStreamBuffers');
  });
});
