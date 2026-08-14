import { describe, expect, it } from 'vitest';

import * as styles from '@/components/primitives/sash/Sash.styles';

describe('Sash.styles', () => {
  it('exports the shared sash thickness', () => {
    expect(styles.SASH_SIZE).toBe(5);
  });

  it('exposes `sash` as a css template compiled to a class identifier', () => {
    expect(styles.sash).toBeTruthy();
    expect(String(styles.sash)).toMatch(/\S/);
  });

  it('absolutely positions the sash and defines the three type modifiers', () => {
    const source = styles.sash.strings.join('');

    expect(source).toContain('position: absolute');
    expect(source).toContain('&.vertical');
    expect(source).toContain('&.horizontal');
    expect(source).toContain('&.edge');
  });

  it('drives the modifier sizes from SASH_SIZE and picks an axis cursor', () => {
    expect(styles.sash.values).toEqual([
      styles.SASH_SIZE,
      styles.SASH_SIZE,
      styles.SASH_SIZE,
      styles.SASH_SIZE,
    ]);

    const source = styles.sash.strings.join('');
    expect(source).toContain('cursor: ew-resize');
    expect(source).toContain('cursor: ns-resize');
  });
});
