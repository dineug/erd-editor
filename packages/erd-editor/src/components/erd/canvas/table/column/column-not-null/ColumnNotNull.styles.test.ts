import { addCSSHost } from '@dineug/r-html';
import { beforeAll, describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/canvas/table/column/column-not-null/ColumnNotNull.styles';

let adoptedRules: string[] = [];

function ruleTextOf(selector: string) {
  const rule = adoptedRules.find(text => text.startsWith(`${selector} {`));
  if (!rule) {
    throw new Error(`missing rule: ${selector}`);
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

describe('ColumnNotNull.styles', () => {
  it('exports a single `notNull` css template literal', () => {
    expect(Object.keys(styles)).toEqual(['notNull']);
    expect(Array.isArray(styles.notNull.strings)).toBe(true);
    expect(styles.notNull.template.node).toBeTruthy();
  });

  it('renders to a stable generated class name', () => {
    const identifier = String(styles.notNull);

    expect(identifier.startsWith('_')).toBe(true);
    expect(String(styles.notNull)).toBe(identifier);
  });

  it('lays the cell out as a fixed height inline-flex box', () => {
    const text = ruleTextOf(`.${styles.notNull}`);

    expect(text).toContain('display: inline-flex');
    expect(text).toContain('height: 20px');
    expect(text).toContain('box-sizing: border-box');
    expect(text).toContain('align-items: center');
  });

  it('always paints the label with the active colour, unlike ColumnOption', () => {
    const text = ruleTextOf(`.${styles.notNull}`);

    expect(text).toContain('color: var(--active)');
    expect(text).not.toContain('var(--placeholder)');
    expect(text).toContain('background-color: transparent');
    expect(text).toContain('border-bottom-color: transparent');
  });

  it('inlines the paragraph typography preset with a normal line height', () => {
    const text = ruleTextOf(`.${styles.notNull}`);

    expect(text).toContain('font-size: var(--font-size-1)');
    expect(text).toContain('letter-spacing: var(--letter-spacing-1)');
    expect(text).toContain('font-weight: var(--font-weight-regular)');
    expect(text).toContain('line-height: normal');
  });

  it('keeps the label non interactive', () => {
    const text = ruleTextOf(`.${styles.notNull}`);

    expect(text).toContain('cursor: default');
    expect(text).toContain('user-select: none');
  });

  it('underlines the cell with the focus colour under `.focus`', () => {
    const text = ruleTextOf(`.${styles.notNull}.focus`);

    expect(text).toContain('border-bottom-color: var(--focus)');
    expect(text).toContain('border-bottom-width: 1.5px');
  });

  it('has no `.checked` variant', () => {
    expect(
      adoptedRules.some(text => text.startsWith(`.${styles.notNull}.checked {`))
    ).toBe(false);
  });
});
