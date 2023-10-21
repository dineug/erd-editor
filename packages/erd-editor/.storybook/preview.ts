import './preview.css';

import type { Preview } from '@storybook/html';
import { render, html, addCSSHost } from '@dineug/r-html';

import {
  createTheme,
  Appearance,
  GrayColor,
  AccentColor,
} from '../src/themes/radix-ui-theme';

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
        .appearance=${context.globals.appearance}
        .grayColor=${context.globals.grayColor}
        .accentColor=${context.globals.accentColor}
      />
    `
  );

  render(
    fragment,
    html`
      <style>
        :root {
          ${themeToTokensString(
          createTheme({
            grayColor: context.globals.grayColor,
            accentColor: context.globals.accentColor,
          })(context.globals.appearance)
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
    grayColor: {
      description: 'Theme gray color',
      defaultValue: GrayColor.gray,
      toolbar: {
        title: 'GrayColor',
        items: Object.values(GrayColor),
      },
    },
    accentColor: {
      description: 'Theme accent color',
      defaultValue: AccentColor.gray,
      toolbar: {
        title: 'AccentColor',
        items: Object.values(AccentColor),
      },
    },
    appearance: {
      description: 'Theme appearance',
      defaultValue: Appearance.dark,
      toolbar: {
        title: 'Appearance',
        items: [
          {
            value: Appearance.dark,
            title: 'Dark',
            icon: 'circle',
          },
          {
            value: Appearance.light,
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
