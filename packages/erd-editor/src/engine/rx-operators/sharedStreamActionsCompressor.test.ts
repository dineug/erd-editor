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

import {
  sharedDragSelectTrackerAction,
  sharedFocusTrackerAction,
  sharedMouseTrackerAction,
  sharedSelectionTrackerAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType } from '@/engine/modules/editor/state';
import {
  moveMemoAction,
  resizeMemoAction,
} from '@/engine/modules/memo/atom.actions';
import { streamZoomLevelAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableColorAction,
  moveTableAction,
} from '@/engine/modules/table/atom.actions';
import { bufferCircuitBreaker } from '@/engine/rx-operators/bufferCircuitBreaker';
import { createSharedStreamActionsCompressor } from '@/engine/rx-operators/createSharedStreamActionsCompressor';
import { flushOnNotifier } from '@/engine/rx-operators/flushOnNotifier';
import { sharedStreamActionsCompressor } from '@/engine/rx-operators/sharedStreamActionsCompressor';

function createHarness() {
  const source$ = new Subject<Array<AnyAction>>();
  const emitted: Array<Array<AnyAction>> = [];
  source$
    .pipe(sharedStreamActionsCompressor)
    .subscribe(actions => emitted.push(actions));
  return { source$, emitted };
}

describe('sharedStreamActionsCompressor', () => {
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

  it('accumulates buffered table moves into a single redo action', () => {
    const { source$, emitted } = createHarness();

    source$.next([
      moveTableAction({ ids: ['t1'], movementX: 30, movementY: 10 }),
    ]);
    source$.next([
      moveTableAction({ ids: ['t1'], movementX: 20, movementY: 5 }),
    ]);
    expect(emitted).toEqual([]);

    vi.advanceTimersByTime(200);

    expect(emitted).toEqual([
      [moveTableAction({ ids: ['t1'], movementX: 50, movementY: 15 })],
    ]);
  });

  it('keeps the raw actions when the stream produced no history redo actions', () => {
    const { source$, emitted } = createHarness();
    const tinyMove = moveTableAction({
      ids: ['t1'],
      movementX: 1,
      movementY: 1,
    });

    source$.next([tinyMove]);
    vi.advanceTimersByTime(200);

    expect(emitted).toEqual([[tinyMove]]);
  });

  it('regroups table and memo moves into one @@move batch', () => {
    const { source$, emitted } = createHarness();

    source$.next([
      moveTableAction({ ids: ['t1'], movementX: 30, movementY: 0 }),
      moveMemoAction({ ids: ['m1'], movementX: 0, movementY: 40 }),
    ]);

    vi.advanceTimersByTime(200);

    expect(emitted).toEqual([
      [
        moveTableAction({ ids: ['t1'], movementX: 30, movementY: 0 }),
        moveMemoAction({ ids: ['m1'], movementX: 0, movementY: 40 }),
      ],
    ]);
  });

  it('sums stream zoom levels regrouped under @@scroll', () => {
    const { source$, emitted } = createHarness();

    source$.next([streamZoomLevelAction({ value: 0.1 })]);
    source$.next([streamZoomLevelAction({ value: 0.2 })]);

    vi.advanceTimersByTime(200);

    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toHaveLength(1);
    expect(emitted[0][0].type).toBe(streamZoomLevelAction.type);
    expect(emitted[0][0].payload.value).toBeCloseTo(0.3, 10);
  });

  it('separates a plain action from the buffered stream actions in one batch', () => {
    const { source$, emitted } = createHarness();
    const add = addTableAction({
      id: 't1',
      ui: { x: 0, y: 0, zIndex: 1 },
    });

    source$.next([
      moveTableAction({ ids: ['t1'], movementX: 30, movementY: 0 }),
      add,
    ]);

    expect(emitted).toEqual([[add]]);

    vi.advanceTimersByTime(200);

    expect(emitted).toEqual([
      [add],
      [moveTableAction({ ids: ['t1'], movementX: 30, movementY: 0 })],
    ]);
  });

  it('propagates errors from the source', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const onError = vi.fn();
    source$.pipe(sharedStreamActionsCompressor).subscribe({ error: onError });

    const err = new Error('boom');
    source$.error(err);

    expect(onError).toHaveBeenCalledWith(err);
  });
});

describe('sharedStreamActionsCompressor versions', () => {
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

  it.each([
    [
      'a lone memo.resize',
      resizeMemoAction({ id: 'm1', x: 0, y: 0, width: 120, height: 80 }),
    ],
    [
      'a table.move under the move threshold',
      moveTableAction({ ids: ['t1'], movementX: 1, movementY: 1 }),
    ],
  ])(
    'lets %s through with its version when the handler builds nothing',
    (_, action) => {
      const { source$, emitted } = createHarness();
      const versioned = { ...action, version: 7 };

      source$.next([versioned]);
      vi.advanceTimersByTime(200);

      expect(emitted).toEqual([[versioned]]);
      expect(emitted[0][0].version).toBe(7);
    }
  );
});

describe('createSharedStreamActionsCompressor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createNotifiedHarness() {
    const notifier$ = new Subject<void>();
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(createSharedStreamActionsCompressor(flushOnNotifier(notifier$)))
      .subscribe(actions => emitted.push(actions));
    return { notifier$, source$, emitted };
  }

  it('waits out the same 200 ms quiet period as the editor instance when given no operator', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(createSharedStreamActionsCompressor())
      .subscribe(actions => emitted.push(actions));

    source$.next([
      moveTableAction({ ids: ['t1'], movementX: 30, movementY: 0 }),
    ]);
    vi.advanceTimersByTime(199);
    expect(emitted).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(emitted).toEqual([
      [moveTableAction({ ids: ['t1'], movementX: 30, movementY: 0 })],
    ]);
  });

  it('closes an edit stream when the notifier fires instead of after a quiet period', () => {
    const { notifier$, source$, emitted } = createNotifiedHarness();

    source$.next([
      moveTableAction({ ids: ['t1'], movementX: 30, movementY: 10 }),
    ]);
    source$.next([
      moveTableAction({ ids: ['t1'], movementX: 20, movementY: 5 }),
    ]);
    vi.advanceTimersByTime(10_000);
    expect(emitted).toEqual([]);

    notifier$.next();

    expect(emitted).toEqual([
      [moveTableAction({ ids: ['t1'], movementX: 50, movementY: 15 })],
    ]);
  });

  it('keeps the presence throttle on its own timer', () => {
    const { notifier$, source$, emitted } = createNotifiedHarness();

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
      const notifier$ = new Subject<void>();
      const opening$ = new Subject<void>();
      const compressor = createSharedStreamActionsCompressor(
        flushOnNotifier(notifier$)
      );
      const source$ = new Subject<Array<AnyAction>>();
      const emitted: Array<Array<AnyAction>> = [];
      source$
        .pipe(
          compressor,
          bufferCircuitBreaker(opening$, new Subject<void>()),
          compressor
        )
        .subscribe(actions => emitted.push(actions));
      opening$.next();

      source$.next([action]);
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
