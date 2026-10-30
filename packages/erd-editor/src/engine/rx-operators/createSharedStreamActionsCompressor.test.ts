import { AnyAction } from '@dineug/r-html';
import { Subject } from 'rxjs';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import {
  POSITION_REGISTER,
  VIEWPORT_REGISTER,
} from '@/engine/geometryRegisters';
import {
  initialClearAction,
  mergeLWWAction,
  sharedDragSelectTrackerAction,
  sharedFocusTrackerAction,
  sharedMouseTrackerAction,
  sharedSelectionTrackerAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType } from '@/engine/modules/editor/state';
import {
  addMemoAction,
  moveMemoAction,
  moveToMemoAction,
  resizeMemoAction,
} from '@/engine/modules/memo/atom.actions';
import {
  changeZoomLevelAction,
  scrollToAction,
  streamScrollToAction,
  streamZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableColorAction,
  moveTableAction,
  moveToTableAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  addTableGroupAction,
  moveTableGroupAction,
  moveToTableGroupAction,
} from '@/engine/modules/table-group/atom.actions';
import { bufferCircuitBreaker } from '@/engine/rx-operators/bufferCircuitBreaker';
import { createSharedStreamActionsCompressor } from '@/engine/rx-operators/createSharedStreamActionsCompressor';
import { flushOnNotifier } from '@/engine/rx-operators/flushOnNotifier';
import type { StreamBufferOperator } from '@/engine/rx-operators/groupByStreamActions';
import { createStore } from '@/engine/store';
import { Tag } from '@/engine/tag';

const at = (action: AnyAction, version: number): AnyAction => ({
  ...action,
  version,
});

/**
 * The compressor over a store of its own, which a spec reduces each batch into
 * before it hands the batch on, as the shared store hears what its store has
 * reduced; the store starts with t1 and t2 at (200, 100), m1 and g1.
 */
function createHarness(operator?: StreamBufferOperator) {
  const store = createStore({
    toWidth: text => text.length * 10,
    clock: new Clock(),
  });
  store.dispatchSync([
    at(addTableAction({ id: 't1', ui: { x: 200, y: 100, zIndex: 1 } }), 1),
    at(addTableAction({ id: 't2', ui: { x: 200, y: 100, zIndex: 1 } }), 1),
    at(addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 1 } }), 1),
    at(
      addTableGroupAction({
        id: 'g1',
        ui: { x: 40, y: 40, width: 400, height: 300, zIndex: 1 },
      }),
      1
    ),
  ]);
  const source$ = new Subject<Array<AnyAction>>();
  const emitted: Array<Array<AnyAction>> = [];
  source$
    .pipe(createSharedStreamActionsCompressor(operator, () => store.state))
    .subscribe(actions => emitted.push(actions));

  return {
    store,
    source$,
    emitted,
    reduce: (...actions: AnyAction[]) => {
      store.dispatchSync(actions);
      source$.next(actions);
    },
  };
}

const step = (ids: string[], movementX: number, movementY = 0) =>
  moveTableAction({ ids, movementX, movementY });

