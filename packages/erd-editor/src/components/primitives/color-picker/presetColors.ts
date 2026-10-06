import { get } from 'es-toolkit/compat';

import type { PlainMessageKey } from '@/i18n/translate';
import { Palette } from '@/themes/radix-ui-theme';

const PRESET_HUES = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'purple',
  'pink',
  'crimson',
  'brown',
  'gray',
] as const;

export type ColorSwatch = { color: string; label: string };

/** A preset swatch, named by the key of its hue's name, which a screen reader hears in the reader's language. */
export type PresetSwatch = { color: string; labelKey: PlainMessageKey };

/** Sixteen Radix step 9 colors, two rows of eight, in their light values, which a document keeps whatever the theme. */
export const PRESET_COLORS: ReadonlyArray<PresetSwatch> = PRESET_HUES.map(
  hue => ({
    color: get(Palette, [hue, `${hue}9`]) as string,
    labelKey: `colorPicker.preset.${hue}` as const,
  })
);
