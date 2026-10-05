import { describe, expect, it } from 'vite-plus/test';

import { SelectType } from '@/engine/modules/editor/state';
import { getSelectTypeIds } from '@/engine/modules/editor/utils/selection';

describe('getSelectTypeIds', () => {
  it('splits the selection into table and memo ids, in selection order', () => {
    expect(
      getSelectTypeIds({
        m1: SelectType.memo,
        t2: SelectType.table,
        t1: SelectType.table,
      })
    ).toEqual({ tableIds: ['t2', 't1'], memoIds: ['m1'] });
  });

  it('is empty for no selection', () => {
    expect(getSelectTypeIds({})).toEqual({ tableIds: [], memoIds: [] });
  });
});
