const path = require('path');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

const resolvePath = value => path.resolve(__dirname, value);

module.exports = env => {
  const isAnalyzer = env.target === 'analyzer';

  const config = {
    entry: './src/index',
    output: {
      path: resolvePath('../erd-editor-vscode/public'),
      publicPath: './',
      filename: 'bundle.[contenthash:8].js',
      chunkFilename: '[id].[contenthash:8].js',
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
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
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
      new MiniCssExtractPlugin({
        filename: 'bundle.[contenthash:8].css',
        chunkFilename: '[id].[contenthash:8].css',
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
