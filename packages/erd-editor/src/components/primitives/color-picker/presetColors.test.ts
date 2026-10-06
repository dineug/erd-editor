import { describe, expect, it } from 'vite-plus/test';

import { PRESET_COLORS } from '@/components/primitives/color-picker/presetColors';
import { sourceI18n } from '@/i18n/source';

describe('PRESET_COLORS', () => {
  it('holds the sixteen Radix step 9 colors in their light values, in order', () => {
    expect(PRESET_COLORS).toEqual([
      { labelKey: 'colorPicker.preset.red', color: '#e5484d' },
      { labelKey: 'colorPicker.preset.orange', color: '#f76b15' },
      { labelKey: 'colorPicker.preset.amber', color: '#ffc53d' },
      { labelKey: 'colorPicker.preset.yellow', color: '#ffe629' },
      { labelKey: 'colorPicker.preset.lime', color: '#bdee63' },
      { labelKey: 'colorPicker.preset.green', color: '#30a46c' },
      { labelKey: 'colorPicker.preset.teal', color: '#12a594' },
      { labelKey: 'colorPicker.preset.cyan', color: '#00a2c7' },
      { labelKey: 'colorPicker.preset.blue', color: '#0090ff' },
      { labelKey: 'colorPicker.preset.indigo', color: '#3e63dd' },
      { labelKey: 'colorPicker.preset.violet', color: '#6e56cf' },
      { labelKey: 'colorPicker.preset.purple', color: '#8e4ec6' },
      { labelKey: 'colorPicker.preset.pink', color: '#d6409f' },
      { labelKey: 'colorPicker.preset.crimson', color: '#e93d82' },
      { labelKey: 'colorPicker.preset.brown', color: '#ad7f58' },
      { labelKey: 'colorPicker.preset.gray', color: '#8d8d8d' },
    ]);
  });

  it('names each by its hue in English where nothing provides a language', () => {
    expect(PRESET_COLORS.map(({ labelKey }) => sourceI18n.t(labelKey))).toEqual(
      [
        'Red',
        'Orange',
        'Amber',
        'Yellow',
        'Lime',
        'Green',
        'Teal',
        'Cyan',
        'Blue',
        'Indigo',
        'Violet',
        'Purple',
        'Pink',
        'Crimson',
        'Brown',
        'Gray',
      ]
    );
  });

  it('writes each as the opaque lower-case #rrggbb the picker hands on', () => {
    for (const { color } of PRESET_COLORS) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
