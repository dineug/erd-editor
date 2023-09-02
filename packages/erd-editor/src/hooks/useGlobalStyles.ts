import { html, observable } from '@dineug/r-html';

import { createFontsStyle } from '@/components/styles/fonts.styles';
import { createResetStyle } from '@/components/styles/reset.styles';
import { createDefaultTheme } from '@/themes/default.theme';
import { Theme, themeToTokensString } from '@/themes/tokens';

export function useGlobalStyles(theme?: Theme) {
  const fontsStyle = createFontsStyle();
  const resetStyle = createResetStyle();
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
    globalStyles: html`${resetStyle}${fontsStyle}`,
    getTheme,
    changeTheme,
  };
}
