import { beforeAll, describe, expect, it } from 'vite-plus/test';

import {
  adoptedRules,
  adoptedSheets,
  ruleOf,
  SCOPE_CLASS,
  selectorsOf,
} from '@/__test-utils__/adoptedCss';
import { resetStyle } from '@/styles/reset.styles';

let rules: CSSStyleRule[] = [];

beforeAll(() => {
  rules = adoptedRules();
});

describe('reset.styles', () => {
  describe('delivery', () => {
    it('is a css.global literal, adopted rather than appended as a <style>', () => {
      expect(String(resetStyle)).toMatch(/^_[0-9a-z]{7}$/);
      expect(resetStyle.template.node.mode).toBe('global');
      expect(document.querySelector('style')).toBeNull();
    });

    it('registers exactly one sheet, holding every reset rule', () => {
      const sheets = adoptedSheets();

      expect(sheets).toHaveLength(1);
      expect(sheets[0]).toHaveLength(rules.length);
    });

    it('attaches no generated class to anything', () => {
      for (const rule of rules) {
        expect(rule.cssText).not.toMatch(SCOPE_CLASS);
      }
    });
  });

  describe('rules', () => {
    it('emits every reset rule in source order', () => {
      // stylis drops the whitespace after a top level comma, so a selector list round trips
      // comma tight. Matching is unaffected; only the text is.
      expect(selectorsOf(rules)).toEqual([
        'p,ol,ul,li,dl,dt,dd,blockquote,figure,fieldset,legend,textarea,pre,iframe,hr,h1,h2,h3,h4,h5,h6',
        'h1,h2,h3,h4,h5,h6',
        'ul',
        'button,input,select,textarea',
        'input::placeholder,textarea::placeholder',
        'input:disabled,textarea:disabled',
        '*,*::before,*::after',
        'img,video',
        'iframe',
        'table',
        'td,th',
        ':host',
      ]);
    });

    it('zeroes margin and padding on flow content', () => {
      const rule = rules[0];

      expect(rule.style.getPropertyValue('margin')).toBe('0px');
      expect(rule.style.getPropertyValue('padding')).toBe('0px');
    });

    it('flattens heading typography', () => {
      const rule = ruleOf(rules, 'h1,h2,h3,h4,h5,h6');

      expect(rule.style.getPropertyValue('font-size')).toBe('100%');
      expect(rule.style.getPropertyValue('font-weight')).toBe('normal');
    });

    it('removes list markers from ul', () => {
      expect(ruleOf(rules, 'ul').style.getPropertyValue('list-style')).toBe(
        'none'
      );
    });

    it('makes form controls inherit the editor font and active color', () => {
      const rule = ruleOf(rules, 'button,input,select,textarea');

      expect(rule.style.getPropertyValue('font-family')).toBe(
        'var(--text-font-family)'
      );
      expect(rule.style.getPropertyValue('color')).toBe('var(--active)');
      expect(rule.style.getPropertyValue('background-color')).toBe('inherit');
      expect(rule.style.getPropertyValue('padding')).toBe('0px');
    });

    it('strips the native border and outline off form controls', () => {
      // This used to read `style.textContent` for `border: none;` / `outline: none;`. There is no
      // element and no source text any more, so it reads the two shorthands back off the CSSOM.
      const rule = ruleOf(rules, 'button,input,select,textarea');

      expect(rule.style.getPropertyValue('border-style')).toBe('none');
      expect(rule.style.getPropertyValue('outline-style')).toBe('none');
    });

    it('styles placeholders with the placeholder color at full opacity', () => {
      const rule = ruleOf(rules, 'input::placeholder,textarea::placeholder');

      expect(rule.style.getPropertyValue('color')).toBe('var(--placeholder)');
      expect(rule.style.getPropertyValue('opacity')).toBe('1');
      expect(rule.style.getPropertyValue('font-family')).toBe(
        'var(--text-font-family)'
      );
    });

    it('dims disabled inputs and shows a not-allowed cursor', () => {
      const rule = ruleOf(rules, 'input:disabled,textarea:disabled');

      expect(rule.style.getPropertyValue('cursor')).toBe('not-allowed');
      expect(rule.style.getPropertyValue('opacity')).toBe('0.5');
    });

    it('applies border-box sizing to every element and pseudo element', () => {
      const rule = ruleOf(rules, '*,*::before,*::after');

      expect(rule.style.getPropertyValue('box-sizing')).toBe('border-box');
    });

    it('keeps media responsive and borderless', () => {
      const media = ruleOf(rules, 'img,video');

      expect(media.style.getPropertyValue('height')).toBe('auto');
      expect(media.style.getPropertyValue('max-width')).toBe('100%');
      expect(
        ruleOf(rules, 'iframe').style.getPropertyValue('border')
      ).toContain('0');
    });

    it('collapses table borders and zeroes cell padding', () => {
      expect(
        ruleOf(rules, 'table').style.getPropertyValue('border-collapse')
      ).toBe('collapse');
      expect(
        ruleOf(rules, 'table').style.getPropertyValue('border-spacing')
      ).toBe('0');
      expect(ruleOf(rules, 'td,th').style.getPropertyValue('padding')).toBe(
        '0px'
      );
    });

    it('binds :host to the typography and theme custom properties', () => {
      const rule = ruleOf(rules, ':host');

      expect(rule.style.getPropertyValue('font-family')).toBe(
        'var(--text-font-family)'
      );
      expect(rule.style.getPropertyValue('color')).toBe('var(--foreground)');
      expect(rule.style.getPropertyValue('font-size')).toBe(
        'var(--font-size-2)'
      );
      expect(rule.style.getPropertyValue('letter-spacing')).toBe(
        'var(--letter-spacing-2)'
      );
      expect(rule.style.getPropertyValue('line-height')).toBe(
        'var(--line-height-2)'
      );
      expect(rule.style.getPropertyValue('font-weight')).toBe(
        'var(--font-weight-regular)'
      );
    });
  });
});
