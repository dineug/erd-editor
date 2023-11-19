import { throttle } from '@dineug/go';

import type { CO, Hook } from '@/engine/hooks';
import {
  initialLoadJsonAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
import { recalculateTableWidth } from '@/utils/calcTable';
import { relationshipSort } from '@/utils/draw-relationship/sort';

const recalculateTableWidthHook: CO = function* (channel, state, ctx) {
  yield throttle(
    channel,
    function* () {
      recalculateTableWidth(state, ctx);
      relationshipSort(state);
    },
    5,
    { leading: false, trailing: true }
  );
};

export const hooks: Hook[] = [
  [[loadJsonAction, initialLoadJsonAction], recalculateTableWidthHook],
];
