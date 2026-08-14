import { AnyAction } from '@dineug/r-html';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { notEmptyActions } from '@/engine/rx-operators/notEmptyActions';

const action = (type: string): AnyAction => ({ type, payload: {} });

describe('notEmptyActions', () => {
  it('passes arrays that contain at least one action', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$.pipe(notEmptyActions).subscribe(actions => emitted.push(actions));

    const one = [action('a')];
    const two = [action('a'), action('b')];
    source$.next(one);
    source$.next(two);

    expect(emitted).toEqual([one, two]);
  });

  it('drops empty arrays', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$.pipe(notEmptyActions).subscribe(actions => emitted.push(actions));

    source$.next([]);
    source$.next([]);

    expect(emitted).toEqual([]);
  });

  it('propagates errors and completion', () => {
    const complete$ = new Subject<Array<AnyAction>>();
    const onComplete = vi.fn();
    complete$.pipe(notEmptyActions).subscribe({ complete: onComplete });
    complete$.complete();
    expect(onComplete).toHaveBeenCalledTimes(1);

    const error$ = new Subject<Array<AnyAction>>();
    const onError = vi.fn();
    error$.pipe(notEmptyActions).subscribe({ error: onError });
    const err = new Error('boom');
    error$.error(err);
    expect(onError).toHaveBeenCalledWith(err);
  });
});
