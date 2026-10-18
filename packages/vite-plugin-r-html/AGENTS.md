<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-10-18 -->

# vite-plugin-r-html

## Purpose

`@dineug/vite-plugin-r-html` is a private workspace package whose `rHtml(options)` returns two Vite plugins. `vite:r-html-jsx` compiles `.tsx` into the `html` / `svg` tagged templates `@dineug/r-html` reads, or into `konva` ones for a file carrying the host pragma. `vite:r-html-refresh`, applied on serve only, makes component modules HMR boundaries whose `accept` dispatches `hmr:r-html` for r-html's `hmr.ts` to swap components in place. Its consumers are `@dineug/erd-editor`, `@dineug/r-html-konva`, the Konva host, and `@dineug/grid`, the canvas grid on that host; the builds of the last two load it through `defineLibraryConfig`'s `jsx` option. A change keeps the DOM output of pragma-less files and the `hmr:r-html` event contract with r-html intact.

## Making a Change

1. Read the files root step 1 names. A change to the `hmr:r-html` event or the `virtual:r-html-hmr` module crosses into r-html's `src/render/hmr.ts`, so read `packages/r-html/AGENTS.md` too. A change to which modules become HMR boundaries reaches erd-editor's scene roots: read `packages/erd-editor/src/konva/AGENTS.md`.
2. Give the change what root step 2 asks. A new compile error gets its own case in `codegen.test.ts`, as each existing one has. The inline snapshot changes only as Testing Requirements allows.
3. Run `pnpm exec vp run --filter @dineug/vite-plugin-r-html --fail-if-no-match test` (root step 3). After a codegen change, also run `pnpm exec vp run --filter @dineug/erd-editor --fail-if-no-match test`, because erd-editor's parity specs gate the compiled output. A change to `rHtml`, `transformJsxToTagged` or the option types runs `pnpm test`, as root step 3 says for anything a package hands its siblings.
4. Run `pnpm --filter ./packages/vite-plugin-r-html --fail-if-no-match test:coverage` (root step 4).
5. Run `pnpm check`, then `pnpm build` (root step 5). The root typecheck in `pnpm check` reads erd-editor's configs through this package's source (Rules, Type checking). A codegen change changes erd-editor's build output, so run `pnpm peer-graph` and `pnpm size` after the build.
6. A codegen change that alters what the editor renders also runs `pnpm --filter @dineug/erd-editor e2e` (root step 6). A refresh change gets the hand check in Testing Requirements, because no spec drives a hot update through the dev server.
7. Report as root step 7 says. Name the dev-server hot-update check as run by hand or left out, with the reason.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | `rHtml(options)`, `transformJsxToTagged`, the option types |
| `src/options.ts` | `Options`, `JsxOptions` (`importSource`, `konvaImportSource`), `RefreshOptions` |
| `src/jsx/plugin.ts` | The JSX half: `enforce: 'pre'`, `.tsx` only |
| `src/jsx/codegen.ts` | JSX AST to tagged-template source: attribute mapping, SVG namespace, the `@jsxHost` pragma, escaping, every compile error |
| `src/refresh.ts` | The HMR half: boundary detection, the appended snippet, the `virtual:r-html-hmr` module that calls `hmr()` |

## Rules

### Composing the two halves

- **Compose both halves through `rHtml()`.** The JSX half is `enforce: 'pre'` because it needs raw JSX. Keep the refresh half off `enforce: 'pre'`: its Babel parse has no TypeScript plugin and works only after `vite:oxc` strips types, so the two halves order oppositely. `rHtml()` wires both, so a caller cannot get the order wrong.
- **Shared options reach both halves.** Top-level `include` / `exclude` / `importSource` reach both halves. Nested `jsx` / `refresh` options override them, and `false` disables a half.

### JSX hosts and the pragma

- **One file, one host.** Only a `/** @jsxHost konva */` block comment above the first statement chooses the host. Each of these is a compile error with a case in `codegen.test.ts`:
  - a pragma elsewhere, in a line comment, or with a value other than `dom` / `konva`;
  - a DOM tag in a konva file, or a `k-*` tag without the pragma;
  - a string or number child under `k-*`;
  - a spread, `class`, `style` or `zIndex` on `k-*`.
