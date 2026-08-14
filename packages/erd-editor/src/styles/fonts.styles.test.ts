import { describe, expect, it } from 'vitest';

import {
  CodeFontFamily,
  createFontsStyle,
  TextFontFamily,
} from '@/styles/fonts.styles';

function hostRule(style: HTMLStyleElement) {
  document.head.append(style);
  const rules = Array.from(style.sheet?.cssRules ?? []) as CSSStyleRule[];
  style.remove();
  return rules;
}

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

  describe('createFontsStyle', () => {
    it('creates a detached <style> element', () => {
      const style = createFontsStyle();

      expect(style).toBeInstanceOf(HTMLStyleElement);
      expect(style.tagName).toBe('STYLE');
      expect(style.parentNode).toBeNull();
    });

    it('returns a new element on every call so multiple hosts can adopt it', () => {
      const a = createFontsStyle();
      const b = createFontsStyle();

      expect(a).not.toBe(b);
      expect(a.textContent).toBe(b.textContent);
    });

    it('declares the font custom properties on :host', () => {
      const rules = hostRule(createFontsStyle());

      expect(rules).toHaveLength(1);
      expect(rules[0].selectorText).toBe(':host');
      expect(rules[0].style.length).toBe(2);
    });

    it('interpolates the exported stacks into the custom properties', () => {
      const [rule] = hostRule(createFontsStyle());

      expect(rule.style.getPropertyValue('--text-font-family')).toBe(
        TextFontFamily
      );
      expect(rule.style.getPropertyValue('--code-font-family')).toBe(
        CodeFontFamily
      );
    });

    it('writes the raw css text consumed by reset.styles', () => {
      const style = createFontsStyle();

      expect(style.textContent).toContain(
        `--text-font-family: ${TextFontFamily};`
      );
      expect(style.textContent).toContain(
        `--code-font-family: ${CodeFontFamily};`
      );
    });
  });
});
