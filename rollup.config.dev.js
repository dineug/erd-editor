import pkg from "./package.json";
import config from "./rollup.config.common";
import html from "rollup-plugin-generate-html-template";
import browsersync from "rollup-plugin-browsersync";

const { plugins, banner } = config();

export default {
  input: "src/index.dev.ts",
  output: {
    name: "vuerd",
    file: pkg.main,
    format: "umd",
    banner,
    plugins: [
      html({
        template: "public/index.rollup.html",
        target: "dist/index.html",
      }),
      browsersync({ server: "dist", open: true, port: 8090 }),
    ],
  },
  plugins,
};
