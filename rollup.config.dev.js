import pkg from "./package.json";
import config from "./rollup.config.common";
import replace from "@rollup/plugin-replace";
import html from "rollup-plugin-generate-html-template";
import serve from "rollup-plugin-serve";
import livereload from "rollup-plugin-livereload";

const { esm, banner, onwarn } = config();

esm.push(
  replace({
    "process.env.NODE_ENV": JSON.stringify("development"),
  })
);

export default [
  {
    input: "src/ts/index.dev.ts",
    output: {
      name: "vuerd",
      file: pkg.browser,
      format: "iife",
      banner,
      plugins: [
        html({
          template: "src/index.html",
          target: "dist/index.html",
        }),
        serve({
          contentBase: "dist",
          port: 3000,
        }),
        livereload("dist"),
      ],
    },
    plugins: esm,
    onwarn,
  },
];
