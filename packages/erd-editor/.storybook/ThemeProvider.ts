import { html, defineCustomElement, FC } from '@dineug/r-html';

import GlobalStyles from '../src/components/global-styles/GlobalStyles';
import Theme from '../src/components/theme/Theme';
import { ThemeMode } from '../src/themes/radix-ui-colors.theme';
import { PresetTheme, getPresetTheme } from '../src/themes/presetTheme';

declare global {
  interface HTMLElementTagNameMap {
    'theme-provider': ThemeProviderElement;
  }
}

type ThemeProviderProps = {
  theme: PresetTheme;
  mode: ThemeMode;
  story: any;
};

interface ThemeProviderElement extends ThemeProviderProps, HTMLElement {}

const ThemeProvider: FC<ThemeProviderProps, ThemeProviderElement> = props => {
  return () => html`
    <${GlobalStyles} />
    <${Theme} .theme=${getPresetTheme(props.theme)(props.mode)} />
    ${props.story}
  `;
};

defineCustomElement('theme-provider', {
  observedProps: {
    theme: { default: PresetTheme.default },
    mode: { default: PresetTheme.default },
    story: {},
  },
  render: ThemeProvider,
});
