import { mauve, mauveA, mauveDark, mauveDarkA } from '@radix-ui/colors';

import { createTheme, createThemeMode } from '@/themes/radix-ui-colors.theme';

export const createMauveTheme = createThemeMode(
  createTheme('mauve', mauveDark, mauveDarkA),
  createTheme('mauve', mauve, mauveA)
);
