import Color from 'color';
import { describe, expect, it } from 'vitest';

import { toTextColor } from '@/themes/textColor';

describe('toTextColor', () => {
  it('returns black for white, whose contrast against white is 1', () => {
    expect(new Color('#ffffff').contrast(new Color('#ffffff'))).toBe(1);
    expect(toTextColor(new Color('#ffffff'))).toBe('black');
  });

  it('returns white for black, whose contrast against white is 21', () => {
    expect(new Color('#000000').contrast(new Color('#ffffff'))).toBe(21);
    expect(toTextColor(new Color('#000000'))).toBe('white');
  });

  it('returns white just above the 4.5 contrast boundary', () => {
    const color = new Color('#767676');
    expect(color.contrast(new Color('#ffffff'))).toBeGreaterThan(4.5);
    expect(toTextColor(color)).toBe('white');
  });

  it('returns black just below the 4.5 contrast boundary', () => {
    const color = new Color('#777777');
    expect(color.contrast(new Color('#ffffff'))).toBeLessThan(4.5);
    expect(toTextColor(color)).toBe('black');
  });

  it('picks black for light radix accents and white for dark ones', () => {
    // amber9 is a light yellow, blue11 is a dark blue
    expect(toTextColor(new Color('#ffc53d'))).toBe('black');
    expect(toTextColor(new Color('#0d74ce'))).toBe('white');
  });

  it('accepts colors created from any notation, not just hex', () => {
    expect(toTextColor(new Color('rgb(255, 255, 255)'))).toBe('black');
    expect(toTextColor(new Color('hsl(0, 0%, 0%)'))).toBe('white');
    expect(toTextColor(new Color({ r: 0, g: 0, b: 0 }))).toBe('white');
  });

  it('ignores alpha because contrast is computed from the rgb channels only', () => {
    const translucentBlack = new Color('rgba(0, 0, 0, 0.5)');
    expect(translucentBlack.contrast(new Color('#ffffff'))).toBe(21);
    expect(toTextColor(translucentBlack)).toBe('white');
  });
});
