import { html, FC } from '@dineug/r-html';

import GlobalStyles from '../src/components/global-styles/GlobalStyles';
import Theme from '../src/components/theme/Theme';
import {
  createTheme,
  Appearance,
  GrayColor,
  AccentColor,
} from '../src/themes/radix-ui-theme';

type ThemeProviderProps = {
  appearance: Appearance;
  grayColor: GrayColor;
  accentColor: AccentColor;
  story: any;
};

const ThemeProvider: FC<ThemeProviderProps> = props => {
  return () => html`
    <${GlobalStyles} />
    <${Theme}
      .theme=${createTheme({
        grayColor: props.grayColor,
        accentColor: props.accentColor,
      })(props.appearance)}
    />
    ${props.story}
  `;
};

export default ThemeProvider;
