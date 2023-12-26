const path = require('path');
const { DefinePlugin } = require('webpack');
const { InjectManifest } = require('workbox-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const WebpackPwaManifest = require('webpack-pwa-manifest');

const resolvePath = value => path.resolve(__dirname, value);

module.exports = (env, args) => {
  const isProduction = args.mode === 'production';
  const isDevelopment = args.mode !== 'production';
  const mode = isDevelopment ? 'development' : 'production';

  const config = {
    mode,
    devtool: isDevelopment ? 'eval-source-map' : 'source-map',
    devServer: {
      static: resolvePath('public'),
      historyApiFallback: true,
      open: true,
      hot: true,
    },
    entry: './src/main.tsx',
    output: {
      path: resolvePath('dist'),
      publicPath: '/',
      filename: 'js/bundle.[id].[contenthash].js',
      chunkFilename: 'js/[id].[contenthash].js',
      clean: true,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      plugins: [new TsconfigPathsPlugin()],
    },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  tsx: true,
                },
                transform: {
                  react: {
                    runtime: 'automatic',
                    importSource: 'react',
                    development: isDevelopment,
                    refresh: isDevelopment,
                  },
                },
              },
              env: {
                targets: 'defaults',
                mode: 'entry',
                coreJs: '3.34',
              },
            },
          },
        },
        {
          test: /\.css$/i,
          use: ['style-loader', 'css-loader'],
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
      new DefinePlugin({
        'import.meta.env.MODE': JSON.stringify(mode),
      }),
      isProduction &&
        new InjectManifest({
          swSrc: './src/sw.ts',
          swDest: 'sw.js',
          exclude: [/\.(html|js.map|txt)$/],
        }),
      new WebpackPwaManifest({
        filename: 'manifest.json',
        name: 'erd-editor',
        short_name: 'erd-editor',
        description: 'Entity-Relationship Diagram Editor App',
        start_url: '/',
        display: 'standalone',
        scope: '/',
        theme_color: '#282c34',
        icons: [
          {
            src: resolvePath('src/assets/erd-editor.png'),
            size: '128x128',
          },
          {
            src: resolvePath('src/assets/erd-editor-256x256.png'),
            size: '256x256',
          },
          {
            src: resolvePath('src/assets/erd-editor-512x512.png'),
            size: '512x512',
            purpose: 'any',
          },
          {
            src: resolvePath('src/assets/erd-editor-512x512.png'),
            size: '512x512',
            purpose: 'maskable',
          },
        ],
      }),
      new HtmlWebpackPlugin({
        inject: true,
        template: resolvePath('public/index.html'),
      }),
      // new CopyPlugin({
      //   patterns: [{ from: 'public/manifest.json' }],
      // }),
      isDevelopment && new ReactRefreshWebpackPlugin(),
    ].filter(Boolean),
  };

  return config;
};
