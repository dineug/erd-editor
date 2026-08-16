import type { StorybookConfig } from '@storybook/html-vite';
import type { PluginOption } from 'vite';

/**
 * `vite-plugin-dts` calls itself `unplugin-dts`. It is `apply: 'build'`, so it
 * would otherwise run here too — Storybook loads the package's `vite.config.ts`
 * at `command=build`, and a Storybook bundle has no use for declarations.
 * Dropping it here rather than branching on `mode` in `vite.config.ts` keeps the
 * exception where the exception is.
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
