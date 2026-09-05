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
    // The library's worker build leaves dependencies external for a consumer's
    // bundler to resolve. This is a page, with no bundler after it, so its
    // workers have to carry them; the page half Storybook already overrides.
    worker: {
      ...config.worker,
      rolldownOptions: { ...config.worker?.rolldownOptions, external: [] },
    },
  }),
};
export default config;
