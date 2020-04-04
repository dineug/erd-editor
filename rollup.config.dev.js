import pkg from "./package.json";
import config from "./rollup.config.common";
import replace from "@rollup/plugin-replace";
import html from "rollup-plugin-generate-html-template";
import browserSync from "browser-sync";

const { esm, banner } = config();

esm.push(
  replace({
    "process.env.NODE_ENV": JSON.stringify("development"),
  })
);

const bs = browserSync.create("rollup");
function browsersync(options) {
  if (!bs.active) {
    bs.init(options || { server: "dist", open: false });
  }
  return {
    name: "browsersync",
    generateBundle({}, bundle, isWrite) {
      if (isWrite) {
        bs.reload(bundle.dest);
      }
    },
  };
}

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
        browsersync(),
      ],
    },
    plugins: esm,
  },
];