describe('createSharedStreamActionsCompressor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes a plain change action straight through', () => {
    const { source$, emitted } = createHarness();
    const add = addTableAction({
      id: 't1',
      ui: { x: 0, y: 0, zIndex: 1 },
    });

    source$.next([add]);

    expect(emitted).toEqual([[add]]);
  });

  it('compresses a throttled window of shared mouse trackers down to the last one', () => {
    const { source$, emitted } = createHarness();

    source$.next([sharedMouseTrackerAction({ x: 1, y: 1 })]);
    expect(emitted).toEqual([[sharedMouseTrackerAction({ x: 1, y: 1 })]]);

    source$.next([sharedMouseTrackerAction({ x: 2, y: 2 })]);
    source$.next([sharedMouseTrackerAction({ x: 3, y: 3 })]);
    expect(emitted).toHaveLength(1);

    vi.advanceTimersByTime(100);

    expect(emitted).toEqual([
      [sharedMouseTrackerAction({ x: 1, y: 1 })],
      [sharedMouseTrackerAction({ x: 3, y: 3 })],
    ]);
  });

  it('delivers the last action of a burst instead of stranding it in the buffer', () => {
    const { source$, emitted } = createHarness();

    source$.next([sharedMouseTrackerAction({ x: 1, y: 1 })]);
    source$.next([sharedMouseTrackerAction({ x: 2, y: 2 })]);
    source$.next([sharedMouseTrackerAction({ x: 3, y: 3 })]);

    vi.advanceTimersByTime(1000);

    expect(emitted.at(-1)).toEqual([sharedMouseTrackerAction({ x: 3, y: 3 })]);
  });

  it('delivers a terminal shared focus action so a peer never keeps a stale marker', () => {
    const { source$, emitted } = createHarness();
    const move = sharedFocusTrackerAction({
      focus: {
        tableId: 't1',
        columnId: 'c1',
        focusType: FocusType.columnName,
      },
    });
    const clear = sharedFocusTrackerAction({ focus: null });

    source$.next([move]);
    source$.next([clear]);

    vi.advanceTimersByTime(1000);

    expect(emitted.at(-1)).toEqual([clear]);
  });

  it('delivers a terminal shared drag select action so a peer never keeps a phantom marquee', () => {
    const { source$, emitted } = createHarness();
    const drag = sharedDragSelectTrackerAction({
      rect: { x: 10, y: 20, w: 200, h: 100 },
    });
    const clear = sharedDragSelectTrackerAction({ rect: null });

    source$.next([drag]);
    source$.next([clear]);

    vi.advanceTimersByTime(1000);

    expect(emitted.at(-1)).toEqual([clear]);
  });

  it('groups every shared tracker by its own type, so a regroup alias over them would drop whole presence channels', () => {
    const { source$, emitted } = createHarness();
    const focus1 = sharedFocusTrackerAction({
      focus: { tableId: 't1', columnId: null, focusType: FocusType.tableName },
    });
    const focus2 = sharedFocusTrackerAction({
      focus: {
        tableId: 't1',
        columnId: 'c1',
        focusType: FocusType.columnName,
      },
    });
    const selection1 = sharedSelectionTrackerAction({ selectedIds: ['t1'] });
    const selection2 = sharedSelectionTrackerAction({
      selectedIds: ['m1', 't1'],
    });
    const dragSelect1 = sharedDragSelectTrackerAction({
      rect: { x: 0, y: 0, w: 10, h: 10 },
    });
    const dragSelect2 = sharedDragSelectTrackerAction({
      rect: { x: 0, y: 0, w: 20, h: 20 },
    });

    source$.next([
      sharedMouseTrackerAction({ x: 1, y: 1 }),
      focus1,
      selection1,
      dragSelect1,
      sharedMouseTrackerAction({ x: 2, y: 2 }),
      focus2,
      selection2,
      dragSelect2,
    ]);

    vi.advanceTimersByTime(100);

    expect(emitted).toEqual([
      [sharedMouseTrackerAction({ x: 2, y: 2 })],
      [focus2],
      [selection2],
      [dragSelect2],
    ]);
  });

  it('propagates errors from the source', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const onError = vi.fn();
    source$
      .pipe(createSharedStreamActionsCompressor(undefined, () => ({}) as never))
      .subscribe({ error: onError });

    const err = new Error('boom');
    source$.error(err);

    expect(onError).toHaveBeenCalledWith(err);
  });
});

