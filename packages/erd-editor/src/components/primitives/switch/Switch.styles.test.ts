import { addCSSHost } from '@dineug/r-html';
import { beforeAll, describe, expect, it } from 'vite-plus/test';

import {
  size1,
  size2,
  size3,
  switchButton,
  switchThumb,
} from '@/components/primitives/switch/Switch.styles';

let adoptedRules: string[] = [];

function rulesOf(identifier: string) {
  const rules = adoptedRules.filter(text => text.startsWith(`.${identifier}`));
  if (!rules.length) {
    throw new Error(`missing rules for: ${identifier}`);
  }
  return rules;
}

function ruleOf(identifier: string, suffix = '') {
  const selector = `.${identifier}${suffix} `;
  const rule = rulesOf(identifier).find(text => text.startsWith(selector));
  if (!rule) {
    throw new Error(`missing rule for: ${selector}`);
  }
  return rule;
}

beforeAll(() => {
  const host = document.createElement('div').attachShadow({ mode: 'open' });
  addCSSHost(host);
  adoptedRules = host.adoptedStyleSheets.flatMap(sheet =>
    Array.from(sheet.cssRules).map(rule => rule.cssText)
  );
});

describe('Switch.styles', () => {
  it('exports five css template literals with distinct generated class names', () => {
    const all = [switchButton, size1, size2, size3, switchThumb];

    for (const style of all) {
      expect(Array.isArray(style.strings)).toBe(true);
      expect(style.template.node).toBeTruthy();
      expect(String(style).startsWith('_')).toBe(true);
    }
    expect(new Set(all.map(String)).size).toBe(5);
  });

  it('is stable: stringifying twice yields the same class name', () => {
    expect(String(switchButton)).toBe(String(switchButton));
    expect(String(size2)).toBe(String(size2));
  });

  describe('switchButton', () => {
    it('is a pill shaped inline-flex button', () => {
      const text = ruleOf(String(switchButton));

      expect(text).toContain('position: relative');
      expect(text).toContain('display: inline-flex');
      expect(text).toContain('align-items: center');
      expect(text).toContain('cursor: pointer');
      expect(text).toContain('border-radius: 9999px');
    });

    it('paints the track through a ::before layer bound to the theme tokens', () => {
      const text = ruleOf(String(switchButton), '::before');

      expect(text).toContain('background-color: var(--gray-color-3)');
      expect(text).toContain('var(--accent-color-9) 40%');
      expect(text).toContain('box-shadow: inset 0 0 0 1px var(--gray-color-6)');
      expect(text).toContain('pointer-events: none');
    });

    it('drives the on/off transition from the data-checked attribute', () => {
      const on = ruleOf(String(switchButton), "[data-checked='true']::before");
      const off = ruleOf(
        String(switchButton),
        "[data-checked='false']::before"
      );

      expect(on).toContain('transition-duration: 0.16s,0.14s,0.14s,0.14s');
      expect(off).toContain('transition-duration: 0.12s,0.14s,0.14s,0.14s');
      expect(off).toContain('background-position-x: 100%');
    });
  });

  describe('size variants', () => {
    const cases: Array<[string, number, number, number]> = [
      ['size1', 28, 16, 14],
      ['size2', 35, 20, 18],
      ['size3', 42, 24, 22],
    ];
    const identifiers: Record<string, string> = {
      size1: String(size1),
      size2: String(size2),
      size3: String(size3),
    };

    it.each(cases)(
      '%s sizes the button, the ::before track and the thumb together',
      (name, width, height, thumb) => {
        const identifier = identifiers[name];

        expect(ruleOf(identifier)).toContain(`width: ${width}px`);
        expect(ruleOf(identifier)).toContain(`height: ${height}px`);
        expect(ruleOf(identifier, '::before')).toContain(
          `background-size: calc(${width}px * 2 + ${height}px) 100%`
        );
        // The compiler emits child combinators unspaced (`._x>span`), which is what
        // `adoptedStyleSheets` echoes back.
        expect(ruleOf(identifier, '>span')).toContain(`width: ${thumb}px`);
        expect(ruleOf(identifier, '>span[data-checked]')).toContain(
          `translateX(calc(${width}px - ${thumb}px - 1px))`
        );
      }
    );
  });

  describe('switchThumb', () => {
    it('is a white pill translated by one pixel when unchecked', () => {
      const text = ruleOf(String(switchThumb));

      expect(text).toContain('background-color: #fff');
      expect(text).toContain('border-radius: 9999px');
      expect(text).toContain('transform: translateX(1px)');
      expect(text).toContain('cubic-bezier(0.45, 0.05, 0.55, 0.95)');
    });
  });
});
