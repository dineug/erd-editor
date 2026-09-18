<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-09-19 -->

# r-html

## Purpose

`@dineug/r-html` (private) is the rendering framework `@dineug/erd-editor` is built on: `html` / `svg` / `css` tagged templates, Proxy reactivity batched by a microtask scheduler, function components with lifecycle hooks and `defineCustomElement`, and a Redux-like `createStore`. The renderer is host-neutral: `createHostTemplate(adapter)` builds an `html` / `svg` / `render` triple over any `HostAdapter`. The DOM adapter ships here; `packages/erd-editor/src/konva/host.ts` is the second production host.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | The runtime contract; anything not re-exported is private. `removeCSSHost` is absent on purpose — only `defineCustomElement`'s element calls it |
| `src/render/adapter.ts` | `HostAdapter` (24 methods) and `HostNode`; its contract is the MANUAL section below |
| `src/render/hostTemplate.ts` | `createHostTemplate(adapter)` — each instance owns its container cache and `HostHelper` |
| `src/render/domAdapter.ts` | The DOM adapter, the only one in `dist/`; `src/render/index.ts` is its `createHostTemplate` instance |
| `src/render/helper.ts` | `createHostHelper`, `domHelper`, and the DOM-bound named exports (`createNode`, `setAttr`, `isHostNode`/`isNode`, …) |
| `src/render/__fake-host__/` | Test-only in-memory host with a call-counting adapter; excluded from `tsconfig.build.json` |
| `src/render/part/node/text/helper.ts` | `PartType`, `getPartType`, `isPartMap`, `partMap` |
| `src/jsx-runtime.ts` | The `JSX` namespace `jsxImportSource` reads |
| `src/constants.ts` | `MARKER` (random suffix per load), its regexps, `TAttrType`, lifecycle `Symbol.for` keys |
| `src/template/vCSSStyleSheet.ts` | Adopted-stylesheet registry with `<style>` fallback |
| `src/index.dev.ts` | Demo entry for `pnpm --filter @dineug/r-html dev`; not the e2e fixture |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/template/` | The tags, the `tNode` template AST, CSS source/diagnostics, `vCSSStyleSheet` |
| `src/css/` | stylis pipeline: `compile`, `flatten`, `selector` (scoping), `emit`, `hash`, `diagnostics` |
| `src/parser/` | HTML tokenizer (`html/`) and the virtual-node builder (`vNode.ts`) |
| `src/render/` | The host seam, `hmr.ts`, `directives/` (`cache`, `repeat`, `innerHTML`, `ref`) |
| `src/render/part/` | Update units: `attribute/`, and `node/` (text value kinds, `arrayDiff`, `component/`) |
| `src/observable/`, `src/store/` | `observable` / `observer` / `watch` + `scheduler.ts`; `createStore` / `createAction` |
| `src/context/` | `createContext` / `useProvider` / `useContext` over bubbling `CustomEvent`s |
| `e2e/` | Playwright suite (`specs/`, `fixture/`, `support/`) with its own `tsconfig.json` |

## For AI Agents

### Working In This Directory

- `exports` is asymmetric on purpose: `./jsx-runtime` ships `types` only, so a build that lost its JSX transform fails on `ERR_PACKAGE_PATH_NOT_EXPORTED` instead of rendering wrongly. It must stay a `.ts` file with a namespace (`vite-plugin-dts` does not copy hand-written `.d.ts`), hence its `typescript/no-namespace` exemption in the root `vite.config.ts`.
- `src/parser/` never imports `src/constants.ts`. `MARKER` is written by `template/html.ts` and read only by `template/helper.ts` and `template/tNode.ts`; those three change together.
- Updates are batched through `observable/scheduler.ts`: a host read right after a state write still sees the old tree — `await nextTick()` first.
- `helpers/array.ts` `groupBy` accumulates into `Object.create(null)`, so an attribute named `constructor` does not hit an inherited function.
- A new text-position value kind needs a `Part` wired into `PartType`, `getPartType`, `isPartMap` and `partMap` together.
- A new lifecycle hook needs its `Symbol.for` key in `constants.ts` and its hook in `render/part/node/component/hooks.ts`.

### Testing Requirements

- `pnpm exec vp run --filter @dineug/r-html --fail-if-no-match test` (happy-dom).
- **Coverage is CI-gated here**, unlike other packages: the `ci` job runs `pnpm --filter @dineug/r-html test:coverage`, so a file under `perFile` 80% fails CI.
- **The specs that predate the host seam are frozen**: they are the only proof the seam refactor preserved DOM behaviour. Add specs or cases freely, never change or delete an existing one. `git diff --numstat --diff-filter=MD 3a524e6e -- 'packages/r-html/src/**/*.test.ts'` must show zero deletions.
- happy-dom has no style engine, so `vCSSStyleSheet.ts`'s `adoptedStyleSheets` behaviour is pinned only by the e2e specs: `pnpm --filter @dineug/r-html e2e` after touching it (`vp dev` on :5176, no build step; see `e2e/README.md`). CI runs it and `e2e:typecheck`, the only program covering `e2e/`.

### Common Patterns

- Components are `FC<Props, Ctx>` returning a render closure; `ctx` always carries `host`, `parentElement` and `dispatchEvent`.

## Dependencies

### Internal

None — leaf package. `@dineug/vite-plugin-r-html` pairs with `hmr.ts` by event contract only.

### External

`stylis` 4.4.0 is the only runtime dependency (the `css` pipeline).

<!-- MANUAL: notes added below this line are preserved on regeneration -->

## Host adapter contract

`HostAdapter` is 24 methods in six groups — creation (5), tree (6), value (3), discrimination (5), event (2), root and context (3). A host that breaks a clause breaks `repeat`, `cache` or the component context, not just its own rendering; `src/render/fakeHost.test.ts` holds each one.

1. **Inserting a fragment is a child splice.** `appendChild`, `insertBefore` and `prependChild` given an `isFragment` node insert its children in order and leave it empty. `cache` parks a range into a fragment and reinserts it whole, so the interleaved order of markers and real nodes must survive.
2. **The host owns sibling order.** `rangeNodes` walks only `nextSiblingOf`; a host keeping its own ledger must project it onto its child order, never the reverse.
3. **Every text-position interpolation asks for a text node**, even on a text-less host: `render/part/index.ts` builds a transient marker-only node through `createNode`, which `TextPart` removes in its constructor (one interpolation = two `createText`, one `removeChild`). A text-less host answers `createText` and throws from `setText`, the `PrimitivePart` backstop.
4. **A marker is a host node, not a comment.** Nothing outside the adapter may assume a marker renders or belongs to the host's real tree.
5. **A whole-attribute value reaches the host raw** (see Attribute values below).
6. **The component context and fragment bridges belong to the host.** `createComponentContext(startNode, eventBus)` builds `ctx`; `bridgeFragment(fragment, root)` makes a parked fragment behave as if still under `root` and returns one destroy.

`innerHTML` and `vCSSStyleSheet` are DOM primitives outside the seam; do not adapt them for another host.

### Helper

- `createHostHelper(adapter)` **spreads** the adapter into the `HostHelper`, so an adapter must expose its methods as own enumerable properties — an object literal, not a class instance.
- Every Part that reaches the host through the adapter, and `ContainerPart`, takes the helper as a constructor parameter defaulting to `domHelper`; a new one must accept and forward it, or it writes through the DOM under any host.
- `getPartType` reads the module-level, DOM-bound `isHostNode` (`arrayDiff.ts` calls it with no helper), so under a non-DOM host a raw host node as a template value becomes an `ObjectPart`, not a `NodePart`.

### Node directives

`NodeDirectiveProps` is `{ startNode, endNode, helper? }`. `helper` is non-enumerable, so keys, spreads and equality see the marker pair alone; build props only through `createNodeDirectiveProps`. A creator called directly gets no helper and defaults to `domHelper`. `createNodeDirective`'s marker type defaults to `Comment`; `repeat` and `cache` are host-neutral, `innerHTML` is DOM-only.

### Attribute values: one marker vs many

`AttributePart` (outside `class` and `style`, which commit separately) decides once whether the attribute text is exactly one marker. One marker → `setAttribute(node, name, value, true)` with the raw value (the DOM adapter stringifies with `safeToString` in `src/render/value.ts`). Several markers → one `String.prototype.replace` per marker, which still reads `$&`, `$$` etc. as substitution patterns; one marker inserts them literally. `attribute.singleMarker.test.ts` pins both halves.

### The fake host

`__fake-host__/tree.ts` is a doubly linked in-memory tree; `adapter.ts` counts every call, so specs assert the shape of host work. The `fake host reconciliation cost` specs in `fakeHost.test.ts` are the gate: per-node host-call bounds for inserting and reversing 1000 nodes and linear growth with list size fail if per-call reconciliation ever replaces per-commit reconciliation.
