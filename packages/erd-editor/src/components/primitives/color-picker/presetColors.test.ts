import { describe, expect, it } from 'vite-plus/test';

import { PRESET_COLORS } from '@/components/primitives/color-picker/presetColors';

describe('PRESET_COLORS', () => {
  it('holds the sixteen Radix step 9 colors in their light values, in order', () => {
    expect(PRESET_COLORS).toEqual([
      { label: 'Red', color: '#e5484d' },
      { label: 'Orange', color: '#f76b15' },
      { label: 'Amber', color: '#ffc53d' },
      { label: 'Yellow', color: '#ffe629' },
      { label: 'Lime', color: '#bdee63' },
      { label: 'Green', color: '#30a46c' },
      { label: 'Teal', color: '#12a594' },
      { label: 'Cyan', color: '#00a2c7' },
      { label: 'Blue', color: '#0090ff' },
      { label: 'Indigo', color: '#3e63dd' },
      { label: 'Violet', color: '#6e56cf' },
      { label: 'Purple', color: '#8e4ec6' },
      { label: 'Pink', color: '#d6409f' },
      { label: 'Crimson', color: '#e93d82' },
      { label: 'Brown', color: '#ad7f58' },
      { label: 'Gray', color: '#8d8d8d' },
    ]);
  });

  it('writes each as the opaque lower-case #rrggbb the picker hands on', () => {
    for (const { color } of PRESET_COLORS) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
