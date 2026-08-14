import { describe, expect, it } from 'vitest';

import * as styles from '@/components/erd/automatic-table-placement/AutomaticTablePlacement.styles';

describe('AutomaticTablePlacement.styles', () => {
  it('exports static css template literals with no interpolated values', () => {
    expect(styles.root).toBeTruthy();
    expect(styles.container).toBeTruthy();
    expect(styles.root.values).toEqual([]);
    expect(styles.container.values).toEqual([]);
    expect(styles.root.strings.raw.length).toBe(1);
    expect(styles.container.strings.raw.length).toBe(1);
  });

  it('overlays the whole erd surface from the top left corner', () => {
    const css = styles.root.strings.raw.join('');

    expect(css).toContain('position: absolute');
    expect(css).toContain('top: 0');
    expect(css).toContain('left: 0');
    expect(css).toContain('width: 100%');
    expect(css).toContain('height: 100%');
    expect(css).toContain('overflow: hidden');
    expect(css).toContain('display: flex');
  });

  it('paints the overlay with the canvas boundary theme token', () => {
    expect(styles.root.strings.raw.join('')).toContain(
      'background-color: var(--canvas-boundary-background)'
    );
  });

  it('makes the container a non-interactive positioning context', () => {
    const css = styles.container.strings.raw.join('');

    expect(css).toContain('position: relative');
    expect(css).toContain('pointer-events: none');
    expect(css).toContain('overflow: hidden');
    expect(css).toContain('width: 100%');
    expect(css).toContain('height: 100%');
  });

  it('does not let the container claim the boundary background', () => {
    expect(styles.container.strings.raw.join('')).not.toContain(
      'background-color'
    );
  });

  it('resolves each export to a distinct stable class identifier', () => {
    const root = String(styles.root);
    const container = String(styles.container);

    expect(root.length).toBeGreaterThan(0);
    expect(container.length).toBeGreaterThan(0);
    expect(root).not.toBe(container);
    expect(String(styles.root)).toBe(root);
    expect(String(styles.container)).toBe(container);
  });
});
