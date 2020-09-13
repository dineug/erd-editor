import pkg from "./package.json";
import config from "./rollup.config.common";
import strip from "@rollup/plugin-strip";
import visualizer from "rollup-plugin-visualizer";
import { terser } from "rollup-plugin-terser";

const { plugins, banner } = config();

plugins.unshift(
  strip({
    debugger: true,
    include: "**/*.ts",
    functions: ["Logger.debug"],
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
        plugins: [
          terser(),
          visualizer({
            filename: "./dist/stats.html",
          }),
        ],
      },
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
    plugins,
  },
  {
    input: "src/ts/index.engine.ts",
    output: [
      {
        file: `dist/${pkg.name}-engine.cjs.js`,
        format: "cjs",
        banner,
      },
      {
        file: `dist/${pkg.name}-engine.esm.js`,
        format: "es",
        banner,
      },
    ],
    plugins,
  },
];
