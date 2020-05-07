import pkg from "./package.json";
import config from "./rollup.config.common";
import replace from "@rollup/plugin-replace";
import strip from "@rollup/plugin-strip";
import visualizer from "rollup-plugin-visualizer";

const { esm, banner, onwarn } = config();

esm.push(
  replace({
    "process.env.NODE_ENV": JSON.stringify("production"),
  }),
  strip({
    debugger: true,
    include: "**/*.ts",
    functions: ["Logger.debug"],
  }),
  visualizer({
    filename: "./dist/stats.html",
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
        banner,
      },
      {
        name: "vuerd",
        file: `dist/${pkg.name}.min.js`,
        format: "iife",
        banner,
      },
    ],
    plugins: esm,
    onwarn,
  },
  {
    input: "src/ts/index.ts",
    output: [
      {
        file: pkg.main,
        format: "cjs",
        banner,
      },
      {
        file: pkg.module,
        format: "es",
        banner,
      },
    ],
    plugins: esm,
    onwarn,
  },
];
