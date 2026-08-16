import { describe, expect, it } from 'vite-plus/test';

import * as canvasColumnStyles from '@/components/erd/canvas/table/column/Column.styles';
import * as styles from '@/components/visualization/table/column/Column.styles';

/**
 * This module is a leftover stub: it only imports `css` and declares nothing.
 * The visualization Column renders with the erd canvas column styles instead,
 * so the assertions below pin the current (empty) public surface.
 */
describe('visualization Column.styles', () => {
  it('exports nothing at all', () => {
    expect(Object.keys(styles)).toEqual([]);
  });

  it('is a distinct module from the canvas column styles the component uses', () => {
    expect(styles).not.toBe(canvasColumnStyles);
    expect(Object.keys(canvasColumnStyles).length).toBeGreaterThan(0);
    expect((styles as Record<string, unknown>).root).toBeUndefined();
  });
});
