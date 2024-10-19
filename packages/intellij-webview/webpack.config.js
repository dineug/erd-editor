const path = require('path');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const resolvePath = value => path.resolve(__dirname, value);

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const isDevelopment = argv.mode !== 'production';
  const mode = isDevelopment ? 'development' : 'production';
  const isAnalyzer = env.target === 'analyzer';
  const isWebview = env.target === 'webview';

  const config = {
    mode,
    devtool: isDevelopment ? 'eval-source-map' : undefined,
    devServer: {
      static: {
        directory: resolvePath('public'),
      },
      compress: true,
      historyApiFallback: true,
      open: true,
      hot: true,
      client: {
        overlay: false,
      },
    },
    entry: './src/main',
    output: {
      path: isWebview
        ? resolvePath('../../../src/main/resources/assets')
        : resolvePath('dist'),
      publicPath: '/',
      filename: isProduction
        ? 'static/js/bundle.[contenthash:8].js'
        : 'static/js/bundle.js',
      chunkFilename: isProduction
        ? 'static/js/[id].[contenthash:8].js'
        : 'static/js/[name].js',
      clean: true,
    },
    resolve: {
      extensions: ['.ts', '.ts', '.js'],
      plugins: [new TsconfigPathsPlugin()],
    },
    module: {
      rules: [
        {
          test: /\.[jt]s$/,
          exclude: /node_modules/,
          use: {
            loader: 'swc-loader',
            options: {
              env: {
                targets: 'defaults',
                mode: 'entry',
                coreJs: '3',
              },
            },
          },
        },
        {
          test: /\.css$/i,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader',
          ],
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset/resource',
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource',
        },
      ],
    },
    plugins: [
      isProduction &&
        new MiniCssExtractPlugin({
          filename: 'static/css/bundle.[contenthash:8].css',
          chunkFilename: 'static/css/[id].[contenthash:8].css',
        }),
      new HtmlWebpackPlugin({
        inject: true,
        template: resolvePath('public/index.html'),
      }),
      isAnalyzer && new BundleAnalyzerPlugin(),
    ].filter(Boolean),
    performance: false,
  };

  return config;
};
