import { AnyAction } from '@dineug/r-html';
import { map, Subject } from 'rxjs';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { groupByStreamActions } from '@/engine/rx-operators/groupByStreamActions';

const action = (type: string, payload: any = {}): AnyAction => ({
  type,
  payload,
});

const STREAM_A = 'stream.a';
const STREAM_B = 'stream.b';
const PLAIN = 'plain.a';

describe('groupByStreamActions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('forwards non-stream actions immediately as one batch', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(groupByStreamActions([STREAM_A]))
      .subscribe(actions => emitted.push(actions));

    source$.next([action(PLAIN, 1), action('plain.b', 2)]);

    expect(emitted).toEqual([[action(PLAIN, 1), action('plain.b', 2)]]);
  });

  it('buffers stream actions until the closing notifier fires', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(groupByStreamActions([STREAM_A]))
      .subscribe(actions => emitted.push(actions));

    source$.next([action(STREAM_A, 1)]);
    source$.next([action(STREAM_A, 2)]);
    expect(emitted).toEqual([]);

    vi.advanceTimersByTime(199);
    expect(emitted).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(emitted).toEqual([[action(STREAM_A, 1), action(STREAM_A, 2)]]);
  });

  it('splits a mixed batch: plain actions now, stream actions debounced', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(groupByStreamActions([STREAM_A]))
      .subscribe(actions => emitted.push(actions));

    source$.next([action(STREAM_A, 1), action(PLAIN, 2)]);

    expect(emitted).toEqual([[action(PLAIN, 2)]]);

    vi.advanceTimersByTime(200);

    expect(emitted).toEqual([[action(PLAIN, 2)], [action(STREAM_A, 1)]]);
  });

  it('keeps distinct stream types in separate buffers', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(groupByStreamActions([STREAM_A, STREAM_B]))
      .subscribe(actions => emitted.push(actions));

    source$.next([
      action(STREAM_A, 1),
      action(STREAM_B, 2),
      action(STREAM_A, 3),
    ]);

    vi.advanceTimersByTime(200);

    expect(emitted).toEqual([
      [action(STREAM_A, 1), action(STREAM_A, 3)],
      [action(STREAM_B, 2)],
    ]);
  });

  it('merges regrouped types into a single buffered group', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(
        groupByStreamActions(
          [STREAM_A, STREAM_B],
          [['@@move', [STREAM_A, STREAM_B]]]
        )
      )
      .subscribe(actions => emitted.push(actions));

    source$.next([action(STREAM_A, 1), action(STREAM_B, 2)]);
    source$.next([action(STREAM_A, 3)]);

    vi.advanceTimersByTime(200);

    expect(emitted).toEqual([
      [action(STREAM_A, 1), action(STREAM_B, 2), action(STREAM_A, 3)],
    ]);
  });

  it('regroups types that are not part of streamActionTypes as well', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(groupByStreamActions([STREAM_A], [['@@move', [PLAIN]]]))
      .subscribe(actions => emitted.push(actions));

    source$.next([action(PLAIN, 1)]);
    expect(emitted).toEqual([]);

    vi.advanceTimersByTime(200);
    expect(emitted).toEqual([[action(PLAIN, 1)]]);
  });

  it('honours a custom buffer closing notifier operator', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(
        groupByStreamActions(
          [STREAM_A],
          [],
          map(actions => actions)
        )
      )
      .subscribe(actions => emitted.push(actions));

    source$.next([action(STREAM_A, 1)]);
    source$.next([action(STREAM_A, 2)]);

    expect(emitted).toEqual([[action(STREAM_A, 1)], [action(STREAM_A, 2)]]);
  });

  it('never emits an empty batch', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(groupByStreamActions([STREAM_A]))
      .subscribe(actions => emitted.push(actions));

    source$.next([]);
    vi.advanceTimersByTime(500);

    expect(emitted).toEqual([]);
  });

  it('propagates errors from the source', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const onError = vi.fn();
    source$.pipe(groupByStreamActions([STREAM_A])).subscribe({
      error: onError,
    });

    const err = new Error('boom');
    source$.error(err);

    expect(onError).toHaveBeenCalledWith(err);
  });

  it('flushes pending stream buffers on completion', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    const onComplete = vi.fn();
    source$.pipe(groupByStreamActions([STREAM_A])).subscribe({
      next: actions => emitted.push(actions),
      complete: onComplete,
    });

    source$.next([action(STREAM_A, 1)]);
    source$.complete();

    expect(emitted).toEqual([[action(STREAM_A, 1)]]);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
