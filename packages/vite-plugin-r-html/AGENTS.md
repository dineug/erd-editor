<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-09-19 -->

# vite-plugin-r-html

## Purpose

`rHtml(options)` (private) returns two Vite plugins. `vite:r-html-jsx` compiles `.tsx` into the `html` / `svg` tagged templates `@dineug/r-html` reads, or into `konva` ones for a file carrying the host pragma. `vite:r-html-refresh` (serve only) makes component modules HMR boundaries whose `accept` dispatches `hmr:r-html` for r-html's `hmr.ts` to swap components in place.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | `rHtml(options)`, `transformJsxToTagged`, the option types |
| `src/options.ts` | `Options`, `JsxOptions` (`importSource`, `konvaImportSource`), `RefreshOptions` |
| `src/jsx/plugin.ts` | The JSX half — `enforce: 'pre'`, `.tsx` only |
| `src/jsx/codegen.ts` | JSX AST → tagged-template source: attribute mapping, SVG namespace, the `@jsxHost` pragma, escaping, every compile error |
| `src/refresh.ts` | The HMR half: boundary detection, the appended snippet, the `virtual:r-html-hmr` module that calls `hmr()` |

## For AI Agents

### Working In This Directory

- **The two halves order oppositely.** The JSX half is `enforce: 'pre'` because it needs raw JSX; the refresh half must not be, because its Babel parse has no TypeScript plugin and only works after `vite:oxc` strips types. `rHtml()` wires both, so compose through it.
- Shared `include` / `exclude` / `importSource` reach both halves; nested `jsx` / `refresh` options override them, and `false` disables a half.
- **One file, one host**, chosen only by a `/** @jsxHost konva */` block comment above the first statement. A pragma elsewhere, in a line comment, or with a value other than `dom` / `konva` is a compile error, as is a DOM tag in a konva file, a `k-*` tag without the pragma, a string or number child under `k-*`, and a spread, `class`, `style` or `zIndex` on `k-*`. Each has a case in `codegen.test.ts`.
- **The pragma must satisfy `local/jsdoc-attached`** (`tools/eslint-rules/jsdoc-attached.js`): a tags-only block — `/** Konva scene. @jsxHost konva */` is a lint error — and no second JSDoc block before the same statement, or the pragma is the one reported as stacked.
- **`konvaImportSource` has no default**; a konva file compiled without it is a compile error. Every erd-editor config that compiles `.tsx` passes `jsx: { konvaImportSource: '@/konva/host' }`: `vite.config.ts` (in `plugins` and again in `worker.plugins`, which inherits nothing), `vite.umd.config.ts` and `vitest.config.ts` (with `refresh: false`). A new one must too.
- **A module is a boundary only when every named export is component-shaped** (uppercase first letter) and it has a named `export default`; an anonymous default is declined. That is why erd-editor's imperative scene roots export in lower case, and why renaming one silently breaks scene HMR — see `packages/erd-editor/AGENTS.md`.
- **HMR meets on `globalThis`, not `window`**: `hmr()` listens there and the `accept` dispatches there, so a dev-server worker swaps components too. Keep both sides on `globalThis`.
- The snippet spells `import.meta.hot` from string fragments so Vite's scanner does not rewrite it before injection, and is appended so no source line moves.
- The root `tsconfig.json` maps this package to `src/index.ts`, so the root typecheck reads erd-editor's configs without a build.

### Testing Requirements

- `pnpm exec vp run --filter @dineug/vite-plugin-r-html --fail-if-no-match test` — `node` environment; both halves' hooks are called directly.
- `codegen.test.ts` is the transform's spec. Its one inline snapshot witnesses that pragma-less files compile unchanged: regenerate it only when the DOM output is meant to change, never to turn a konva change green.
- Output parity with hand-written templates is gated in `packages/erd-editor/src/__jsx-parity__/` (`parity.test.tsx`, `parity.konva.browser.test.tsx`); after a codegen change also run `pnpm exec vp run --filter @dineug/erd-editor --fail-if-no-match test`.
- Boundary selection is tested, the swap is not: check it by hand with `pnpm --filter @dineug/erd-editor dev` and an edited component.

### Common Patterns

- `// @ts-ignore` on the Babel import and AST access is intentional — `@babel/core` ships no types.

## Dependencies

### Internal

None. Pairs with `@dineug/r-html`'s `hmr.ts` by event contract only; `@dineug/erd-editor` is the sole consumer.

### External

`@babel/core` (parsing) and `@rollup/pluginutils` (`createFilter`) are runtime `dependencies`, which the build leaves external.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
