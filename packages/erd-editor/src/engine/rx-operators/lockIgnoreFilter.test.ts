import { AnyAction } from '@dineug/r-html';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vite-plus/test';

import { LockSettingType } from '@/constants/schema';
import { lockIgnoreFilter } from '@/engine/rx-operators/lockIgnoreFilter';

const action = (type: string): AnyAction => ({ type, payload: {} });

const { viewport, language } = LockSettingType;

function run(getLockSettings: () => number) {
  const source$ = new Subject<Array<AnyAction>>();
  const emitted: Array<Array<AnyAction>> = [];
  source$
    .pipe(lockIgnoreFilter(getLockSettings))
    .subscribe(actions => emitted.push(actions));
  return { source$, emitted };
}

describe('lockIgnoreFilter', () => {
  it('drops the change of a locked setting and keeps every other action', () => {
    const { source$, emitted } = run(() => viewport);
    const edit = action('table.add');
    const code = action('settings.changeLanguage');

    source$.next([action('settings.scrollTo'), edit, code]);

    expect(emitted).toEqual([[edit, code]]);
  });

  it('lets every change through with nothing locked', () => {
    const { source$, emitted } = run(() => 0);
    const batch = [
      action('settings.scrollTo'),
      action('settings.changeLanguage'),
    ];

    source$.next(batch);

    expect(emitted).toEqual([batch]);
  });

  it('emits nothing for a batch the locks empty', () => {
    const { source$, emitted } = run(() => viewport | language);

    source$.next([
      action('settings.changeZoomLevel'),
      action('settings.changeLanguage'),
    ]);

    expect(emitted).toEqual([]);
  });

  it('reads the locks again for each batch', () => {
    let locks: number = viewport;
    const { source$, emitted } = run(() => locks);
    const scroll = action('settings.scrollTo');

    source$.next([scroll]);
    locks = 0;
    source$.next([scroll]);

    expect(emitted).toEqual([[scroll]]);
  });

  it('forwards an error and the completion from its source', () => {
    const source$ = new Subject<Array<AnyAction>>();
    const error = vi.fn();
    const complete = vi.fn();
    source$.pipe(lockIgnoreFilter(() => 0)).subscribe({ error });
    const failure = new Error('boom');
    source$.error(failure);

    const done$ = new Subject<Array<AnyAction>>();
    done$.pipe(lockIgnoreFilter(() => 0)).subscribe({ complete });
    done$.complete();

    expect(error).toHaveBeenCalledWith(failure);
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
