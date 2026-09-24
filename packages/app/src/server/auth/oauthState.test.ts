// @vitest-environment node
/// <reference types="node" />

import { describe, expect, it } from 'vite-plus/test';

import { safeEqual } from '@/server/auth/oauthState';

const STATE = 'a'.repeat(43);

describe('safeEqual', () => {
  it.each([
    ['equal states', STATE, STATE, true],
    ['two empty strings', '', '', true],
    ['a difference in the last character', STATE, `${'a'.repeat(42)}b`, false],
    ['a difference in the first character', STATE, `b${'a'.repeat(42)}`, false],
    ['a prefix', STATE, 'a'.repeat(42), false],
    ['a longer string', STATE, `${STATE}a`, false],
  ])('compares %s', (_, a, b, equal) => {
    expect(safeEqual(a, b)).toBe(equal);
    expect(safeEqual(b, a)).toBe(equal);
  });
});
