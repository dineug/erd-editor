import { upperFirst } from 'es-toolkit';
import { get } from 'es-toolkit/compat';

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

/** Sixteen Radix step 9 colors, two rows of eight, in their light values, which a document keeps whatever the theme. */
export const PRESET_COLORS: ReadonlyArray<ColorSwatch> = PRESET_HUES.map(
  hue => ({
    color: get(Palette, [hue, `${hue}9`]) as string,
    label: upperFirst(hue),
  })
);
