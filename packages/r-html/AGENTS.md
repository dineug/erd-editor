<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-10-24 -->

# r-html

## Purpose

`@dineug/r-html` (private) is the rendering framework `@dineug/erd-editor` is built on and inlines; `mcp-server` imports its store's action types. It provides `html` / `svg` / `css` tagged templates, Proxy reactivity batched by a microtask scheduler, function components with lifecycle hooks, `createCustomElement` (a component as an unregistered element class) and `defineCustomElement` (that class registered under a tag), and a Redux-like `createStore`. The renderer is host-neutral: `createHostTemplate(adapter)` builds an `html` / `svg` / `render` triple over any `HostAdapter`. The DOM adapter ships here, and `@dineug/r-html-konva` (`packages/r-html-konva/src/host.ts`) is the second production host, the one every Konva scene renders through. A change keeps the DOM behaviour the frozen specs pin (Testing Requirements) and the host adapter contract both hosts rest on (Rules).

## Making a Change

1. Read this file (root step 1). For a change to the host seam (`HostAdapter`, `HostNode`, `createHostTemplate`, a Part that writes through the helper), also read `packages/r-html-konva/AGENTS.md`, the file for its `src/host.ts`, the Konva `HostAdapter`. For a change to `src/render/hmr.ts`, read `packages/vite-plugin-r-html/AGENTS.md`, the other side of its event contract. For a change to an export or a type, read `packages/erd-editor/AGENTS.md`, and `packages/mcp-server/AGENTS.md` where the store's action types change.
2. Write the change with what it carries (root step 2). A new text-position value kind or lifecycle hook goes into every place Rules § Parts and lifecycle hooks lists. Add new specs or cases; leave each spec that predates the host seam as it is (Testing Requirements).
3. Run root step 3 as `pnpm exec vp run --filter @dineug/r-html --fail-if-no-match test`. Run `pnpm test` as well for a change to an export, a type or the host seam. `erd-editor`, `r-html-konva`, `grid` and `mcp-server` type-check against this package's `dist/**/*.d.ts`, and `r-html-konva`'s Konva host implements `HostAdapter`.
4. After a change to any spec file, run the frozen-spec check and confirm every line shows zero deletions:

   ```
   git diff --numstat --diff-filter=MD 3a524e6e -- 'packages/r-html/src/**/*.test.ts' ':!packages/r-html/src/css/compile.behaviour.test.ts'
   ```

