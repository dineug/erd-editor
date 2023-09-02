import { olive, oliveA, oliveDark, oliveDarkA } from '@radix-ui/colors';

import { createTheme, createThemeMode } from '@/themes/radix-ui-colors.theme';

export const createOliveTheme = createThemeMode(
  createTheme('olive', oliveDark, oliveDarkA),
  createTheme('olive', olive, oliveA)
);
