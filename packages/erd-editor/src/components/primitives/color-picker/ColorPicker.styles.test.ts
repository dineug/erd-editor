import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/primitives/color-picker/ColorPicker.styles';

describe('ColorPicker.styles', () => {
  it('exports the container css template literal', () => {
    expect(styles.container).toBeTruthy();
    expect(styles.container.values).toEqual([]);
  });

  it('absolutely positions the container so top/left inline styles apply', () => {
    expect(styles.container.strings.raw.join('')).toContain(
      'position: absolute'
    );
  });

  it('resolves to a non-empty class identifier', () => {
    const identifier = String(styles.container);

    expect(typeof identifier).toBe('string');
    expect(identifier.length).toBeGreaterThan(0);
  });
});
