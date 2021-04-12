const path = require('path');

module.exports = {
  stories: ['../src/**/*.stories.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-links', '@storybook/addon-essentials'],
  webpackFinal: async config => {
    config.resolve.alias['@'] = path.resolve(__dirname, '../src');
    config.resolve.alias['@@types'] = path.resolve(__dirname, '../types');
    config.resolve.alias['@dist'] = path.resolve(__dirname, '../dist');
    return config;
  },
};
