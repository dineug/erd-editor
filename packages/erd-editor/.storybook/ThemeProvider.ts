import { html, FC } from '@dineug/r-html';

import GlobalStyles from '../src/components/global-styles/GlobalStyles';
import Theme from '../src/components/theme/Theme';
import { ThemeMode } from '../src/themes/radix-ui-colors.theme';
import { PresetTheme, getPresetTheme } from '../src/themes/presetTheme';

type ThemeProviderProps = {
  theme: PresetTheme;
  mode: ThemeMode;
  story: any;
};

const ThemeProvider: FC<ThemeProviderProps> = props => {
  return () => html`
    <${GlobalStyles} />
    <${Theme} .theme=${getPresetTheme(props.theme)(props.mode)} />
    ${props.story}
  `;
};

export default ThemeProvider;
