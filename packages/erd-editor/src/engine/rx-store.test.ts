import { toJson } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { CanvasType } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { EngineContext } from '@/engine/context';
import { createHistory, History, HistoryOptions } from '@/engine/history';
import {
  clearAction,
  loadJsonAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import { ViewKind, VisualizationMode } from '@/engine/modules/editor/state';
import { getActiveView } from '@/engine/modules/editor/view';
import {
  changeVisualizationModeAction,
  viewCloseAction,
  viewOpenAction,
  viewSetLayoutAction,
} from '@/engine/modules/editor/view.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  changeCanvasTypeAction,
  changeZoomLevelAction,
  scrollToAction,
  streamScrollToAction,
  streamZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import {
  changeZoomLevelAction$,
  streamZoomLevelAction$,
} from '@/engine/modules/settings/generator.actions';
import {
  addTableAction,
  changeTableColorAction,
  changeTableNameAction,
  moveTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
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

  describe('while a view is active', () => {
    /** A store holding one table and one column, with a Focus view open on the table. */
    function makeWithFocus() {
      const store = make(createContext());
      store.dispatchSync(
        addTable('t1'),
        addColumnAction({ id: 'c1', tableId: 't1' }),
        changeColumnNameAction({ tableId: 't1', id: 'c1', value: 'id' })
      );
      store.dispatchSync(
        viewOpenAction({ kind: ViewKind.focus, centerIds: ['t1'] }),
        viewSetLayoutAction({
          kind: ViewKind.focus,
          positions: { t1: { x: 0, y: 0 } },
        })
      );
      return store;
    }

    /** The document as the view found it, to hold against after the view acts. */
    function documentPlacement(store: RxStore) {
      const { originX, originY, zoomLevel } = store.state.settings;
      const { x, y } = store.state.collections.tableEntities['t1'].ui;
      return { originX, originY, zoomLevel, table: { x, y } };
    }

    function collectChanges(store: RxStore) {
      const seen: Array<Array<AnyAction>> = [];
      const subscription = store.change$.subscribe(actions =>
        seen.push(actions)
      );
      return { seen, subscription };
    }

    // AC-7, AC-8: every placement lands in the view and never in the document
    // or the host's change stream.
    it('takes the scrolls and zooms into the view, leaving the document and change$ untouched', () => {
      vi.useFakeTimers();
      const store = makeWithFocus();
      const before = documentPlacement(store);
      const { seen, subscription } = collectChanges(store);

      store.dispatchSync(scrollToAction({ originX: 120, originY: -80 }));
      store.dispatchSync(
        streamScrollToAction({ movementX: 10, movementY: 10 })
      );
      store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
      store.dispatchSync(streamZoomLevelAction({ value: 0.1 }));
      store.dispatchSync(changeZoomLevelAction$(0.8));
      store.dispatchSync(streamZoomLevelAction$(-0.1));
      vi.advanceTimersByTime(250);

      expect(seen).toEqual([]);
      expect(documentPlacement(store)).toEqual(before);
      expect(store.state.editor.views.focus).toMatchObject({
        zoomLevel: 0.7,
      });
      expect(store.state.editor.views.focus?.originX).not.toBe(0);

      subscription.unsubscribe();
    });

    // AC-9: the document is closed to edits for as long as a view is open.
    it('drops the document edits before they reach the store', () => {
      vi.useFakeTimers();
      const store = makeWithFocus();
      const before = documentPlacement(store);
      const { seen, subscription } = collectChanges(store);

      store.dispatchSync(
        addTable('t2'),
        changeColumnNameAction({ tableId: 't1', id: 'c1', value: 'renamed' }),
        addRelationshipAction({
          id: 'r1',
          relationshipType: 1,
          start: { tableId: 't1', columnIds: ['c1'] },
          end: { tableId: 't1', columnIds: ['c1'] },
        }),
        changeTableColorAction({ id: 't1', color: '#fff', prevColor: '' }),
        moveTableAction({ ids: ['t1'], movementX: 50, movementY: 50 })
      );
      vi.advanceTimersByTime(250);

      expect(store.state.doc.tableIds).toEqual(['t1']);
      expect(store.state.doc.relationshipIds).toEqual([]);
      expect(store.state.collections.tableColumnEntities['c1'].name).toBe('id');
      expect(store.state.collections.tableEntities['t1'].ui.color).toBe('');
      expect(documentPlacement(store)).toEqual(before);
      expect(seen).toEqual([]);

      subscription.unsubscribe();
    });

    // AC-10
    it('leaves the undo stack where it was after any view manipulation', () => {
      vi.useFakeTimers();
      const store = makeWithFocus();
      const size = store.history.size;
      expect(size).toBeGreaterThan(0);

      store.dispatchSync(scrollToAction({ originX: 120, originY: -80 }));
      store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
      store.dispatchSync(
        streamScrollToAction({ movementX: 100, movementY: 100 })
      );
      store.dispatchSync(streamZoomLevelAction({ value: 0.1 }));
      store.dispatchSync(addTable('t2'));
      store.dispatchSync(
        moveTableAction({ ids: ['t1'], movementX: 9, movementY: 9 })
      );
      vi.advanceTimersByTime(300);

      expect(store.history.size).toBe(size);
      expect(store.history.hasRedo()).toBe(false);
    });

    // AC-49
    it('refuses undo and redo, and takes them again once the view closes', () => {
      const store = make(createContext());
      store.dispatchSync(addTable('t1'));
      store.dispatchSync(changeTableNameAction({ id: 't1', value: 'users' }));
      store.undo();
      expect(store.state.collections.tableEntities['t1'].name).toBe('');
      store.dispatchSync(
        viewOpenAction({ kind: ViewKind.focus, centerIds: ['t1'] })
      );

      store.undo();
      expect(store.state.doc.tableIds).toEqual(['t1']);
      store.redo();
      expect(store.state.collections.tableEntities['t1'].name).toBe('');
      expect(store.history.hasUndo()).toBe(true);
      expect(store.history.hasRedo()).toBe(true);

      store.dispatchSync(viewCloseAction({ kind: ViewKind.focus }));
      store.redo();
      expect(store.state.collections.tableEntities['t1'].name).toBe('users');
      store.undo();
      store.undo();
      expect(store.state.doc.tableIds).toEqual([]);
    });

    // AC-48: a peer's edit reaches the document under the view, and never the history.
    it('applies a shared edit to the document without recording it', () => {
      const store = makeWithFocus();
      const size = store.history.size;

      store.dispatchSync(attachActionTag(Tag.shared, addTable('t2')));
      store.dispatchSync(
        attachActionTag(
          Tag.shared,
          changeColumnNameAction({ tableId: 't1', id: 'c1', value: 'peer' })
        )
      );

      expect(store.state.doc.tableIds).toEqual(['t1', 't2']);
      expect(store.state.collections.tableColumnEntities['c1'].name).toBe(
        'peer'
      );
      expect(store.history.size).toBe(size);
      expect(getActiveView(store.state)).not.toBeNull();
    });

    it('leaves a following placement from a peer to the document', () => {
      const store = makeWithFocus();

      store.dispatchSync(
        attachActionTag(
          Tag.shared | Tag.following,
          scrollToAction({ originX: 999, originY: 999 })
        )
      );

      expect(store.state.settings.originX).toBe(0);
      expect(store.state.editor.views.focus?.originX).toBe(0);
    });

    // AC-48: the host replacing the document closes the view with it.
    it.each([
      [
        'loadJson',
        (store: RxStore) => loadJsonAction({ value: toJson(store.state) }),
      ],
      ['clear', () => clearAction()],
    ])('lets %s through, and it empties the views', (_, replace) => {
      vi.useFakeTimers();
      const store = makeWithFocus();
      const { seen, subscription } = collectChanges(store);

      store.dispatchSync(replace(store));
      vi.advanceTimersByTime(250);

      expect(store.state.editor.views).toEqual({ flow: null, focus: null });
      expect(getActiveView(store.state)).toBeNull();
      expect(seen).toHaveLength(1);

      store.dispatchSync(addTable('t9'));
      expect(store.state.doc.tableIds).toContain('t9');

      subscription.unsubscribe();
    });

    it('lets the tab change through, which is how a view is left from another tab', () => {
      vi.useFakeTimers();
      const store = makeWithFocus();
      const { seen, subscription } = collectChanges(store);

      store.dispatchSync(
        changeCanvasTypeAction({ value: CanvasType.visualization })
      );
      vi.advanceTimersByTime(250);

      expect(store.state.settings.canvasType).toBe(CanvasType.visualization);
      expect(seen.map(actions => actions.map(({ type }) => type))).toEqual([
        ['settings.changeCanvasType'],
      ]);

      subscription.unsubscribe();
    });

    it('gates the same way behind a Flow view, and stops when the tab leaves it', () => {
      const store = make(createContext());
      store.dispatchSync(addTable('t1'));
      store.dispatchSync(
        changeCanvasTypeAction({ value: CanvasType.visualization }),
        changeVisualizationModeAction({ value: VisualizationMode.flow })
      );
      store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
      expect(getActiveView(store.state)?.kind).toBe(ViewKind.flow);

      store.dispatchSync(addTable('t2'));
      store.dispatchSync(scrollToAction({ originX: 50, originY: 50 }));
      expect(store.state.doc.tableIds).toEqual(['t1']);
      expect(store.state.settings.originX).toBe(0);
      expect(store.state.editor.views.flow?.originX).toBe(50);

      store.dispatchSync(changeCanvasTypeAction({ value: CanvasType.ERD }));
      expect(getActiveView(store.state)).toBeNull();

      store.dispatchSync(addTable('t2'));
      store.dispatchSync(scrollToAction({ originX: 70, originY: 70 }));
      expect(store.state.doc.tableIds).toEqual(['t1', 't2']);
      expect(store.state.settings.originX).toBe(70);
      expect(store.state.editor.views.flow?.originX).toBe(50);
    });

    it('classifies a batch by the state before it, so a close and a scroll travel apart', () => {
      const store = makeWithFocus();

      store.dispatchSync(
        viewCloseAction({ kind: ViewKind.focus }),
        scrollToAction({ originX: 10, originY: 10 })
      );
      expect(store.state.settings.originX).toBe(0);

      store.dispatchSync(scrollToAction({ originX: 10, originY: 10 }));
      expect(store.state.settings.originX).toBe(10);
    });
  });
});
