import type { StorybookConfig } from '@storybook/html-vite';
import type { PluginOption } from 'vite';

/**
 * vite-plugin-dts calls itself unplugin-dts and is apply: build, so Storybook
 * loading the package config at command=build would run it for a bundle with no
 * use for declarations. Dropped here, where the exception belongs.
 */
const withoutDts = (plugins: PluginOption[]): PluginOption[] =>
  plugins
    .map(plugin => (Array.isArray(plugin) ? withoutDts(plugin) : plugin))
    .filter(
      plugin =>
        !(
          plugin &&
          typeof plugin === 'object' &&
          'name' in plugin &&
          plugin.name === 'unplugin-dts'
        )
    );

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-links', '@storybook/addon-docs'],
  framework: {
    name: '@storybook/html-vite',
    options: {},
  },
  viteFinal: config => ({
    ...config,
    plugins: withoutDts(config.plugins ?? []),
  }),
};
export default config;
