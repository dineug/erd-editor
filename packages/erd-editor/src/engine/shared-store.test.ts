import { type LWW, setSettingLock } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import {
  afterEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vite-plus/test';

import { createSeedValue, SEED } from '@/__test-utils__/peerSeed';
import type { ErdEditorElement } from '@/components/erd-editor/ErdEditor';
import {
  BracketType,
  CanvasType,
  Database,
  Language,
  LockSettingType,
  LockSettingTypeList,
  NameCase,
  NameViewMode,
  RelationshipType,
  Show,
} from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { EngineContext } from '@/engine/context';
import { documentJsonOf, runtimeJsonOf } from '@/engine/documentJson';
import {
  changeViewportAction,
  clearAction,
  focusTableAction,
  getLWWAction,
  selectAction,
  sharedDragSelectTrackerAction,
  sharedFocusTrackerAction,
  sharedMouseTrackerAction,
  sharedSelectionTrackerAction,
} from '@/engine/modules/editor/atom.actions';
import {
  duplicateAction$,
  initialLoadJsonAction$,
  loadJsonAction$,
} from '@/engine/modules/editor/generator.actions';
import {
  FocusType,
  SelectType,
  ViewKind,
  VisualizationMode,
} from '@/engine/modules/editor/state';
import { getActiveView } from '@/engine/modules/editor/view';
import {
  changeVisualizationModeAction,
  viewOpenAction,
} from '@/engine/modules/editor/view.actions';
import { addIndexAction } from '@/engine/modules/index/atom.actions';
import { addIndexColumnAction } from '@/engine/modules/index-column/atom.actions';
import {
  addMemoAction,
  resizeMemoAction,
} from '@/engine/modules/memo/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  changeBracketTypeAction,
  changeCanvasTypeAction,
  changeColumnNameCaseAction,
  changeDatabaseAction,
  changeLanguageAction,
  changeLockSettingsAction,
  changeShowAction,
  changeTableNameCaseAction,
  changeZoomLevelAction,
  scrollToAction,
  streamScrollToAction,
  streamZoomLevelAction,
  toNameViewModeAction,
} from '@/engine/modules/settings/atom.actions';
import { restoreScreenSettingsAction$ } from '@/engine/modules/settings/generator.actions';
import {
  addTableAction,
  changeTableColorAction,
  changeTableNameAction,
  moveTableAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import { addTableGroupAction } from '@/engine/modules/table-group/atom.actions';
import { toMoveTableGroupActions } from '@/engine/modules/table-group/generator.actions';
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

function make(
  config?: Parameters<typeof createSharedStore>[1],
  options?: Parameters<typeof createRxStore>[1]
): Fixture {
  const store = createRxStore(createContext(), options);
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

  it('asks again once a load opens a document, which drops the registers', () => {
    const fixture = make();
    fixture.store.dispatchSync(addTable('t1'));
    fixture.shared.subscribe(actions => fixture.seen.push(actions));
    fixture.reset();

    fixture.store.dispatchSync(initialLoadJsonAction$('{}'));

    expect(fixture.store.state.lww).toEqual({});
    expect(fixture.types()).toEqual(['editor.getLWW']);
    expect(fixture.seen.flat()[0].version).toBe(
      fixture.store.context.clock.getVersion()
    );
  });

  it('leaves a load before its first subscribe to the request that subscribe sends', () => {
    const fixture = make();

    fixture.store.dispatchSync(initialLoadJsonAction$('{}'));
    fixture.shared.subscribe(actions => fixture.seen.push(actions));

    expect(fixture.types()).toEqual(['editor.getLWW']);
  });

  it('keeps the registers and asks for none on a load that replaces the document in session', () => {
    const fixture = make();
    fixture.store.dispatchSync(addTable('t1'));
    fixture.shared.subscribe(actions => fixture.seen.push(actions));
    fixture.reset();

    fixture.store.dispatchSync(loadJsonAction$('{}'));

    expect(fixture.store.state.lww).toHaveProperty('t1');
    expect(fixture.types()).toEqual(['editor.clear', 'editor.loadJson']);
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

  it('sends a name view switch as a follow, naming in its payload the editor that made it', () => {
    const fixture = make();
    fixture.shared.subscribe(actions => fixture.seen.push(actions));
    fixture.reset();
    const { editor } = fixture.store.state;

    fixture.store.dispatchSync(
      toNameViewModeAction(fixture.store.state, NameViewMode.logical, false)
    );

    const action = fixture.seen
      .flat()
      .find(a => a.type === 'settings.changeNameViewMode');
    expect(action).toBeTruthy();
    expect(bHas(action!.tags!, Tag.following)).toBe(true);
    expect(bHas(action!.tags!, Tag.shared)).toBe(true);
    expect(action!.payload).toEqual({
      value: NameViewMode.logical,
      shared: false,
      editorId: editor.id,
    });
    expect(action!.meta).toMatchObject({ editorId: editor.id });
    expect(fixture.store.state.settings.nameViewMode).toBe(
      NameViewMode.logical
    );
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

  describe('over a readonly editor', () => {
    function makeReadonly(readonlyEditState = true) {
      let readonly = false;
      const fixture = make(undefined, {
        getReadonly: () => readonly,
        readonlyEditState,
      });
      fixture.store.dispatchSync(addTable('t1'));
      fixture.shared.subscribe(actions => fixture.seen.push(actions));
      fixture.reset();
      return {
        ...fixture,
        setReadonly: (value: boolean) => {
          readonly = value;
        },
      };
    }

    it('sends none of the code settings and the database a readonly reader changes', () => {
      const fixture = makeReadonly();
      fixture.setReadonly(true);

      fixture.store.dispatchSync(
        changeLanguageAction({ value: Language.Kotlin }),
        changeTableNameCaseAction({ value: NameCase.snakeCase }),
        changeColumnNameCaseAction({ value: NameCase.snakeCase }),
        changeBracketTypeAction({ value: BracketType.backtick }),
        changeDatabaseAction({ value: Database.PostgreSQL }),
        addTable('t2')
      );

      expect(fixture.seen).toEqual([]);
      expect(fixture.store.state.settings).toMatchObject({
        language: Language.Kotlin,
        database: Database.PostgreSQL,
      });
    });

    it('sends no change while readonly, the viewport, the tab and the name view a reader moves among them', () => {
      vi.useFakeTimers();
      const fixture = makeReadonly();
      fixture.setReadonly(true);

      fixture.store.dispatchSync(
        scrollToAction({ originX: 40, originY: 40 }),
        changeZoomLevelAction({ value: 0.5 }),
        changeCanvasTypeAction({ value: CanvasType.schemaSQL }),
        toNameViewModeAction(fixture.store.state, NameViewMode.logical, true)
      );
      fixture.store.dispatchSync(
        streamScrollToAction({ movementX: 40, movementY: 40 })
      );
      fixture.store.dispatchSync(streamZoomLevelAction({ value: 0.1 }));
      // A quiet period on each side of the circuit breaker.
      vi.advanceTimersByTime(400);

      expect(fixture.seen).toEqual([]);
      expect(fixture.store.state.settings).toMatchObject({
        canvasType: CanvasType.schemaSQL,
        nameViewMode: NameViewMode.logical,
      });
    });

    it('still sends presence and answers a join with its registers', () => {
      const fixture = makeReadonly();
      fixture.setReadonly(true);

      fixture.store.dispatchSync(
        sharedMouseTrackerAction({ x: 1, y: 1 }),
        sharedFocusTrackerAction({ focus: null }),
        sharedSelectionTrackerAction({ selectedIds: [] }),
        sharedDragSelectTrackerAction({ rect: null })
      );
      fixture.shared.dispatchSync(getLWWAction());

      expect(fixture.types()).toEqual([
        'editor.sharedMouseTracker',
        'editor.sharedFocusTracker',
        'editor.sharedSelectionTracker',
        'editor.sharedDragSelectTracker',
        'editor.getLWW',
        'editor.mergeLWW',
      ]);
      const merge = fixture.seen
        .flat()
        .find(action => action.type === 'editor.mergeLWW');
      expect(Object.keys(merge!.payload.lww)).toContain('t1');
    });

    it('still sends a drag it held from before it turned readonly', () => {
      vi.useFakeTimers();
      const fixture = makeReadonly();

      fixture.store.dispatchSync(
        moveTableAction({ ids: ['t1'], movementX: 40, movementY: 0 })
      );
      fixture.setReadonly(true);
      fixture.store.dispatchSync(
        moveTableAction({ ids: ['t1'], movementX: 40, movementY: 0 })
      );
      vi.advanceTimersByTime(400);

      const sent = fixture.seen.flat();
      expect(sent.map(action => action.type)).toEqual(['table.moveTo']);
      expect(sent[0].payload).toEqual({ id: 't1', x: 240, y: 100 });
      expect(fixture.store.state.collections.tableEntities.t1.ui.x).toBe(240);
    });

    it('sends none of a history replay made while readonly, which reaches the store past both state filters', () => {
      vi.useFakeTimers();
      const fixture = makeReadonly();
      fixture.store.dispatchSync(addTable('t2'));
      vi.advanceTimersByTime(400);
      expect(fixture.types()).toEqual(['table.add']);
      fixture.reset();
      fixture.setReadonly(true);

      // Time Travel's Apply steps the history itself, past the readonly guard
      // of the store's own undo.
      fixture.store.history.undo();
      // A quiet period on each side of the circuit breaker.
      vi.advanceTimersByTime(400);

      expect(fixture.seen).toEqual([]);
      expect(fixture.store.state.doc.tableIds).toEqual(['t1']);
    });

    it('sends none of what its screen takes back once writable, and leads its next pan with where the screen stands', () => {
      vi.useFakeTimers();
      const fixture = makeReadonly();
      fixture.setReadonly(true);
      fixture.store.dispatchSync(
        changeLanguageAction({ value: Language.Kotlin }),
        scrollToAction({ originX: 40, originY: 40 })
      );

      fixture.setReadonly(false);
      fixture.store.dispatchSync(restoreScreenSettingsAction$());
      vi.advanceTimersByTime(400);
      expect(fixture.seen).toEqual([]);

      fixture.store.dispatchSync(
        streamScrollToAction({ movementX: 30, movementY: 0 })
      );
      vi.advanceTimersByTime(400);

      const sent = fixture.seen.flat();
      expect(sent.map(({ type, payload }) => [type, payload])).toEqual([
        ['settings.scrollTo', { originX: 40, originY: 40 }],
        ['settings.changeZoomLevel', { value: 1 }],
        ['settings.scrollTo', { originX: 70, originY: 40 }],
      ]);
      expect(
        sent.every(({ tags }) => bHas(tags!, Tag.shared | Tag.following))
      ).toBe(true);
    });

    it('sends what a reader changes on a readonly store that does not ask for it', () => {
      const fixture = makeReadonly(false);
      fixture.setReadonly(true);

      fixture.store.dispatchSync(
        changeLanguageAction({ value: Language.Kotlin })
      );

      expect(fixture.types()).toEqual(['settings.changeLanguage']);
    });
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

describe('createSharedStore absolute geometry', () => {
  /** A store holding t1 at (200, 100) and the group g1, whose sends are seen from here on. */
  function makeSeen() {
    vi.useFakeTimers();
    const fixture = make();
    fixture.store.dispatchSync(
      addTable('t1'),
      addTableGroupAction({
        id: 'g1',
        ui: { x: 160, y: 40, width: 400, height: 300, zIndex: 1 },
      })
    );
    fixture.shared.subscribe(actions => fixture.seen.push(actions));
    // The history's quiet period, so an undo finds the adds behind it.
    vi.advanceTimersByTime(400);
    fixture.reset();
    return fixture;
  }

  const positionVersion = (fixture: Fixture, id: string) =>
    fixture.store.state.lww[id][3]['ui.position'];

  it('sends a drag’s steps as one absolute move, 200 ms after the last, at the last step’s version (AC-P1)', () => {
    const fixture = makeSeen();

    fixture.store.dispatchSync(
      moveTableAction({ ids: ['t1'], movementX: 30, movementY: 0 })
    );
    fixture.store.dispatchSync(
      moveTableAction({ ids: ['t1'], movementX: 30, movementY: 10 })
    );
    vi.advanceTimersByTime(199);
    expect(fixture.seen).toEqual([]);
    vi.advanceTimersByTime(1);

    expect(fixture.seen).toHaveLength(1);
    const [moveTo] = fixture.seen[0];
    expect(moveTo).toMatchObject({
      type: 'table.moveTo',
      payload: { id: 't1', x: 260, y: 110 },
      version: fixture.store.context.clock.getVersion(),
    });
    expect(fixture.types()).not.toContain('table.move');
  });

  it('sends the undo of a drag as the absolute point it puts the table back at', () => {
    const fixture = makeSeen();
    fixture.store.dispatchSync(
      moveTableAction({ ids: ['t1'], movementX: 60, movementY: 0 })
    );
    vi.advanceTimersByTime(400);
    const dragged = fixture.seen.flat()[0].version!;
    fixture.reset();

    fixture.store.undo();
    const replayed = fixture.store.context.clock.getVersion();
    vi.advanceTimersByTime(200);

    const sent = fixture.seen.flat();
    expect(sent.map(({ type, payload }) => [type, payload])).toEqual([
      ['table.moveTo', { id: 't1', x: 200, y: 100 }],
    ]);
    expect(sent[0].version).toBe(replayed);
    expect(sent[0].version).toBeGreaterThan(dragged);
  });

  it('sends a group drag’s group and the tables it carries in one batch, tagged as shared alone, so a receiver sorts their connectors in a microtask', () => {
    const fixture = makeSeen();

    fixture.store.dispatchSync(toMoveTableGroupActions(['g1'], ['t1'], 40, 0));
    fixture.store.dispatchSync(toMoveTableGroupActions(['g1'], ['t1'], 40, 0));
    vi.advanceTimersByTime(200);

    expect(fixture.seen).toHaveLength(1);
    expect(
      fixture.seen[0].map(({ type, payload, tags }) => [type, payload, tags])
    ).toEqual([
      ['table.moveTo', { id: 't1', x: 280, y: 100 }, Tag.shared],
      ['tableGroup.moveTo', { id: 'g1', x: 240, y: 40 }, Tag.shared],
    ]);
  });

  it('answers a join only after the drag it holds has left, so the versions the answer carries stand on a point sent', () => {
    const fixture = makeSeen();

    fixture.store.dispatchSync(
      moveTableAction({ ids: ['t1'], movementX: 30, movementY: 0 })
    );
    const stepped = positionVersion(fixture, 't1');
    fixture.shared.dispatchSync({ ...getLWWAction(), tags: Tag.shared });

    const sent = fixture.seen.flat();
    expect(sent.map(({ type }) => type)).toEqual([
      'table.moveTo',
      'editor.mergeLWW',
    ]);
    expect(sent[0]).toMatchObject({
      payload: { id: 't1', x: 230, y: 100 },
      version: stepped,
    });
    expect(sent[1].payload.lww.t1[3]['ui.position']).toBe(stepped);
  });

  it('sends a drag under 20 px, which leaves no undo entry', () => {
    const fixture = makeSeen();
    const size = fixture.store.history.size;

    fixture.store.dispatchSync(
      moveTableAction({ ids: ['t1'], movementX: 5, movementY: 5 })
    );
    vi.advanceTimersByTime(400);

    expect(fixture.store.history.size).toBe(size);
    expect(
      fixture.seen.flat().map(({ type, payload }) => [type, payload])
    ).toEqual([['table.moveTo', { id: 't1', x: 205, y: 105 }]]);
  });

  it('sends a pan and a zoom as the origin and the zoom they end at, 200 ms after the last step', () => {
    const fixture = makeSeen();

    fixture.store.dispatchSync(
      streamScrollToAction({ movementX: 30, movementY: -10 }),
      streamZoomLevelAction({ value: -0.25 })
    );
    vi.advanceTimersByTime(200);

    const sent = fixture.seen.flat();
    expect(sent.map(({ type, payload }) => [type, payload])).toEqual([
      ['settings.scrollTo', { originX: 30, originY: -10 }],
      ['settings.changeZoomLevel', { value: 0.75 }],
    ]);
    const viewport = fixture.store.state.lww['settings.viewport'][3];
    expect(sent.map(({ version }) => version)).toEqual([
      viewport.origin,
      viewport.zoomLevel,
    ]);
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

describe('createSharedStore registers, clock and reseed', () => {
  const READER_SIZE = { width: 1100, height: 700 };
  /** Where the reader's screen stands as the snapshot arrives, away from the document's own. */
  const SCREEN = { originX: -320, originY: -180, zoomLevel: 0.5 };

  /** The seed with every lock on, as a new document has them, or every lock off. */
  const seedValue = (locked: boolean) => {
    if (locked) return createSeedValue();

    const value = JSON.parse(createSeedValue());
    value.settings.lockSettings = LockSettingTypeList.reduce(
      (bits, bit) => setSettingLock(bits, bit, false),
      value.settings.lockSettings
    );
    return JSON.stringify(value);
  };

  /** A peer holding the document: its store reports no screen, as a peer store's does. */
  function makePeer(value: string) {
    const fixture = make();
    fixture.store.dispatchSync(
      changeViewportAction({ width: 0, height: 0 }),
      initialLoadJsonAction$(value)
    );
    return fixture;
  }

  /**
   * An element's store pair as getSharedStore wraps it: readonly read from a
   * switch, edit state dropped while readonly, a viewport before the first
   * measure, the document opened, then measured unless told not to be.
   */
  function makeReader(value: string, { measured = true } = {}) {
    let readonly = false;
    const fixture = make(undefined, {
      getReadonly: () => readonly,
      readonlyEditState: true,
    });
    fixture.store.dispatchSync(
      changeViewportAction({ width: 0, height: 0 }),
      initialLoadJsonAction$(value)
    );
    if (measured) fixture.store.dispatchSync(changeViewportAction(READER_SIZE));
    return {
      ...fixture,
      setReadonly: (next: boolean) => {
        readonly = next;
      },
    };
  }

  const snapshotOf = ({ store, shared }: Fixture) => ({
    value: runtimeJsonOf(store),
    lww: shared.getLWW(),
    version: shared.getVersion(),
  });

  const screenOf = ({ store }: Fixture) => {
    const { originX, originY, zoomLevel, canvasType } = store.state.settings;
    return { originX, originY, zoomLevel, canvasType };
  };

  /** The file form with the units each element writes of its own screen left out. */
  const outsideScreen = (fixture: Fixture) => {
    const { settings, ...rest } = JSON.parse(documentJsonOf(fixture.store));
    const { originX, originY, zoomLevel, canvasType, ...kept } = settings;
    return { ...rest, settings: kept };
  };

  /** An element that opens the snapshot after the rejoin, as a host's late joiner does. */
  function lateJoinerOf(snapshot: ReturnType<typeof snapshotOf>) {
    const joiner = makeReader(snapshot.value, { measured: false });
    joiner.shared.mergeLWW(snapshot.lww, snapshot.version);
    joiner.store.dispatchSync(changeViewportAction(READER_SIZE));
    return joiner;
  }

  it('exposes the five methods a transport binds to', () => {
    const { shared } = make();

    expect(
      ['getLWW', 'mergeLWW', 'getVersion', 'forgetPeer', 'reseed'].map(
        key => typeof shared[key as keyof SharedStore]
      )
    ).toEqual(['function', 'function', 'function', 'function', 'function']);
  });

  it('hands out a JSON copy of its registers, which a write to the copy leaves as they were', () => {
    const fixture = make();
    fixture.store.dispatchSync(addTable('t1'));
    fixture.store.dispatchSync(
      changeTableNameAction({ id: 't1', value: 'named' })
    );
    const held = JSON.parse(JSON.stringify(fixture.store.state.lww));

    const lww = fixture.shared.getLWW() as unknown as LWW;
    lww.t1[1] += 1;
    lww.t1[3].name += 1;
    Reflect.deleteProperty(lww, 't1');

    expect(fixture.store.state.lww).toEqual(held);
    expect(fixture.shared.getLWW()).toEqual(held);
  });

  it('reports the version its clock has merged', () => {
    const fixture = make();
    fixture.store.dispatchSync(addTable('t1'));

    expect(fixture.shared.getVersion()).toBe(
      fixture.store.context.clock.getVersion()
    );
    expect(fixture.shared.getVersion()).toBeGreaterThan(0);
  });

  it('takes another store’s registers and version, refusing an older write after, and sends and answers nothing', () => {
    const value = createSeedValue();
    const peer = makePeer(value);
    peer.store.dispatchSync(
      changeTableNameAction({ id: SEED.users, value: 'peer' })
    );
    const fixture = makePeer(value);
    fixture.shared.subscribe(actions => fixture.seen.push(actions));
    fixture.reset();

    fixture.shared.mergeLWW(peer.shared.getLWW(), peer.shared.getVersion());
    fixture.shared.dispatchSync({
      ...changeTableNameAction({ id: SEED.users, value: 'stale' }),
      version: 1,
      tags: Tag.shared,
    });

    expect(fixture.seen).toEqual([]);
    expect(fixture.store.state.lww).toEqual(peer.store.state.lww);
    expect(fixture.shared.getVersion()).toBe(peer.shared.getVersion());
    expect(fixture.store.state.collections.tableEntities[SEED.users].name).toBe(
      'users'
    );
  });

  it('forgets the trackers of one other editor and their expiry, keeping every other editor’s', () => {
    vi.useFakeTimers();
    const fixture = make();
    const trackers = (editorId: string): AnyAction[] =>
      [
        sharedMouseTrackerAction({ x: 1, y: 2 }),
        sharedFocusTrackerAction({
          focus: { tableId: 't1', columnId: null, focusType: 'tableName' },
        }),
        sharedSelectionTrackerAction({ selectedIds: ['t1'] }),
        sharedDragSelectTrackerAction({ rect: { x: 0, y: 0, w: 4, h: 4 } }),
      ].map(action => ({
        ...action,
        tags: Tag.shared,
        meta: { editorId, nickname: editorId },
      }));
    fixture.shared.dispatchSync(trackers('gone'));
    fixture.shared.dispatchSync(trackers('kept'));
    const { editor } = fixture.store.state;
    const maps = () => [
      editor.sharedMouseTrackerMap,
      editor.sharedFocusTrackerMap,
      editor.sharedSelectionTrackerMap,
      editor.sharedDragSelectTrackerMap,
    ];
    const timers = maps().map(map => map.gone.timeoutId);
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    const before = vi.getTimerCount();

    fixture.shared.forgetPeer('gone');

    expect(maps().map(map => Object.keys(map))).toEqual([
      ['kept'],
      ['kept'],
      ['kept'],
      ['kept'],
    ]);
    timers.forEach(timer => expect(clear).toHaveBeenCalledWith(timer));
    expect(vi.getTimerCount()).toBe(before - 4);
  });

  describe.each([
    ['every lock on', true],
    ['every lock off', false],
  ])('a rejoin under %s (AC-P11)', (_label, locked) => {
    it.each([
      ['the Schema SQL tab', [CanvasType.schemaSQL]],
      [
        'the Settings tab through Schema SQL',
        [CanvasType.schemaSQL, CanvasType.settings],
      ],
    ])(
      'keeps a screen scrolled, zoomed and moved to %s, and the tab it came from, while the value is the snapshot’s, sending only the request for registers',
      (_tab, tabs) => {
        const canvasType = tabs[tabs.length - 1];
        vi.useFakeTimers();
        const value = seedValue(locked);
        const peer = makePeer(value);
        const reader = makeReader(value);
        reader.shared.subscribe(actions => reader.seen.push(actions));
        reader.store.dispatchSync(addTable('mine'));
        reader.store.dispatchSync(
          scrollToAction({ originX: SCREEN.originX, originY: SCREEN.originY }),
          changeZoomLevelAction({ value: SCREEN.zoomLevel })
        );
        tabs.forEach(value =>
          reader.store.dispatchSync(changeCanvasTypeAction({ value }))
        );
        const { lastCanvasType } = reader.store.state.editor;
        peer.store.dispatchSync(addTable('t9'));
        peer.store.dispatchSync(
          changeTableNameAction({ id: 't9', value: 'theirs' })
        );
        vi.advanceTimersByTime(400);
        expect(reader.store.history.size).toBeGreaterThan(0);
        const versionBefore = reader.shared.getVersion();
        let changes = 0;
        const changed = reader.store.change$.subscribe(() => changes++);
        reader.reset();
        const snapshot = snapshotOf(peer);

        reader.shared.reseed(snapshot.value, {
          lww: snapshot.lww,
          version: snapshot.version,
          keepScreen: true,
        });
        vi.advanceTimersByTime(400);
        changed.unsubscribe();

        expect(screenOf(reader)).toEqual({ ...SCREEN, canvasType });
        expect(reader.store.state.editor.lastCanvasType).toBe(lastCanvasType);
        expect(reader.types()).toEqual(['editor.getLWW']);
        expect(changes).toBe(0);
        expect(reader.store.history.size).toBe(0);
        expect(reader.store.state.editor.hasUndo).toBe(false);
        expect(reader.shared.getLWW()).toEqual(snapshot.lww);
        expect(reader.shared.getVersion()).toBe(
          Math.max(versionBefore, snapshot.version)
        );
        expect(reader.store.state.doc.tableIds).not.toContain('mine');
        expect(reader.store.state.collections.tableEntities.t9.name).toBe(
          'theirs'
        );
        if (locked) {
          expect(documentJsonOf(reader.store)).toBe(documentJsonOf(peer.store));
        } else {
          expect(outsideScreen(reader)).toEqual(outsideScreen(peer));
        }
        expect(documentJsonOf(reader.store)).toBe(
          documentJsonOf(lateJoinerOf(snapshot).store)
        );
        expect(runtimeJsonOf(reader.store)).toBe(
          runtimeJsonOf(lateJoinerOf(snapshot).store)
        );
      }
    );

    it('leads the reader’s next pan with where the screen stands, so a replica takes the screen’s zoom', () => {
      vi.useFakeTimers();
      const value = seedValue(locked);
      const peer = makePeer(value);
      const reader = makeReader(value);
      reader.shared.subscribe(actions => reader.seen.push(actions));
      reader.store.dispatchSync(
        scrollToAction({ originX: SCREEN.originX, originY: SCREEN.originY }),
        changeZoomLevelAction({ value: SCREEN.zoomLevel })
      );
      vi.advanceTimersByTime(400);
      const snapshot = snapshotOf(peer);
      reader.shared.reseed(snapshot.value, {
        lww: snapshot.lww,
        version: snapshot.version,
        keepScreen: true,
      });
      vi.advanceTimersByTime(400);
      reader.reset();

      reader.store.dispatchSync(
        streamScrollToAction({ movementX: 30, movementY: 0 })
      );
      vi.advanceTimersByTime(400);

      expect(
        reader.seen.flat().map(({ type, payload }) => [type, payload])
      ).toEqual([
        [
          'settings.scrollTo',
          { originX: SCREEN.originX, originY: SCREEN.originY },
        ],
        ['settings.changeZoomLevel', { value: SCREEN.zoomLevel }],
        [
          'settings.scrollTo',
          { originX: SCREEN.originX + 30, originY: SCREEN.originY },
        ],
      ]);
      expect(reader.store.state.editor.screenBaseline).toBeNull();
    });

    it('keeps the screen of a readonly reader, and leads its first pan once writable with it', () => {
      vi.useFakeTimers();
      const value = seedValue(locked);
      const peer = makePeer(value);
      const reader = makeReader(value);
      reader.shared.subscribe(actions => reader.seen.push(actions));
      reader.setReadonly(true);
      reader.store.dispatchSync(
        scrollToAction({ originX: SCREEN.originX, originY: SCREEN.originY }),
        changeZoomLevelAction({ value: SCREEN.zoomLevel }),
        changeCanvasTypeAction({ value: CanvasType.schemaSQL })
      );
      peer.store.dispatchSync(addTable('t9'));
      vi.advanceTimersByTime(400);
      reader.reset();
      const snapshot = snapshotOf(peer);

      reader.shared.reseed(snapshot.value, {
        lww: snapshot.lww,
        version: snapshot.version,
        keepScreen: true,
      });
      vi.advanceTimersByTime(400);

      expect(screenOf(reader)).toEqual({
        ...SCREEN,
        canvasType: CanvasType.schemaSQL,
      });
      expect(reader.types()).toEqual(['editor.getLWW']);
      expect(reader.store.state.doc.tableIds).toContain('t9');
      if (locked) {
        expect(documentJsonOf(reader.store)).toBe(documentJsonOf(peer.store));
      } else {
        expect(outsideScreen(reader)).toEqual(outsideScreen(peer));
      }
      expect(documentJsonOf(reader.store)).toBe(
        documentJsonOf(lateJoinerOf(snapshot).store)
      );

      reader.setReadonly(false);
      reader.store.dispatchSync(restoreScreenSettingsAction$());
      reader.reset();
      reader.store.dispatchSync(
        streamScrollToAction({ movementX: 30, movementY: 0 })
      );
      vi.advanceTimersByTime(400);

      expect(reader.types()).toEqual([
        'settings.scrollTo',
        'settings.changeZoomLevel',
        'settings.scrollTo',
      ]);
      expect(reader.seen.flat()[1].payload).toEqual({
        value: SCREEN.zoomLevel,
      });
    });

    it('keeps the name view the reader switched to while its lock holds, and shows the value’s once it is shared', () => {
      vi.useFakeTimers();
      const value = seedValue(locked);
      const peer = makePeer(value);
      const reader = makeReader(value);
      reader.shared.subscribe(actions => reader.seen.push(actions));
      reader.store.dispatchSync(
        toNameViewModeAction(reader.store.state, NameViewMode.logical, false)
      );
      vi.advanceTimersByTime(400);
      reader.reset();
      const snapshot = snapshotOf(peer);

      reader.shared.reseed(snapshot.value, {
        lww: snapshot.lww,
        version: snapshot.version,
        keepScreen: true,
      });
      vi.advanceTimersByTime(400);

      expect(reader.store.state.settings.nameViewMode).toBe(
        locked ? NameViewMode.logical : NameViewMode.physical
      );
      expect(reader.types()).toEqual(['editor.getLWW']);
      if (locked) {
        expect(documentJsonOf(reader.store)).toBe(documentJsonOf(peer.store));
      } else {
        expect(outsideScreen(reader)).toEqual(outsideScreen(peer));
      }
      const joiner = lateJoinerOf(snapshot);
      expect(documentJsonOf(reader.store)).toBe(documentJsonOf(joiner.store));

      [reader, joiner].forEach(({ store }) =>
        store.dispatchSync(
          toNameViewModeAction(store.state, NameViewMode.both, false)
        )
      );

      expect(reader.store.state.editor.screenBaseline?.nameViewMode).toBe(
        undefined
      );
      expect(documentJsonOf(reader.store)).toBe(documentJsonOf(joiner.store));
    });

    it('keeps the show bits, the database and the code settings a readonly reader turned, the value’s beneath until it turns writable', () => {
      vi.useFakeTimers();
      const value = seedValue(locked);
      const peer = makePeer(value);
      const reader = makeReader(value);
      reader.shared.subscribe(actions => reader.seen.push(actions));
      const held = (fixture: Fixture) => {
        const { show, database, language, tableNameCase } =
          fixture.store.state.settings;
        return { show, database, language, tableNameCase };
      };
      reader.setReadonly(true);
      reader.store.dispatchSync(
        changeShowAction({
          show: Show.tableComment,
          value: !bHas(reader.store.state.settings.show, Show.tableComment),
        }),
        changeDatabaseAction({ value: Database.SQLite }),
        changeLanguageAction({ value: Language.Kotlin }),
        changeTableNameCaseAction({ value: NameCase.snakeCase })
      );
      const turned = held(reader);
      expect(turned).not.toEqual(held(peer));
      vi.advanceTimersByTime(400);
      reader.reset();
      const snapshot = snapshotOf(peer);

      reader.shared.reseed(snapshot.value, {
        lww: snapshot.lww,
        version: snapshot.version,
        keepScreen: true,
      });
      vi.advanceTimersByTime(400);

      expect(held(reader)).toEqual(turned);
      expect(reader.types()).toEqual(['editor.getLWW']);
      if (locked) {
        expect(documentJsonOf(reader.store)).toBe(documentJsonOf(peer.store));
      } else {
        expect(outsideScreen(reader)).toEqual(outsideScreen(peer));
      }
      expect(documentJsonOf(reader.store)).toBe(
        documentJsonOf(lateJoinerOf(snapshot).store)
      );

      reader.setReadonly(false);
      reader.store.dispatchSync(restoreScreenSettingsAction$());
      vi.advanceTimersByTime(400);

      expect(held(reader)).toEqual(held(peer));
      expect(reader.types()).toEqual(['editor.getLWW']);
    });
  });

  it('shows the shared name view once the snapshot unlocks it, though the reader held its own under the lock', () => {
    const value = seedValue(true);
    const peer = makePeer(value);
    const reader = makeReader(value);
    reader.store.dispatchSync(
      toNameViewModeAction(reader.store.state, NameViewMode.logical, false)
    );
    peer.store.dispatchSync(
      changeLockSettingsAction({
        lockSettingType: LockSettingType.unlockNameViewMode,
        value: false,
        values: { nameViewMode: NameViewMode.physical },
      })
    );
    const snapshot = snapshotOf(peer);

    reader.shared.reseed(snapshot.value, {
      lww: snapshot.lww,
      version: snapshot.version,
      keepScreen: true,
    });

    expect(reader.store.state.settings.nameViewMode).toBe(
      NameViewMode.physical
    );
    expect(reader.store.state.editor.screenBaseline?.nameViewMode).toBe(
      undefined
    );
    expect(documentJsonOf(reader.store)).toBe(documentJsonOf(peer.store));
  });

  /** Far from every table, where a load's pull brings the origin back at the next measure. */
  const FAR = { originX: -50000, originY: -50000 };

  it('keeps the screen of an element measured and then hidden through each rejoin while hidden and the measure that shows it', () => {
    const value = seedValue(false);
    const peer = makePeer(value);
    const reader = makeReader(value);
    reader.store.dispatchSync(
      scrollToAction(FAR),
      changeZoomLevelAction({ value: SCREEN.zoomLevel })
    );
    reader.store.dispatchSync(changeViewportAction({ width: 0, height: 0 }));
    const snapshot = snapshotOf(peer);

    for (let rejoin = 0; rejoin < 2; rejoin++) {
      reader.shared.reseed(snapshot.value, {
        lww: snapshot.lww,
        version: snapshot.version,
        keepScreen: true,
      });
    }
    reader.store.dispatchSync(changeViewportAction(READER_SIZE));

    const { originX, originY, zoomLevel } = JSON.parse(snapshot.value).settings;
    expect(reader.store.state.settings).toMatchObject({
      ...FAR,
      zoomLevel: SCREEN.zoomLevel,
    });
    expect(reader.store.state.editor.scrollPullPending).toBe(false);
    expect(JSON.parse(documentJsonOf(reader.store)).settings).toMatchObject({
      originX,
      originY,
      zoomLevel,
    });
    expect(outsideScreen(reader)).toEqual(outsideScreen(peer));
  });

  it('opens an element no measure has shown where the value’s pull puts it, keeping its tab, as a late joiner opens', () => {
    const value = seedValue(false);
    const peer = makePeer(value);
    const reader = makeReader(value, { measured: false });
    // The pull the load left waiting takes the first measure, rejoin or not,
    // so the origin the reader holds was never on a screen.
    reader.store.dispatchSync(
      scrollToAction(FAR),
      changeZoomLevelAction({ value: SCREEN.zoomLevel }),
      changeCanvasTypeAction({ value: CanvasType.schemaSQL })
    );
    const snapshot = snapshotOf(peer);

    reader.shared.reseed(snapshot.value, {
      lww: snapshot.lww,
      version: snapshot.version,
      keepScreen: true,
    });
    reader.store.dispatchSync(changeViewportAction(READER_SIZE));

    const joiner = lateJoinerOf(snapshot);
    expect(screenOf(reader)).toEqual({
      ...screenOf(joiner),
      canvasType: CanvasType.schemaSQL,
    });
    expect(reader.store.state.settings.originX).not.toBe(FAR.originX);
    expect(documentJsonOf(reader.store)).toBe(documentJsonOf(joiner.store));
  });

  it.each([
    ['never loaded', false],
    ['cleared after a load that found no screen', true],
  ])(
    'opens an element %s, which no measure has shown, where the value’s pull puts it, as a late joiner opens',
    (_label, loaded) => {
      const value = seedValue(false);
      const peer = makePeer(value);
      peer.store.dispatchSync(
        scrollToAction(FAR),
        changeZoomLevelAction({ value: SCREEN.zoomLevel })
      );
      const reader = make();
      reader.store.dispatchSync(changeViewportAction({ width: 0, height: 0 }));
      if (loaded) {
        reader.store.dispatchSync(initialLoadJsonAction$(value), clearAction());
      }
      const snapshot = snapshotOf(peer);

      reader.shared.reseed(snapshot.value, {
        lww: snapshot.lww,
        version: snapshot.version,
        keepScreen: true,
      });
      reader.store.dispatchSync(changeViewportAction(READER_SIZE));

      const joiner = lateJoinerOf(snapshot);
      expect(screenOf(reader)).toEqual(screenOf(joiner));
      expect(reader.store.state.settings.zoomLevel).toBe(SCREEN.zoomLevel);
      expect(reader.store.state.settings.originX).not.toBe(FAR.originX);
      expect(documentJsonOf(reader.store)).toBe(documentJsonOf(joiner.store));
    }
  );

  it.each([
    ['keeping the screen', true],
    ['opening the value’s', false],
  ])(
    'drops the selection and the focus, on a table a peer removed among them, %s',
    (_label, keepScreen) => {
      vi.useFakeTimers();
      const value = seedValue(true);
      const peer = makePeer(value);
      const reader = makeReader(value);
      reader.shared.subscribe(actions => reader.seen.push(actions));
      reader.store.dispatchSync(
        selectAction({
          [SEED.users]: SelectType.table,
          [SEED.orders]: SelectType.table,
        }),
        focusTableAction({
          tableId: SEED.users,
          focusType: FocusType.tableName,
        })
      );
      expect(Object.keys(reader.store.state.editor.selectedMap)).toHaveLength(
        2
      );
      peer.store.dispatchSync(removeTableAction({ id: SEED.users }));
      vi.advanceTimersByTime(400);
      reader.reset();
      const snapshot = snapshotOf(peer);

      reader.shared.reseed(snapshot.value, {
        lww: snapshot.lww,
        version: snapshot.version,
        keepScreen,
      });
      vi.advanceTimersByTime(400);

      expect(reader.store.state.editor.selectedMap).toEqual({});
      expect(reader.store.state.editor.focusTable).toBeNull();
      expect(reader.store.state.doc.tableIds).not.toContain(SEED.users);
      expect(reader.types()).toEqual(['editor.getLWW']);
    }
  );

  it('closes a Flow view open at the rejoin, then keeps the screen it stood over, on the Visualization tab', () => {
    const value = seedValue(false);
    const peer = makePeer(value);
    const reader = makeReader(value);
    reader.store.dispatchSync(
      scrollToAction({ originX: SCREEN.originX, originY: SCREEN.originY }),
      changeZoomLevelAction({ value: SCREEN.zoomLevel })
    );
    reader.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.visualization }),
      changeVisualizationModeAction({ value: VisualizationMode.flow })
    );
    reader.store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
    reader.store.dispatchSync(
      selectAction({ [SEED.users]: SelectType.table }),
      focusTableAction({ tableId: SEED.users, focusType: FocusType.tableName })
    );
    expect(getActiveView(reader.store.state)).not.toBeNull();
    expect(reader.store.state.editor.focusTable).not.toBeNull();
    const snapshot = snapshotOf(peer);

    reader.shared.reseed(snapshot.value, {
      lww: snapshot.lww,
      version: snapshot.version,
      keepScreen: true,
    });

    expect(reader.store.state.editor.views.flow).toBeNull();
    expect(reader.store.state.editor.selectedMap).toEqual({});
    expect(reader.store.state.editor.focusTable).toBeNull();
    expect(screenOf(reader)).toEqual({
      ...SCREEN,
      canvasType: CanvasType.visualization,
    });
    expect(documentJsonOf(reader.store)).toBe(
      documentJsonOf(lateJoinerOf(snapshot).store)
    );
  });

  it('opens the snapshot’s screen too unless asked to keep the reader’s, holding no baseline', () => {
    const value = seedValue(false);
    const peer = makePeer(value);
    const reader = makeReader(value);
    reader.store.dispatchSync(
      scrollToAction({ originX: SCREEN.originX, originY: SCREEN.originY }),
      changeCanvasTypeAction({ value: CanvasType.schemaSQL })
    );
    const snapshot = snapshotOf(peer);
    const joiner = lateJoinerOf(snapshot);

    reader.shared.reseed(snapshot.value, {
      lww: snapshot.lww,
      version: snapshot.version,
    });

    expect(screenOf(reader)).toEqual(screenOf(joiner));
    expect(reader.store.state.editor.screenBaseline).toBeNull();
    expect(documentJsonOf(reader.store)).toBe(documentJsonOf(joiner.store));
  });
});
