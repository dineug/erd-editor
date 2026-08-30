import { beforeAll, describe, expect, it } from 'vite-plus/test';

import {
  adoptedRules,
  adoptedSheets,
  ruleOf,
  SCOPE_CLASS,
  selectorsOf,
} from '@/__test-utils__/adoptedCss';
import { colorPickerStyle } from '@/styles/colorPicker.style';

let rules: CSSStyleRule[] = [];

beforeAll(() => {
  rules = adoptedRules();
});

describe('colorPicker.style', () => {
  describe('delivery', () => {
    it('is a css.global literal, adopted rather than appended as a <style>', () => {
      expect(colorPickerStyle.template.node.mode).toBe('global');
      expect(document.querySelector('style')).toBeNull();
    });

    it('registers exactly one sheet, holding every vendored rule', () => {
      const sheets = adoptedSheets();

      expect(sheets).toHaveLength(1);
      expect(sheets[0]).toHaveLength(rules.length);
    });

    it('emits all 307 rules, every one of them with a selector', () => {
      // Exact rather than a lower bound, because a vendored stylesheet does not
      // drift on its own: a change here means the vendored text changed or the
      // compiler started dropping rules, both worth looking at.
      expect(rules).toHaveLength(307);
      for (const rule of rules) {
        expect(rule.selectorText).toBeTruthy();
      }
    });
  });

  describe('containment', () => {
    it('namespaces every selector under one of the two upstream class names', () => {
      // Load-bearing, not housekeeping. This sheet is unscoped and adopted into every shadow root
      // addCSSHost knows about, so a selector that escapes these two names is a 307-rule
      // vendored stylesheet applying to the whole editor.
      const escaped = selectorsOf(rules).filter(
        selector =>
          !selector.includes('.easylogic-colorpicker') &&
          !selector.includes('.colorsets-contextmenu')
      );

      expect(escaped).toEqual([]);
    });

    it('keeps the upstream class names literal, not generated', () => {
      // The picker's markup is built by the upstream library at runtime and writes these names
      // itself, so a scope class anywhere in this sheet would mean nothing matches it.
      for (const rule of rules) {
        expect(rule.cssText).not.toMatch(SCOPE_CLASS);
      }
    });

    it('only depends on theme custom properties the editor actually defines', () => {
      const text = rules.map(rule => rule.cssText).join('');
      const used = Array.from(text.matchAll(/var\((--[a-z-]+)\)/g)).map(
        match => match[1]
      );

      expect(new Set(used)).toEqual(
        new Set([
          '--context-menu-border',
          '--context-menu-background',
          '--active',
          '--foreground',
        ])
      );
    });
  });

  describe('rules', () => {
    it('anchors the picker as a 224px wide floating panel', () => {
      const rule = ruleOf(rules, '.easylogic-colorpicker');

      expect(rule.style.getPropertyValue('position')).toBe('relative');
      expect(rule.style.getPropertyValue('width')).toBe('224px');
      expect(rule.style.getPropertyValue('z-index')).toBe('1000');
      expect(rule.style.getPropertyValue('display')).toBe('inline-block');
      expect(rule.style.getPropertyValue('border-radius')).toBe('3px');
    });

    it('themes the panel chrome with the context menu custom properties', () => {
      const rule = ruleOf(rules, '.easylogic-colorpicker');

      expect(rule.style.getPropertyValue('background-color')).toBe(
        'var(--context-menu-background)'
      );
      expect(rule.style.getPropertyValue('border-color')).toBe(
        'var(--context-menu-border)'
      );
    });

    it('hides the arrow decoration by default', () => {
      // > with no surrounding whitespace: the compiler compacts combinators, where the old
      // <style> path handed the source text to the parser verbatim. Same rule, same match.
      const rule = ruleOf(rules, '.easylogic-colorpicker>.arrow');

      expect(rule.style.getPropertyValue('display')).toBe('none');
      expect(rule.style.getPropertyValue('pointer-events')).toBe('none');
    });

    it('keeps the color chooser overlay transparent and click through until .open', () => {
      const overlay = ruleOf(
        rules,
        '.easylogic-colorpicker .colorpicker-body .color-chooser'
      );
      const open = ruleOf(
        rules,
        '.easylogic-colorpicker .colorpicker-body .color-chooser.open'
      );

      expect(overlay.style.getPropertyValue('position')).toBe('absolute');
      expect(overlay.style.getPropertyValue('top')).toBe('0px');
      expect(overlay.style.getPropertyValue('opacity')).toBe('0');
      expect(overlay.style.getPropertyValue('pointer-events')).toBe('none');
      expect(open.style.getPropertyValue('opacity')).toBe('1');
      expect(open.style.getPropertyValue('pointer-events')).toBe('all');
    });

    it('positions the chooser container below the 120px tall header area', () => {
      const rule = ruleOf(
        rules,
        '.easylogic-colorpicker .colorpicker-body .color-chooser .color-chooser-container'
      );

      expect(rule.style.getPropertyValue('position')).toBe('absolute');
      expect(rule.style.getPropertyValue('top')).toBe('120px');
      expect(rule.style.getPropertyValue('background-color')).toBe(
        'var(--context-menu-background)'
      );
    });

    it('supports the hide-colorsets modifier', () => {
      const rule = ruleOf(
        rules,
        '.easylogic-colorpicker.hide-colorsets .colorsets'
      );

      expect(rule.style.getPropertyValue('display')).toBe('none');
      expect(rule.style.getPropertyPriority('display')).toBe('important');
    });

    it('keeps the colorsets context menu hidden until .show is applied', () => {
      expect(
        ruleOf(rules, '.colorsets-contextmenu').style.getPropertyValue(
          'display'
        )
      ).toBe('none');
      expect(
        ruleOf(rules, '.colorsets-contextmenu.show').style.getPropertyValue(
          'display'
        )
      ).toBe('inline-block');
      expect(
        ruleOf(rules, '.colorsets-contextmenu').style.getPropertyValue(
          'position'
        )
      ).toBe('fixed');
    });

    it('highlights context menu items on hover', () => {
      const rule = ruleOf(rules, '.colorsets-contextmenu .menu-item:hover');

      expect(rule.style.getPropertyValue('background-color')).toBe('#5ea3fb');
      expect(rule.style.getPropertyValue('color')).toBe('white');
    });

    it('ships the layout primitives the picker markup relies on', () => {
      const selectors = selectorsOf(rules).join(' ');

      for (const selector of [
        '.colorpicker-body',
        '.color-chooser',
        '.colorsets',
        '.hue',
        '.saturation',
        '.value',
        '.opacity',
        '.information',
        '.drag-bar',
      ]) {
        expect(selectors).toContain(selector);
      }
    });
  });
});
