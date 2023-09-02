import { html, observable } from '@dineug/r-html';

import { createFontsStyle } from '@/styles/fonts.styles';
import { createResetStyle } from '@/styles/reset.styles';
import { createTypographyStyle } from '@/styles/typography.styles';
import { createDefaultTheme } from '@/themes/default.theme';
import { Theme, themeToTokensString } from '@/themes/tokens';

export function useGlobalStyles(theme?: Theme) {
  const resetStyle = createResetStyle();
  const fontsStyle = createFontsStyle();
  const typographyStyle = createTypographyStyle();
  const state = observable(
    { theme: theme ?? createDefaultTheme('dark') },
    { shallow: true }
  );

  const changeTheme = (theme: Theme) => {
    state.theme = theme;
  };

  const getTheme = () => html`
    <style>
      :host {
        ${themeToTokensString(state.theme)}
      }
    </style>
  `;

  return {
    globalStyles: html`${resetStyle}${fontsStyle}${typographyStyle}`,
    getTheme,
    changeTheme,
  };
}
