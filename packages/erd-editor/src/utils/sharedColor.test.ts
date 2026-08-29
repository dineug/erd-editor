import { describe, expect, it } from 'vite-plus/test';

import { Palette } from '@/themes/radix-ui-theme';
import { SharedColors, toSharedColor } from '@/utils/sharedColor';

describe('SharedColors', () => {
  it('lists eight distinct opaque colors', () => {
    expect(SharedColors).toHaveLength(8);
    expect(new Set(SharedColors).size).toBe(SharedColors.length);

    for (const color of SharedColors) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('reads the same value in both appearances', () => {
    const lightValues = Object.entries(Palette)
      .filter(([key]) => !key.includes('Dark') && !key.endsWith('A'))
      .flatMap(([, scale]) => Object.values(scale as Record<string, string>));
    const darkValues = Object.entries(Palette)
      .filter(([key]) => key.endsWith('Dark'))
      .flatMap(([, scale]) => Object.values(scale as Record<string, string>));

    for (const color of SharedColors) {
      expect(lightValues).toContain(color);
      expect(darkValues).toContain(color);
    }
  });

  it('avoids the colors the editor already spends on key badges', () => {
    expect(SharedColors).not.toContain(Palette.amber.amber9);
    expect(SharedColors).not.toContain(Palette.ruby.ruby9);
    expect(SharedColors).not.toContain(Palette.cyan.cyan9);
  });
});

describe('toSharedColor', () => {
  it('is deterministic for one id', () => {
    expect(toSharedColor('editor-1')).toBe(toSharedColor('editor-1'));
  });

  it('always lands inside the palette, including for an empty id', () => {
    for (const id of ['', 'a', 'V1StGXR8_Z5jdHi6B-myT', '\u{1F600}\u{1F600}']) {
      expect(SharedColors).toContain(toSharedColor(id));
    }
  });

  it('spreads nanoid-shaped ids across every slot', () => {
    const ids = Array.from({ length: 400 }, (_, index) => `editor-${index}`);
    const used = new Set(ids.map(toSharedColor));

    expect(used.size).toBe(SharedColors.length);
  });

  it('separates two peers in a session more often than not', () => {
    const pairs = Array.from({ length: 100 }, (_, index) => [
      `peer-a-${index}`,
      `peer-b-${index}`,
    ]);
    const distinct = pairs.filter(
      ([a, b]) => toSharedColor(a) !== toSharedColor(b)
    );

    expect(distinct.length).toBeGreaterThan(70);
  });
});
