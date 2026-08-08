<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-08 -->

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

| File                   | Description                                                                    |
| ---------------------- | ------------------------------------------------------------------------------ |
| `src/index.ts`         | The public API surface — explicit named re-exports, the authoritative contract |
| `src/index.dev.ts`     | Dev-server entry for `pnpm --filter @dineug/r-html dev`                        |
| `src/constants.ts`     | Marker/sentinel strings used by the parsers and part system                    |
| `src/reduxDevtools.ts` | Optional Redux DevTools bridge for the store                                   |

## Subdirectories

| Directory                         | Purpose                                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/template/`                   | `html`/`svg`/`css` tag functions, `tNode`/`tcNode`/`rcNode` template AST, `vCSSStyleSheet` (adopted stylesheets + shadow-host rewriting)                |
| `src/parser/`                     | `html/` and `css/` tokenizers and their virtual-node builders (`vNode`, `vcNode`)                                                                       |
| `src/render/`                     | DOM commit layer — see below                                                                                                                            |
| `src/render/part/`                | Fine-grained update units: `attribute/` (attribute, boolean, property, event, spread, directive) and `node/` (text, comment, component)                 |
| `src/render/part/node/text/`      | Value-kind dispatch (`primitive`, `object`, `array`, `function`, `node`, `directive`) plus `arrayDiff.ts`, the keyed list reconciler                    |
| `src/render/part/node/component/` | `observableComponent.ts` (the `FC` model), `hooks.ts` lifecycle hooks, `prop.ts`, and `webComponent/` (`defineCustomElement`, shadow-DOM query helpers) |
| `src/render/directives/`          | Built-in directives — node (`cache`, `repeat`, `innerHTML`) and attribute (`ref`) — plus `createNodeDirective`/`createAttributeDirective` factories     |
| `src/render/hmr.ts`               | HMR entry point cooperating with `@dineug/vite-plugin-r-html`                                                                                           |
| `src/observable/`                 | `observable`/`observer`/`watch` reactivity and `scheduler.ts` (`nextTick` batching)                                                                     |
| `src/store/`                      | `createStore`, `createAction`, `compositionActionsFlat`, and the `Reducer`/`GeneratorAction` types                                                      |
| `src/context/`                    | `createContext` / `useProvider` / `useContext` dependency injection                                                                                     |
| `src/helpers/`                    | Internal array/function/type-guard helpers and `subject.ts`                                                                                             |
| `src/internal-types/`             | Ambient declarations (`index.d.ts`)                                                                                                                     |

## For AI Agents

### Working In This Directory

- **`src/index.ts` is the contract.** It lists every export explicitly. A symbol not named there is
  private, regardless of whether the file exports it — do not import deep paths from consumers.
- **Parser and part system are tightly coupled.** The tokenizers emit marker strings from
  `src/constants.ts` that the render layer scans for. Changing a marker requires changing both sides.
- **Reactivity is Proxy-based and batched.** Updates go through `observable/scheduler.ts`; synchronous
  DOM reads after a state write need `nextTick`.
- **Web component boundary:** `defineCustomElement` attaches shadow roots and adopts stylesheets built
  by `template/vCSSStyleSheet.ts`. CSS written with the `css` tag is host-rewritten
  (`addCSSHost`/`removeCSSHost`) — plain `<style>` injection will not behave the same.
- `arrayDiff.ts` is the performance-critical path for large diagrams. Preserve its keyed-diff semantics.
- `private: true` — internal to the workspace.

### Testing Requirements

- No `test` target. Verify with `pnpm --filter @dineug/r-html build` for type safety, then exercise
  behaviour through the editor (`pnpm --filter @dineug/erd-editor dev`), which is the only real
  consumer and covers templates, parts, directives, hooks, and the store together.
- Rendering regressions are easiest to catch in the editor's Storybook:
  `pnpm --filter @dineug/erd-editor dev:storybook`.

### Common Patterns

- One responsibility per file; each directory has an `index.ts` barrel.
- Components are `FC<Props, Element>` functions returning a render closure; lifecycle is expressed via
  `onBeforeMount` / `onMounted` / `onBeforeUpdate` / `onUpdated` / `onUnmounted`.
- Store actions are created with `createAction`; generator actions (`action$`) are composed and
  flattened by `compositionActionsFlat`.

## Dependencies

### Internal

None — leaf package.

### External

Build-only: `vite`, `vite-plugin-dts`, `@rollup/plugin-typescript`, `tslib`.

### Consumers

`@dineug/erd-editor` — templates, components, store, context, and observables.
`@dineug/vite-plugin-r-html` — pairs with `src/render/hmr.ts`.

<!-- MANUAL: -->
