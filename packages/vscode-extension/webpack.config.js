const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = (env, argv) => {
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
                // Typecheck what is actually bundled, not everything under the
                // tsconfig `include`. Without this the unit specs join the
                // program and fail the build: they import the `vscode` stub from
                // outside `rootDir` (TS6059) and use `import.meta` under
                // `module: commonjs` (TS1343). They are typechecked by
                // `tsconfig.unit.json` instead — see `pnpm typecheck`.
                onlyCompileBundledFiles: true,
                compilerOptions: {
                  module: 'es6',
                },
              },
            },
          ],
        },
      ],
    },
  };

  return config;
};
