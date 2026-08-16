import { beforeAll, describe, expect, it } from 'vite-plus/test';

import {
  adoptedRules,
  adoptedSheets,
  ruleOf,
  SCOPE_CLASS,
  selectorsOf,
} from '@/__test-utils__/adoptedCss';
import { scrollbarStyle } from '@/styles/scrollbar.styles';

let rules: CSSStyleRule[] = [];

beforeAll(() => {
  rules = adoptedRules();
});

describe('scrollbar.styles', () => {
  describe('delivery', () => {
    it('is a css.global literal, adopted rather than appended as a <style>', () => {
      expect(scrollbarStyle.template.node.mode).toBe('global');
      expect(document.querySelector('style')).toBeNull();
    });

    it('registers exactly one sheet, holding every scrollbar rule', () => {
      const sheets = adoptedSheets();

      expect(sheets).toHaveLength(1);
      expect(sheets[0]).toHaveLength(rules.length);
    });
  });

  describe('rules', () => {
    it('defines every webkit scrollbar pseudo element plus the .scrollbar class', () => {
      expect(selectorsOf(rules)).toEqual([
        '::-webkit-scrollbar',
        '::-webkit-scrollbar-track',
        '::-webkit-scrollbar-corner',
        '::-webkit-scrollbar-thumb',
        '::-webkit-scrollbar-thumb:hover',
        '.scrollbar',
      ]);
    });

    it('sizes the scrollbar to 8px in both axes', () => {
      const rule = ruleOf(rules, '::-webkit-scrollbar');

      expect(rule.style.getPropertyValue('width')).toBe('8px');
      expect(rule.style.getPropertyValue('height')).toBe('8px');
    });

    it('wires track, thumb and hover backgrounds to theme custom properties', () => {
      expect(
        ruleOf(rules, '::-webkit-scrollbar-track').style.getPropertyValue(
          'background'
        )
      ).toBe('var(--scrollbar-track)');
      expect(
        ruleOf(rules, '::-webkit-scrollbar-thumb').style.getPropertyValue(
          'background'
        )
      ).toBe('var(--scrollbar-thumb)');
      expect(
        ruleOf(rules, '::-webkit-scrollbar-thumb:hover').style.getPropertyValue(
          'background'
        )
      ).toBe('var(--scrollbar-thumb-hover)');
    });

    it('keeps the scrollbar corner transparent', () => {
      expect(
        ruleOf(rules, '::-webkit-scrollbar-corner').style.getPropertyValue(
          'background'
        )
      ).toBe('transparent');
    });

    it('exposes a standards based .scrollbar opt-in class', () => {
      const rule = ruleOf(rules, '.scrollbar');

      expect(rule.style.getPropertyValue('scrollbar-color')).toBe(
        'var(--scrollbar-thumb) var(--scrollbar-track)'
      );
      expect(rule.style.getPropertyValue('scrollbar-width')).toBe('thin');
    });

    it('keeps .scrollbar a literal hook class, not a generated one', () => {
      // Seven components opt in with `class=${['scrollbar', ...]}` and nine tests assert the
      // literal name, so this class is API. Scoping the sheet would rename it out from under them.
      expect(selectorsOf(rules)).toContain('.scrollbar');
      for (const rule of rules) {
        expect(rule.cssText).not.toMatch(SCOPE_CLASS);
      }
    });
  });
});
