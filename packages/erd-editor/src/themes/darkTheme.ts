import Color from 'color';

import { toTextColor } from '@/themes/textColor';
import { Theme } from '@/themes/tokens';

export const createDarkTheme = (): Theme => {
  const primaryColor = new Color('#282c34');
  const primaryHsl = primaryColor.hsl().object();
  const secondaryColor = new Color({ ...primaryHsl, l: primaryHsl.l - 3 });

  return {
    primary: primaryColor.hex(),
    secondary: secondaryColor.hex(),
    primaryForeground: toTextColor(primaryColor),
    secondaryForeground: toTextColor(secondaryColor),
    focus: '#528bff',
    edit: '#ffc107',
    select: '#2c313a',
    hover: '#2c313a',
    keyPK: '#b4b400',
    keyFK: '#dda8b1',
    keyPFK: '#60b9c4',
  };
};
