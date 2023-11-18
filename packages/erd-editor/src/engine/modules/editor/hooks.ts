import { throttle } from '@dineug/go';

import type { CO, Hook } from '@/engine/hooks';
import { loadJsonAction } from '@/engine/modules/editor/atom.actions';
import { recalculateTableWidth } from '@/utils/calcTable';

const recalculateTableWidthHook: CO = function* (channel, state, ctx) {
  yield throttle(
    channel,
    function* () {
      recalculateTableWidth(state, ctx);
    },
    5,
    { leading: false, trailing: true }
  );
};

export const hooks: Hook[] = [[[loadJsonAction], recalculateTableWidthHook]];
