import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

import {
  createOffscreenToWidth,
  FONT_PROBE_TEXTS,
  measureFontProbe,
  sameFontProbe,
  SCENE_FONT,
} from '@/services/export-png/textWidth';
import { TextFontFamily } from '@/styles/fonts.styles';

const TEXT_SOURCE = readFileSync(
  join(process.cwd(), 'src', 'utils', 'text.ts'),
  'utf8'
);

describe('the measurement a worker has to reproduce', () => {
  it('sets the shorthand the editor measures with', () => {
    expect(SCENE_FONT).toBe(`400 12px ${TextFontFamily}`);
  });

  it('is the shorthand utils/text.ts really sets', () => {
    expect(TEXT_SOURCE).toContain('`400 12px ${TextFontFamily}`');
  });

  it('adds the padding utils/text.ts adds', () => {
    expect(TEXT_SOURCE).toContain('const TEXT_PADDING = 2;');
    expect(TEXT_SOURCE).toContain('Math.round(width) + TEXT_PADDING');
  });

  it('answers with nothing in a realm that has no offscreen canvas', () => {
    const held = Reflect.get(globalThis, 'OffscreenCanvas');
    Reflect.deleteProperty(globalThis, 'OffscreenCanvas');

    try {
      expect(createOffscreenToWidth()).toBeNull();
    } finally {
      if (held) Reflect.set(globalThis, 'OffscreenCanvas', held);
    }
  });
});

describe('the probe two realms are compared by', () => {
  it('measures every probe string, in order', () => {
    expect(measureFontProbe(text => text.length)).toEqual(
      FONT_PROBE_TEXTS.map(text => text.length)
    );
  });

  it('covers latin, ideographs and punctuation, which resolve separately', () => {
    expect(FONT_PROBE_TEXTS).toHaveLength(3);
    expect(FONT_PROBE_TEXTS.join()).toMatch(/[a-z]/);
    expect(FONT_PROBE_TEXTS.join()).toMatch(/[　-鿿가-힯]/);
  });

  it('agrees only when every width agrees', () => {
    expect(sameFontProbe([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(sameFontProbe([1, 2, 3], [1, 2, 4])).toBe(false);
    expect(sameFontProbe([1, 2, 3], [1, 2])).toBe(false);
    expect(sameFontProbe([], [])).toBe(true);
  });
});
