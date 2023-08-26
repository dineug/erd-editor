import { Memo } from '@/internal-types';
import { getDefaultEntityMeta } from '@/utils';

export const createMemo = (value?: Partial<Memo>): Memo => ({
  id: '',
  value: '',
  ui: {
    x: 200,
    y: 200,
    zIndex: 2,
    width: 127,
    height: 127,
    color: '',
  },
  meta: getDefaultEntityMeta(),
  ...value,
});
