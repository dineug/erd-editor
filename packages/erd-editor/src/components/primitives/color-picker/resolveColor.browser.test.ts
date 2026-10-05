import { describe, expect, it } from 'vite-plus/test';

import { resolveColor } from '@/components/primitives/color-picker/resolveColor';

describe('resolveColor in a real browser', () => {
  it('reads a CSS color name as its hex, in any letter case', () => {
    expect(resolveColor('red')).toBe('#ff0000');
    expect(resolveColor('RebeccaPurple')).toBe('#663399');
  });

  it('reads a color function toOpaqueHex does not', () => {
    expect(resolveColor('hwb(120 0% 0%)')).toBe('#00ff00');
  });

  it('reads white and black, the colors of its two grounds', () => {
    expect(resolveColor('white')).toBe('#ffffff');
    expect(resolveColor('black')).toBe('#000000');
  });

  it('is null for a word that names no color', () => {
    expect(resolveColor('notacolor')).toBeNull();
  });

  it('reads a color Chromium writes back in its own syntax by the pixel it paints', () => {
    expect(resolveColor('oklch(0.6 0.2 30)')).toBe('#de3e2d');
    expect(resolveColor('lab(50% 40 59.5)')).toBe('#bf5700');
    expect(resolveColor('color(display-p3 1 0 0)')).toBe('#ff0000');
    expect(resolveColor('color-mix(in srgb, red, blue)')).toBe('#800080');
    expect(resolveColor('rgb(from red r g b)')).toBe('#ff0000');
  });

  it('is null for a color in its own syntax that paints nothing', () => {
    expect(resolveColor('oklch(0.6 0.2 30 / 0)')).toBeNull();
  });
});
