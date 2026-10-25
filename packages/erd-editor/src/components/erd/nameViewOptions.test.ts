import { describe, expect, it } from 'vite-plus/test';

import { nameViewOptions } from '@/components/erd/nameViewOptions';
import { NameViewMode } from '@/constants/schema';
import { sourceI18n } from '@/i18n/source';

describe('nameViewOptions', () => {
  it('lists the physical, logical and both name views in that order, each by the label a reader picks it by', () => {
    expect(nameViewOptions.map(({ value }) => value)).toEqual([
      NameViewMode.physical,
      NameViewMode.logical,
      NameViewMode.both,
    ]);
    expect(
      nameViewOptions.map(({ labelKey }) => sourceI18n.t(labelKey))
    ).toEqual(['Physical Names', 'Logical Names', 'Both Names']);
  });
});
