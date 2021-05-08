module.exports = {
  plugins: ['@snowpack/plugin-typescript', '@snowpack/plugin-dotenv'],
  mount: {
    public: '/',
    src: '/_dist_',
  },
  alias: {
    '@': './src',
    '@@types': './types',
  },
  packageOptions: {
    knownEntrypoints: [
      'highlight.js',
      'highlight.js/lib/languages/typescript.js',
    ],
  },
  exclude: ['**/node_modules/**/*', '**/src/stories/**'],
};
