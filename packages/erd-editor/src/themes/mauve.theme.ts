import { mauve, mauveA, mauveDark, mauveDarkA } from '@radix-ui/colors';

import { createTheme } from '@/themes/radix-ui-colors.theme';

export const createMauveDarkTheme = createTheme('mauve', mauveDark, mauveDarkA);
export const createMauveLightTheme = createTheme('mauve', mauve, mauveA);