5. Run root step 4 as `pnpm --filter @dineug/r-html --fail-if-no-match test:coverage`. It measures every `src/**/*.ts` but the specs, `.d.ts` files, `src/internal-types/**`, `src/index.dev.ts` and the types-only `src/jsx-runtime.ts`. A drop under `src/css/` means a rule class no longer runs (Testing Requirements).
6. Run root step 5 with `pnpm peer-graph`, `pnpm dist-shape`, `pnpm consumer-bundles` and `pnpm size` for any change to shipping source. `erd-editor` inlines this package and its `peer.js` reaches it (`src/peer/imports.test.ts` there lists it), so the peer graph rules in `packages/erd-editor/src/peer/AGENTS.md` hold for that code too.
7. For root step 6, run `pnpm --filter @dineug/r-html e2e` after touching `src/template/vCSSStyleSheet.ts`. Run `pnpm --filter @dineug/r-html e2e:typecheck` after touching `e2e/`, `playwright.config.ts` or an export of `src/index.ts`. The fixture imports `@/index`, and no other program covers `e2e/`. A run that cannot start for want of Chromium is not done (root § Making a Change, after step 7). Run `pnpm --filter @dineug/erd-editor e2e` for a change a user would see in the editor.
8. In the report (root step 7), say whether the r-html e2e ran, and the reason where it did not.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | The runtime contract (Rules § Package surface) |
| `src/render/adapter.ts` | `HostAdapter` (24 methods) and `HostNode`; its contract is Rules § Host adapter contract |
| `src/render/hostTemplate.ts` | `createHostTemplate(adapter)`; each instance owns its container cache and `HostHelper` |
| `src/render/domAdapter.ts` | The DOM adapter, the only one in `dist/`; `src/render/index.ts` is its `createHostTemplate` instance |
| `src/render/helper.ts` | `createHostHelper`, `domHelper`, and the DOM-bound named exports (`createNode`, `setAttr`, `isHostNode` / `isNode`, …) |
| `src/render/__fake-host__/` | Test-only in-memory host with a call-counting adapter; excluded from `tsconfig.build.json` |
| `src/render/fakeHost.test.ts` | Holds each host adapter clause and the reconciliation cost gate (Testing Requirements) |
| `src/render/part/node/text/helper.ts` | `PartType`, `getPartType`, `isPartMap`, `partMap` |
| `src/jsx-runtime.ts` | The `JSX` namespace `jsxImportSource` reads |
| `src/constants.ts` | `MARKER` (random suffix per load), its regexps, `TAttrType`, the lifecycle `Symbol.for` keys |
| `src/template/vCSSStyleSheet.ts` | Adopted-stylesheet registry with a `<style>` fallback |
| `src/index.dev.ts` | Demo entry for `pnpm --filter @dineug/r-html dev`; not the e2e fixture |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/template/` | The tags, the `tNode` template AST, CSS source and diagnostics, `vCSSStyleSheet` |
| `src/css/` | The stylis pipeline: `compile`, `flatten`, `selector` (scoping), `emit`, `hash`, `diagnostics` |
| `src/parser/` | HTML tokenizer (`html/`) and the virtual-node builder (`vNode.ts`) |
| `src/render/` | The host seam, `hmr.ts`, `directives/` (`cache`, `repeat`, `innerHTML`, `ref`) |
| `src/render/part/` | Update units: `attribute/`, and `node/` (text value kinds, `arrayDiff`, `component/`) |
| `src/observable/`, `src/store/` | `observable` / `observer` / `watch` and `scheduler.ts`; `createStore` / `createAction` |
| `src/context/` | `createContext` / `useProvider` / `useContext` over bubbling `CustomEvent`s |
| `e2e/` | Playwright suite (`specs/`, `fixture/`, `support/`) with its own `tsconfig.json`; `e2e/README.md` describes it |

## Rules

### Package surface

- **`./jsx-runtime` ships types only.** `exports` is asymmetric on purpose: `.` ships `types` and `default`, `./jsx-runtime` `types` alone. A build that lost its JSX transform then fails on `ERR_PACKAGE_PATH_NOT_EXPORTED` instead of rendering wrongly.
- **`src/jsx-runtime.ts` stays a `.ts` file with a namespace.** `jsxImportSource` reads a `JSX` namespace, and `vite-plugin-dts` does not copy a hand-written `.d.ts`. That is why the root `vite.config.ts` exempts the file from `typescript/no-namespace`.
- **`src/index.ts` is the runtime contract.** Anything it does not re-export is private.
- **`createCustomElement` registers nothing; `defineCustomElement` stays its `void` wrapper.** `defineCustomElement(name, options)` is `customElements.define(name, createCustomElement(options))` with its signature unchanged, so the caller of `createCustomElement` picks the tag and the moment to define it, and `new` on the class throws a `TypeError` until then. Each call builds a new class and still mutates `options.shadow` to `'open'` when unset.
- **`createCustomElement` returns the written `CustomElementClass<C>`** (`new (): C` and `observedAttributes`). The class's `#private` fields make an inferred return type fail declaration emit (TS4094), and `C extends HTMLElement` is what lets `customElements.define` take it; `defineCustomElement` keeps its unconstrained `C` and narrows it to `C & HTMLElement` inside.
- **`removeCSSHost` stays out of `src/index.ts` on purpose.** Only the element class `createCustomElement` builds calls it, from its `disconnectedCallback`.

### Templates and markers

- **`src/parser/` never imports `src/constants.ts`.** The parser tokenizes plain HTML and knows nothing of markers.
- **Change the three marker files together.** `MARKER` is written by `template/html.ts` and read only by `template/helper.ts` and `template/tNode.ts`.
- **`groupBy` accumulates into `Object.create(null)`.** `template/tNode.ts` groups attributes by name with the `groupBy` in `helpers/array.ts`, so an attribute named `constructor` does not hit an inherited function.

### Reactivity

- **Await `nextTick()` before reading the host.** Updates are batched through `observable/scheduler.ts`, so a host read right after a state write still sees the old tree.

### Parts and lifecycle hooks

- **A new text-position value kind needs four entries.** Its `Part` goes into `PartType`, `getPartType`, `isPartMap` and `partMap` together (`src/render/part/node/text/helper.ts`).
- **A new lifecycle hook goes in four places.**
  - Its `Symbol.for` key in `src/constants.ts`, listed there in `LifecycleName` and in `LIFECYCLE_NAMES`, the list `clearAllLifecycleHooks` resets.
  - Its hook in `src/render/part/node/component/hooks.ts`.
  - A `lifecycleHooks` call at its point in both runners beside it, `observableComponent.ts` and `webComponent/index.ts`, because each runner fires only the keys it names.
  - A re-export from `src/index.ts`.

### Host adapter contract

- **`HostAdapter` has 24 methods in six groups.** They are creation (5), tree (6), value (3), discrimination (5), event (2), and root and context (3). A host that breaks a clause below breaks `repeat`, `cache` or the component context, not just its own rendering. `src/render/fakeHost.test.ts` holds each clause.
- **Inserting a fragment is a child splice.** Given an `isFragment` node, `appendChild`, `insertBefore` and `prependChild` insert its children in order and leave it empty. `cache` parks a range in a fragment and reinserts it whole, so the interleaved order of markers and real nodes must survive.
- **The host owns sibling order.** `rangeNodes` walks only `nextSiblingOf`. A host that keeps its own ledger projects that ledger onto its child order, never the reverse.
- **Every text-position interpolation asks for a text node.** This holds on a text-less host too. `render/part/index.ts` builds a transient marker-only node through `createNode`, which `TextPart` removes in its constructor. One interpolation costs two `createText` calls and one `removeChild`. A text-less host answers `createText` and throws from `setText`, the `PrimitivePart` backstop.
- **A marker is a host node.** It is not a comment: nothing outside the adapter may assume a marker renders or belongs to the host's real tree.
- **A whole-attribute value reaches the host raw.** § Attribute values below gives the rule.
- **The host builds the context and fragment bridges.** `createComponentContext(startNode, eventBus)` builds `ctx`. `bridgeFragment(fragment, root)` makes a parked fragment behave as if still under `root` and returns one destroy function.
- **Keep `innerHTML` and `vCSSStyleSheet` on the DOM.** They are DOM primitives outside the seam; do not adapt them for another host.

