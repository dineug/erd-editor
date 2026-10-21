import { describe, expect, it } from 'vite-plus/test';

import { blankLogicalName } from '@/components/erd/canvas/table/blankLogicalName';
import { NameViewMode } from '@/constants/schema';

describe('what a blank logical name cell shows', () => {
  it('is the name in the logical view, and the placeholder of the name while that is blank too', () => {
    const logical = { nameViewMode: NameViewMode.logical };

    expect(
      blankLogicalName(logical, 'member', 'common.placeholder.table')
    ).toEqual({ standIn: 'member', key: 'common.placeholder.table' });
    expect(
      blankLogicalName(logical, '  ', 'common.placeholder.column')
    ).toEqual({ standIn: '', key: 'common.placeholder.column' });
  });

  it('is the logical name placeholder in the other views, whatever the name', () => {
    for (const nameViewMode of [NameViewMode.both, NameViewMode.physical]) {
      expect(
        blankLogicalName({ nameViewMode }, 'member', 'common.placeholder.table')
      ).toEqual({ standIn: '', key: 'common.placeholder.logicalName' });
    }
  });
});
