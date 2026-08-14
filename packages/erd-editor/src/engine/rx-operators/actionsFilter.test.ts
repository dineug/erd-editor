import { AnyAction } from '@dineug/r-html';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { actionsFilter } from '@/engine/rx-operators/actionsFilter';

const action = (type: string): AnyAction => ({ type, payload: { type } });

describe('actionsFilter', () => {
  it('keeps only the actions whose type is allowed', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(actionsFilter(['keep.a', 'keep.b']))
      .subscribe(actions => emitted.push(actions));

    const keepA = action('keep.a');
    const keepB = action('keep.b');
    source$.next([keepA, action('drop.a'), keepB]);

    expect(emitted).toEqual([[keepA, keepB]]);
  });

  it('does not emit when every action was filtered out', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(actionsFilter(['keep.a']))
      .subscribe(actions => emitted.push(actions));

    source$.next([action('drop.a'), action('drop.b')]);
    source$.next([]);

    expect(emitted).toEqual([]);
  });

  it('accepts a readonly list of action types', () => {
    const types: ReadonlyArray<string> = Object.freeze(['keep.a']);
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(actionsFilter(types))
      .subscribe(actions => emitted.push(actions));

    source$.next([action('keep.a'), action('drop.a')]);

    expect(emitted).toEqual([[action('keep.a')]]);
  });

  it('propagates errors from the source', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const onError = vi.fn();
    source$.pipe(actionsFilter(['keep.a'])).subscribe({ error: onError });

    const err = new Error('boom');
    source$.error(err);

    expect(onError).toHaveBeenCalledWith(err);
  });

  it('propagates completion from the source', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const onComplete = vi.fn();
    source$.pipe(actionsFilter(['keep.a'])).subscribe({ complete: onComplete });

    source$.complete();

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
