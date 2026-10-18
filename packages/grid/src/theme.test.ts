import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import { darkTheme, type GridTheme, lightTheme } from '@/theme';

/** The fifteen tokens in the order the grid's spec lists them. */
const TOKENS = [
  'background',
  'headerBackground',
  'headerText',
  'text',
  'gridLine',
  'frozenBorder',
  'selectionFill',
  'selectionBorder',
  'activeCellBorder',
  'selectedHeaderBackground',
  'selectedHeaderText',
  'fullSelectionBackground',
  'readonlyBackground',
  'scrollbarThumb',
  'scrollbarTrack',
] as const;

/**
 * Six or eight hex digits, a colour every floor browser parses in CSS and in a
 * canvas fillStyle alike; happy-dom answers CSS.supports with true for anything,
 * so the spelling itself is what this pins.
 */
const HEX_COLOR = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/;

const OPAQUE = /^#[0-9a-f]{6}$/;

const themes = [
  ['lightTheme', lightTheme],
  ['darkTheme', darkTheme],
] as const;

/** Each text token and the surface the grid draws it on. */
const TEXT_ON_SURFACE = [
  ['text', 'background'],
  ['text', 'readonlyBackground'],
  ['headerText', 'headerBackground'],
  ['headerText', 'selectedHeaderBackground'],
  ['selectedHeaderText', 'fullSelectionBackground'],
] as const;

/** WCAG's relative luminance of an opaque #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(index => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;

    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG's contrast ratio of two opaque colours, from 1 to 21. */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (light + 0.05) / (dark + 0.05);
}

describe('GridTheme', () => {
  it('names the fifteen tokens and no more', () => {
    expectTypeOf<keyof GridTheme>().toEqualTypeOf<(typeof TOKENS)[number]>();
    expect(TOKENS).toHaveLength(15);
  });

  describe.each(themes)('%s', (_, theme) => {
    it('sets every token, in the spec order', () => {
      expect(Object.keys(theme)).toEqual([...TOKENS]);
    });

    it('spells every token as a hex colour', () => {
      const invalid = TOKENS.filter(token => !HEX_COLOR.test(theme[token]));

      expect(invalid).toEqual([]);
    });

    it('fills a selection translucently, so the cells under it still read', () => {
      expect(theme.selectionFill).toMatch(/^#[0-9a-f]{6}(?!ff)[0-9a-f]{2}$/);
    });

    it('paints the header highlights opaque, since they repaint the labels over the header', () => {
      expect(theme.selectedHeaderBackground).toMatch(OPAQUE);
      expect(theme.fullSelectionBackground).toMatch(OPAQUE);
    });

    it('keeps every text 4.5:1 against the surface it is drawn on, the AA bound for 13px text', () => {
      const short = TEXT_ON_SURFACE.filter(
        ([text, surface]) => contrast(theme[text], theme[surface]) < 4.5
      );

      expect(short).toEqual([]);
    });

    it('is frozen, so one grid cannot repaint another through the shared default', () => {
      expect(Object.isFrozen(theme)).toBe(true);
    });
  });

  it('gives the dark default its own colours for the surfaces', () => {
    expect(darkTheme.background).not.toBe(lightTheme.background);
    expect(darkTheme.headerBackground).not.toBe(lightTheme.headerBackground);
    expect(darkTheme.text).not.toBe(lightTheme.text);
  });
});
