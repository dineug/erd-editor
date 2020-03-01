import pkg from "./package.json";
import config from "./rollup.config.common";
import replace from "@rollup/plugin-replace";
import browsersync from "rollup-plugin-browsersync";
import html from "rollup-plugin-generate-html-template";

const { esm, banner } = config();

esm.push(
  replace({
    "process.env.NODE_ENV": JSON.stringify("development")
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
          target: "dist/index.html"
        }),
        browsersync({
          server: "dist"
        })
      ]
    },
    plugins: esm
  }
];
