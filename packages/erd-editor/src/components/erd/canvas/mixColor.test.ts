import { describe, expect, it } from 'vite-plus/test';

import { mixColor } from '@/components/erd/canvas/mixColor';

describe('the colour a highlight walks through', () => {
  it('hands back each end exactly as it was given', () => {
    expect(mixColor('#102030', '#a0b0c0', 0)).toBe('#102030');
    expect(mixColor('#102030', '#a0b0c0', 1)).toBe('#a0b0c0');
    expect(mixColor('#102030', '#a0b0c0', -1)).toBe('#102030');
    expect(mixColor('#102030', '#a0b0c0', 2)).toBe('#a0b0c0');
  });

  it('mixes each channel straight, and rounds to a whole one', () => {
    expect(mixColor('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixColor('#000000', '#102030', 0.5)).toBe('#081018');
    expect(mixColor('#ff0000', '#0000ff', 0.25)).toBe('#bf0040');
  });

  it('reads the short spelling as the long one', () => {
    expect(mixColor('#000', '#fff', 0.5)).toBe('#808080');
    expect(mixColor('#f00', '#ff0000', 0.5)).toBe('#ff0000');
  });

  it('walks the whole way, and never past either end', () => {
    const steps = Array.from({ length: 11 }, (_, index) =>
      mixColor('#000000', '#0000ff', index / 10)
    );

    expect(steps[0]).toBe('#000000');
    expect(steps[10]).toBe('#0000ff');
    expect(new Set(steps).size).toBe(11);
  });

  it('hands back a colour it cannot read rather than one that is not a colour', () => {
    expect(mixColor('transparent', '#0000ff', 0.25)).toBe('transparent');
    expect(mixColor('transparent', '#0000ff', 0.75)).toBe('#0000ff');
    expect(mixColor('#0000ff', 'rgb(0 0 0)', 0.25)).toBe('#0000ff');
    expect(mixColor('#000000', '#ffffff', Number.NaN)).toBe('#000000');
  });
});
