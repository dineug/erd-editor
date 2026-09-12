import { AnyAction } from '@dineug/r-html';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vite-plus/test';

import {
  ChangeActionTypes,
  ReadonlyIgnoreActionTypes,
  ViewIgnoreActionTypes,
} from '@/engine/actions';
import { SceneView, ViewKind } from '@/engine/modules/editor/state';
import { createSceneView } from '@/engine/modules/editor/view';
import { viewIgnoreFilter } from '@/engine/rx-operators/viewIgnoreFilter';
import { Tag } from '@/engine/tag';

const action = (type: string, tags?: number): AnyAction => ({
  type,
  payload: {},
  ...(tags === undefined ? {} : { tags }),
});

const focus = () => createSceneView(ViewKind.focus, ['t1']);

function pipe(getActiveView: () => SceneView | null, passTags?: number[]) {
  const source$ = new Subject<Array<AnyAction>>();
  const emitted: Array<Array<AnyAction>> = [];
  source$
    .pipe(viewIgnoreFilter(getActiveView, passTags))
    .subscribe(actions => emitted.push(actions));
  return { source$, emitted };
}

describe('ViewIgnoreActionTypes', () => {
  it('is the readonly ignore list less the two document replacements', () => {
    expect(ViewIgnoreActionTypes).toEqual(
      ReadonlyIgnoreActionTypes.filter(
        type => type !== 'editor.loadJson' && type !== 'editor.clear'
      )
    );
    expect(ViewIgnoreActionTypes.length).toBe(
      ReadonlyIgnoreActionTypes.length - 2
    );
    expect(new Set(ViewIgnoreActionTypes).size).toBe(
      ViewIgnoreActionTypes.length
    );
  });

  it('holds every edit of the document', () => {
    for (const type of [
      'table.add',
      'table.move',
      'table.remove',
      'table.changeColor',
      'column.add',
      'column.changeName',
      'relationship.add',
      'memo.add',
      'settings.changeShow',
      'settings.changeDatabaseName',
    ]) {
      expect(ViewIgnoreActionTypes).toContain(type);
    }
  });

  it('lets the placements, the tab and the document replacements through', () => {
    for (const type of [
      'settings.scrollTo',
      'settings.streamScrollTo',
      'settings.changeZoomLevel',
      'settings.streamZoomLevel',
      'settings.changeCanvasType',
      'editor.loadJson',
      'editor.clear',
      'editor.select',
      'editor.viewOpen',
      'editor.viewClose',
      'editor.viewScrollTo',
    ]) {
      expect(ViewIgnoreActionTypes).not.toContain(type);
    }
    expect(ChangeActionTypes).toContain('editor.loadJson');
    expect(ChangeActionTypes).toContain('editor.clear');
  });
});

describe('viewIgnoreFilter', () => {
  it('passes every action through, same array, while no view is active', () => {
    const { source$, emitted } = pipe(() => null);
    const batch = [action('table.add'), action('editor.select')];

    source$.next(batch);

    expect(emitted).toEqual([batch]);
    expect(emitted[0]).toBe(batch);
  });

  // AC-48
  it('drops the document edits while a view is active and keeps the rest', () => {
    const { source$, emitted } = pipe(focus);
    const select = action('editor.select');
    const canvasType = action('settings.changeCanvasType');
    const viewScroll = action('editor.viewScrollTo');

    source$.next([
      action('table.add'),
      select,
      action('column.changeName'),
      canvasType,
      action('relationship.add'),
      viewScroll,
      action('table.changeColor'),
    ]);

    expect(emitted).toEqual([[select, canvasType, viewScroll]]);
  });

  it('lets a document replacement through while a view is active', () => {
    const { source$, emitted } = pipe(focus);
    const load = action('editor.loadJson');
    const clear = action('editor.clear');

    source$.next([action('table.add'), load, clear]);

    expect(emitted).toEqual([[load, clear]]);
  });

  it('does not emit when a view removes every action', () => {
    const { source$, emitted } = pipe(focus);

    source$.next([action('table.add'), action('memo.add')]);

    expect(emitted).toEqual([]);
  });

  it('lets a dropped action through when it carries a pass tag', () => {
    const { source$, emitted } = pipe(focus, [Tag.shared]);
    const shared = action('table.add', Tag.shared);
    const sharedAndFollowing = action('column.add', Tag.shared | Tag.following);
    const localOnly = action('table.add', Tag.following);
    const untagged = action('table.add');

    source$.next([shared, sharedAndFollowing, localOnly, untagged]);

    expect(emitted).toEqual([[shared, sharedAndFollowing]]);
  });

  it('drops a shared edit when no pass tag is given, as the history side does', () => {
    const { source$, emitted } = pipe(focus);

    source$.next([action('table.add', Tag.shared)]);

    expect(emitted).toEqual([]);
  });

  it('re-reads the active view on every emission', () => {
    let view: SceneView | null = null;
    const { source$, emitted } = pipe(() => view);

    source$.next([action('table.add')]);
    view = focus();
    source$.next([action('table.add')]);
    view = null;
    source$.next([action('table.add')]);

    expect(emitted).toEqual([[action('table.add')], [action('table.add')]]);
  });

  it('propagates errors and completion', () => {
    const error$ = new Subject<Array<AnyAction>>();
    const onError = vi.fn();
    error$.pipe(viewIgnoreFilter(focus)).subscribe({ error: onError });
    const err = new Error('boom');
    error$.error(err);
    expect(onError).toHaveBeenCalledWith(err);

    const complete$ = new Subject<Array<AnyAction>>();
    const onComplete = vi.fn();
    complete$.pipe(viewIgnoreFilter(focus)).subscribe({ complete: onComplete });
    complete$.complete();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
