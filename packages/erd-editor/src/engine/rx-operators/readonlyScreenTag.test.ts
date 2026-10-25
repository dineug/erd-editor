import { AnyAction } from '@dineug/r-html';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vite-plus/test';

import {
  ChangeActionTypes,
  ReadonlyIgnoreActionTypes,
  ScreenSettingActionTypes,
} from '@/engine/actions';
import type { ScreenBaseline } from '@/engine/modules/editor/state';
import { readonlyScreenTag } from '@/engine/rx-operators/readonlyScreenTag';
import { RootState } from '@/engine/state';
import { Tag } from '@/engine/tag';

const action = (
  type: string,
  payload: unknown = {},
  extra: Partial<AnyAction> = {}
): AnyAction => ({ type, payload, ...extra });

const VIEWPORT_TYPES = [
  'settings.scrollTo',
  'settings.streamScrollTo',
  'settings.changeZoomLevel',
  'settings.streamZoomLevel',
];

/** The part of a store's state the operator reads: the live placement and the baseline. */
const stateOf = (screenBaseline: ScreenBaseline | null = null) =>
  ({
    settings: { originX: 120, originY: -40, zoomLevel: 0.6 },
    editor: { screenBaseline },
  }) as unknown as RootState;

function pipe(getReadonly: () => boolean, getState = () => stateOf()) {
  const source$ = new Subject<Array<AnyAction>>();
  const emitted: Array<Array<AnyAction>> = [];
  source$
    .pipe(readonlyScreenTag(getReadonly, getState))
    .subscribe(actions => emitted.push(actions));
  return { source$, emitted };
}

const HELD_VIEWPORT: ScreenBaseline = {
  viewport: { originX: 0, originY: 0, zoomLevel: 1 },
};

