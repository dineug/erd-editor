import { describe, expect, it } from 'vite-plus/test';

import { pseudoMessages } from '@/__test-utils__/i18n';
import { menuLabel } from '@/i18n/menuLabel';
import { sourceI18n } from '@/i18n/source';
import { createI18n } from '@/i18n/translate';

describe('menuLabel', () => {
  it('reads a row with a key in the language given', () => {
    const menu = { name: 'None', labelKey: 'common.none' } as const;

    expect(menuLabel(sourceI18n, menu)).toBe('None');
    expect(menuLabel(createI18n('ko-KR', pseudoMessages('ko')), menu)).toBe(
      'ko:None'
    );
  });

  it('shows the name of a row without a key, as written in every language', () => {
    const menu = { name: 'PostgreSQL' };

    expect(menuLabel(sourceI18n, menu)).toBe('PostgreSQL');
    expect(menuLabel(createI18n('ja-JP', pseudoMessages('ja')), menu)).toBe(
      'PostgreSQL'
    );
  });
});
