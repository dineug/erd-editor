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
