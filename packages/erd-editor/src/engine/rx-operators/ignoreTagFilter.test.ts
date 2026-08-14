import { AnyAction } from '@dineug/r-html';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ignoreTagFilter } from '@/engine/rx-operators/ignoreTagFilter';
import { Tag } from '@/engine/tag';

const action = (type: string, tags?: number): AnyAction => ({
  type,
  payload: {},
  ...(tags === undefined ? {} : { tags }),
});

describe('ignoreTagFilter', () => {
  it('keeps actions that carry no tags at all', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(ignoreTagFilter([Tag.shared]))
      .subscribe(actions => emitted.push(actions));

    const untagged = action('a');
    source$.next([untagged]);

    expect(emitted).toEqual([[untagged]]);
  });

  it('drops actions whose tag bit matches one of the ignored tags', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(ignoreTagFilter([Tag.changeOnly, Tag.shared]))
      .subscribe(actions => emitted.push(actions));

    const shared = action('a', Tag.shared);
    const changeOnly = action('b', Tag.changeOnly);
    const following = action('c', Tag.following);
    source$.next([shared, changeOnly, following]);

    expect(emitted).toEqual([[following]]);
  });

  it('drops actions carrying an ignored bit inside a composed tag mask', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(ignoreTagFilter([Tag.shared]))
      .subscribe(actions => emitted.push(actions));

    const composed = action('a', Tag.shared | Tag.following);
    const other = action('b', Tag.following | Tag.changeOnly);
    source$.next([composed, other]);

    expect(emitted).toEqual([[other]]);
  });

  it('does not emit when everything is ignored', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(ignoreTagFilter([Tag.shared]))
      .subscribe(actions => emitted.push(actions));

    source$.next([action('a', Tag.shared)]);

    expect(emitted).toEqual([]);
  });

  it('keeps every action when the ignore list is empty', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(ignoreTagFilter([]))
      .subscribe(actions => emitted.push(actions));

    const shared = action('a', Tag.shared);
    source$.next([shared]);

    expect(emitted).toEqual([[shared]]);
  });

  it('propagates errors and completion', () => {
    const error$ = new Subject<Array<AnyAction>>();
    const onError = vi.fn();
    error$.pipe(ignoreTagFilter([Tag.shared])).subscribe({ error: onError });
    const err = new Error('boom');
    error$.error(err);
    expect(onError).toHaveBeenCalledWith(err);

    const complete$ = new Subject<Array<AnyAction>>();
    const onComplete = vi.fn();
    complete$
      .pipe(ignoreTagFilter([Tag.shared]))
      .subscribe({ complete: onComplete });
    complete$.complete();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
