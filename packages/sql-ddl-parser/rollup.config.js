import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import visualizer from "rollup-plugin-visualizer";
import filesize from "rollup-plugin-filesize";
import { eslint } from "rollup-plugin-eslint";
import { uglify } from "rollup-plugin-uglify";
import pkg from "./package.json";

const banner = `/*!
 * ${pkg.name}
 * @version ${pkg.version} | ${new Date().toDateString()}
 * @author ${pkg.author}
 * @license ${pkg.license}
 */`;

export default {
  input: "src/index.ts",
  output: [
    {
      name: "SQLDDLParser",
      file: pkg.main,
      format: "umd",
      banner,
    },
    {
      name: "SQLDDLParser",
      file: pkg.browser,
      format: "umd",
      plugins: [uglify()],
      banner,
    },
    {
      file: pkg.module,
      format: "es",
      banner,
    },
  ],
  plugins: [
    resolve(),
    commonjs(),
    eslint("./.eslintrc.json"),
    typescript(),
    visualizer({
      filename: "./dist/stats.html",
    }),
    filesize({
      showBrotliSize: true,
    }),
  ],
};
