module.exports = {
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    "@babel/preset-typescript",
  ],
  plugins: [
    ["transform-remove-console", { exclude: ["log", "warn", "error"] }],
    ["inline-json-import", {}],
  ],
};
