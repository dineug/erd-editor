import { describe, expect, it } from 'vitest';

import * as styles from '@/components/erd/hide-sign/HideSign.styles';

describe('HideSign.styles', () => {
  it('exposes `sign` as a css template compiled to a stable class identifier', () => {
    expect(styles.sign).toBeTruthy();
    expect(String(styles.sign)).toMatch(/\S/);
    expect(String(styles.sign)).toBe(String(styles.sign));
    expect(styles.sign.values).toEqual([]);
  });

  it('takes the sign out of flow so the component can pin it with inline offsets', () => {
    const source = styles.sign.strings.join('');

    expect(source).toContain('position: absolute');
    expect(source).toContain('cursor: pointer');
  });

  it('highlights the icon with the active theme color on hover', () => {
    const source = styles.sign.strings.join('');

    expect(source).toContain('&:hover');
    expect(source).toContain('fill: var(--active)');
  });

  it('exports nothing but the sign class', () => {
    expect(Object.keys(styles)).toEqual(['sign']);
  });
});
