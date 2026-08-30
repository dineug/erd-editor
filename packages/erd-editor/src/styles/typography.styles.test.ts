import { beforeAll, describe, expect, it } from 'vite-plus/test';

import {
  adoptedRules,
  adoptedSheets,
  SCOPE_CLASS,
} from '@/__test-utils__/adoptedCss';
import {
  fontSize1,
  fontSize2,
  fontSize3,
  fontSize4,
  fontSize5,
  fontSize6,
  fontSize7,
  fontSize8,
  fontSize9,
  typography,
  typographyStyle,
} from '@/styles/typography.styles';

const fontSizes = [
  fontSize1,
  fontSize2,
  fontSize3,
  fontSize4,
  fontSize5,
  fontSize6,
  fontSize7,
  fontSize8,
  fontSize9,
];

let rules: CSSStyleRule[] = [];
let ruleTexts: string[] = [];

function ruleTextOf(identifier: string) {
  const rule = ruleTexts.find(text => text.startsWith(`.${identifier} `));
  if (!rule) {
    throw new Error(`missing rule for: ${identifier}`);
  }
  return rule;
}

/** The one global sheet this module registers — the design token block. */
function tokenRule(): CSSStyleRule {
  const rule = rules.find(candidate => candidate.selectorText === ':host');
  if (!rule) {
    throw new Error('missing rule for: :host');
  }
  return rule;
}

beforeAll(() => {
  rules = adoptedRules();
  ruleTexts = rules.map(rule => rule.cssText);
});

describe('typography.styles', () => {
  describe('fontSize scale', () => {
    it('exports nine css template literals', () => {
      expect(fontSizes).toHaveLength(9);

      for (const fontSize of fontSizes) {
        expect(Array.isArray(fontSize.strings)).toBe(true);
        expect(fontSize.values).toHaveLength(3);
        expect(fontSize.template.node).toBeTruthy();
      }
    });

    it('renders each scale step to a unique generated class name', () => {
      const identifiers = fontSizes.map(String);

      for (const identifier of identifiers) {
        expect(identifier.startsWith('_')).toBe(true);
      }
      expect(new Set(identifiers).size).toBe(9);
    });

    it('is stable: stringifying twice yields the same class name', () => {
      expect(String(fontSize4)).toBe(String(fontSize4));
    });

    it('binds every step to the matching font-size/letter-spacing/line-height vars', () => {
      fontSizes.forEach((fontSize, index) => {
        const size = index + 1;
        const text = ruleTextOf(String(fontSize));

        expect(text).toContain(`font-size: var(--font-size-${size})`);
        expect(text).toContain(`letter-spacing: var(--letter-spacing-${size})`);
        expect(text).toContain(`line-height: var(--line-height-${size})`);
      });
    });

    it('interpolates the numeric size into the template values', () => {
      expect(fontSize7.values).toEqual([7, 7, 7]);
    });
  });

  describe('typography presets', () => {
    it('exposes exactly normal and paragraph', () => {
      expect(Object.keys(typography)).toEqual(['normal', 'paragraph']);
    });

    it('flattens fontSize2 plus the regular weight into normal', () => {
      const text = ruleTextOf(String(typography.normal));

      expect(text).toContain('font-size: var(--font-size-2)');
      expect(text).toContain('letter-spacing: var(--letter-spacing-2)');
      expect(text).toContain('line-height: var(--line-height-2)');
      expect(text).toContain('font-weight: var(--font-weight-regular)');
    });

    it('flattens fontSize1 plus the regular weight into paragraph', () => {
      const text = ruleTextOf(String(typography.paragraph));

      expect(text).toContain('font-size: var(--font-size-1)');
      expect(text).toContain('line-height: var(--line-height-1)');
      expect(text).toContain('font-weight: var(--font-weight-regular)');
    });

    it('keeps the presets distinct from the raw scale steps', () => {
      const identifiers = [
        String(typography.normal),
        String(typography.paragraph),
        ...fontSizes.map(String),
      ];

      expect(new Set(identifiers).size).toBe(11);
    });
  });

  describe('typographyStyle', () => {
    it('is a css.global literal, adopted rather than appended as a <style>', () => {
      expect(typographyStyle.template.node.mode).toBe('global');
      expect(document.querySelector('style')).toBeNull();
    });

    it('leads the adopted list, ahead of the scoped scale steps', () => {
      // The global bucket is adopted before every component sheet, so the token block that the
      // eleven scoped templates read through var() cannot end up behind them.
      const sheets = adoptedSheets();

      expect(sheets).toHaveLength(12);
      expect(sheets[0]).toHaveLength(1);
      expect(sheets[0][0].selectorText).toBe(':host');
    });

    it('declares the whole design token set on an unscoped :host', () => {
      const rule = tokenRule();

      expect(rule.style.length).toBe(31);
      expect(rule.cssText).not.toMatch(SCOPE_CLASS);
    });

    it('defines the nine font sizes in pixels', () => {
      const rule = tokenRule();
      const values = fontSizes.map((_, index) =>
        rule.style.getPropertyValue(`--font-size-${index + 1}`)
      );

      expect(values).toEqual([
        '12px',
        '14px',
        '16px',
        '18px',
        '20px',
        '24px',
        '28px',
        '35px',
        '60px',
      ]);
    });

    it('tightens letter spacing only from step 4 upwards', () => {
      const rule = tokenRule();

      expect(rule.style.getPropertyValue('--letter-spacing-1')).toBe('0em');
      expect(rule.style.getPropertyValue('--letter-spacing-3')).toBe('0em');
      expect(rule.style.getPropertyValue('--letter-spacing-4')).toBe(
        '-0.0025em'
      );
      expect(rule.style.getPropertyValue('--letter-spacing-9')).toBe(
        '-0.025em'
      );
    });

    it('defines the nine line heights in pixels', () => {
      const rule = tokenRule();
      const values = fontSizes.map((_, index) =>
        rule.style.getPropertyValue(`--line-height-${index + 1}`)
      );

      expect(values).toEqual([
        '16px',
        '20px',
        '24px',
        '26px',
        '28px',
        '30px',
        '36px',
        '40px',
        '60px',
      ]);
    });

    it('defines the four font weights consumed by reset.styles', () => {
      const rule = tokenRule();

      expect(rule.style.getPropertyValue('--font-weight-light')).toBe('300');
      expect(rule.style.getPropertyValue('--font-weight-regular')).toBe('400');
      expect(rule.style.getPropertyValue('--font-weight-medium')).toBe('500');
      expect(rule.style.getPropertyValue('--font-weight-bold')).toBe('700');
    });
  });
});
