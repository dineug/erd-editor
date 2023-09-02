import { gray, grayA, grayDark, grayDarkA } from '@radix-ui/colors';

import { createTheme, createThemeMode } from '@/themes/radix-ui-colors.theme';

export const createDefaultTheme = createThemeMode(
  createTheme('gray', grayDark, grayDarkA),
  createTheme('gray', gray, grayA)
);
