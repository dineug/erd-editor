const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const pkg = JSON.parse(fs.readFileSync('package.json', { encoding: 'utf8' }));

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const isDevelopment = argv.mode !== 'production';
  const mode = isDevelopment ? 'development' : 'production';

  const config = {
    mode,
    target: 'node',
    entry: './src/extension.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'extension.js',
      chunkFilename: '[id].[contenthash:8].js',
      libraryTarget: 'commonjs2',
      devtoolModuleFilenameTemplate: '../[resource-path]',
      clean: true,
    },
    devtool: 'source-map',
    externals: {
      vscode: 'commonjs vscode',
    },
    resolve: {
      extensions: ['.ts', '.js'],
      plugins: [new TsconfigPathsPlugin()],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                compilerOptions: {
                  module: 'es6',
                },
              },
            },
          ],
        },
      ],
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.ERD_EDITOR_VSCODE_VERSION': JSON.stringify(pkg.version),
        'process.env.ERD_WEBPACK_MODE': JSON.stringify(mode),
      }),
    ].filter(Boolean),
  };

  return config;
};
