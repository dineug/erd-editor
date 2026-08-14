import { throttleTime } from 'rxjs';

import type { Hook, HookEffect } from '@/engine/hooks';
import {
  initialLoadJsonAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
import { recalculateTableWidth } from '@/utils/calcTable';
import { relationshipSort } from '@/utils/draw-relationship/sort';

const recalculateTableWidthHook: HookEffect = (action$, getState, ctx) =>
  action$
    .pipe(throttleTime(5, undefined, { leading: false, trailing: true }))
    .subscribe(() => {
      const state = getState();
      recalculateTableWidth(state, ctx);
      relationshipSort(state);
    });

export const hooks: Hook[] = [
  [[loadJsonAction, initialLoadJsonAction], recalculateTableWidthHook],
];
