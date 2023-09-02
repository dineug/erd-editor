import { FC, html } from '@dineug/r-html';

import { Theme, themeToTokensString } from '@/themes/tokens';

export type ThemeProps = {
  theme: Theme;
};

const Theme: FC<ThemeProps> = props => {
  return () => html`
    <style>
      :host {
        ${themeToTokensString(props.theme)}
      }
    </style>
  `;
};

export default Theme;
