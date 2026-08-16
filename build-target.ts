/**
 * The one browser floor this repo commits to, set to the ES2022 baseline.
 *
 * It exists because the repo used to have three different answers and no way to
 * tell which was true. `app` compiled its own source with swc against
 * browserslist `defaults`; the nine libraries declared nothing and inherited
 * Vite's default; and what the bundles actually emitted was neither. Nothing
 * tested the question, so all three were claims rather than facts.
 *
 * The versions are measured, not recalled — bisected against esbuild's own
 * feature table, which is the same data Rolldown compiles against:
 *
 * | ES2022 syntax    | chrome | edge | firefox | safari |
 * | ---------------- | ------ | ---- | ------- | ------ |
 * | private field    | 84     | 84   | 90      | 14.1   |
 * | private method   | 84     | 84   | 90      | 15     |
 * | top-level await  | 89     | 89   | 89      | 15     |
 * | static block     | 91     | 94   | 93      | 16.4   |
 *
 * Static initialisation blocks set the floor in every engine, so those four
 * numbers are the full-ES2022 line. This matches `tsconfig.app.json`'s
 * `target: ES2022`, which is what the emitted bundles have needed all along —
 * they carry `#private` fields, and Rolldown does not downlevel those at any
 * target, measured.
 *
 * ⚠️ `lib` in `tsconfig.app.json` deliberately stays at ES2020, one generation
 * behind. The two guard different things: `target` is syntax, which the bundler
 * transpiles, while `lib` is runtime APIs, which it can neither transpile nor
 * polyfill. Raising `lib` would let `.at()` and `Object.hasOwn` typecheck and
 * then fail at runtime on anything below Safari 15.4, with nothing going red.
 *
 * Every published library imports this. They are consumed by the web app, both
 * webviews and by third parties through npm, so their floor is the floor of
 * everything downstream — raising it here narrows all of them at once, which is
 * the reason for keeping it in one file.
 *
 * The two webviews deliberately do not import it: they run in embedded Chromium
 * their host ships, so their own sources sit well above the public web's floor,
 * and what they consume from the libraries is capped by this value regardless.
 * `vscode-extension` is not a browser target at all — it pins `node20`, derived
 * from its `engines.vscode`.
 */
export const BROWSER_TARGET = ['chrome91', 'edge94', 'firefox93', 'safari16.4'];

/**
 * The same floor as a browserslist query, for tools that speak that instead of
 * esbuild's syntax — `@vitejs/plugin-legacy`'s `modernTargets` is the one here.
 *
 * Derived rather than written twice. Two hand-maintained spellings of one floor
 * drift, and the failure is silent in the worst direction: the polyfill set
 * would be computed for browsers the bundle is not actually built for.
 */
export const BROWSER_TARGET_QUERY = BROWSER_TARGET.map(entry =>
  entry.replace(/^([a-z]+)([\d.]+)$/, '$1 >= $2')
);
