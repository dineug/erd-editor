import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/Erd.styles';

describe('Erd.styles', () => {
  it('exports the root css template literal', () => {
    expect(styles.root).toBeTruthy();
    expect(styles.root.values).toEqual([]);
    expect(styles.root.strings.raw.length).toBe(1);
  });

  it('fills the host and clips overflow so the canvas can be scrolled by transform', () => {
    const css = styles.root.strings.raw.join('');

    expect(css).toContain('display: flex');
    expect(css).toContain('width: 100%');
    expect(css).toContain('height: 100%');
    expect(css).toContain('overflow: hidden');
  });

  it('is a positioning context for the absolutely positioned overlays', () => {
    expect(styles.root.strings.raw.join('')).toContain('position: relative');
  });

  it('resolves to a stable non-empty class identifier', () => {
    const identifier = String(styles.root);

    expect(typeof identifier).toBe('string');
    expect(identifier.length).toBeGreaterThan(0);
    expect(String(styles.root)).toBe(identifier);
  });
});
