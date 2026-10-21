import { describe, expect, it } from 'vite-plus/test';

import { formatCount } from '@/utils/formatCount';

describe('formatCount', () => {
  it("groups a count's thousands as the language does, in the digits 0 to 9", () => {
    expect(
      ['en', 'ko-KR', 'de-DE', 'fr-FR', 'ar-SA', 'fa-IR'].map(locale =>
        formatCount(locale, 13176)
      )
    ).toEqual([
      '13,176',
      '13,176',
      '13.176',
      '13\u202f176',
      '13,176',
      '13,176',
    ]);
    expect(formatCount('en', 999)).toBe('999');
  });
});
