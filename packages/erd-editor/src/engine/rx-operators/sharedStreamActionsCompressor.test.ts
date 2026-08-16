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

import { sharedMouseTrackerAction } from '@/engine/modules/editor/atom.actions';
import { moveMemoAction } from '@/engine/modules/memo/atom.actions';
import { streamZoomLevelAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  moveTableAction,
} from '@/engine/modules/table/atom.actions';
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
    source$.next([sharedMouseTrackerAction({ x: 4, y: 4 })]);

    expect(emitted).toEqual([
      [sharedMouseTrackerAction({ x: 1, y: 1 })],
      [sharedMouseTrackerAction({ x: 4, y: 4 })],
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