describe('createSharedStreamActionsCompressor versions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends the redo action the stream handler builds, which carries no version', () => {
    const { source$, emitted } = createHarness();

    source$.next([
      {
        ...changeTableColorAction({ id: 't1', color: '#f00', prevColor: '' }),
        version: 5,
      },
    ]);
    source$.next([
      {
        ...changeTableColorAction({
          id: 't1',
          color: '#0f0',
          prevColor: '#f00',
        }),
        version: 6,
      },
    ]);
    vi.advanceTimersByTime(200);

    expect(emitted).toEqual([
      [changeTableColorAction({ id: 't1', color: '#0f0', prevColor: '' })],
    ]);
    expect(emitted[0][0]).not.toHaveProperty('version');
  });

  it('lets a lone memo.resize through with its version when the handler builds nothing', () => {
    const { source$, emitted } = createHarness();
    const versioned = {
      ...resizeMemoAction({ id: 'm1', x: 0, y: 0, width: 120, height: 80 }),
      version: 7,
    };

    source$.next([versioned]);
    vi.advanceTimersByTime(200);

    expect(emitted).toEqual([[versioned]]);
    expect(emitted[0][0].version).toBe(7);
  });
});

describe('createSharedStreamActionsCompressor absolute moves', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a drag’s steps as the point the table ends at, at the highest version of its steps (AC-P1)', () => {
    const { store, reduce, emitted } = createHarness();

    reduce(at(step(['t1'], 30, 10), 5));
    reduce(at(step(['t1'], 20, 5), 6));
    expect(emitted).toEqual([]);

    vi.advanceTimersByTime(200);

    expect(emitted).toEqual([
      [at(moveToTableAction({ id: 't1', x: 250, y: 115 }), 6)],
    ]);
    expect(store.state.lww.t1[3][POSITION_REGISTER]).toBe(6);
  });

  it('gives each entity the highest version of its own steps, not of the burst', () => {
    const { reduce, emitted } = createHarness();

    reduce(at(step(['t1'], 30), 10));
    reduce(at(step(['t1'], 30), 12));
    reduce(at(step(['t2'], 30), 13));
    reduce(at(step(['t2'], 30), 14));
    vi.advanceTimersByTime(200);

    expect(emitted).toEqual([
      [
        at(moveToTableAction({ id: 't1', x: 260, y: 100 }), 12),
        at(moveToTableAction({ id: 't2', x: 260, y: 100 }), 14),
      ],
    ]);
  });

  it('sends the point a peer’s later write left at its own steps’ version, which that write’s own version overrides', () => {
    const { store, reduce, emitted } = createHarness();

    reduce(at(step(['t1'], 30), 5));
    store.dispatchSync({
      ...at(moveToTableAction({ id: 't1', x: -40, y: 60 }), 9),
      tags: Tag.shared,
    });
    vi.advanceTimersByTime(200);

    expect(emitted).toEqual([
      [at(moveToTableAction({ id: 't1', x: -40, y: 60 }), 5)],
    ]);
  });

  it('keeps its own steps’ version after a handshake raised the register past it, which brought no point', () => {
    const { store, reduce, emitted } = createHarness();

    reduce(at(step(['t1'], 30), 5));
    store.dispatchSync({
      ...at(
        mergeLWWAction({
          lww: { t1: ['tableEntities', 0, 0, { [POSITION_REGISTER]: 9 }] },
        }),
        9
      ),
      tags: Tag.shared,
    });
    vi.advanceTimersByTime(200);

    expect(store.state.lww.t1[3][POSITION_REGISTER]).toBe(9);
    expect(emitted).toEqual([
      [at(moveToTableAction({ id: 't1', x: 230, y: 100 }), 5)],
    ]);
  });

  it('takes the highest version of the steps, though a later one came in lower', () => {
    const { source$, emitted } = createHarness();

    source$.next([at(step(['t1'], 30), 7)]);
    source$.next([at(step(['t1'], 30), 3)]);
    vi.advanceTimersByTime(200);

    expect(emitted).toEqual([
      [at(moveToTableAction({ id: 't1', x: 200, y: 100 }), 7)],
    ]);
  });

  it('sends a removed table it moved, which its tombstone keeps', () => {
    const { reduce, store, emitted } = createHarness();

    reduce(at(step(['t1'], 30), 5));
    store.dispatchSync(at(removeTableAction({ id: 't1' }), 6));
    vi.advanceTimersByTime(200);

    expect(store.state.doc.tableIds).toEqual(['t2']);
    expect(emitted).toEqual([
      [at(moveToTableAction({ id: 't1', x: 230, y: 100 }), 5)],
    ]);
  });

  it('passes over an id the collection holds no entity for, and sends nothing when none is left', () => {
    const { reduce, store, emitted } = createHarness();

    reduce(at(step(['t1', 't2'], 30), 5));
    store.dispatchSync(initialClearAction());
    vi.advanceTimersByTime(200);
    expect(emitted).toEqual([]);

    store.dispatchSync(
      at(addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 1 } }), 7)
    );
    reduce(at(step(['t1', 'ghost'], 30), 8));
    store.dispatchSync(initialClearAction());
    store.dispatchSync(
      at(addTableAction({ id: 't1', ui: { x: 30, y: 0, zIndex: 1 } }), 9)
    );
    vi.advanceTimersByTime(200);

    expect(emitted).toEqual([
      [at(moveToTableAction({ id: 't1', x: 30, y: 0 }), 8)],
    ]);
  });

  it('sends one point per table however many of the burst’s lists name it, in the order they first do', () => {
    const { reduce, emitted } = createHarness();

    reduce(at(step(['t2', 't1'], 30), 5));
    reduce(at(step(['t1'], 30), 6));
    vi.advanceTimersByTime(200);

    expect(emitted).toEqual([
      [
        at(moveToTableAction({ id: 't2', x: 230, y: 100 }), 5),
        at(moveToTableAction({ id: 't1', x: 260, y: 100 }), 6),
      ],
    ]);
  });

  it('sends a drag under 20 px, which the history keeps no entry for', () => {
    const { reduce, emitted } = createHarness();

    reduce(at(step(['t1'], 1, 1), 5));
    vi.advanceTimersByTime(200);

    expect(emitted).toEqual([
      [at(moveToTableAction({ id: 't1', x: 201, y: 101 }), 5)],
    ]);
  });

  it('sends a group drag’s tables, memos and groups in one batch, without the drag’s tag, which would hold a receiver’s sort to the 5 ms window', () => {
    const { reduce, emitted } = createHarness();
    const drag = (action: AnyAction, version: number) => ({
      ...at(action, version),
      tags: Tag.drag,
    });

    reduce(
      drag(
        moveTableGroupAction({ ids: ['g1'], movementX: 40, movementY: 0 }),
        5
      ),
      drag(step(['t1'], 40), 5),
      drag(moveMemoAction({ ids: ['m1'], movementX: 0, movementY: 40 }), 5)
    );
    vi.advanceTimersByTime(200);

    expect(emitted).toStrictEqual([
      [
        at(moveToTableAction({ id: 't1', x: 240, y: 100 }), 5),
        at(moveToMemoAction({ id: 'm1', x: 0, y: 40 }), 5),
        at(moveToTableGroupAction({ id: 'g1', x: 80, y: 40 }), 5),
      ],
    ]);
  });

  it('keeps every other tag of an id’s last step', () => {
    const { reduce, emitted } = createHarness();

    reduce({ ...at(step(['t1'], 30), 5), tags: Tag.drag });
    reduce({
      ...at(step(['t1'], 30), 6),
      tags: Tag.drag | Tag.changeOnly,
    });
    vi.advanceTimersByTime(200);

    expect(emitted).toStrictEqual([
      [
        {
          ...at(moveToTableAction({ id: 't1', x: 260, y: 100 }), 6),
          tags: Tag.changeOnly,
        },
      ],
    ]);
  });

  it('sends a plain action at once and the drag beside it once its group closes', () => {
    const { reduce, emitted } = createHarness();
    const add = at(
      addTableAction({ id: 't3', ui: { x: 0, y: 0, zIndex: 1 } }),
      5
    );

    reduce(at(step(['t1'], 30), 5), add);
    expect(emitted).toEqual([[add]]);

    vi.advanceTimersByTime(200);

    expect(emitted).toEqual([
      [add],
      [at(moveToTableAction({ id: 't1', x: 230, y: 100 }), 5)],
    ]);
  });
});

