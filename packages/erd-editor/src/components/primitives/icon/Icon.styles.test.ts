import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/primitives/icon/Icon.styles';

describe('Icon.styles', () => {
  it('exposes `wrap` as a css template compiled to a class identifier', () => {
    expect(styles.wrap).toBeTruthy();
    expect(String(styles.wrap)).toMatch(/\S/);
  });

  it('lays the wrapper out as a vertically centered, full height inline flex box', () => {
    const source = styles.wrap.strings.join('');

    expect(source).toContain('display: inline-flex');
    expect(source).toContain('height: 100%');
    expect(source).toContain('align-items: center');
  });

  it('exposes `icon` as a separate class that transitions fill', () => {
    expect(String(styles.icon)).toMatch(/\S/);
    expect(String(styles.icon)).not.toBe(String(styles.wrap));
    expect(styles.icon.strings.join('')).toContain('transition: fill 0.15s');
  });
});
