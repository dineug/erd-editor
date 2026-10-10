import { uuid25 } from '@dineug/uuid';

import { MEMO_MIN_HEIGHT, MEMO_MIN_WIDTH } from '@/constants/layout';
import { DeepPartial, Memo } from '@/internal-types';
import { deepMerge } from '@/utils/deepMerge';

export const createMemo = (value?: DeepPartial<Memo>): Memo =>
  deepMerge<Memo>(
    {
      id: uuid25(),
      value: '',
      ui: {
        x: 200,
        y: 100,
        zIndex: 2,
        width: MEMO_MIN_WIDTH,
        height: MEMO_MIN_HEIGHT,
        color: '',
      },
    },
    value ?? {}
  );