describe('createSharedStreamActionsCompressor absolute viewport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a pan and a zoom as the origin and the zoom they end at, each at the highest version of its own steps', () => {
    const { store, reduce, emitted } = createHarness();

    reduce(at(streamScrollToAction({ movementX: 30, movementY: -10 }), 5));
    reduce(at(streamZoomLevelAction({ value: -0.2 }), 6));
    reduce(at(streamScrollToAction({ movementX: 10, movementY: 0 }), 7));
    vi.advanceTimersByTime(200);

    const { originX, originY } = store.state.settings;
    expect([originX, originY]).toEqual([40, -10]);
    expect(emitted).toEqual([
      [
        at(scrollToAction({ originX: 40, originY: -10 }), 7),
        at(changeZoomLevelAction({ value: 0.8 }), 6),
      ],
    ]);
    expect(store.state.lww[VIEWPORT_REGISTER][3]).toEqual({
      origin: 7,
      zoomLevel: 6,
    });
  });

  it('sends a zoom alone without an origin, and an origin alone without a zoom', () => {
    const { reduce, emitted } = createHarness();

    reduce(at(streamZoomLevelAction({ value: 0.5 }), 5));
    vi.advanceTimersByTime(200);
    reduce(at(streamScrollToAction({ movementX: 1, movementY: 1 }), 6));
    vi.advanceTimersByTime(200);

    expect(emitted).toEqual([
      [at(changeZoomLevelAction({ value: 1.5 }), 5)],
      [at(scrollToAction({ originX: 1, originY: 1 }), 6)],
    ]);
  });

  it('reads the document’s viewport, which a readonly screen keeps aside, never the screen’s', () => {
    const { store, reduce, emitted } = createHarness();

    reduce(at(streamScrollToAction({ movementX: 30, movementY: 0 }), 5));
    store.dispatchSync({
      ...at(scrollToAction({ originX: 900, originY: 900 }), 5),
      tags: Tag.screen,
    });
    vi.advanceTimersByTime(200);

    expect(store.state.settings.originX).toBe(900);
    expect(store.state.editor.screenBaseline?.viewport?.originX).toBe(30);
    expect(emitted).toEqual([
      [at(scrollToAction({ originX: 30, originY: 0 }), 5)],
    ]);
  });

  it('keeps each path’s own steps’ version after a handshake raised its register past it', () => {
    const { store, reduce, emitted } = createHarness();

    reduce(at(streamScrollToAction({ movementX: 30, movementY: 0 }), 5));
    reduce(at(streamZoomLevelAction({ value: 0.5 }), 6));
    store.dispatchSync({
      ...at(
        mergeLWWAction({
          lww: {
            [VIEWPORT_REGISTER]: [
              'settings',
              0,
              0,
              { origin: 11, zoomLevel: 12 },
            ],
          },
        }),
        12
      ),
      tags: Tag.shared,
    });
    vi.advanceTimersByTime(200);

    expect(store.state.lww[VIEWPORT_REGISTER][3]).toEqual({
      origin: 11,
      zoomLevel: 12,
    });
    expect(emitted).toEqual([
      [
        at(scrollToAction({ originX: 30, originY: 0 }), 5),
        at(changeZoomLevelAction({ value: 1.5 }), 6),
      ],
    ]);
  });

  it('stamps each path with its own steps’ version, though the store reduced none of them', () => {
    const { source$, emitted } = createHarness();

    source$.next([at(streamScrollToAction({ movementX: 9, movementY: 9 }), 4)]);
    source$.next([at(streamZoomLevelAction({ value: 0.1 }), 3)]);
    vi.advanceTimersByTime(200);

    expect(emitted).toEqual([
      [
        at(scrollToAction({ originX: 0, originY: 0 }), 4),
        at(changeZoomLevelAction({ value: 1 }), 3),
      ],
    ]);
  });
});

