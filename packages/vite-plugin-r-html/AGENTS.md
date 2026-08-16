<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-17 | Updated: 2026-08-17 -->

# vite-plugin-r-html

## Purpose

A Vite plugin (`vite:r-html-refresh`) giving `@dineug/r-html` components hot module replacement. Its
`transform` hook parses each matched module with Babel, treats it as an HMR _boundary_ when every
named export is component-shaped (uppercase first letter), and appends an `import.meta.hot.accept`
block dispatching an `hmr:r-html` `CustomEvent` carrying `{ originComponent, newComponent }`.
`packages/r-html/src/render/hmr.ts` listens for it and swaps the component in place. `private: true`,
dev-only, never published.

## Key Files

| File              | Description                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `src/index.ts`    | The entire plugin — `rHtml(options)` with `include`/`exclude` (default exclude `'**/node_modules/**'`)   |
| `vite.config.mts` | `run.tasks.build` plus a CJS-only lib build (`formats: ['cjs']`, `minify: false`) with `vite-plugin-dts` |

## For AI Agents

### Working In This Directory

- The only library package without `"type": "module"`: it runs inside Vite's Node process, so the
  build is `formats: ['cjs']` and `main` is `./dist/index.js`.
- The injected snippet assembles `import.meta.hot` from string fragments
  (`` `${'import'}.${'meta'}.${'hot'}` ``) so Vite's own scanner does not rewrite it before injection.
- Babel runs with `ast: true, code: false` — the AST is inspected only for export shape and Babel's
  output is discarded, so this plugin does no syntax downleveling.
- The `accept` block is appended only when the module also has an `export default`; that identifier
  becomes `originComponent`. A boundary without one gets no HMR and no error.
- The root `tsconfig.json` maps `@dineug/vite-plugin-r-html` to `src/index.ts`; the `check` CI job
  typechecks `erd-editor/vite.config.ts` without building, and `types` points into `dist/`.

### Testing Requirements

- No unit suite, no `test` task, and `package.json` `scripts` is empty. The only task is
  `vp run --filter @dineug/vite-plugin-r-html --fail-if-no-match build`
  (`command: ['tsc --noEmit', 'vp build']`, `output: ['dist/**']`).
- Manual verification: `pnpm --filter @dineug/erd-editor dev`, edit a component under
  `packages/erd-editor/src/components/`, confirm the DOM updates without a full reload.
- `vite.config.mts` itself is typechecked by the root `pnpm check`, which is what catches a typo in
  the `run.tasks` block.

### Common Patterns

- `// @ts-ignore` on the Babel import and AST node access is intentional — no `@babel/core` types.
- New runtime deps go in `dependencies`: the build's `external` RegExp is derived from
  `dependencies` + `peerDependencies`, so they stay out of the bundle automatically.

## Dependencies

### Internal

None. Pairs with `@dineug/r-html`'s `hmr.ts` by event contract only; it imports nothing from it.

### External

- `@babel/core` — parses modules to an AST (runtime dependency)
- `@rollup/pluginutils` — `createFilter` for `include`/`exclude` (runtime dependency)
- `vite` — dev-only, for `import type { Plugin }`

### Consumers

`@dineug/erd-editor` only, at `vite.config.ts:152` — `isLib && isServe && rHtml()`. Its `build` and
`test` tasks track `packages/vite-plugin-r-html/dist/**/*.d.ts` as an `input`.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
