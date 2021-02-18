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
};
