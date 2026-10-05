import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { stubCanvasColors } from '@/__test-utils__/canvas';
import { resolveColor } from '@/components/primitives/color-picker/resolveColor';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveColor', () => {
  it('reads the forms toOpaqueHex reads without a canvas', () => {
    const getContext = stubCanvasColors({});

    expect(resolveColor('#F80')).toBe('#ff8800');
    expect(resolveColor(' #ff880080 ')).toBe('#ff8800');
    expect(resolveColor('rgb(255 136 0)')).toBe('#ff8800');
    expect(resolveColor('hsl(32 100% 50%)')).toBe('#ff8800');
    expect(getContext).not.toHaveBeenCalled();
  });

  it('is null for an empty color, asking no canvas', () => {
    const getContext = stubCanvasColors({});

    expect(resolveColor('')).toBeNull();
    expect(resolveColor('   ')).toBeNull();
    expect(getContext).not.toHaveBeenCalled();
  });

  it('reads a name through the canvas, in any letter case', () => {
    stubCanvasColors({ red: '#ff0000', rebeccapurple: '#663399' });

    expect(resolveColor('red')).toBe('#ff0000');
    expect(resolveColor(' RebeccaPurple ')).toBe('#663399');
  });

  it('reads a name that is the color of one of its grounds', () => {
    stubCanvasColors({ white: '#ffffff', black: '#000000' });

    expect(resolveColor('white')).toBe('#ffffff');
    expect(resolveColor('black')).toBe('#000000');
  });

  it('drops the alpha of a color the canvas reads with one', () => {
    stubCanvasColors({ 'hwb(0 0% 0% / 0.5)': 'rgba(255, 0, 0, 0.5)' });

    expect(resolveColor('hwb(0 0% 0% / 0.5)')).toBe('#ff0000');
  });

  it('is null for a value the canvas leaves its fillStyle on', () => {
    stubCanvasColors({ red: '#ff0000' });

    expect(resolveColor('notacolor')).toBeNull();
  });

  it('reads a color the canvas writes back in its own syntax by the pixel it paints', () => {
    stubCanvasColors(
      { 'oklch(0.6 0.2 30)': 'oklch(0.6 0.2 30)' },
      { 'oklch(0.6 0.2 30)': [222, 62, 45, 255] }
    );

    expect(resolveColor('oklch(0.6 0.2 30)')).toBe('#de3e2d');
  });

  it('is null for a color in its own syntax the canvas paints clear', () => {
    stubCanvasColors(
      { 'oklch(0.6 0.2 30 / 0)': 'oklch(0.6 0.2 30 / 0)' },
      { 'oklch(0.6 0.2 30 / 0)': [0, 0, 0, 0] }
    );

    expect(resolveColor('oklch(0.6 0.2 30 / 0)')).toBeNull();
  });

  it('is null where the canvas has no 2d context', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    expect(resolveColor('red')).toBeNull();
  });
});
