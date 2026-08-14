import { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Clock } from '@/engine/clock';
import { EngineContext } from '@/engine/context';
import { getLWWAction } from '@/engine/modules/editor/atom.actions';
import { changeZoomLevelAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { createRxStore, RxStore } from '@/engine/rx-store';
import { createSharedStore, SharedStore } from '@/engine/shared-store';
import { Tag } from '@/engine/tag';
import { bHas } from '@/utils/bit';

type Fixture = {
  store: RxStore;
  shared: SharedStore;
  seen: Array<Array<AnyAction>>;
  types: () => string[];
  reset: () => void;
};

const created: SharedStore[] = [];

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
  created.push(shared);
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
    const shared = created.pop();
    try {
      shared?.destroy();
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
    // throttled: buffered until the window reopens
    track(2);
    track(3);
    vi.advanceTimersByTime(150);
    track(4);

    const trackers = fixture.seen
      .flat()
      .filter(action => action.type === 'editor.sharedMouseTracker');
    expect(trackers.map(action => action.payload.x)).toEqual([1, 4]);
  });

  it('destroy tears down the store and every subscription', () => {
    const fixture = make();
    fixture.shared.subscribe(actions => fixture.seen.push(actions));
    fixture.reset();

    fixture.shared.destroy();
    fixture.store.dispatchSync(addTable('t1'));

    expect(fixture.seen).toHaveLength(0);
    expect(fixture.store.state.doc.tableIds).toEqual([]);
  });
});
