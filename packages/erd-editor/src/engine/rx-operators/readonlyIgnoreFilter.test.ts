import { AnyAction } from '@dineug/r-html';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ReadonlyIgnoreActionTypes } from '@/engine/actions';
import { readonlyIgnoreFilter } from '@/engine/rx-operators/readonlyIgnoreFilter';
import { Tag } from '@/engine/tag';

const action = (type: string, tags?: number): AnyAction => ({
  type,
  payload: {},
  ...(tags === undefined ? {} : { tags }),
});

// `table.add` mutates the document, so it is blocked in readonly mode.
const BLOCKED = 'table.add';
// zoom / scroll style actions are deliberately excluded from the ignore list.
const ALLOWED = 'settings.changeZoomLevel';

describe('readonlyIgnoreFilter', () => {
  it('exposes an ignore list that excludes viewport-only settings actions', () => {
    expect(ReadonlyIgnoreActionTypes).toContain(BLOCKED);
    expect(ReadonlyIgnoreActionTypes).not.toContain(ALLOWED);
  });

  it('passes every action through when not readonly', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(readonlyIgnoreFilter(() => false))
      .subscribe(actions => emitted.push(actions));

    const batch = [
      action(BLOCKED),
      action(ALLOWED),
      action('editor.selectAll'),
    ];
    source$.next(batch);

    expect(emitted).toEqual([batch]);
    expect(emitted[0]).toBe(batch);
  });

  it('drops document-changing actions when readonly', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(readonlyIgnoreFilter(() => true))
      .subscribe(actions => emitted.push(actions));

    const allowed = action(ALLOWED);
    source$.next([action(BLOCKED), allowed]);

    expect(emitted).toEqual([[allowed]]);
  });

  it('does not emit when readonly removes every action', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(readonlyIgnoreFilter(() => true))
      .subscribe(actions => emitted.push(actions));

    source$.next([action(BLOCKED), action('memo.add')]);

    expect(emitted).toEqual([]);
  });

  it('lets a blocked action through when it carries a pass tag', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(readonlyIgnoreFilter(() => true, [Tag.shared]))
      .subscribe(actions => emitted.push(actions));

    const shared = action(BLOCKED, Tag.shared);
    const localOnly = action(BLOCKED, Tag.following);
    const untagged = action(BLOCKED);
    source$.next([shared, localOnly, untagged]);

    expect(emitted).toEqual([[shared]]);
  });

  it('re-reads the readonly flag on every emission', () => {
    let readonly = false;
    const source$ = new Subject<Array<AnyAction>>();
    const emitted: Array<Array<AnyAction>> = [];
    source$
      .pipe(readonlyIgnoreFilter(() => readonly))
      .subscribe(actions => emitted.push(actions));

    source$.next([action(BLOCKED)]);
    readonly = true;
    source$.next([action(BLOCKED)]);
    readonly = false;
    source$.next([action(BLOCKED)]);

    expect(emitted).toEqual([[action(BLOCKED)], [action(BLOCKED)]]);
  });

  it('propagates errors and completion', () => {
    const error$ = new Subject<Array<AnyAction>>();
    const onError = vi.fn();
    error$.pipe(readonlyIgnoreFilter(() => true)).subscribe({ error: onError });
    const err = new Error('boom');
    error$.error(err);
    expect(onError).toHaveBeenCalledWith(err);

    const complete$ = new Subject<Array<AnyAction>>();
    const onComplete = vi.fn();
    complete$
      .pipe(readonlyIgnoreFilter(() => true))
      .subscribe({ complete: onComplete });
    complete$.complete();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
