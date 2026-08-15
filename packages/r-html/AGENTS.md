<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-15 -->

# r-html (`@dineug/r-html`)

## Purpose

The in-house rendering framework the editor is built on — a lit-html-style tagged-template library
plus a reactivity system, a component model with hooks, a Web Components adapter, and a Redux-like
store. `@dineug/erd-editor` renders entirely through this package; there is no React in the editor
core.

Four subsystems:

1. **Template** (`html`, `svg`, `css`) — tagged templates compiled into virtual node trees.
2. **Parser + CSS compiler** — a hand-written HTML tokenizer that turns template strings into
   `tNode`, and a stylis-based CSS pipeline (`src/css/`) that scopes, emits and hashes a `css`
   literal into one adopted stylesheet.
3. **Render** — commits virtual trees to the DOM through fine-grained "parts", with diffing for arrays.
4. **Observable + Store** — Proxy-based reactivity, a batching scheduler, and `createStore`.

## Key Files

| File                   | Description                                                                      |
| ---------------------- | -------------------------------------------------------------------------------- |
| `src/index.ts`         | The public API surface — explicit named re-exports, the authoritative contract   |
| `src/index.dev.ts`     | Dev-server entry (a counter FC + custom element) loaded by `index.html`          |
| `src/constants.ts`     | Marker/sentinel strings, `TAttrType`, and the seven lifecycle `Symbol.for` names |
| `src/reduxDevtools.ts` | Optional Redux DevTools bridge for the store                                     |
| `vite.config.ts`       | ESM-only lib build (`rolldownOptions` banner) + `vite-plugin-dts` + rollup-ts    |
| `vitest.config.ts`     | happy-dom env, `src/**/*.test.ts`, v8 coverage with **per-file 80% thresholds**  |
| `playwright.config.ts` | Chromium e2e — `e2e/specs`, pinned 1280x720, Vite `webServer` on port 5176      |
| `tsconfig.build.json`  | Build/dts view of `tsconfig.json` that excludes `src/**/*.test.ts`               |

## Subdirectories

