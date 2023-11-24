import { FC, html } from '@dineug/r-html';

import { createColorPickerStyle } from '@/styles/colorPicker.style';
import { createFontsStyle } from '@/styles/fonts.styles';
import { createResetStyle } from '@/styles/reset.styles';
import { createScrollbarStyle } from '@/styles/scrollbar.styles';
import { createTypographyStyle } from '@/styles/typography.styles';

export type GlobalStylesProps = {};

const GlobalStyles: FC<GlobalStylesProps> = () => {
  const resetStyle = createResetStyle();
  const fontsStyle = createFontsStyle();
  const typographyStyle = createTypographyStyle();
  const scrollbarStyle = createScrollbarStyle();
  const colorPickerStyle = createColorPickerStyle();
  return () =>
    html`${resetStyle}${fontsStyle}${typographyStyle}${scrollbarStyle}${colorPickerStyle}`;
};

export default GlobalStyles;
