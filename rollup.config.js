import pkg from "./package.json";
import config from "./rollup.config.common";
import replace from "@rollup/plugin-replace";

const { esm, banner } = config();

esm.push(
  replace({
    "process.env.NODE_ENV": JSON.stringify("production")
  })
);

export default [
  {
    input: "src/ts/index.ts",
    output: [
      {
        name: "vuerd",
        file: pkg.browser,
        format: "iife",
        banner
      },
      {
        name: "vuerd",
        file: `dist/${pkg.name}.min.js`,
        format: "iife",
        banner
      }
    ],
    plugins: esm
  },
  {
    input: "src/ts/index.ts",
    output: [
      {
        file: pkg.main,
        format: "cjs",
        banner
      },
      {
        file: pkg.module,
        format: "es",
        banner
      }
    ],
    plugins: esm
  }
];
