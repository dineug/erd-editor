import { addCSSHost } from '@dineug/r-html';
import { beforeAll, describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/table-view/column/column-option/ColumnOption.styles';

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

describe('ColumnOption.styles', () => {
  it('exports a single `option` css template literal', () => {
    expect(Object.keys(styles)).toEqual(['option']);
    expect(Array.isArray(styles.option.strings)).toBe(true);
    expect(styles.option.template.node).toBeTruthy();
  });

  it('renders to a stable generated class name', () => {
    const identifier = String(styles.option);

    expect(identifier.startsWith('_')).toBe(true);
    expect(String(styles.option)).toBe(identifier);
  });

  it('lays the cell out as a fixed height inline-flex box', () => {
    const text = ruleTextOf(`.${styles.option}`);

    expect(text).toContain('display: inline-flex');
    expect(text).toContain('height: 20px');
    expect(text).toContain('box-sizing: border-box');
    expect(text).toContain('align-items: center');
  });

  it('defaults to the placeholder colour on a transparent background', () => {
    const text = ruleTextOf(`.${styles.option}`);

    expect(text).toContain('color: var(--placeholder)');
    expect(text).toContain('background-color: transparent');
    expect(text).toContain('border-bottom-color: transparent');
  });

  it('inlines the paragraph typography preset with a normal line height', () => {
    const text = ruleTextOf(`.${styles.option}`);

    expect(text).toContain('font-size: var(--font-size-1)');
    expect(text).toContain('letter-spacing: var(--letter-spacing-1)');
    expect(text).toContain('font-weight: var(--font-weight-regular)');
    expect(text).toContain('line-height: normal');
  });

  it('keeps the label non interactive', () => {
    const text = ruleTextOf(`.${styles.option}`);

    expect(text).toContain('cursor: default');
    expect(text).toContain('user-select: none');
  });

  it('underlines the cell with the focus colour under `.focus`', () => {
    const text = ruleTextOf(`.${styles.option}.focus`);

    expect(text).toContain('border-bottom-color: var(--focus)');
    expect(text).toContain('border-bottom-width: 1.5px');
  });

  it('switches to the active colour under `.checked`', () => {
    expect(ruleTextOf(`.${styles.option}.checked`)).toContain(
      'color: var(--active)'
    );
  });
});
