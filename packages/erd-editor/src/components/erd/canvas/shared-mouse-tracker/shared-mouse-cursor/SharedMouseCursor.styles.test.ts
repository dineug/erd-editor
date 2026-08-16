import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/canvas/shared-mouse-tracker/shared-mouse-cursor/SharedMouseCursor.styles';

describe('SharedMouseCursor.styles', () => {
  it('compiles `cursor` to a non empty class identifier', () => {
    expect(styles.cursor).toBeTruthy();
    expect(String(styles.cursor)).toMatch(/\S/);
  });

  it('floats the cursor above everything without capturing pointer events', () => {
    const source = styles.cursor.strings.join('');

    expect(source).toContain('position: absolute');
    expect(source).toContain('pointer-events: none');
    expect(source).toContain('z-index: 2147483647');
    expect(source).toContain('display: flex');
  });

  it('clamps the nickname width and ellipsizes the overflow', () => {
    const source = styles.cursor.strings.join('');

    expect(source).toContain('max-width: 100px');
    expect(source).toContain('overflow: hidden');
    expect(source).toContain('& > span');
    expect(source).toContain('text-overflow: ellipsis');
    expect(source).toContain('white-space: nowrap');
  });

  it('is a static template with no interpolated values', () => {
    expect(styles.cursor.values).toEqual([]);
  });
});
