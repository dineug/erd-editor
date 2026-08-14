import { describe, expect, it } from 'vitest';

import * as styles from '@/components/erd/canvas/high-level-table/HighLevelTable.styles';

describe('HighLevelTable.styles', () => {
  it('compiles `name` to a non empty class identifier', () => {
    expect(styles.name).toBeTruthy();
    expect(String(styles.name)).toMatch(/\S/);
  });

  it('centers the name across the whole table box and allows scrolling', () => {
    const source = styles.name.strings.join('');

    expect(source).toContain('width: 100%');
    expect(source).toContain('height: 100%');
    expect(source).toContain('display: flex');
    expect(source).toContain('align-items: center');
    expect(source).toContain('justify-content: center');
    expect(source).toContain('overflow: auto');
    expect(source).toContain('word-break: break-all');
  });

  it('uses the active color and bold weight, dimming to the placeholder color when unnamed', () => {
    const source = styles.name.strings.join('');

    expect(source).toContain('color: var(--active)');
    expect(source).toContain('font-weight: var(--font-weight-bold)');
    expect(source).toContain('&.isEmptyName');
    expect(source).toContain('color: var(--placeholder)');
  });

  it('is a static template with no interpolated values', () => {
    expect(styles.name.values).toEqual([]);
  });
});
