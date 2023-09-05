import './preview.css';

import type { Preview } from '@storybook/html';
import { render, html, addCSSHost } from '@dineug/r-html';

import { ThemeMode } from '../src/themes/radix-ui-colors.theme';
import { PresetTheme, getPresetTheme } from '../src/themes/presetTheme';
import { themeToTokensString } from '../src/themes/tokens';
import ThemeProvider from './ThemeProvider';

const withThemeProvider = (Story, context) => {
  const fragment = document.createDocumentFragment();
  const div = document.createElement('div');
  const shadowRoot = div.attachShadow({ mode: 'open' });

  addCSSHost(shadowRoot);

  render(
    shadowRoot,
    html`
      <${ThemeProvider}
        .story=${Story()}
        .theme=${context.globals.theme}
        .mode=${context.globals.themeMode}
      />
    `
  );

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
      ${div}
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
