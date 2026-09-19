import { AnyAction } from '@dineug/r-html';
import { Observable, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vite-plus/test';

import { bufferCircuitBreaker } from '@/engine/rx-operators/bufferCircuitBreaker';

const action = (type: string): AnyAction => ({ type, payload: {} });

type Harness = {
  source$: Subject<Array<AnyAction>>;
  opening$: Subject<void>;
  closing$: Subject<void>;
  emitted: Array<Array<AnyAction>>;
};

function createHarness(): Harness {
  const source$ = new Subject<Array<AnyAction>>();
  const opening$ = new Subject<void>();
  const closing$ = new Subject<void>();
  const emitted: Array<Array<AnyAction>> = [];

  source$
    .pipe(bufferCircuitBreaker(opening$, closing$))
    .subscribe(actions => emitted.push(actions));

  return { source$, opening$, closing$, emitted };
}

describe('bufferCircuitBreaker', () => {
  it('buffers while the circuit is open and flushes on the opening notifier', () => {
    const { source$, opening$, emitted } = createHarness();

    const a = action('a');
    const b = action('b');
    source$.next([a]);
    source$.next([b]);
    expect(emitted).toEqual([]);

    opening$.next();

    expect(emitted).toEqual([[a, b]]);
  });

  it('flattens the buffered batches into a single action array', () => {
    const { source$, opening$, emitted } = createHarness();

    source$.next([action('a'), action('b')]);
    source$.next([action('c')]);
    opening$.next();

    expect(emitted).toEqual([[action('a'), action('b'), action('c')]]);
  });

  it('passes actions straight through once connected', () => {
    const { source$, opening$, emitted } = createHarness();

    opening$.next();
    expect(emitted).toEqual([]);

    source$.next([action('a')]);
    source$.next([action('b')]);

    expect(emitted).toEqual([[action('a')], [action('b')]]);
  });

  it('ignores repeated opening notifications while already connected', () => {
    const { source$, opening$, emitted } = createHarness();

    source$.next([action('a')]);
    opening$.next();
    expect(emitted).toEqual([[action('a')]]);

    opening$.next();
    opening$.next();

    expect(emitted).toEqual([[action('a')]]);
  });

  it('re-opens the circuit on the closing notifier and buffers again', () => {
    const { source$, opening$, closing$, emitted } = createHarness();

    opening$.next();
    source$.next([action('a')]);
    expect(emitted).toEqual([[action('a')]]);

    closing$.next();
    source$.next([action('b')]);
    source$.next([action('c')]);
    expect(emitted).toEqual([[action('a')]]);

    opening$.next();

    expect(emitted).toEqual([[action('a')], [action('b'), action('c')]]);
  });

  it('does not emit an empty flush when nothing was buffered', () => {
    const { opening$, closing$, emitted } = createHarness();

    opening$.next();
    closing$.next();
    opening$.next();

    expect(emitted).toEqual([]);
  });

  it('closing before any connection keeps the circuit buffering', () => {
    const { source$, closing$, emitted } = createHarness();

    closing$.next();
    source$.next([action('a')]);

    expect(emitted).toEqual([]);
  });

  it('emits the pending buffer when the source completes', () => {
    const { source$, emitted } = createHarness();
    const onComplete = vi.fn();
    source$
      .pipe(bufferCircuitBreaker(new Subject<void>(), new Subject<void>()))
      .subscribe({ complete: onComplete });

    source$.next([action('a')]);
    source$.complete();

    expect(emitted).toEqual([[action('a')]]);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('forwards a source error', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const onError = vi.fn();
    source$
      .pipe(bufferCircuitBreaker(new Subject<void>(), new Subject<void>()))
      .subscribe({ error: onError });

    source$.error(new Error('boom'));

    expect(onError).toHaveBeenCalledWith(new Error('boom'));
  });

  it('subscribes a cold source once, so its own timers cannot strand the last batch', () => {
    vi.useFakeTimers();
    try {
      let subscriptions = 0;
      // Each subscription runs its own timer, the way a debounced upstream does.
      const source$ = new Observable<Array<AnyAction>>(subscriber => {
        const delay = ++subscriptions === 1 ? 20 : 10;
        const id = setTimeout(() => subscriber.next([action('a')]), delay);
        return () => clearTimeout(id);
      });
      const opening$ = new Subject<void>();
      const emitted: Array<Array<AnyAction>> = [];

      source$
        .pipe(bufferCircuitBreaker(opening$, new Subject<void>()))
        .subscribe(actions => emitted.push(actions));
      opening$.next();
      vi.advanceTimersByTime(20);

      expect(subscriptions).toBe(1);
      expect(emitted).toEqual([[action('a')]]);
    } finally {
      vi.useRealTimers();
    }
  });
});
