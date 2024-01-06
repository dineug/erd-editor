import { nanoid } from '@dineug/shared';
import merge from 'deepmerge';

import { MEMO_MIN_HEIGHT, MEMO_MIN_WIDTH } from '@/constants/layout';
import { DeepPartial, Memo } from '@/internal-types';
import { getDefaultEntityMeta } from '@/utils';

export const createMemo = (value?: DeepPartial<Memo>): Memo =>
  merge(
    {
      id: nanoid(),
      value: '',
      ui: {
        x: 200,
        y: 100,
        zIndex: 2,
        width: MEMO_MIN_WIDTH,
        height: MEMO_MIN_HEIGHT,
        color: '',
      },
      meta: getDefaultEntityMeta(),
    },
    (value as Memo) ?? {}
  );
