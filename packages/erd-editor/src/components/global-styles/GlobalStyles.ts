import { FC, html } from '@dineug/r-html';

import { createFontsStyle } from '@/styles/fonts.styles';
import { createResetStyle } from '@/styles/reset.styles';
import { createTypographyStyle } from '@/styles/typography.styles';

export type GlobalStylesProps = {};

const GlobalStyles: FC<GlobalStylesProps> = () => {
  const resetStyle = createResetStyle();
  const fontsStyle = createFontsStyle();
  const typographyStyle = createTypographyStyle();
  return () => html`${resetStyle}${fontsStyle}${typographyStyle}`;
};

export default GlobalStyles;
