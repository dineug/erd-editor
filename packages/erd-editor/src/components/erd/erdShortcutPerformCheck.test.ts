import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { createTestAppContext } from '@/__test-utils__/index';
import { erdShortcutPerformCheck } from '@/components/erd/erdShortcutPerformCheck';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import { RootState } from '@/engine/state';

type MutableState = {
  editor: { openMap: Record<string, boolean> };
  settings: { canvasType: string };
};

function createState(
  openMap: Record<string, boolean> = {},
  canvasType: string = CanvasType.ERD
) {
  const state = {
    editor: { openMap },
    settings: { canvasType },
  };

  return state as MutableState & RootState;
}

describe('erdShortcutPerformCheck', () => {
  it('lets values through while the ERD canvas has no overlay open', () => {
    const source$ = new Subject<string>();
    const next = vi.fn();

    source$.pipe(erdShortcutPerformCheck(createState())).subscribe(next);
    source$.next('a');
    source$.next('b');

    expect(next).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenNthCalledWith(1, 'a');
    expect(next).toHaveBeenNthCalledWith(2, 'b');
  });

  it('blocks values when the canvas type is not the ERD canvas', () => {
    const source$ = new Subject<string>();
    const next = vi.fn();

    source$
      .pipe(erdShortcutPerformCheck(createState({}, CanvasType.schemaSQL)))
      .subscribe(next);
    source$.next('a');

    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    Open.automaticTablePlacement,
    Open.tableProperties,
    Open.search,
    Open.diffViewer,
    Open.timeTravel,
  ])('blocks values while %s is open', open => {
    const source$ = new Subject<string>();
    const next = vi.fn();

    source$
      .pipe(erdShortcutPerformCheck(createState({ [open]: true })))
      .subscribe(next);
    source$.next('a');

    expect(next).not.toHaveBeenCalled();
  });

  it('ignores overlays that do not gate the erd shortcuts', () => {
    const source$ = new Subject<string>();
    const next = vi.fn();

    source$
      .pipe(erdShortcutPerformCheck(createState({ [Open.themeBuilder]: true })))
      .subscribe(next);
    source$.next('a');

    expect(next).toHaveBeenCalledWith('a');
  });

  it('re-reads the state on every emission instead of capturing it once', () => {
    const state = createState();
    const source$ = new Subject<string>();
    const next = vi.fn();

    source$.pipe(erdShortcutPerformCheck(state)).subscribe(next);

    source$.next('before');
    state.editor.openMap[Open.search] = true;
    source$.next('blocked');
    state.editor.openMap[Open.search] = false;
    source$.next('after');

    expect(next.mock.calls.flat()).toEqual(['before', 'after']);
  });

  it('forwards errors from the source', () => {
    const source$ = new Subject<string>();
    const error = vi.fn();
    const failure = new Error('boom');

    source$
      .pipe(erdShortcutPerformCheck(createState()))
      .subscribe({ next: () => {}, error });
    source$.error(failure);

    expect(error).toHaveBeenCalledWith(failure);
  });

  it('forwards completion from the source', () => {
    const source$ = new Subject<string>();
    const complete = vi.fn();

    source$
      .pipe(erdShortcutPerformCheck(createState()))
      .subscribe({ next: () => {}, complete });
    source$.complete();

    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('works against a real store state which defaults to the ERD canvas', () => {
    const app = createTestAppContext();
    const source$ = new Subject<number>();
    const next = vi.fn();

    source$.pipe(erdShortcutPerformCheck(app.store.state)).subscribe(next);
    source$.next(1);

    expect(app.store.state.settings.canvasType).toBe(CanvasType.ERD);
    expect(next).toHaveBeenCalledWith(1);

    app.store.state.editor.openMap[Open.tableProperties] = true;
    source$.next(2);

    expect(next).toHaveBeenCalledTimes(1);

    app.store.destroy();
  });
});
