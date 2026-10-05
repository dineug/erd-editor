import { describe, expect, it } from 'vite-plus/test';

import * as styles from '@/components/primitives/color-picker/ColorPicker.styles';

describe('ColorPicker.styles', () => {
  const clear = styles.clear.strings.raw.join('');

  it('exports the container css template literal', () => {
    expect(styles.container).toBeTruthy();
    expect(styles.container.values).toEqual([]);
  });

  it('absolutely positions the container so top/left inline styles apply', () => {
    expect(styles.container.strings.raw.join('')).toContain(
      'position: absolute'
    );
  });

  it('stretches the No color button to the picker width under it', () => {
    expect(styles.picker.strings.raw.join('')).toContain('display: flex');
    expect(clear).toContain('display: block');
    expect(clear).toContain('width: 100%');
  });

  it('draws the No color button on the menu surface, lit on hover', () => {
    expect(clear).toContain('background-color: var(--context-menu-background)');
    expect(clear).toContain('border: 1px solid var(--context-menu-border)');
    expect(clear).toContain('background-color: var(--context-menu-hover)');
  });

  it('rings the No color button while it holds the keyboard, as the reset takes every outline', () => {
    expect(clear).toMatch(
      /&:focus-visible\s*\{\s*outline: 2px solid var\(--input-active\);\s*outline-offset: 1px;\s*\}/
    );
  });

  it('resolves to a non-empty class identifier', () => {
    const identifier = String(styles.container);

    expect(typeof identifier).toBe('string');
    expect(identifier.length).toBeGreaterThan(0);
  });
});
