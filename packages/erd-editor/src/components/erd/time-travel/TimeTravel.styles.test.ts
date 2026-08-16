import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/erd/time-travel/TimeTravel.styles';

describe('TimeTravel.styles', () => {
  it('compiles every export to a distinct non empty class identifier', () => {
    const identifiers = [
      String(styles.root),
      String(styles.container),
      String(styles.slider),
      String(styles.vertical),
    ];

    for (const identifier of identifiers) {
      expect(identifier).toMatch(/\S/);
    }
    expect(new Set(identifiers).size).toBe(4);
  });

  it('is stable: stringifying the same template twice yields one class', () => {
    expect(String(styles.root)).toBe(String(styles.root));
  });

  it('overlays the whole editor surface with the canvas boundary colour', () => {
    const source = styles.root.strings.join('');

    expect(source).toContain('position: absolute');
    expect(source).toContain('top: 0');
    expect(source).toContain('left: 0');
    expect(source).toContain('width: 100%');
    expect(source).toContain('height: 100%');
    expect(source).toContain('overflow: hidden');
    expect(source).toContain(
      'background-color: var(--canvas-boundary-background)'
    );
  });

  it('makes the preview container a click through positioning context', () => {
    const source = styles.container.strings.join('');

    expect(source).toContain('position: relative');
    expect(source).toContain('pointer-events: none');
    expect(source).toContain('overflow: hidden');
  });

  it('pins the slider bar to the bottom edge at a fixed height', () => {
    const source = styles.slider.strings.join('');

    expect(source).toContain('position: absolute');
    expect(source).toContain('bottom: 0');
    expect(source).toContain('left: 0');
    expect(source).toContain('height: 30px');
    expect(source).toContain('padding: 0 15px');
    expect(source).toContain('align-items: center');
    expect(source).toContain(
      'background-color: var(--canvas-boundary-background)'
    );
  });

  it('separates the cancel button from apply through a last-child rule', () => {
    const source = styles.slider.strings.join('');

    expect(source).toContain('& > button:last-child');
    expect(source).toContain('margin-left: 8px');
  });

  it('renders the vertical rule as a fixed width spacer', () => {
    const source = styles.vertical.strings.join('');

    expect(source).toContain('width: 24px');
    expect(source).toContain('height: 100%');
  });

  it('interpolates no runtime values into any of the styles', () => {
    expect(styles.root.values).toEqual([]);
    expect(styles.container.values).toEqual([]);
    expect(styles.slider.values).toEqual([]);
    expect(styles.vertical.values).toEqual([]);
  });
});
