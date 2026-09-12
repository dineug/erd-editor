import { AnyAction } from '@dineug/r-html';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vite-plus/test';

import { SceneView, ViewKind } from '@/engine/modules/editor/state';
import { createSceneView } from '@/engine/modules/editor/view';
import { viewActionRedirect } from '@/engine/rx-operators/viewActionRedirect';
import { Tag } from '@/engine/tag';

const action = (
  type: string,
  payload: unknown = {},
  extra: Partial<AnyAction> = {}
): AnyAction => ({ type, payload, ...extra });

const REDIRECTED: ReadonlyArray<[string, string]> = [
  ['settings.scrollTo', 'editor.viewScrollTo'],
  ['settings.streamScrollTo', 'editor.viewStreamScrollTo'],
  ['settings.changeZoomLevel', 'editor.viewChangeZoomLevel'],
  ['settings.streamZoomLevel', 'editor.viewStreamZoomLevel'],
];

function pipe(getActiveView: () => SceneView | null) {
  const source$ = new Subject<Array<AnyAction>>();
  const emitted: Array<Array<AnyAction>> = [];
  source$
    .pipe(viewActionRedirect(getActiveView))
    .subscribe(actions => emitted.push(actions));
  return { source$, emitted };
}

const openView = () => createSceneView(ViewKind.flow, ['t1']);

describe('viewActionRedirect', () => {
  it('passes the batch through untouched, same array, while no view is active', () => {
    const { source$, emitted } = pipe(() => null);
    const batch = REDIRECTED.map(([type]) => action(type));

    source$.next(batch);

    expect(emitted).toEqual([batch]);
    expect(emitted[0]).toBe(batch);
  });

  // AC-47
  it.each(REDIRECTED)(
    'turns %s into %s while a view is active, keeping everything but the type',
    (from, to) => {
      const { source$, emitted } = pipe(openView);
      const payload = { originX: 1, originY: 2, value: 3, movementX: 4 };
      const original = action(from, payload, { version: 7, meta: { a: 1 } });

      source$.next([original]);

      expect(emitted).toEqual([
        [{ type: to, payload, version: 7, meta: { a: 1 } }],
      ]);
      expect(emitted[0][0].payload).toBe(payload);
      expect(original.type).toBe(from);
    }
  );

  it('leaves every other action as it is, by identity', () => {
    const { source$, emitted } = pipe(openView);
    const others = [
      action('table.add'),
      action('editor.select'),
      action('settings.changeCanvasType'),
      action('editor.viewScrollTo'),
      action('editor.loadJson'),
    ];

    source$.next(others);

    expect(emitted).toHaveLength(1);
    others.forEach((original, index) => {
      expect(emitted[0][index]).toBe(original);
    });
  });

  it('leaves a following or shared placement to the document', () => {
    const { source$, emitted } = pipe(openView);
    const following = action('settings.scrollTo', {}, { tags: Tag.following });
    const shared = action('settings.changeZoomLevel', {}, { tags: Tag.shared });
    const both = action(
      'settings.streamScrollTo',
      {},
      {
        tags: Tag.shared | Tag.following,
      }
    );
    const changeOnly = action(
      'settings.streamZoomLevel',
      {},
      {
        tags: Tag.changeOnly,
      }
    );

    source$.next([following, shared, both, changeOnly]);

    expect(emitted[0][0]).toBe(following);
    expect(emitted[0][1]).toBe(shared);
    expect(emitted[0][2]).toBe(both);
    expect(emitted[0][3]).toEqual({
      ...changeOnly,
      type: 'editor.viewStreamZoomLevel',
    });
  });

  it('is pure: the same batch twice gives equal results and mutates nothing', () => {
    const { source$, emitted } = pipe(openView);
    const batch = [
      action('settings.scrollTo', { originX: 1, originY: 2 }),
      action('table.add', { id: 't1' }),
      action(
        'settings.scrollTo',
        { originX: 3, originY: 4 },
        { tags: Tag.shared }
      ),
    ];
    const snapshot = structuredClone(batch);

    source$.next(batch);
    source$.next(batch);

    expect(emitted).toHaveLength(2);
    expect(emitted[0]).toEqual(emitted[1]);
    expect(emitted[0]).not.toBe(batch);
    expect(batch).toEqual(snapshot);
  });

  it('runs once per subscriber over a cold chain and both see the same result', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const getActiveView = vi.fn(openView);
    const redirected$ = source$.pipe(viewActionRedirect(getActiveView));
    const first: Array<Array<AnyAction>> = [];
    const second: Array<Array<AnyAction>> = [];
    redirected$.subscribe(actions => first.push(actions));
    redirected$.subscribe(actions => second.push(actions));

    source$.next([action('settings.scrollTo', { originX: 1, originY: 2 })]);

    expect(getActiveView).toHaveBeenCalledTimes(2);
    expect(first).toEqual(second);
    expect(first[0][0].type).toBe('editor.viewScrollTo');
  });

  it('re-reads the active view on every emission', () => {
    let view: SceneView | null = null;
    const { source$, emitted } = pipe(() => view);

    source$.next([action('settings.scrollTo')]);
    view = openView();
    source$.next([action('settings.scrollTo')]);
    view = null;
    source$.next([action('settings.scrollTo')]);

    expect(emitted.map(([{ type }]) => type)).toEqual([
      'settings.scrollTo',
      'editor.viewScrollTo',
      'settings.scrollTo',
    ]);
  });

  it('propagates errors and completion', () => {
    const error$ = new Subject<Array<AnyAction>>();
    const onError = vi.fn();
    error$.pipe(viewActionRedirect(openView)).subscribe({ error: onError });
    const err = new Error('boom');
    error$.error(err);
    expect(onError).toHaveBeenCalledWith(err);

    const complete$ = new Subject<Array<AnyAction>>();
    const onComplete = vi.fn();
    complete$
      .pipe(viewActionRedirect(openView))
      .subscribe({ complete: onComplete });
    complete$.complete();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
