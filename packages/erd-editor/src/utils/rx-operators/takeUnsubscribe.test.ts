import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { takeUnsubscribe } from '@/utils/rx-operators/takeUnsubscribe';

describe('takeUnsubscribe', () => {
  it('forwards the source values untouched', () => {
    const source$ = new Subject<number>();
    const values: number[] = [];
    const subscription = source$
      .pipe(takeUnsubscribe(() => {}))
      .subscribe(value => values.push(value));

    source$.next(1);
    source$.next(2);
    subscription.unsubscribe();

    expect(values).toEqual([1, 2]);
  });

  it('calls the callback and releases the source on unsubscribe', () => {
    const source$ = new Subject<number>();
    const callback = vi.fn();
    const subscription = source$.pipe(takeUnsubscribe(callback)).subscribe();

    expect(source$.observed).toBe(true);
    expect(callback).not.toHaveBeenCalled();

    subscription.unsubscribe();

    expect(callback).toHaveBeenCalledOnce();
    expect(source$.observed).toBe(false);
  });

  it('forwards completion and runs the callback through the teardown', () => {
    const source$ = new Subject<number>();
    const callback = vi.fn();
    const complete = vi.fn();
    source$.pipe(takeUnsubscribe(callback)).subscribe({ complete });

    source$.complete();

    expect(complete).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledOnce();
  });

  it('forwards errors and runs the callback through the teardown', () => {
    const source$ = new Subject<number>();
    const callback = vi.fn();
    const error = new Error('boom');
    const onError = vi.fn();
    source$.pipe(takeUnsubscribe(callback)).subscribe({ error: onError });

    source$.error(error);

    expect(onError).toHaveBeenCalledWith(error);
    expect(callback).toHaveBeenCalledOnce();
  });

  it('runs the callback once per subscription', () => {
    const source$ = new Subject<number>();
    const callback = vi.fn();
    const operator = takeUnsubscribe(callback);
    const first = source$.pipe(operator).subscribe();
    const second = source$.pipe(operator).subscribe();

    first.unsubscribe();
    first.unsubscribe();

    expect(callback).toHaveBeenCalledTimes(1);

    second.unsubscribe();

    expect(callback).toHaveBeenCalledTimes(2);
  });
});