describe('readonlyScreenTag', () => {
  it('names the eleven settings readonly lets through and the show bits', () => {
    const passes = ChangeActionTypes.filter(
      type => !ReadonlyIgnoreActionTypes.includes(type)
    );

    expect([...ScreenSettingActionTypes].sort()).toEqual(
      [...passes, 'settings.changeShow'].sort()
    );
    expect(ScreenSettingActionTypes).toHaveLength(12);
  });

  it.each(ScreenSettingActionTypes)(
    'tags %s as the screen’s while readonly, keeping everything else',
    type => {
      const { source$, emitted } = pipe(() => true);
      const original = action(type, { value: 1 }, { version: 7, tags: 0 });

      source$.next([original]);

      expect(emitted).toEqual([
        [{ type, payload: { value: 1 }, version: 7, tags: Tag.screen }],
      ]);
      expect(original.tags).toBe(0);
    }
  );

  it('adds the tag to one already there', () => {
    const { source$, emitted } = pipe(() => true);

    source$.next([action('settings.changeLanguage', {}, { tags: Tag.drag })]);

    expect(emitted[0][0].tags).toBe(Tag.drag | Tag.screen);
  });

  it('leaves a peer’s setting and a follow of one as they are, by identity', () => {
    const { source$, emitted } = pipe(() => true);
    const shared = action('settings.changeLanguage', {}, { tags: Tag.shared });
    const following = action('settings.scrollTo', {}, { tags: Tag.following });
    const both = action(
      'settings.changeCanvasType',
      {},
      {
        tags: Tag.shared | Tag.following,
      }
    );

    source$.next([shared, following, both]);

    expect(emitted[0][0]).toBe(shared);
    expect(emitted[0][1]).toBe(following);
    expect(emitted[0][2]).toBe(both);
  });

  it('leaves every other action as it is, by identity', () => {
    const { source$, emitted } = pipe(() => true);
    const others = [
      action('table.add'),
      action('settings.changeDatabaseName'),
      action('settings.changeLockSettings'),
      action('editor.viewScrollTo'),
      action('editor.select'),
    ];

    source$.next(others);

    others.forEach((original, index) => {
      expect(emitted[0][index]).toBe(original);
    });
  });

  it('passes a writable batch through as the same array while no viewport is held', () => {
    const { source$, emitted } = pipe(
      () => false,
      () => stateOf({ language: 1 })
    );
    const batch = VIEWPORT_TYPES.map(type => action(type));

    source$.next(batch);

    expect(emitted[0]).toBe(batch);
  });

  it.each(VIEWPORT_TYPES)(
    'leads the first writable %s after a held viewport with where the screen stands',
    type => {
      const { source$, emitted } = pipe(
        () => false,
        () => stateOf(HELD_VIEWPORT)
      );
      const before = action('table.add', {}, { version: 3 });
      const write = action(type, { value: 0.1 }, { version: 4 });
      const second = action('settings.scrollTo', {}, { version: 4 });

      source$.next([before, write, second]);

      expect(emitted[0]).toEqual([
        before,
        {
          type: 'settings.scrollTo',
          payload: { originX: 120, originY: -40 },
          version: 4,
          tags: Tag.changeOnly,
        },
        {
          type: 'settings.changeZoomLevel',
          payload: { value: 0.6 },
          version: 4,
          tags: Tag.changeOnly,
        },
        write,
        second,
      ]);
      expect(emitted[0][3]).toBe(write);
    }
  );

  it('is led by no placement for a peer’s, a follow’s or a screen’s write', () => {
    const { source$, emitted } = pipe(
      () => false,
      () => stateOf(HELD_VIEWPORT)
    );
    const batch = [
      action('settings.scrollTo', {}, { tags: Tag.shared }),
      action('settings.streamScrollTo', {}, { tags: Tag.following }),
      action('settings.changeZoomLevel', {}, { tags: Tag.screen }),
      action('settings.changeLanguage'),
    ];

    source$.next(batch);

    expect(emitted[0]).toBe(batch);
  });

  it('tags nothing once writable and leads no placement while readonly', () => {
    let readonly = true;
    const { source$, emitted } = pipe(
      () => readonly,
      () => stateOf(HELD_VIEWPORT)
    );

    source$.next([action('settings.streamScrollTo')]);
    readonly = false;
    source$.next([action('settings.changeLanguage')]);

    expect(emitted[0]).toEqual([
      action('settings.streamScrollTo', {}, { tags: Tag.screen }),
    ]);
    expect(emitted[1]).toEqual([action('settings.changeLanguage')]);
  });

  it('is pure: the same batch and state twice give equal results and mutate nothing', () => {
    let readonly = true;
    const { source$, emitted } = pipe(
      () => readonly,
      () => stateOf(HELD_VIEWPORT)
    );
    const batch = [
      action('settings.scrollTo', { originX: 1, originY: 2 }),
      action('table.add', { id: 't1' }),
      action('settings.changeLanguage', { value: 2 }, { tags: Tag.shared }),
    ];
    const snapshot = structuredClone(batch);

    source$.next(batch);
    source$.next(batch);
    readonly = false;
    source$.next(batch);
    source$.next(batch);

    expect(emitted[0]).toEqual(emitted[1]);
    expect(emitted[2]).toEqual(emitted[3]);
    expect(emitted[2]).toHaveLength(5);
    expect(batch).toEqual(snapshot);
  });

  it('runs once per subscriber over a cold chain and both see the same result', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const getState = vi.fn(() => stateOf(HELD_VIEWPORT));
    const tagged$ = source$.pipe(readonlyScreenTag(() => false, getState));
    const first: Array<Array<AnyAction>> = [];
    const second: Array<Array<AnyAction>> = [];
    tagged$.subscribe(actions => first.push(actions));
    tagged$.subscribe(actions => second.push(actions));

    source$.next([action('settings.streamZoomLevel', { value: 0.1 })]);

    expect(getState).toHaveBeenCalledTimes(2);
    expect(first).toEqual(second);
    expect(first[0].map(({ type }) => type)).toEqual([
      'settings.scrollTo',
      'settings.changeZoomLevel',
      'settings.streamZoomLevel',
    ]);
  });

  it('propagates errors and completion', () => {
    const error$ = new Subject<Array<AnyAction>>();
    const onError = vi.fn();
    error$
      .pipe(readonlyScreenTag(() => true, stateOf))
      .subscribe({ error: onError });
    const err = new Error('boom');
    error$.error(err);
    expect(onError).toHaveBeenCalledWith(err);

    const complete$ = new Subject<Array<AnyAction>>();
    const onComplete = vi.fn();
    complete$
      .pipe(readonlyScreenTag(() => true, stateOf))
      .subscribe({ complete: onComplete });
    complete$.complete();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
