import { describe, expect, it } from 'vite-plus/test';

import {
  hexToHsv,
  Hsv,
  hsvToHex,
  hsvToRgb,
  isCompleteHexInput,
  parseChannelInput,
  parseHexInput,
  rgbToHsv,
  stepArea,
  stepHue,
} from '@/components/primitives/color-picker/colorModel';

const RED: Hsv = { h: 0, s: 1, v: 1 };
const INDIGO: Hsv = hexToHsv('#3e63dd', RED);

describe('colorModel conversions', () => {
  it('brings every 12-bit color back from hue, saturation and value unchanged', () => {
    const digits = '0123456789abcdef';
    const changed: string[] = [];

    for (const r of digits) {
      for (const g of digits) {
        for (const b of digits) {
          const hex = `#${r}${r}${g}${g}${b}${b}`;
          if (hsvToHex(hexToHsv(hex, RED)) !== hex) changed.push(hex);
        }
      }
    }

    expect(changed).toEqual([]);
  });

  it('turns a hue of 360 back into red', () => {
    expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe('#ff0000');
    expect(hsvToRgb({ h: 360, s: 1, v: 1 })).toEqual([255, 0, 0]);
  });

  it('reads a hue below red as the degrees short of 360, not a negative angle', () => {
    expect(rgbToHsv([255, 0, 128], RED).h).toBeCloseTo(329.88, 2);
  });

  it('reads the hue off green and blue as their own sixths of the circle', () => {
    expect(rgbToHsv([0, 255, 0], RED).h).toBe(120);
    expect(rgbToHsv([0, 0, 255], RED).h).toBe(240);
  });

  it('keeps the hue a gray lacks and takes its saturation to none', () => {
    const gray = rgbToHsv([128, 128, 128], INDIGO);

    expect(gray.h).toBe(INDIGO.h);
    expect(gray.s).toBe(0);
    expect(gray.v).toBeCloseTo(128 / 255, 10);
  });

  it('keeps both the hue and the saturation black lacks', () => {
    const black = rgbToHsv([0, 0, 0], INDIGO);

    expect(black).toEqual({ h: INDIGO.h, s: INDIGO.s, v: 0 });
  });

  it('writes a lower-case #rrggbb with two digits a channel', () => {
    expect(hsvToHex({ h: 0, s: 0, v: 0 })).toBe('#000000');
    expect(hsvToHex(hexToHsv('#0A0B0C', RED))).toBe('#0a0b0c');
  });
});

describe('parseHexInput', () => {
  it.each([
    'ff8800',
    '#FF8800',
    'f80',
    '#f808',
    'ff880080',
    ' ff8800 ',
    'rgb(255 136 0)',
  ])('reads %j as #ff8800', text => {
    expect(parseHexInput(text)).toBe('#ff8800');
  });

  it.each(['', '12345', 'zz', 'red'])('reads %j as no color', text => {
    expect(parseHexInput(text)).toBeNull();
  });
});

describe('isCompleteHexInput', () => {
  it.each(['ff8800', '#ff8800', 'FF880080', '#ff880080', ' ff8800 '])(
    'takes %j as a whole color',
    text => {
      expect(isCompleteHexInput(text)).toBe(true);
    }
  );

  it.each(['f80', '#f80', 'ff880', 'ff8800800', 'gg8800', ''])(
    'waits for more than %j',
    text => {
      expect(isCompleteHexInput(text)).toBe(false);
    }
  );
});

describe('parseChannelInput', () => {
  it.each([
    ['0', 0],
    ['255', 255],
    ['300', 255],
    [' 128 ', 128],
  ])('reads %j as %d', (text, value) => {
    expect(parseChannelInput(text)).toBe(value);
  });

  it.each(['', '-1', '1.5', '1000', 'a'])('reads %j as nothing', text => {
    expect(parseChannelInput(text)).toBeNull();
  });
});

describe('stepArea', () => {
  const MIDDLE: Hsv = { h: 200, s: 0.537, v: 0.462 };

  it.each([
    ['ArrowLeft', false, { s: 0.53 }],
    ['ArrowRight', false, { s: 0.55 }],
    ['ArrowDown', false, { v: 0.45 }],
    ['ArrowUp', false, { v: 0.47 }],
    ['ArrowLeft', true, { s: 0.44 }],
    ['ArrowRight', true, { s: 0.64 }],
    ['ArrowDown', true, { v: 0.36 }],
    ['ArrowUp', true, { v: 0.56 }],
    ['PageDown', false, { v: 0.36 }],
    ['PageUp', false, { v: 0.56 }],
    ['PageUp', true, { v: 0.56 }],
    ['Home', false, { s: 0 }],
    ['End', false, { s: 1 }],
  ] as const)(
    'moves %s (shift %s) from the whole percent',
    (key, coarse, moved) => {
      expect(stepArea(MIDDLE, key, coarse)).toEqual({ ...MIDDLE, ...moved });
    }
  );

  it('stops at either end rather than wrapping', () => {
    const corner: Hsv = { h: 10, s: 1, v: 0 };

    expect(stepArea(corner, 'ArrowRight', true)).toEqual(corner);
    expect(stepArea(corner, 'ArrowDown', false)).toEqual(corner);
    expect(stepArea(corner, 'PageDown', false)).toEqual(corner);
    expect(stepArea({ h: 10, s: 0, v: 1 }, 'ArrowLeft', false)).toEqual({
      h: 10,
      s: 0,
      v: 1,
    });
    expect(stepArea({ h: 10, s: 0, v: 1 }, 'PageUp', false)).toEqual({
      h: 10,
      s: 0,
      v: 1,
    });
  });

  it.each([' ', 'Enter', 'a', 'Tab'])('takes no %j', key => {
    expect(stepArea(MIDDLE, key, false)).toBeNull();
  });
});

describe('stepHue', () => {
  it.each([
    ['ArrowLeft', false, 199],
    ['ArrowDown', false, 199],
    ['ArrowRight', false, 201],
    ['ArrowUp', false, 201],
    ['ArrowLeft', true, 190],
    ['ArrowUp', true, 210],
    ['PageDown', false, 190],
    ['PageUp', false, 210],
    ['Home', false, 0],
    ['End', false, 360],
  ] as const)('moves %s (shift %s) from the whole degree', (key, coarse, h) => {
    expect(stepHue(199.8, key, coarse)).toBe(h);
  });

  it('stops at 0 and 360 rather than wrapping', () => {
    expect(stepHue(0, 'ArrowLeft', false)).toBe(0);
    expect(stepHue(4, 'PageDown', false)).toBe(0);
    expect(stepHue(360, 'ArrowRight', true)).toBe(360);
    expect(stepHue(355, 'PageUp', false)).toBe(360);
  });

  it.each([' ', 'Enter', 'a'])('takes no %j', key => {
    expect(stepHue(100, key, false)).toBeNull();
  });
});
