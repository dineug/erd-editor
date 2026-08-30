import { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import { EngineContext } from '@/engine/context';
import { createHistory, History, HistoryOptions } from '@/engine/history';
import { unselectAllAction } from '@/engine/modules/editor/atom.actions';
import { changeZoomLevelAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
  moveTableAction,
} from '@/engine/modules/table/atom.actions';
import { createRxStore, HISTORY_LIMIT, RxStore } from '@/engine/rx-store';
import { attachActionTag, Tag } from '@/engine/tag';
import { bHas } from '@/utils/bit';

const addTable = (id: string) =>
  addTableAction({ id, ui: { x: 200, y: 100, zIndex: 2 } });

function createContext(): EngineContext {
  return {
    toWidth: (text: string) => text.length * 10,
    clock: new Clock(),
  };
}

const stores: RxStore[] = [];

function make(...args: Parameters<typeof createRxStore>): RxStore {
  const store = createRxStore(...args);
  stores.push(store);
  return store;
}

/** Let a queueMicrotask based asap callback run. */
async function tick() {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
  while (stores.length) {
    const store = stores.pop();
    try {
      store?.destroy();
    } catch {
      // already destroyed by the test
    }
  }
});

describe('createRxStore', () => {
  it('exposes the store surface plus history helpers', () => {
    const store = make(createContext());

    expect(typeof store.dispatch).toBe('function');
    expect(typeof store.dispatchSync).toBe('function');
    expect(typeof store.undo).toBe('function');
    expect(typeof store.redo).toBe('function');
    expect(store.history.size).toBe(0);
    expect(Object.isFrozen(store)).toBe(true);
  });

  it('uses the injected history factory and applies the history limit', () => {
    let seen: HistoryOptions | null = null;
    const setLimit = vi.fn();
    const injected = {
      ...createHistory({
        notify: () => {},
        dispatch: () => {},
        getNextVersion: () => 1,
      }),
      setLimit,
    } as unknown as History;

    const store = make(createContext(), {
      getHistory: options => {
        seen = options;
        return injected;
      },
    });

    expect(store.history).toBe(injected);
    expect(setLimit).toHaveBeenCalledWith(HISTORY_LIMIT);
    expect(seen).not.toBeNull();
    expect(typeof seen!.notify).toBe('function');
    expect(typeof seen!.dispatch).toBe('function');
    expect(typeof seen!.getNextVersion).toBe('function');
  });

  it('feeds the history options a version source bound to its own clock', () => {
    const context = createContext();
    let seen: HistoryOptions | null = null;

    make(context, {
      getHistory: options => {
        seen = options;
        return createHistory(options);
      },
    });

    expect(seen!.getNextVersion()).toBe(1);

    context.clock.merge(7);

    expect(seen!.getNextVersion()).toBe(8);
  });

  it('dispatchSync applies the reducer and stamps the next clock version', () => {
    const context = createContext();
    const store = make(context);

    store.dispatchSync(addTable('t1'));

    expect(store.state.doc.tableIds).toEqual(['t1']);
    expect(context.clock.getVersion()).toBe(1);
  });

  it('keeps a version that the action already carries', () => {
    const context = createContext();
    const store = make(context);

    store.dispatchSync({ ...addTable('t1'), version: 42 });

    expect(store.state.doc.tableIds).toEqual(['t1']);
    expect(context.clock.getVersion()).toBe(42);
  });

  it('flattens generator actions before dispatching', () => {
    const store = make(createContext());

    store.dispatchSync(function* () {
      yield addTable('t1');
      yield addTable('t2');
    });

    expect(store.state.doc.tableIds).toEqual(['t1', 't2']);
  });

  it('dispatch defers to a microtask', async () => {
    const store = make(createContext());

    store.dispatch(addTable('t1'));
    expect(store.state.doc.tableIds).toEqual([]);

    await tick();
    expect(store.state.doc.tableIds).toEqual(['t1']);
  });

  it('records undoable actions and restores state on undo/redo', async () => {
    const store = make(createContext());

    store.dispatchSync(addTable('t1'));
    expect(store.history.size).toBe(1);
    expect(store.history.hasUndo()).toBe(true);

    await tick();
    expect(store.state.editor.hasUndo).toBe(true);

    store.undo();
    expect(store.state.doc.tableIds).toEqual([]);

    store.redo();
    expect(store.state.doc.tableIds).toEqual(['t1']);
  });

  it('undoing a name change restores the previous name', () => {
    const store = make(createContext());

    store.dispatchSync(addTable('t1'));
    store.dispatchSync(changeTableNameAction({ id: 't1', value: 'users' }));
    expect(store.state.collections.tableEntities['t1'].name).toBe('users');

    store.undo();
    expect(store.state.collections.tableEntities['t1'].name).toBe('');
  });

  it('groups stream actions into a single history entry', () => {
    vi.useFakeTimers();
    const store = make(createContext());

    store.dispatchSync(
      moveTableAction({ ids: ['t1'], movementX: 20, movementY: 0 })
    );
    store.dispatchSync(
      moveTableAction({ ids: ['t1'], movementX: 20, movementY: 0 })
    );

    expect(store.state.collections.tableEntities['t1'].ui.x).toBe(240);
    expect(store.history.size).toBe(0);

    vi.advanceTimersByTime(300);
    expect(store.history.size).toBe(1);

    store.undo();
    expect(store.state.collections.tableEntities['t1'].ui.x).toBe(200);
  });

  it('does not push history for actions tagged changeOnly', () => {
    const store = make(createContext());

    store.dispatchSync(attachActionTag(Tag.changeOnly, addTable('t1')));

    expect(store.state.doc.tableIds).toEqual(['t1']);
    expect(store.history.size).toBe(0);
  });

  it('does not push history for actions tagged shared', () => {
    const store = make(createContext());

    store.dispatchSync(attachActionTag(Tag.shared, addTable('t1')));

    expect(store.state.doc.tableIds).toEqual(['t1']);
    expect(store.history.size).toBe(0);
  });

  describe('readonly', () => {
    it('drops readonly-ignored change actions', () => {
      const store = make(createContext(), { getReadonly: () => true });

      store.dispatchSync(addTable('t1'));

      expect(store.state.doc.tableIds).toEqual([]);
      expect(store.history.size).toBe(0);
    });

    it('still applies view-only actions', () => {
      const store = make(createContext(), { getReadonly: () => true });

      store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));

      expect(store.state.settings.zoomLevel).toBe(0.5);
    });

    it('lets shared-tagged actions through', () => {
      const store = make(createContext(), { getReadonly: () => true });

      store.dispatchSync(attachActionTag(Tag.shared, addTable('t1')));

      expect(store.state.doc.tableIds).toEqual(['t1']);
    });

    it('blocks undo and redo', () => {
      let readonly = false;
      const store = make(createContext(), { getReadonly: () => readonly });

      store.dispatchSync(addTable('t1'));
      readonly = true;

      store.undo();
      expect(store.state.doc.tableIds).toEqual(['t1']);

      readonly = false;
      store.undo();
      expect(store.state.doc.tableIds).toEqual([]);

      readonly = true;
      store.redo();
      expect(store.state.doc.tableIds).toEqual([]);
    });
  });

  describe('change$', () => {
    it('emits change actions after the debounce window', () => {
      vi.useFakeTimers();
      const store = make(createContext());
      const seen: Array<Array<AnyAction>> = [];
      const subscription = store.change$.subscribe(actions =>
        seen.push(actions)
      );

      store.dispatchSync(addTable('t1'));
      store.dispatchSync(addTable('t2'));
      expect(seen).toHaveLength(0);

      vi.advanceTimersByTime(250);
      expect(seen).toHaveLength(1);
      expect(seen[0].map(action => action.type)).toEqual(['table.add']);

      subscription.unsubscribe();
    });

    it('ignores non-change actions', () => {
      vi.useFakeTimers();
      const store = make(createContext());
      const seen: Array<Array<AnyAction>> = [];
      const subscription = store.change$.subscribe(actions =>
        seen.push(actions)
      );

      store.dispatchSync(unselectAllAction(), addTable('t1'));
      vi.advanceTimersByTime(250);

      expect(seen).toHaveLength(1);
      expect(seen[0].map(action => action.type)).toEqual(['table.add']);

      subscription.unsubscribe();
    });

    it('filters readonly-ignored actions when readonly', () => {
      vi.useFakeTimers();
      const store = make(createContext(), { getReadonly: () => true });
      const seen: Array<Array<AnyAction>> = [];
      const subscription = store.change$.subscribe(actions =>
        seen.push(actions)
      );

      store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
      vi.advanceTimersByTime(250);

      expect(seen).toHaveLength(1);
      expect(seen[0].map(action => action.type)).toEqual([
        'settings.changeZoomLevel',
      ]);

      subscription.unsubscribe();
    });
  });

  it('merges remote versions into the clock', () => {
    const context = createContext();
    const store = make(context);

    store.dispatchSync({ ...addTable('t1'), version: 10 });
    expect(context.clock.getVersion()).toBe(10);

    store.dispatchSync({ ...addTable('t2'), version: 3 });
    expect(context.clock.getVersion()).toBe(10);
  });

  it('destroy detaches every subscription and clears history', () => {
    const context = createContext();
    const store = make(context);

    store.dispatchSync(addTable('t1'));
    expect(store.history.size).toBe(1);

    store.destroy();

    expect(store.history.size).toBe(0);
    store.dispatchSync(addTable('t2'));
    expect(store.state.doc.tableIds).toEqual(['t1']);
    expect(context.clock.getVersion()).toBe(1);
  });

  it('tags helper produces bit flags the pipeline understands', () => {
    const tagged = attachActionTag(
      Tag.changeOnly,
      attachActionTag(Tag.shared, addTable('t1'))
    );

    expect(bHas(tagged.tags!, Tag.shared)).toBe(true);
    expect(bHas(tagged.tags!, Tag.changeOnly)).toBe(true);
  });
});
