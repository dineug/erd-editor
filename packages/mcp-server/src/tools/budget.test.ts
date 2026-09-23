import { describe, expect, it } from 'vite-plus/test';

import { fitsInRead, MAX_READ_CHARS } from '@/tools/budget';

describe('the read budget', () => {
  it('fits a text up to the budget in characters, whatever the script', () => {
    expect(fitsInRead('x'.repeat(MAX_READ_CHARS))).toBe(true);
    expect(fitsInRead('x'.repeat(MAX_READ_CHARS + 1))).toBe(false);
    expect(fitsInRead('한'.repeat(MAX_READ_CHARS))).toBe(true);
    expect(fitsInRead('한'.repeat(MAX_READ_CHARS + 1))).toBe(false);
  });
});
