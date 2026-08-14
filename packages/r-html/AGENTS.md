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
2. **Parser** — hand-written HTML and CSS tokenizers that turn template strings into `tNode`/`tcNode`.
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
| `tsconfig.build.json`  | Build/dts view of `tsconfig.json` that excludes `src/**/*.test.ts`               |

## Subdirectories

| Directory                         | Purpose                                                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/template/`                   | `html`/`svg`/`css` tag functions, `tNode`/`tcNode`/`rcNode` template AST, `helper.ts` (marker/attr-type predicates), `vCSSStyleSheet` (adopted stylesheets + shadow-host rewriting)               |
| `src/parser/`                     | `html/` and `css/` tokenizers and their virtual-node builders (`vNode`, `vcNode`)                                                                                                                 |
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

## For AI Agents

### Working In This Directory

- **`src/index.ts` is the contract.** It lists every export explicitly. A symbol not named there is
  private, regardless of whether the file exports it — do not import deep paths from consumers.
  Current surface: `html`/`svg`/`css`, `render`, `addCSSHost`/`removeCSSHost`/`cssUnwrap`,
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

- **There is a full Vitest suite** — `pnpm --filter @dineug/r-html test` (`vitest run`), plus
  `test:dev` (watch) and `test:coverage`. Nx picks the `test` target up through `pnpm test` at the
  root, so it inherits `cache: true` and `dependsOn: ["^build"]`.
- Tests are colocated as `src/**/*.test.ts`; **every module under `src/` has one except
  `src/index.dev.ts`** (70 files / 1080 tests, ~5s). Coverage: statements 99.3%, branches 97.7%,
  functions 99.4%, lines 99.5%.
- `vitest.config.ts` runs on `happy-dom` (no browser) and mirrors the `@` → `src` alias. Coverage is
  v8 with `thresholds.perFile` at 80% for lines/functions/branches/statements — a new file below 80%
  fails the run, so add tests alongside new modules.
- Coverage excludes `src/**/*.test.ts`, `src/**/*.d.ts`, `src/internal-types/**`, and
  `src/index.dev.ts`. `tsconfig.build.json` separately excludes `src/**/*.test.ts` (and a reserved
  `src/__test-utils__/**`), so tests never reach `dist/` or the emitted `.d.ts`.
- Covered end to end: both tokenizers/parsers and their AST builders, `tNode`/`tcNode`/`rcNode`,
  `vCSSStyleSheet`, every attribute and node part (including `arrayDiff` and `ContainerPart`),
  the directives, hooks/`observableComponent`/`defineCustomElement`, observable + scheduler,
  context, the store (440-line suite over generator actions and `pipe`), `hmr`, and `reduxDevtools`.
- `pnpm --filter @dineug/r-html build` remains the type gate — `@rollup/plugin-typescript` runs with
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

Build/test-only (no runtime deps): `vite` 8 (Rolldown), `vite-plugin-dts` 5,
`@rollup/plugin-typescript` 12, `typescript` 5.8.2, `tslib`, `vitest` 4, `@vitest/coverage-v8`,
`happy-dom` 20.

### Consumers

`@dineug/erd-editor` — templates, components, store, context, and observables.
`@dineug/vite-plugin-r-html` — pairs with `src/render/hmr.ts`.

<!-- MANUAL: -->
