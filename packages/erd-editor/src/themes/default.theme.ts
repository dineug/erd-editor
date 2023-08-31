import { gray, grayA, grayDark, grayDarkA } from '@radix-ui/colors';

import { createTheme } from '@/themes/radix-ui-colors.theme';

export const createDefaultDarkTheme = createTheme('gray', grayDark, grayDarkA);
export const createDefaultLightTheme = createTheme('gray', gray, grayA);
