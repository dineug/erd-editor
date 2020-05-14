module.exports = ({ config, mode }) => {
  config.module.rules.push({
    test: /\.ts$/,
    exclude: /node_modules/,
    use: [
      {
        loader: require.resolve("ts-loader"),
        options: {
          transpileOnly: true,
        },
      },
    ],
  });
  config.resolve.extensions.push(".ts");

  return config;
};