| Directory                         | Purpose                                                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/template/`                   | `html`/`svg`/`css` tag functions, the `tNode` template AST, `helper.ts` (marker/attr-type predicates), `cssSource`/`cssDiagnostics`, `vCSSStyleSheet` (adopted stylesheets + the global bucket)   |
| `src/css/`                        | The CSS compiler behind the `css` tag — `compile`, `flatten`, `selector` (scoping), `emit`, `hash` (the identifier), `element`, `diagnostics`                                                     |
| `src/parser/`                     | The HTML tokenizer under `html/` and its virtual-node builder (`vNode`)                                                                                                                          |
| `src/render/`                     | DOM commit layer — `index.ts` (`render` + the container `WeakMap` cache), `helper.ts` (node/attr primitives, `kebabCase`/`camelCase`), `host.ts` (shadow-host bridge on a fragment)               |
| `src/render/part/`                | Fine-grained update units: `container.ts` (`ContainerPart`, the per-`render` root), `attribute/` (attribute, boolean, property, event, spread, directive) and `node/` (text, comment, component)  |
| `src/render/part/node/text/`      | Value-kind dispatch via `helper.ts` `getPartType` (`primitive`, `templateLiterals`, `array`, `node`, `object`, `function`, `directive`) plus `arrayDiff.ts`, the keyed list reconciler            |
| `src/render/part/node/component/` | `observableComponent.ts` (the `FC` model), `hooks.ts` lifecycle hooks, `prop.ts`, and `webComponent/` (`defineCustomElement`, shadow-DOM query helpers)                                           |
| `src/render/directives/`          | `nodeDirective.ts`/`attributeDirective.ts` factories over the shared `DirectiveTuple` in `index.ts`; built-ins are `node/` (`cache`, `innerHTML`, `repeat`) and `attribute/` (`ref`, `createRef`) |
| `src/render/hmr.ts`               | HMR entry point cooperating with `@dineug/vite-plugin-r-html`                                                                                                                                     |
| `src/observable/`                 | `observable`/`observer`/`watch` reactivity and `scheduler.ts` (`nextTick` batching)                                                                                                               |
| `src/store/`                      | `createStore`, `createAction`, `compositionActionsFlat`, and the `Reducer`/`GeneratorAction` types                                                                                                |
| `src/context/`                    | `createContext` / `useProvider` / `useContext` DI over bubbling+composed `CustomEvent`s                                                                                                           |
| `src/helpers/`                    | Internal array/function/type-guard helpers and `subject.ts`                                                                                                                                       |
| `src/internal-types/`             | Ambient declarations (`index.d.ts`)                                                                                                                                                               |
| `e2e/`                            | Playwright suite — `specs/`, the `fixture/` page, `support/` (`window-api.ts` contract, `CssPage`), its own `tsconfig.json` and `README.md`                                                       |

## For AI Agents

### Working In This Directory

- **`src/index.ts` is the contract.** It lists every export explicitly. A symbol not named there is
  private, regardless of whether the file exports it — do not import deep paths from consumers.
  Current surface: `html`/`svg`/`css` (+ `css.global`), `render`,
  `addCSSHost`/`setGlobalStyleOrder`/`setCSSDiagnostics` — `removeCSSHost` is deliberately not
  exported, because `defineCustomElement` is its only caller —
  `observable`/`observer`/`watch`/`nextTick`, `createStore`/`createAction`/`compositionActionsFlat`
  (+ `Action`/`AnyAction`/`Reducer`/`Store`/`GeneratorAction`/`DispatchOperator` types),
  `createContext`/`useProvider`/`useContext`, `defineCustomElement` with
  `closestElement`/`queryShadowSelector`/`queryShadowSelectorAll`, the seven lifecycle hooks,
  `FC`/`FunctionalComponent`, `NoopComponent`, `hmr`, `reduxDevtools`, the built-in directives, and
  `createNodeDirective`/`createAttributeDirective`.
- **Parser and part system are tightly coupled.** The tokenizers emit marker strings from
  `src/constants.ts` (`MARKER` carries a per-load random suffix) that the render layer scans for.
  Changing a marker requires changing both sides.
- **Reactivity is Proxy-based and batched.** Writes enqueue into `observable/scheduler.ts`, which
  drains on a microtask (`queueMicrotask`); synchronous DOM reads after a state write need `nextTick`.
- **Web component boundary:** `defineCustomElement` attaches shadow roots and adopts stylesheets built
  by `template/vCSSStyleSheet.ts`. CSS written with the `css` tag is host-rewritten
  (`addCSSHost`/`removeCSSHost`) — plain `<style>` injection will not behave the same.
- `arrayDiff.ts` is the performance-critical path for large diagrams. Preserve its keyed-diff semantics.
- **Prototype-named keys are a live hazard.** `helpers/array.ts` `groupBy` builds its accumulator with
  `Object.create(null)` because `createAttrsTuple` (`template/tNode.ts`) groups by attribute name — a
  `constructor`/`toString` attribute otherwise resolved to an inherited function and crashed on
  `.push`. It runs once per template call site, not per render: `template/html.ts` looks up
  `templateCache` (a `WeakMap<TemplateStringsArray, Template>` in `template/index.ts`) first and only
  parses on a miss, and a tagged template's `strings` object is identical across re-renders. Keep any
  new keyed-accumulator prototype-free.
- `private: true` — internal to the workspace, so `version` (0.1.3) is not published.

### Testing Requirements

Two suites, and the split between them is not about speed — it is about what each environment is
capable of observing. Vitest runs on happy-dom, which has **no style engine at all**: it never
computes a value and never resolves a cascade, so every styling assertion it can make is really an
assertion about bookkeeping. The Playwright suite exists for the rest.

**Unit — `pnpm --filter @dineug/r-html test`** (`vitest run`), plus `test:dev` (watch) and
`test:coverage`. Nx picks the `test` target up through `pnpm test` at the root, so it inherits
`cache: true` and `dependsOn: ["^build"]`.

- Tests are colocated as `src/**/*.test.ts`; **every module under `src/` has one except
  `src/index.dev.ts`** (76 files / 1457 tests, ~5s). Coverage: statements 99.5%, branches 97.9%,
  functions 99.4%, lines 99.7%.
- `vitest.config.ts` runs on `happy-dom` and mirrors the `@` → `src` alias. Coverage is v8 with
  `thresholds.perFile` at 80% for lines/functions/branches/statements — a new file below 80% fails
  the run, so add tests alongside new modules. **`pnpm test` does not enforce it**; the root CI job
  runs `test:coverage` as a separate step.
- Coverage excludes `src/**/*.test.ts`, `src/**/*.d.ts`, `src/internal-types/**`, and
  `src/index.dev.ts`. `tsconfig.build.json` separately excludes `src/**/*.test.ts` (and a reserved
  `src/__test-utils__/**`), so tests never reach `dist/` or the emitted `.d.ts`. `e2e/` is outside
  both, which is why `e2e:typecheck` is the only thing that typechecks it.
- Covered end to end: the HTML tokenizer/parser and `tNode`, the CSS compiler under `src/css/`,
  `vCSSStyleSheet`, every attribute and node part (including `arrayDiff` and `ContainerPart`), the
  directives, hooks/`observableComponent`/`defineCustomElement`, observable + scheduler, context,
  the store (440-line suite over generator actions and `pipe`), `hmr`, and `reduxDevtools`.

**E2E — `pnpm --filter @dineug/r-html e2e`** (Playwright, Chromium), with `e2e:dev` (UI mode),
`e2e:headed`, `e2e:report` and `e2e:typecheck`. It does **not** run in `pnpm test`; CI gives it its
own `r-html-e2e` job because it needs a browser download. See `e2e/README.md`.

- Everything lives under `e2e/` — `specs/`, the deterministic page in `fixture/`, and `support/`
  (the typed `window.rHtmlE2E` contract and the `CssPage` page object). `playwright.config.ts` sits
  at the package root. Specs talk to the page through `CssPage`, never hand-rolled `page.evaluate`
  bodies; grow the fixture instead.
- **No build step.** The Vite dev server serves r-html's own `src/` through the `@` alias, so unlike
  the erd-editor suite this one needs no `dist/`. Port **5176** (`E2E_PORT` overrides) — 5174 is
  `@dineug/erd-editor` and 5175 is the app, so all three can run at once. The `webServer` command
  passes `--no-open` because `vite.config.ts` sets `server.open: true` for `pnpm dev`.
- `src/index.dev.ts` is a counter demo and is **not** the fixture. It registers at module scope,
  before any host exists, which is the one ordering the unit suite already covers.
- **Two things in `src/template/vCSSStyleSheet.ts` are true only because a real engine says so**, and
  happy-dom will keep agreeing with us whatever Chromium does. `adoptedStyleSheets` is mutable in
  place, which is what the append fast path rests on; and a *permuted* sheet list is re-resolved only
  if something dirties a rule set the affected elements match, which is why `setGlobalStyleOrder`
  re-runs `replaceSync` over each global's own text. Both are pinned by specs — the second by
  `e2e/specs/chromium-ignores-adopted-sheet-reorder.spec.ts`, which isolates the Chromium behaviour
  with no r-html in it at all. Changing either code path means re-running this suite.
- `e2e/.results` and `e2e/.report` are gitignored at the root (`packages/*/e2e/…`).
- Some specs are `test.fail()`: confirmed browser defects, asserted the *correct* way round so they
  turn red the day the engine is fixed. Playwright prints them as `✘` and counts them as passed.
- **Never assert a wall-clock threshold.** `specs/register-cost.spec.ts` prints benchmark tables and
  asserts only shape — that per-item cost does not grow across an 8x batch range.

`pnpm --filter @dineug/r-html build` remains the type gate — `@rollup/plugin-typescript` runs with
`noEmitOnError: true`. For visual/rendering regressions the editor is still the integration
environment: `pnpm --filter @dineug/erd-editor dev` or `dev:storybook`.

### Common Patterns

- One responsibility per file; each directory has an `index.ts` barrel. Named exports only.
- Components are `FC<Props, Ctx>` functions returning a render closure; the second type parameter
  augments the ctx object, which always carries `host`, `parentElement`, and `dispatchEvent`.
- Seven lifecycle hooks, all backed by `Symbol.for` keys in `constants.ts`: `onBeforeMount`,
  `onMounted`, `onUnmounted`, `onBeforeFirstUpdate`, `onBeforeUpdate`, `onFirstUpdated`, `onUpdated`.
- Store actions are created with `createAction`; generator actions (`action$`) are composed and
  flattened by `compositionActionsFlat`.
- Parts implement the `Part` interface (`commit(value)`, optional `destroy()`); a new value kind means
  a new part class registered in `render/part/node/text/helper.ts` (`PartType`, `isPartMap`, `partMap`).

## Dependencies

### Internal

None — leaf package.

### External

Runtime: `stylis` 4.4.0 — the CSS compiler's parser/serializer.

Build/test-only: `vite` 8 (Rolldown), `vite-plugin-dts` 5, `@rollup/plugin-typescript` 12,
`typescript` 5.8.2, `tslib`, `vitest` 4, `@vitest/coverage-v8`, `happy-dom` 20,
`@playwright/test` 1.62 (pinned to the same range as `@dineug/erd-editor` and the app, so one
browser download serves all three).

### Consumers

`@dineug/erd-editor` — templates, components, store, context, and observables.
`@dineug/vite-plugin-r-html` — pairs with `src/render/hmr.ts`.

<!-- MANUAL: -->
