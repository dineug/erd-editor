import { addCSSHost } from '@dineug/r-html';
import { beforeAll, describe, expect, it } from 'vitest';

import * as styles from '@/components/erd/canvas/table/column/column-key/ColumnKey.styles';

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

describe('ColumnKey.styles', () => {
  it('exports a single `key` css template literal', () => {
    expect(Object.keys(styles)).toEqual(['key']);
    expect(Array.isArray(styles.key.strings)).toBe(true);
    expect(styles.key.values).toEqual([]);
    expect(styles.key.template.node).toBeTruthy();
  });

  it('renders to a stable generated class name', () => {
    const identifier = String(styles.key);

    expect(identifier.startsWith('_')).toBe(true);
    expect(String(styles.key)).toBe(identifier);
  });

  it('hides the key glyph by default', () => {
    expect(ruleTextOf(`.${styles.key}`)).toContain('fill: transparent');
  });

  it('fills each key variant from its own theme custom property', () => {
    expect(ruleTextOf(`.${styles.key}.pk`)).toContain('fill: var(--key-pk)');
    expect(ruleTextOf(`.${styles.key}.fk`)).toContain('fill: var(--key-fk)');
    expect(ruleTextOf(`.${styles.key}.pfk`)).toContain('fill: var(--key-pfk)');
  });

  it('emits exactly the base rule plus the three key variants', () => {
    const rules = adoptedRules.filter(text =>
      text.startsWith(`.${styles.key}`)
    );

    expect(rules).toHaveLength(4);
  });
});
