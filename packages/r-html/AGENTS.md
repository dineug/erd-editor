<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-17 | Updated: 2026-08-17 -->

# r-html

## Purpose

`@dineug/r-html` is the in-house rendering framework `@dineug/erd-editor` is built on — the only workspace package depending on it. It supplies tagged templates (`html`, `svg`, `css`) compiled to a virtual node tree, Proxy-based reactivity with a microtask scheduler, a functional component model with lifecycle hooks and a `defineCustomElement` adapter, and a Redux-like `createStore`. `private: true`, so its `version` is never published.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | The public API — named re-exports, plus `export *` over the two directive barrels; anything else is private |
| `src/constants.ts` | `MARKER` (per-load random suffix) and its regexps, `TAttrType`, 7 lifecycle `Symbol.for` keys |
| `src/template/vCSSStyleSheet.ts` | Adopted-stylesheet registry: one sheet per template, global/component cascade buckets, `<style>` fallback |
| `src/render/part/node/text/helper.ts` | `PartType`, `getPartType`, and the `isPartMap`/`partMap` registries every value kind goes through |
| `vite.config.ts` | `run.tasks` (`build`, `test`, both prefixed by `tsc --noEmit`), ESM lib build, `vite-plugin-dts` |
| `playwright.config.ts` | Chromium e2e against `vp dev` on port 5176, viewport pinned 1280x720 |
| `tsconfig.build.json` | Build/dts view — excludes `src/**/*.test.ts` so specs never reach `dist/` |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/template/` | `html`/`svg`/`css` tags, the `tNode` template AST, `cssSource`, `cssDiagnostics`, `vCSSStyleSheet` |
| `src/css/` | stylis-based CSS pipeline: `compile`, `flatten`, `selector` (scoping), `emit`, `hash`, `diagnostics` |
| `src/parser/` | HTML tokenizer (`html/`) and the virtual-node builder (`vNode.ts`) |
| `src/render/` | `render` entry + container `WeakMap` cache, DOM helpers, shadow-host bridge, `hmr.ts`, `directives/` |
| `src/render/part/` | Fine-grained update units — `attribute/` and `node/` (text kinds, `arrayDiff`, `component/`) |
| `src/observable/`, `src/store/` | `observable`/`observer`/`watch` + `scheduler.ts` batching; `createStore`/`createAction`/`compositionActionsFlat` |
| `src/context/`, `src/helpers/` | `createContext`/`useProvider`/`useContext` DI over bubbling `CustomEvent`s; internal array/fn/type-guard/subject helpers |
| `e2e/` | Playwright suite — `specs/`, the `fixture/` page, `support/` page objects, its own `tsconfig.json` |

## For AI Agents

### Working In This Directory

- `src/index.ts` is the contract; a symbol not re-exported there is private. `removeCSSHost` is deliberately absent — its only caller is the `disconnectedCallback` of the element class `defineCustomElement` registers.
- `src/parser/` imports nothing from `src/constants.ts` — it tokenizes plain HTML. `MARKER` is injected by `template/html.ts` (`createMarker`) and read back only in `template/helper.ts` and `template/tNode.ts`, so those three move together.
- Reactivity is batched through `observable/scheduler.ts`, so a DOM read taken right after a state write still sees the old tree — `await nextTick()` first.
- `helpers/array.ts` `groupBy` accumulates into `Object.create(null)`: attributes are grouped by name, and a `constructor` attribute would otherwise hit an inherited function.
- `build.target` reads `BROWSER_TARGET` from the root `build-target.ts` — the browser floor is a workspace decision, not one this package narrows on its own.

### Testing Requirements

- Unit: `pnpm exec vp run --filter @dineug/r-html --fail-if-no-match test` — `tsc --noEmit` then `vp test run`, happy-dom, 76 colocated `src/**/*.test.ts` files.
- Coverage: `pnpm --filter @dineug/r-html test:coverage` — v8, `perFile` 80% lines/functions/branches/statements, excluding `src/internal-types/**` and `src/index.dev.ts`.
- E2E: `pnpm --filter @dineug/r-html e2e` (plus `e2e:dev`, `e2e:headed`, `e2e:report`, `e2e:typecheck`). No build step — `vp dev` serves `src/` through `@`. See `e2e/README.md`.
- happy-dom has no style engine, so `vCSSStyleSheet.ts`'s `adoptedStyleSheets` behaviour is pinned only by the e2e specs; re-run them after touching that file.
- `tsconfig.json` is `include: ["src"]` with no `exclude`, so the type gate covers the specs. `e2e/` belongs to no package program and is typechecked only by `e2e:typecheck`.

### Common Patterns

- Components are `FC<Props, Ctx>` returning a render closure; `ctx` always carries `host`, `parentElement` and `dispatchEvent`, augmented by the second type parameter.
- A new text-position value kind needs a `Part` class wired into `render/part/node/text/helper.ts` — `PartType`, `getPartType`, `isPartMap` and `partMap` together.
- Lifecycle hooks are keyed by the `Symbol.for` names in `constants.ts`; add a hook in both places.

## Dependencies

### Internal

None — leaf package.

### External

`stylis` 4.4.0 is the only runtime dependency, parsing and serializing the `css` pipeline. Dev-only: `happy-dom` (unit env), `@playwright/test` (e2e), `vite-plugin-dts` + `@typescript/typescript6` (dts emit).

<!-- MANUAL: notes added below this line are preserved on regeneration -->