### Host helper

- **Write an adapter as an object literal.** `createHostHelper(adapter)` spreads the adapter into the `HostHelper`, so only its own enumerable properties arrive; a class instance's methods would not.
- **Every host-reaching Part takes the helper.** Each Part that reaches the host through the adapter, and `ContainerPart`, takes the helper as a constructor parameter defaulting to `domHelper`. A new one accepts and forwards it; otherwise it writes through the DOM under any host.
- **`getPartType` reads the DOM-bound `isHostNode`.** It uses the module-level `isHostNode`, because `arrayDiff.ts` calls it with no helper. Under a non-DOM host, a raw host node as a template value therefore becomes an `ObjectPart`, not a `NodePart`.

### Node directives

- **Build directive props only through `createNodeDirectiveProps`.** `NodeDirectiveProps` is `{ startNode, endNode, helper? }`, and `helper` is non-enumerable. Keys, spreads and equality therefore see the marker pair alone.
- **A creator called directly writes through the DOM.** It gets no helper, so it defaults to `domHelper`.
- **`createNodeDirective`'s marker type defaults to `Comment`.** `repeat` and `cache` are host-neutral; `innerHTML` is DOM-only.

### Attribute values

- **`AttributePart` checks once for a single marker.** Outside `class` and `style`, which commit separately, it decides once whether the attribute text is exactly one marker.
- **One marker passes the raw value.** The part calls `setAttribute(node, name, value, true)` with the raw value. The DOM adapter stringifies it with `safeToString` in `src/render/value.ts`.
- **Several markers go through `String.prototype.replace`.** One `replace` per marker still reads `$&`, `$$` and the like as substitution patterns, while a single marker inserts them literally. `attribute.singleMarker.test.ts` pins both halves.

## Testing Requirements

- **The `test` task runs Vitest in happy-dom**, after `tsc --noEmit` (Making a Change step 3).
- **Cover each CSS rule class with a case.** Read a coverage drop in `src/css/` as a rule class no longer run. The CSS compiler is reached through one narrow seam: `template/css.ts` calls `compileToRules`. A whole rule class can stop being exercised without a test going red, so `test:coverage`'s `perFile` 80% gate is the only signal. Cover the drop with a case that runs that class.
- **Specs predating the host seam are frozen.** They are the only proof the seam refactor preserved DOM behaviour. Add specs or cases freely, and change or delete no existing one; the check in Making a Change step 4 must show zero deletions. `src/css/compile.behaviour.test.ts` alone has lost cases since. Its three 69 KB real-stylesheet cases, with the helper that found their input, went with the vendored stylesheet `erd-editor` dropped (an owner decision of 2026-10-05).
- **The e2e specs alone pin `adoptedStyleSheets` behaviour.** happy-dom has no style engine, so only they pin how `vCSSStyleSheet.ts` uses `adoptedStyleSheets`. `pnpm --filter @dineug/r-html e2e` serves `vp dev` on port 5176 with no build step (`e2e/README.md`).
- **Run this e2e apart from `app`'s.** `app`'s e2e relay takes port 5176 too, so run the two at different times or move one (`E2E_PORT` here, `E2E_RELAY_PORT` there).
- **`e2e:typecheck` is the only program covering `e2e/`.** CI runs `e2e:typecheck` and `e2e` for this package.
- **The fake host measures host work.** `src/render/__fake-host__/tree.ts` is a doubly linked in-memory tree, and its `adapter.ts` counts every call, so specs assert the shape of host work.
- **The reconciliation cost specs are a gate.** The `fake host reconciliation cost` specs in `fakeHost.test.ts` bound host calls per node for inserting and reversing 1000 nodes. They also check that the cost grows linearly with list size. They fail if per-call reconciliation ever replaces per-commit reconciliation.

## Common Patterns

- Components are `FC<Props, Ctx>` returning a render closure; `ctx` always carries `host`, `parentElement` and `dispatchEvent`.

## Dependencies

### Internal

None: a leaf package. `@dineug/vite-plugin-r-html` pairs with `src/render/hmr.ts` by event contract only (`packages/vite-plugin-r-html/AGENTS.md`).

### External

`stylis` (`^4.4.0` through the catalog) is the only runtime dependency (the `css` pipeline).

<!-- MANUAL: notes added below this line are preserved on regeneration -->
