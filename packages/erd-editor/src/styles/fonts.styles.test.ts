import { beforeAll, describe, expect, it } from 'vite-plus/test';

import {
  adoptedRules,
  adoptedSheets,
  SCOPE_CLASS,
} from '@/__test-utils__/adoptedCss';
import {
  CodeFontFamily,
  fontsStyle,
  TextFontFamily,
} from '@/styles/fonts.styles';

/** The family list a stack declares, whatever the whitespace around its commas. */
const families = (stack: string) => stack.split(',').map(part => part.trim());

let rules: CSSStyleRule[] = [];

beforeAll(() => {
  rules = adoptedRules();
});

describe('fonts.styles', () => {
  describe('font family constants', () => {
    it('exposes the system text stack starting with -apple-system', () => {
      expect(TextFontFamily.startsWith('-apple-system')).toBe(true);
      expect(TextFontFamily).toContain('BlinkMacSystemFont');
      expect(TextFontFamily).toContain("'Segoe UI'");
      expect(TextFontFamily).toContain('system-ui');
      expect(TextFontFamily.endsWith("'Segoe UI Emoji'")).toBe(true);
    });

    it('always falls back to a generic family', () => {
      expect(TextFontFamily).toContain('sans-serif');
      expect(CodeFontFamily).toContain('monospace');
    });

    it('exposes a monospace code stack starting with Menlo', () => {
      expect(CodeFontFamily.startsWith("'Menlo'")).toBe(true);
      expect(CodeFontFamily).toContain("'Consolas'");
      expect(CodeFontFamily).toContain("'Bitstream Vera Sans Mono'");
    });

    it('keeps the two stacks distinct', () => {
      expect(TextFontFamily).not.toBe(CodeFontFamily);
    });
  });

  describe('fontsStyle', () => {
    it('is a css.global literal, adopted rather than appended as a <style>', () => {
      expect(fontsStyle.template.node.mode).toBe('global');
      expect(document.querySelector('style')).toBeNull();
    });

    it('declares the font custom properties on an unscoped :host', () => {
      const sheets = adoptedSheets();

      expect(sheets).toHaveLength(1);
      expect(rules).toHaveLength(1);
      expect(rules[0].selectorText).toBe(':host');
      expect(rules[0].style.length).toBe(2);
      expect(rules[0].cssText).not.toMatch(SCOPE_CLASS);
    });

    it('interpolates the exported stacks into the custom properties', () => {
      const style = rules[0].style;

      expect(families(style.getPropertyValue('--text-font-family'))).toEqual(
        families(TextFontFamily)
      );
      expect(families(style.getPropertyValue('--code-font-family'))).toEqual(
        families(CodeFontFamily)
      );
    });

    it('emits the stacks comma tight', () => {
      // stylis removes the whitespace after a top level comma in a value, and happy-dom only
      // restores it for properties it parses itself — a custom property is not one of those. The
      // token stream is unchanged, so this is a serialization difference and nothing more.
      const style = rules[0].style;

      expect(style.getPropertyValue('--text-font-family')).toBe(
        TextFontFamily.split(', ').join(',')
      );
      expect(style.getPropertyValue('--code-font-family')).toBe(
        CodeFontFamily.split(', ').join(',')
      );
    });

    it('keeps the two slots as values, not as selectors', () => {
      expect(fontsStyle.values).toEqual([TextFontFamily, CodeFontFamily]);
      expect(fontsStyle.template.node.slots.map(slot => slot.kind)).toEqual([
        'inline',
        'inline',
      ]);
    });
  });
});
