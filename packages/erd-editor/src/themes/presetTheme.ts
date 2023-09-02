import { ValuesType } from '@/internal-types';
import { createDefaultTheme } from '@/themes/default.theme';
import { createMauveTheme } from '@/themes/mauve.theme';
import { createOliveTheme } from '@/themes/olive.theme';

export const PresetTheme = {
  default: 'default',
  mauve: 'mauve',
  olive: 'olive',
} as const;
export type PresetTheme = ValuesType<typeof PresetTheme>;

export const getPresetTheme = (presetTheme: PresetTheme) => {
  switch (presetTheme) {
    case PresetTheme.default:
      return createDefaultTheme;
    case PresetTheme.mauve:
      return createMauveTheme;
    case PresetTheme.olive:
      return createOliveTheme;
    default:
      return createDefaultTheme;
  }
};
