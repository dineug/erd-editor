import { describe, expect, it } from 'vite-plus/test';

import {
  CONTRAST_BLACK,
  CONTRAST_WHITE,
  contrastRatio,
  contrastTextColor,
  relativeLuminance,
} from '@/utils/contrastText';

/** The luminance at which black and white contrast alike, sqrt(0.0525) less 0.05. */
const TIE = Math.sqrt(0.0525) - 0.05;

const hexOf = (value: number) => value.toString(16).padStart(2, '0');

describe('relativeLuminance', () => {
  it('runs from 0 for black to 1 for white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10);
  });

  it('weighs each channel as WCAG 2 does', () => {
    expect(relativeLuminance('#ff0000')).toBeCloseTo(0.2126, 10);
    expect(relativeLuminance('#00ff00')).toBeCloseTo(0.7152, 10);
    expect(relativeLuminance('#0000ff')).toBeCloseTo(0.0722, 10);
  });

  it('linearizes sRGB first, mid gray being far darker than half', () => {
    expect(relativeLuminance('#808080')).toBeCloseTo(0.2158605, 6);
    expect(relativeLuminance('#777777')).toBeCloseTo(0.1844749, 6);
  });

  it('reads every form toOpaqueHex reads, any alpha dropped', () => {
    const white = relativeLuminance('#ffffff');

    expect(relativeLuminance('#fff')).toBe(white);
    expect(relativeLuminance('#FFF8')).toBe(white);
    expect(relativeLuminance('#ffffff00')).toBe(white);
    expect(relativeLuminance('rgb(255, 255, 255)')).toBe(white);
    expect(relativeLuminance('rgba(100% 100% 100% / 0.2)')).toBe(white);
    expect(relativeLuminance('hsl(0 0% 100%)')).toBe(white);
    expect(relativeLuminance(' hsla(120, 100%, 100%, 0.5) ')).toBe(white);
  });

  it('is null for a color it cannot read', () => {
    expect(relativeLuminance('')).toBeNull();
    expect(relativeLuminance('red')).toBeNull();
    expect(relativeLuminance('#ggg')).toBeNull();
    expect(relativeLuminance('var(--accent-9)')).toBeNull();
  });
});

describe('contrastRatio', () => {
  it('is 21 for black and white and 1 for a color and itself, in either order', () => {
    expect(contrastRatio(0, 1)).toBe(21);
    expect(contrastRatio(1, 0)).toBe(21);
    expect(contrastRatio(0.3, 0.3)).toBe(1);
  });

  it('reads #777777 on white as the 4.48 WCAG gives it', () => {
    expect(contrastRatio(relativeLuminance('#777777')!, 1)).toBeCloseTo(
      4.48,
      2
    );
  });
});

describe('contrastTextColor', () => {
  it.each([
    ['#ffffff', CONTRAST_BLACK],
    ['#000000', CONTRAST_WHITE],
    ['#3b82f6', CONTRAST_BLACK],
    ['#1e3a8a', CONTRAST_WHITE],
    ['#ef4444', CONTRAST_BLACK],
    ['#6b7280', CONTRAST_WHITE],
    ['#ffff00', CONTRAST_BLACK],
    ['#0000ff', CONTRAST_WHITE],
  ])('writes on %s in %s', (background, text) => {
    expect(contrastTextColor(background)).toBe(text);
  });

  it('picks by the ratio either side of the tie, which falls between two grays', () => {
    expect(contrastRatio(TIE, 0)).toBeCloseTo(contrastRatio(TIE, 1), 10);
    expect(relativeLuminance('#757575')!).toBeLessThan(TIE);
    expect(relativeLuminance('#767676')!).toBeGreaterThan(TIE);
    expect(contrastTextColor('#757575')).toBe(CONTRAST_WHITE);
    expect(contrastTextColor('#767676')).toBe(CONTRAST_BLACK);
    expect(contrastTextColor('#777777')).toBe(CONTRAST_BLACK);
  });

  it('keeps 4.58 or more on every gray and across the color cube', () => {
    const backgrounds = [
      ...Array.from(
        { length: 256 },
        (_, value) => `#${hexOf(value).repeat(3)}`
      ),
      ...Array.from({ length: 512 }, (_, index) => {
        const channel = (bit: number) => hexOf(((index >> bit) & 7) * 36);
        return `#${channel(0)}${channel(3)}${channel(6)}`;
      }),
    ];

    for (const background of backgrounds) {
      const luminance = relativeLuminance(background)!;
      const text = contrastTextColor(background);
      const ratio = contrastRatio(luminance, text === CONTRAST_BLACK ? 0 : 1);

      expect(ratio).toBeGreaterThanOrEqual(4.58);
    }
  });

  it('reads the forms toOpaqueHex reads and gives null for any other', () => {
    expect(contrastTextColor('#FFF')).toBe(CONTRAST_BLACK);
    expect(contrastTextColor('rgb(0 0 0 / 50%)')).toBe(CONTRAST_WHITE);
    expect(contrastTextColor('hsl(60, 100%, 50%)')).toBe(CONTRAST_BLACK);
    expect(contrastTextColor('')).toBeNull();
    expect(contrastTextColor('blue')).toBeNull();
  });
});
