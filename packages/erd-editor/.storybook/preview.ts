import './preview.css';
import './ThemeProvider';

import type { Preview } from '@storybook/html';
import { render, html } from '@dineug/r-html';
import { ThemeMode } from '../src/themes/radix-ui-colors.theme';
import { PresetTheme, getPresetTheme } from '../src/themes/presetTheme';
import { themeToTokensString } from '../src/themes/tokens';

const withThemeProvider = (Story, context) => {
  const fragment = document.createDocumentFragment();

  render(
    fragment,
    html`
      <style>
        :root {
          ${themeToTokensString(
          getPresetTheme(context.globals.theme)(context.globals.themeMode)
        )};
        }
      </style>
      <theme-provider
        .story=${Story()}
        .theme=${context.globals.theme}
        .mode=${context.globals.themeMode}
      />
    `
  );

  return fragment;
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Global PresetTheme for components',
      defaultValue: PresetTheme.default,
      toolbar: {
        title: 'Theme',
        items: Object.values(PresetTheme),
      },
    },
    themeMode: {
      description: 'Global ThemeMode for components',
      defaultValue: ThemeMode.dark,
      toolbar: {
        title: 'Mode',
        items: [
          {
            value: ThemeMode.dark,
            title: 'Dark',
            icon: 'circle',
          },
          {
            value: ThemeMode.light,
            title: 'Light',
            icon: 'circlehollow',
          },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
  decorators: [withThemeProvider],
};

export default preview;