- **Write the pragma as a tags-only block.** It must satisfy `local/jsdoc-attached` (`tools/eslint-rules/jsdoc-attached.js`), so `/** Konva scene. @jsxHost konva */` is a lint error. Put no second JSDoc block before the same statement; otherwise the pragma is the block reported as stacked.
- **Pass `konvaImportSource` in every config that compiles `.tsx`.** It has no default, so a konva file compiled without it is a compile error. erd-editor's and grid's configs pass `jsx: { konvaImportSource: '@dineug/r-html-konva' }`, the host package, and r-html-konva's own pass `'@/host'`, its host module; a new config must pass it too:
  - erd-editor's `vite.config.ts`, in `plugins` and again in `worker.plugins`, which inherits nothing;
  - erd-editor's `vite.umd.config.ts`;
  - erd-editor's `vitest.config.ts`, with `refresh: false`;
  - r-html-konva's `vite.config.ts`, as `defineLibraryConfig`'s `jsx` option, which adds `refresh: false` itself and, with `workers`, adds the plugin to `worker.plugins` too, and its `vitest.config.ts`, with `refresh: false`;
  - grid's `vite.config.ts` and `vitest.config.ts`, the same way as r-html-konva's.
- **Load the plugin lazily in `vite.config.ts`.** erd-editor's `vite.config.ts` loads the plugin lazily, through `lazyPlugins` and `await import(rHtmlPackage)` with `const rHtmlPackage: string`, because its `run.tasks` is read before this package is built on a clean checkout. `tools/vite-config.test.ts` (task metadata does not require generated workspace plugins) fails on a static import or a literal `import('@dineug/vite-plugin-r-html')` there. `vite.umd.config.ts` loads it the same way, though it runs only inside the `build` task, after its dependencies build, and `vitest.config.ts` imports it statically. `defineLibraryConfig` loads it lazily too, through `lazyPlugins`, from the own dependencies of the library being built (`tools/vite/library-config.ts`).

### HMR boundaries

- **Boundaries need component-shaped named exports.** A module is a boundary only when every named export is component-shaped (uppercase first letter) and it has a named `export default`; an anonymous default is declined. An exported class declaration and a bare `export * from` go unchecked, so a lower-case class or a star re-export still leaves the module a boundary.
- **Scene roots stay lower case.** erd-editor's imperative scene roots export in lower case so they are not boundaries, and renaming one breaks scene HMR with no error. The rule is in `packages/erd-editor/src/konva/AGENTS.md`.
- **Keep both HMR sides on `globalThis`.** `hmr()` listens on `globalThis` and the `accept` dispatches there, not on `window`. A worker on the dev server has no `window`, so this is what lets it swap components too.
- **Append the snippet, spelled from fragments.** The snippet spells `import.meta.hot` from string fragments, so Vite's scanner does not rewrite it before injection. It is appended rather than prepended, so no source line moves.

### Type checking

- **The root program reads this package's source.** The root `tsconfig.json` maps `@dineug/vite-plugin-r-html` to `src/index.ts`, so the root typecheck reads erd-editor's configs without a build. The package's `types` point at `dist/`, and the `check` job never builds.

## Testing Requirements

- The test task runs Vitest in the `node` environment, and the specs call both halves' hooks directly.
- `codegen.test.ts` is the transform's spec. Its one inline snapshot checks that pragma-less files compile unchanged. Regenerate it only when the DOM output is meant to change, never to turn a konva change green; otherwise no spec shows a konva change altering the DOM output.
- Output parity with hand-written templates is gated in `packages/erd-editor/src/__jsx-parity__/` (`parity.test.tsx`, `parity.konva.browser.test.tsx`), which Making a Change step 3 runs.
- Boundary selection and the `accept`'s dispatch are tested here (`refresh.test.ts`), and the swap itself in r-html (`packages/r-html/src/render/hmr.test.ts`). A hot update through the dev server is not: check it by hand with `pnpm --filter @dineug/erd-editor dev` and an edited component.

## Common Patterns

- `// @ts-ignore` on the Babel import and on AST access is intentional, because `@babel/core` ships no types and the workspace installs no `@types/babel__core`.

## Dependencies

### Internal

None. The package works with `@dineug/r-html`'s `hmr.ts` through the event contract alone, and `@dineug/erd-editor`, `@dineug/r-html-konva` and `@dineug/grid` are its consumers, each through a devDependency.

### External

`@babel/core` (parsing) and `@rollup/pluginutils` (`createFilter`) are runtime `dependencies`, which the build leaves external, as `createExternal` (`tools/vite/package-metadata.ts`) keeps every `dependencies` entry a bare import.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
