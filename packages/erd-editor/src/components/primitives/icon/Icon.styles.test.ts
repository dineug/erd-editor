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

  it('exposes `icon` as a separate class that transitions color, not stroke', () => {
    expect(String(styles.icon)).toMatch(/\S/);
    expect(String(styles.icon)).not.toBe(String(styles.wrap));

    const source = styles.icon.strings.join('');

    // The glyph is painted `stroke="currentColor"`, whose specified value never
    // changes, so a `stroke` transition has nothing to interpolate and never
    // fires. `color` is the property that actually changes.
    expect(source).toContain('transition: color 0.15s');
    expect(source).not.toContain('transition: stroke');
    expect(source).not.toContain('transition: fill');
  });
});
