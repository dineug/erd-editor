import { addCSSHost } from '@dineug/r-html';
import { beforeAll, describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/canvas/table/column/column-data-type/ColumnDataType.styles';
import { INPUT_HEIGHT } from '@/constants/layout';

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

describe('ColumnDataType.styles', () => {
  it('exports root, hint and hintItem css template literals', () => {
    expect(Object.keys(styles)).toEqual(['root', 'hint', 'hintItem']);

    for (const style of [styles.root, styles.hint, styles.hintItem]) {
      expect(Array.isArray(style.strings)).toBe(true);
      expect(style.template.node).toBeTruthy();
    }
  });

  it('renders each export to its own stable generated class name', () => {
    const identifiers = [styles.root, styles.hint, styles.hintItem].map(String);

    for (const identifier of identifiers) {
      expect(identifier.startsWith('_')).toBe(true);
    }
    expect(new Set(identifiers).size).toBe(3);
    expect(String(styles.hint)).toBe(identifiers[1]);
  });

  it('makes the root a focusable positioning context without an outline', () => {
    const text = ruleTextOf(`.${styles.root}`);

    expect(text).toContain('position: relative');
    expect(text).toContain('outline');
    expect(text).not.toContain('outline-color: var(');
  });

  it('drops the hint popup right below the input, above its siblings', () => {
    const text = ruleTextOf(`.${styles.hint}`);

    expect(text).toContain('position: absolute');
    expect(text).toContain('z-index: 1');
    expect(text).toContain(`top: ${INPUT_HEIGHT}px`);
    expect(text).toContain('left: 0px');
    expect(text).toContain('white-space: nowrap');
  });

  it('interpolates INPUT_HEIGHT into the hint template values', () => {
    expect(styles.hint.values[0]).toBe(INPUT_HEIGHT);
  });

  it('paints the hint popup with the table surface tokens', () => {
    const text = ruleTextOf(`.${styles.hint}`);

    expect(text).toContain('color: var(--foreground)');
    expect(text).toContain('background-color: var(--table-background)');
    expect(text).toContain('var(--table-border)');
    expect(text).toContain('font-size: var(--font-size-1)');
    expect(text).toContain('line-height: var(--line-height-1)');
  });

  it('lays each hint row out as a clickable 20px flex row', () => {
    const text = ruleTextOf(`.${styles.hintItem}`);

    expect(text).toContain('display: flex');
    expect(text).toContain('align-items: center');
    expect(text).toContain('padding: 0px 4px');
    expect(text).toContain('height: 20px');
    expect(text).toContain('cursor: pointer');
  });

  it('highlights hint rows on hover and on keyboard selection', () => {
    expect(ruleTextOf(`.${styles.hintItem}:hover`)).toContain(
      'background-color: var(--column-hover)'
    );
    expect(ruleTextOf(`.${styles.hintItem}.selected`)).toContain(
      'background-color: var(--column-select)'
    );
  });

  it('reveals the Tab kbd badge only on the selected row', () => {
    // The compiler emits child combinators unspaced (._x>.kbd), which is what
    // adoptedStyleSheets echoes back.
    expect(ruleTextOf(`.${styles.hintItem}>.kbd`)).toContain(
      'visibility: hidden'
    );
    expect(ruleTextOf(`.${styles.hintItem}.selected .kbd`)).toContain(
      'visibility: visible'
    );
  });

  it('pushes the kbd badge to the end of the row', () => {
    const text = ruleTextOf(`.${styles.hintItem}>.kbd`);

    expect(text).toContain('margin-left: auto');
    expect(text).toContain('padding-left: 6px');
  });
});
