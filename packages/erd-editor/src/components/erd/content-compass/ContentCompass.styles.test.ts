import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/content-compass/ContentCompass.styles';

describe('ContentCompass.styles', () => {
  it('compiles every export to a non empty class identifier', () => {
    expect(String(styles.compass)).toMatch(/\S/);
    expect(String(styles.distance)).toMatch(/\S/);
    expect(String(styles.compass)).not.toBe(String(styles.distance));
  });

  it('stands over the middle of the bottom edge, clear of the scrollbar track', () => {
    const source = styles.compass.strings.join('');

    expect(source).toContain('position: absolute');
    expect(source).toContain('left: 50%');
    expect(source).toContain('transform: translateX(-50%)');
    expect(source).toMatch(/bottom: (\d+)px/);
    expect(Number(/bottom: (\d+)px/.exec(source)?.[1])).toBeGreaterThan(8);
  });

  it('reads as a pressable pill, painted with the tokens a toast is', () => {
    const source = styles.compass.strings.join('');

    expect(source).toContain('background-color: var(--toast-background)');
    expect(source).toContain('border: 1px solid var(--toast-border)');
    expect(source).toContain('color: var(--foreground)');
    expect(source).toContain('cursor: pointer');
    expect(source).toContain('user-select: none');
    expect(source).toContain('color: var(--active)');
  });

  it('interpolates nothing at runtime into the pill itself', () => {
    expect(styles.compass.values).toEqual([]);
  });
});
