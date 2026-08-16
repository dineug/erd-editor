<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-17 | Updated: 2026-08-17 -->

# vite-plugin-r-html

## Purpose

One plugin entry, `rHtml()`, returning two halves. `private: true`, dev-only, never published.
`vite:r-html-refresh` marks a module an HMR _boundary_ when every named export is component-shaped
(uppercase first letter), appending an `import.meta.hot.accept` that dispatches `hmr:r-html` with
`{ originComponent, newComponent }` for `r-html`'s `hmr.ts` to swap on, plus an
`import 'virtual:r-html-hmr'` — the module that calls `hmr()`. `vite:r-html-jsx` compiles `.tsx`
into the `html`/`svg` tagged templates the runtime already reads.

## Key Files

| File                 | Description                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/index.ts`       | `rHtml(options)` — composes both halves; `jsx: false` / `refresh: false` drop one                     |
| `src/refresh.ts`     | The HMR half: boundary detection, the injected snippet, and the `virtual:r-html-hmr` module           |
| `src/jsx/codegen.ts` | JSX AST → tagged-template source; owns the attribute mapping, the SVG namespace call and the escaping |
| `src/jsx/plugin.ts`  | `rHtmlJsx(options)` — `enforce: 'pre'`, `.tsx` only, injects `html`/`svg` under aliases                |
| `vite.config.mts`    | `run.tasks` (`build`, `test`) plus a CJS-only lib build (`formats: ['cjs']`, `minify: false`) with dts |

## For AI Agents

### Working In This Directory

- The only library package without `"type": "module"`: it runs inside Vite's Node process, so the
  build is `formats: ['cjs']` and `main` is `./dist/index.js`.
- The injected snippet assembles `import.meta.hot` from string fragments
  (`` `${'import'}.${'meta'}.${'hot'}` ``) so Vite's own scanner does not rewrite it before injection.
- The refresh half runs Babel with `ast: true, code: false` and no parser plugins. **That makes the
  two orderings opposite** — the JSX half is `enforce: 'pre'` because it needs raw JSX, the refresh
  half must not be, because it can only parse once `vite:oxc` has stripped the types ahead of it.
- The `accept` block is appended only when the module also has an `export default`; that identifier
  becomes `originComponent`. A nameless one is declined so the update still propagates.
- **No entry file calls `hmr()`.** Every boundary imports `virtual:r-html-hmr`, evaluated exactly
  once by module semantics, and `apply: 'serve'` is the dev/production switch — so no downstream
  `import.meta.env.DEV` branch. Entries are not one place: `erd-editor` has three, stories reach none.
- The root `tsconfig.json` maps this package to `src/index.ts` so the `check` CI job can typecheck
  `erd-editor/vite.config.ts` without building; `types` still points into `dist/`.

### Testing Requirements

- `vp run --filter @dineug/vite-plugin-r-html --fail-if-no-match test` — `tsc --noEmit` then Vitest
  over `src/**/*.test.ts` in the `node` env. Both halves' hooks are called directly.
- The codegen suite is the transform's spec — every attribute mapping, rejected construct and
  escaping case. DOM parity against hand-written `html` lives in `packages/erd-editor`.
- Boundary selection is tested; the swap itself is not. That stays manual:
  `pnpm --filter @dineug/erd-editor dev`, edit a component, watch it swap in place.

### Common Patterns

- `// @ts-ignore` on the Babel import and AST access is intentional — no `@babel/core` types, and
  new runtime deps go in `dependencies`, from which the build's `external` RegExp derives.

## Dependencies

### Internal

None. Pairs with `@dineug/r-html`'s `hmr.ts` by event contract only; it imports nothing from it.

### External

`@babel/core` (AST) and `@rollup/pluginutils` (`createFilter`) are runtime deps; `vite` is dev-only.

### Consumers

`@dineug/erd-editor` only, unconditionally in its `plugins`; its `build`/`test` tasks track this
`dist/**/*.d.ts`. Import by name — the CJS build has several exports, so a default import lands on
the namespace object rather than the factory.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
