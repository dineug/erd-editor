<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-16 -->

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
| `vite.config.ts`       | `run.tasks` type gates + ESM-only lib build (banner, `BROWSER_TARGET`) + dts     |
| `vitest.config.ts`     | happy-dom env, `src/**/*.test.ts`, v8 coverage with **per-file 80% thresholds**  |
| `playwright.config.ts` | Chromium e2e — `e2e/specs`, pinned 1280x720, `vp dev` `webServer` on port 5176   |
| `tsconfig.json`        | The type-gate program — `include: ["src"]`, so the specs are gated too           |
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
- **`build` and `test` are tasks, not scripts.** Both live in `vite.config.ts`'s `run.tasks`, and the
  same-named `package.json` scripts were deleted — a task and a script sharing a name make the task
  graph fail to load. Invoke them as
  `pnpm exec vp run --filter @dineug/r-html --fail-if-no-match <task>`; the root `pnpm build` and
  `pnpm test` (`vp run -r <task>`) sweep them up. `pnpm --filter @dineug/r-html build` is now an
  `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT` exit 1 — loud, at least. Everything else here (`dev`,
  `test:dev`, `test:coverage`, the five `e2e*` entries) is still a script and keeps the
  `pnpm --filter` form.
- **The browser floor is not decided here.** `build.target` reads `BROWSER_TARGET` from the root
  `build-target.ts` (chrome87 / edge88 / firefox78 / safari14.1) — the single value all nine library
  builds import. Raising it is a workspace decision, and this package cannot narrow it on its own.
- `private: true` — internal to the workspace, so `version` (0.1.3) is not published.

### Testing Requirements

Two suites, and the split between them is not about speed — it is about what each environment is
capable of observing. Vitest runs on happy-dom, which has **no style engine at all**: it never
computes a value and never resolves a cascade, so every styling assertion it can make is really an
assertion about bookkeeping. The Playwright suite exists for the rest.

**Unit — `pnpm exec vp run --filter @dineug/r-html --fail-if-no-match test`**, a `run.tasks` entry
whose `command` is `['tsc --noEmit', 'vp test run']`. The root `pnpm test` (`vp run -r test`) picks
the same task up, so it inherits that task's cache key and its `dependsOn`. `test:dev`
(`vp test dev`, watch) and `test:coverage` (`vp test run --coverage`) are still plain scripts.

- ⚠️ **The built-in `vp test` skips the type gate.** `vp test` and `vp build` ignore `run.tasks`
  altogether, so they run vitest / the bundler without the `tsc --noEmit` that precedes them. Nothing
  warns — the suite just goes green with the types unread. CI and every command here use `vp run`.
- Tests are colocated as `src/**/*.test.ts`; **every module under `src/` has one except
  `src/index.dev.ts`** (76 files / 1457 tests, ~7s). Coverage: statements 99.5%, branches 97.9%,
  functions 99.4%, lines 99.7%.
- `vitest.config.ts` runs on `happy-dom` and mirrors the `@` → `src` alias. Specs import their
  runner API from `vite-plus/test`, not from `vitest` — the `vite-plus/prefer-vite-plus-imports`
  lint rule in the root config is what keeps that from drifting back. Coverage is v8 with
  `thresholds.perFile` at 80% for lines/functions/branches/statements — a new file below 80% fails
  the run, so add tests alongside new modules. **`pnpm test` does not enforce it**; the root CI job
  runs `test:coverage` as a separate step.
- Coverage excludes `src/**/*.test.ts`, `src/**/*.d.ts`, `src/internal-types/**`, and
  `src/index.dev.ts`. `tsconfig.build.json` separately excludes `src/**/*.test.ts` (and a reserved
  `src/__test-utils__/**`), so tests never reach `dist/` or the emitted `.d.ts`.
- **The type gate reads the specs now.** The task's `tsc --noEmit` runs against `tsconfig.json`,
  which is `include: ["src"]` with no `exclude` — all 76 spec files are in the program (counted with
  `tsc --noEmit --listFiles`). The gate used to run through `tsconfig.build.json`, which excludes
  them, so a type error in a spec was simply invisible. `e2e/` is in neither program, which is why
  `e2e:typecheck` (`tsc -p e2e/tsconfig.json`) is still the only thing that typechecks it; and
  `vite.config.ts` / `vitest.config.ts` are in neither either — the root `tsconfig.json` `include`
  reaches out for those, under `pnpm check`.
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
- **No build step.** The `vp dev` server serves r-html's own `src/` through the `@` alias, so unlike
  the erd-editor suite this one needs no `dist/`. Port **5176** (`E2E_PORT` overrides) — 5174 is
  `@dineug/erd-editor` and 5175 is the app, so all three can run at once. `webServer.command` is
  `pnpm exec vp dev`, and since `vp dev` has no `--no-open` flag the headless run is arranged through
  the environment instead: `server.open` is `!process.env.E2E` and the `webServer` block sets
  `E2E: '1'`. Drop that env and every local run pops a browser.
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

`pnpm exec vp run --filter @dineug/r-html --fail-if-no-match build` is the other half of the type
gate — its `command` is `['tsc --noEmit', 'vp build']`, the same pairing the `test` task uses. The
`@rollup/plugin-typescript` that used to do this emitted nothing at all (it ran purely for its
diagnostics); removing it left `dist/` byte-identical, and `tsc --noEmit` reports the same errors for
both tasks.

⚠️ **`tsc` is a Go binary in TypeScript 7, so Vite Task's automatic file tracking never sees what it
reads.** That is why both tasks spell their `input` out by hand — `src/**`, `vitest.config.*`,
`package.json`, both tsconfigs, and the root `tsconfig.app.json` they extend. Widen
`tsconfig.json`'s `include` without widening `input` and the gate goes stale behind a cache hit:
green, and reading nothing new. (r-html is a leaf, so unlike every other package its `input` carries
no `packages/<dep>/dist/**/*.d.ts` glob — which is also why `scripts/check-task-inputs.mjs` has
nothing to say about it.) `build` declares `output: ['dist/**']`; without it a cache hit replays the
log and restores no artifact.

For visual/rendering regressions the editor is still the integration environment:
`pnpm --filter @dineug/erd-editor dev` or `dev:storybook`.

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

Build/test-only: `vite-plus` 0.2.9 and `vite` — which is a catalog alias for
`@voidzero-dev/vite-plus-core@0.2.9`, so **there is no `vite` binary in `node_modules/.bin`** and any
command written as `vite build` / `vite serve` is dead on arrival; `vite-plugin-dts` 5,
`typescript` 7.0.2 (a single version across the workspace, pinned by `pnpm-workspace.yaml`
`overrides`), `@typescript/typescript6` 6.0.2 — carried only because `vite-plugin-dts` still calls
the JS Compiler API TypeScript 7 dropped — `tslib`, `vitest` 4.1.10, `@vitest/coverage-v8`,
`happy-dom` 20, `@playwright/test` 1.62 (pinned to the same range as `@dineug/erd-editor` and the
app, so one browser download serves all three).

### Consumers

`@dineug/erd-editor` — templates, components, store, context, and observables.
`@dineug/vite-plugin-r-html` — pairs with `src/render/hmr.ts`.

<!-- MANUAL: -->