describe('createSharedStreamActionsCompressor stream flushing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createNotified() {
    const notifier$ = new Subject<void>();
    return { notifier$, ...createHarness(flushOnNotifier(notifier$)) };
  }

  it('waits out a 200 ms quiet period when given no operator', () => {
    const { reduce, emitted } = createHarness();

    reduce(at(step(['t1'], 30), 5));
    vi.advanceTimersByTime(199);
    expect(emitted).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(emitted).toEqual([
      [at(moveToTableAction({ id: 't1', x: 230, y: 100 }), 5)],
    ]);
  });

  it('closes an edit stream when the notifier fires instead of after a quiet period', () => {
    const { notifier$, reduce, emitted } = createNotified();

    reduce(at(step(['t1'], 30, 10), 5));
    reduce(at(step(['t1'], 20, 5), 6));
    vi.advanceTimersByTime(10_000);
    expect(emitted).toEqual([]);

    notifier$.next();

    expect(emitted).toEqual([
      [at(moveToTableAction({ id: 't1', x: 250, y: 115 }), 6)],
    ]);
  });

  it('keeps the presence throttle on its own timer', () => {
    const { notifier$, source$, emitted } = createNotified();

    source$.next([sharedMouseTrackerAction({ x: 1, y: 1 })]);
    source$.next([sharedMouseTrackerAction({ x: 2, y: 2 })]);
    notifier$.next();
    expect(emitted).toEqual([[sharedMouseTrackerAction({ x: 1, y: 1 })]]);

    vi.advanceTimersByTime(100);

    expect(emitted).toEqual([
      [sharedMouseTrackerAction({ x: 1, y: 1 })],
      [sharedMouseTrackerAction({ x: 2, y: 2 })],
    ]);
  });

  /** Two compressors around a breaker on one notifier, as the shared store stacks them. */
  function createPipe() {
    const notifier$ = new Subject<void>();
    const opening$ = new Subject<void>();
    const { store, source$ } = createHarness();
    const compressor = createSharedStreamActionsCompressor(
      flushOnNotifier(notifier$),
      () => store.state
    );
    const piped$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    piped$
      .pipe(
        compressor,
        bufferCircuitBreaker(opening$, new Subject<void>()),
        compressor
      )
      .subscribe(actions => emitted.push(actions));
    opening$.next();
    source$.complete();

    return {
      notifier$,
      emitted,
      reduce: (...actions: AnyAction[]) => {
        store.dispatchSync(actions);
        piped$.next(actions);
      },
    };
  }

  it('passes the absolute moves the first stage sends through the second unchanged, within one tick', () => {
    const { notifier$, reduce, emitted } = createPipe();

    reduce({ ...at(step(['t1'], 30), 5), tags: Tag.drag });
    reduce(at(streamScrollToAction({ movementX: 5, movementY: 0 }), 6));
    notifier$.next();

    expect(emitted).toStrictEqual([
      [at(moveToTableAction({ id: 't1', x: 230, y: 100 }), 5)],
      [at(scrollToAction({ originX: 5, originY: 0 }), 6)],
    ]);

    notifier$.next();
    expect(emitted).toHaveLength(2);
  });

  // The shared store stacks two compressors around its circuit breaker on one
  // notifier and sends two ticks per flush; this measures what the pipe needs.
  it.each([
    [
      'table.changeColor',
      changeTableColorAction({ id: 't1', color: '#f00', prevColor: '' }),
    ],
    [
      'memo.resize',
      resizeMemoAction({ id: 'm1', x: 0, y: 0, width: 120, height: 80 }),
    ],
  ])(
    'drains %s through two compressors behind a breaker within two ticks, and no further tick sends anything',
    (_, action) => {
      const { notifier$, reduce, emitted } = createPipe();

      reduce(action);
      let ticks = 0;
      while (!emitted.length && ticks < 10) {
        notifier$.next();
        ticks++;
      }
      notifier$.next();
      notifier$.next();

      expect(ticks).toBeGreaterThan(0);
      expect(ticks).toBeLessThanOrEqual(2);
      expect(emitted).toHaveLength(1);
      expect(emitted[0].map(({ type }) => type)).toEqual([action.type]);
    }
  );
});
