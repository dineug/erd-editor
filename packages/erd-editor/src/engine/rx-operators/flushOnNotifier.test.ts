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

import { flushOnNotifier } from '@/engine/rx-operators/flushOnNotifier';
import { groupByStreamActions } from '@/engine/rx-operators/groupByStreamActions';

const action = (type: string, payload: any = {}): AnyAction => ({
  type,
  payload,
});

const STREAM_A = 'stream.a';
const STREAM_B = 'stream.b';
const PLAIN = 'plain.a';

function createHarness() {
  const notifier$ = new Subject<void>();
  const source$ = new Subject<Array<AnyAction>>();
  const emitted: Array<Array<AnyAction>> = [];
  source$
    .pipe(
      groupByStreamActions([STREAM_A, STREAM_B], [], flushOnNotifier(notifier$))
    )
    .subscribe(actions => emitted.push(actions));
  return { notifier$, source$, emitted };
}

describe('flushOnNotifier', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds a stream group past any quiet period until the notifier fires', () => {
    const { notifier$, source$, emitted } = createHarness();

    source$.next([action(STREAM_A, 1)]);
    source$.next([action(STREAM_A, 2)]);
    vi.advanceTimersByTime(10_000);
    expect(emitted).toEqual([]);

    notifier$.next();

    expect(emitted).toEqual([[action(STREAM_A, 1), action(STREAM_A, 2)]]);
  });

  it('closes every armed group on one tick, each as its own batch', () => {
    const { notifier$, source$, emitted } = createHarness();

    source$.next([action(STREAM_A, 1), action(STREAM_B, 2)]);
    notifier$.next();

    expect(emitted).toEqual([[action(STREAM_A, 1)], [action(STREAM_B, 2)]]);
  });

  it('leaves plain actions to pass at once, without waiting for a tick', () => {
    const { source$, emitted } = createHarness();

    source$.next([action(PLAIN, 1), action(STREAM_A, 2)]);

    expect(emitted).toEqual([[action(PLAIN, 1)]]);
  });

  it('emits nothing for a tick with no group armed, before or after a flush', () => {
    const { notifier$, source$, emitted } = createHarness();

    notifier$.next();
    expect(emitted).toEqual([]);

    source$.next([action(STREAM_A, 1)]);
    notifier$.next();
    notifier$.next();
    notifier$.next();

    expect(emitted).toEqual([[action(STREAM_A, 1)]]);
  });

  it('re-arms a group for the values that arrive after a tick', () => {
    const { notifier$, source$, emitted } = createHarness();

    source$.next([action(STREAM_A, 1)]);
    notifier$.next();
    source$.next([action(STREAM_A, 2)]);
    notifier$.next();

    expect(emitted).toEqual([[action(STREAM_A, 1)], [action(STREAM_A, 2)]]);
  });

  it('stays quiet without throwing once the notifier has completed', () => {
    const { notifier$, source$, emitted } = createHarness();

    notifier$.complete();
    source$.next([action(STREAM_A, 1)]);

    expect(() => notifier$.next()).not.toThrow();
    expect(emitted).toEqual([]);
  });
});
