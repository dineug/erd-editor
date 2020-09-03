import pkg from "./package.json";
import config from "./rollup.config.common";
import strip from "@rollup/plugin-strip";
import { terser } from "rollup-plugin-terser";

const { plugins, banner } = config();

plugins.push(
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
        file: `../static/${pkg.name}.min.js`,
        format: "iife",
        banner,
        plugins: [terser()],
      },
    ],
    plugins,
  },
];
