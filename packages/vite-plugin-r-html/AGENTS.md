<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-17 | Updated: 2026-08-17 -->

# vite-plugin-r-html

## Purpose

Two Vite plugins for `@dineug/r-html`, `private: true`, dev-only, never published. `rHtml()`
(`vite:r-html-refresh`) gives components HMR: it treats a module as a _boundary_ when every named
export is component-shaped (uppercase first letter) and appends an `import.meta.hot.accept` block
dispatching an `hmr:r-html` `CustomEvent` carrying `{ originComponent, newComponent }`, which
`packages/r-html/src/render/hmr.ts` swaps on. `rHtmlJsx()` (`vite:r-html-jsx`) compiles `.tsx` into
the `html`/`svg` tagged templates the runtime already reads.

## Key Files

| File                 | Description                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/index.ts`       | `rHtml(options)` with `include`/`exclude` (default exclude `'**/node_modules/**'`), plus the JSX exports |
| `src/jsx/codegen.ts` | JSX AST → tagged-template source; owns the attribute mapping, the SVG namespace call and the escaping   |
| `src/jsx/plugin.ts`  | `rHtmlJsx(options)` — `enforce: 'pre'`, `.tsx` only, injects `html`/`svg` under aliases                 |
| `vite.config.mts`    | `run.tasks` (`build`, `test`) plus a CJS-only lib build (`formats: ['cjs']`, `minify: false`) with dts  |

## For AI Agents

### Working In This Directory

- The only library package without `"type": "module"`: it runs inside Vite's Node process, so the
  build is `formats: ['cjs']` and `main` is `./dist/index.js`.
- The injected snippet assembles `import.meta.hot` from string fragments
  (`` `${'import'}.${'meta'}.${'hot'}` ``) so Vite's own scanner does not rewrite it before injection.
- `rHtml` runs Babel with `ast: true, code: false` and no parser plugins; the AST is read only for
  export shape. **That makes the two plugins' ordering opposite** — `rHtmlJsx` is `enforce: 'pre'`
  because it needs the raw JSX, while `rHtml` must not be, because it can only parse at all once
  `vite:oxc` has stripped the types ahead of it.
- The `accept` block is appended only when the module also has an `export default`; that identifier
  becomes `originComponent`. A boundary without one gets no HMR and no error.
- The root `tsconfig.json` maps this package to `src/index.ts` so the `check` CI job can typecheck
  `erd-editor/vite.config.ts` without building; `types` still points into `dist/`.

### Testing Requirements

- `vp run --filter @dineug/vite-plugin-r-html --fail-if-no-match test` — `tsc --noEmit` then Vitest
  over `src/**/*.test.ts` in the `node` env. Both plugins' `transform` hooks are called directly.
- The codegen suite is the transform's spec — every attribute mapping, rejected construct and
  escaping case. DOM-level parity against hand-written `html` lives in `packages/erd-editor`, the
  one package that has both r-html and this plugin.
- Unit tests cover which modules become boundaries, not whether the swap works. That is still
  manual: `pnpm --filter @dineug/erd-editor dev`, edit a component, watch it swap in place.

### Common Patterns

- `// @ts-ignore` on the Babel import and AST access is intentional — no `@babel/core` types.
- New runtime deps go in `dependencies`; the build's `external` RegExp derives from it.

## Dependencies

### Internal

None. Pairs with `@dineug/r-html`'s `hmr.ts` by event contract only; it imports nothing from it.

### External

`@babel/core` (AST) and `@rollup/pluginutils` (`createFilter`) are runtime deps; `vite` is dev-only.

### Consumers

`@dineug/erd-editor` only, unconditionally in its `plugins`, whose `build`/`test` tasks track this
`dist/**/*.d.ts`. Import it by name — the CJS build exposes several exports, so a default import
resolves to the namespace object instead of the factory.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
