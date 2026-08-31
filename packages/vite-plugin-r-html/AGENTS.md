<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-08-31 -->

# vite-plugin-r-html

## Purpose

`rHtml()` is a private, dev-only factory returning two Vite plugin halves. It is never published.
`vite:r-html-refresh` marks a module an HMR _boundary_ when every named export is component-shaped
(uppercase first letter), appending an `import.meta.hot.accept` that dispatches `hmr:r-html` with
`{ originComponent, newComponent }` for `r-html`'s `hmr.ts` to swap on, plus an
`import 'virtual:r-html-hmr'` — the module that calls `hmr()`. `vite:r-html-jsx` compiles `.tsx`
into the `html`/`svg` tagged templates the runtime already reads, or into `konva` ones when the
file carries the host pragma.

## Key Files

| File                 | Description                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/index.ts`       | `rHtml(options)` plus `transformJsxToTagged` and the `Options`/`JsxOptions`/`RefreshOptions` types |
| `src/refresh.ts`     | The HMR half: boundary detection, the injected snippet, and the `virtual:r-html-hmr` module           |
| `src/jsx/codegen.ts` | JSX AST → tagged-template source; owns the attribute mapping, the SVG namespace call, the `@jsxHost` pragma and the escaping |
| `src/jsx/plugin.ts`  | `rHtmlJsx(options)` — `enforce: 'pre'`, `.tsx` only, injects `html`/`svg`/`konva` under aliases        |
| `src/options.ts`     | `Options`, `JsxOptions` (`importSource`, `konvaImportSource`) and `RefreshOptions`                     |
| `vite.config.mts`    | `run.tasks` (`build`, `test`) plus a CJS-only lib build (`formats: ['cjs']`, `minify: false`) with dts |
| `vitest.config.mts`  | Node tests over `src/**/*.test.ts`; v8 per-file 80% thresholds for coverage runs |

## For AI Agents

### Working In This Directory

- It is the deliberate CJS-only library: it runs inside Vite's Node process, so the build is
  `formats: ['cjs']` and `main` is `./dist/index.js`; the public API is named exports.
- Shared `include`, `exclude`, and `importSource` options are passed to both halves; nested `jsx` or
  `refresh` options override them, and either half can be disabled with `false`.
- The injected snippet assembles `import.meta.hot` from string fragments
  (`` `${'import'}.${'meta'}.${'hot'}` ``) so Vite's own scanner does not rewrite it before injection.
- The JSX half filters `.tsx` and parses Babel `typescript` + `jsx`; the refresh half has no extension
  restriction, skips `node_modules`, and parses with no plugins. **That makes the
  two orderings opposite** — the JSX half is `enforce: 'pre'` because it needs raw JSX, the refresh
  half must not be, because it can only parse once `vite:oxc` has stripped the types ahead of it.
- Codegen emits `html`/`svg` aliases, preserves source line count, normalizes JSX whitespace, and
  escapes template delimiters, backslashes and quotes. Direct codegen returns `null` when no JSX exists;
  the Vite hook returns `{ code, map: null }`.
- **One file, one host.** The host is picked from a file-level `/** @jsxHost konva */` pragma, never
  from a root tag: `isComponentName` resolves every component root, `emitExpr` recurses into a
  `repeat(...)` argument as an independent root, and a component's `.children` wrapper is emitted with
  no intrinsic in sight — none of the three can see a `k-*` name. A konva file emits every template
  under `__rKonva`, imported from the `konvaImportSource` option; there is no default, so a pragma with
  that option unset is a compile error. So are, each with a `codegen.test.ts` case: a DOM tag in a konva
  file, a `k-*` tag in a file without the pragma, a string or number child under `k-*`, and
  `{...spread}` / `class` / `style` / `zIndex` on a `k-*` tag. Component tags stand in either host,
  spread included — a spread there lands on props, not on a node. A file with no pragma compiles byte
  for byte the way it did before the pragma existed, which the inline snapshot in `codegen.test.ts` pins.
- **Writing the pragma** is bound by two of the repo's comment rules (`tools/eslint-rules/jsdoc-attached.js`).
  It has to be a **tags-only** block: `/** @jsxHost konva */` passes, `/** Konva scene. @jsxHost konva */`
  is a lint error, because `carriesProse()` exempts a block only when every non-blank line starts with `@`.
  And **no other JSDoc may sit between the pragma and the first declaration**: the `stacked` check groups
  blocks by the next code token and only the last one attaches, so the pragma is the one reported. The
  compiler reads it from a block comment above the first statement only — later in the file, in a line
  comment, or with a value other than `dom`/`konva`, it is a compile error rather than a silent miss.
- The `accept` block is appended only when the module also has a named `export default`; every named
  export must be component-shaped (uppercase first letter), and a nameless default is declined.
- Boundary modules import `virtual:r-html-hmr`, whose module calls `hmr()` once; `apply: 'serve'` is
  the dev/production switch.
- The root `tsconfig.json` maps this package to `src/index.ts` so the `check` CI job can typecheck
  `erd-editor/vite.config.ts` without building; `types` still points into `dist/`.

### Testing Requirements

- `vp run --filter @dineug/vite-plugin-r-html --fail-if-no-match test` — `tsc --noEmit` then Vitest
  over `src/**/*.test.ts` in the `node` env. Both halves' hooks are called directly.
- The codegen suite is the transform's spec — every attribute mapping, rejected construct and
  escaping case. DOM parity against hand-written `html` lives in `packages/erd-editor`. The one
  inline snapshot is the byte-invariance witness for pragma-less files; regenerate it only when the DOM
  half is meant to change, never to make a konva change go green.
- Boundary selection is tested; the swap itself is not. That stays manual:
  `pnpm --filter @dineug/erd-editor dev`, edit a component, watch it swap in place.

### Common Patterns

- `// @ts-ignore` on the Babel import and AST access is intentional — no `@babel/core` types, and
  new runtime deps go in `dependencies`, from which the build's `external` RegExp derives.

## Dependencies

### Internal

None. Pairs with `@dineug/r-html`'s `hmr.ts` by event contract only; it imports nothing from it.

### External

`@babel/core` (AST) and `@rollup/pluginutils` (`createFilter`) are runtime deps; `vite` and
`vite-plugin-dts` are dev-only.

### Consumers

`@dineug/erd-editor` only: production loads the plugin through `lazyPlugins`, while its Vitest config
imports it directly with `{ refresh: false }`; its `build`/`test` tasks track this `dist/**/*.d.ts`.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
