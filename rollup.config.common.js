import pkg from "./package.json";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import { terser } from "rollup-plugin-terser";
import { eslint } from "rollup-plugin-eslint";

const banner = `/*!
 * ${pkg.name}
 * @version ${pkg.version} | ${new Date().toDateString()}
 * @author ${pkg.author}
 * @license ${pkg.license}
 */`;

const esm = [
  resolve(),
  commonjs(),
  eslint(".eslintrc.json"),
  typescript(),
  terser({
    include: [/^.+\.min\.js$/],
  }),
];

export default function config() {
  return {
    esm,
    banner,
    onwarn(warning, rollupWarn) {
      if (warning.code !== "CIRCULAR_DEPENDENCY") {
        rollupWarn(warning);
      }
    },
  };
}
