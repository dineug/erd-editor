<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-08-27 -->

# r-html

## Purpose

`@dineug/r-html` is the in-house rendering framework `@dineug/erd-editor` is built on. It supplies tagged templates (`html`, `svg`, `css`) compiled to a virtual node tree, Proxy-based reactivity with a microtask scheduler, a functional component model with lifecycle hooks and a `defineCustomElement` adapter, and a Redux-like `createStore`. A second, types-only entry at `./jsx-runtime` carries the JSX contract those templates can also be written in. `private: true`, so its `version` is never published; `vite-plugin-r-html` is the separate build-time JSX/HMR integration.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | The public API — named re-exports, plus `export *` over the two directive barrels; anything else is private |
| `src/jsx-runtime.ts` | The `JSX` namespace behind `jsxImportSource`; intrinsic tags derived from the DOM lib's tag-name maps |
| `src/constants.ts` | `MARKER` (per-load random suffix) and its regexps, `TAttrType`, 7 lifecycle `Symbol.for` keys |
| `src/template/vCSSStyleSheet.ts` | Adopted-stylesheet registry: one sheet per template, global/component cascade buckets, `<style>` fallback |
| `src/render/part/node/text/helper.ts` | `PartType`, `getPartType`, and the `isPartMap`/`partMap` registries every value kind goes through |
| `vite.config.ts` | `run.tasks` (`build`, `test`, both prefixed by `tsc --noEmit`), ESM lib build, `vite-plugin-dts` |
| `vitest.config.ts` | `happy-dom`, `src/**/*.test.ts`, v8 coverage and the `jsx-runtime`/test-utils exclusions |
| `playwright.config.ts` | Chromium e2e against `vp dev` on port 5176, viewport pinned 1280x720 |
| `tsconfig.build.json` | Build/dts view — excludes `src/**/*.test.ts`, `src/__test-utils__/**` and `src/render/__fake-host__/**` so specs, mount helpers and the fake host never reach `dist/` |
| `src/index.dev.ts` | Development-only demo entry; separate from the Playwright fixture |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/template/` | `html`/`svg`/`css` tags, the `tNode` template AST, `cssSource`, `cssDiagnostics`, `vCSSStyleSheet` |
| `src/css/` | stylis-based CSS pipeline: `compile`, `flatten`, `selector` (scoping), `emit`, `hash`, `diagnostics` |
| `src/parser/` | HTML tokenizer (`html/`) and the virtual-node builder (`vNode.ts`) |
| `src/render/` | `createHostTemplate` and the DOM instance it exports, the `HostAdapter` seam (`adapter.ts`, `domAdapter.ts`), the second implementation of it in `__fake-host__/`, DOM helpers, shadow-host bridge, `hmr.ts`, `directives/` |
| `src/render/part/` | Fine-grained update units — `attribute/` and `node/` (text kinds, `arrayDiff`, `component/`) |
| `src/observable/`, `src/store/` | `observable`/`observer`/`watch` + `scheduler.ts` batching; `createStore`/`createAction`/`compositionActionsFlat` |
| `src/context/`, `src/helpers/` | `createContext`/`useProvider`/`useContext` DI over bubbling `CustomEvent`s; internal array/fn/type-guard/subject helpers |
| `e2e/` | Playwright suite — `specs/`, the `fixture/` page, `support/` page objects, its own `tsconfig.json` |

## For AI Agents

### Working In This Directory

- `exports` is asymmetric on purpose: `.` ships `types` and `default`, `./jsx-runtime` ships `types` alone, so a build whose JSX transform went missing dies on `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than rendering wrongly. That file is a `.ts` because `vite-plugin-dts` emits declarations and does not copy hand-written ones, which costs it a `typescript/no-namespace` exemption in the root `vite.config.ts` — `JSX` has to be a namespace, that being the shape `jsxImportSource` looks for.
- `src/index.ts` is the runtime contract; a symbol not re-exported there is private. `removeCSSHost` is deliberately absent — its only caller is the `disconnectedCallback` of the element class `defineCustomElement` registers. The public surface also includes context, directives, CSS diagnostics, HMR, refs/cache/repeat, store, and stylesheet controls.
- `src/parser/` imports nothing from `src/constants.ts` — it tokenizes plain HTML. `MARKER` is injected by `template/html.ts` (`createMarker`) and read back only in `template/helper.ts` and `template/tNode.ts`, so those three move together.
- Reactivity is batched through `observable/scheduler.ts`, so a DOM read taken right after a state write still sees the old tree — `await nextTick()` first.
- `helpers/array.ts` `groupBy` accumulates into `Object.create(null)`: attributes are grouped by name, and a `constructor` attribute would otherwise hit an inherited function.
- `build.target` reads `BROWSER_TARGET` from the root `build-target.ts` — the browser floor is a workspace decision, not one this package narrows on its own.

### Testing Requirements

- Unit: `pnpm exec vp run --filter @dineug/r-html --fail-if-no-match test` — `tsc --noEmit` then `vp test run`, happy-dom, 79 colocated `src/**/*.test.ts` files.
- Coverage: `pnpm --filter @dineug/r-html test:coverage` — v8, `perFile` 80% lines/functions/branches/statements, excluding `src/internal-types/**`, `src/index.dev.ts`, and type-only `src/jsx-runtime.ts`.
- E2E: `pnpm --filter @dineug/r-html e2e` (plus `e2e:dev`, `e2e:headed`, `e2e:report`, `e2e:typecheck`). No build step — `vp dev` serves `src/` through `@`. See `e2e/README.md`.
- happy-dom has no style engine, so `vCSSStyleSheet.ts`'s `adoptedStyleSheets` behaviour is pinned only by the e2e specs; re-run them after touching that file. The Playwright web server uses `E2E=1` to suppress `server.open`; it does not pass `--no-open`.
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

## Host adapter contract

`src/render/adapter.ts` declares `HostAdapter`, the seam a render host implements: 24 methods in six groups — creation (5), tree (6), value (3), discrimination (5), event (2), root and context (3). `src/render/domAdapter.ts` is the DOM implementation and the only one that ships; `src/render/__fake-host__/adapter.ts` is the second one, test-only. The clauses below are contract rather than implementation detail: a host that breaks one of them breaks `repeat`, `cache` or the component context, not just its own rendering, and `src/render/fakeHost.test.ts` is what holds each of them.

1. **Inserting a fragment is a child splice.** `appendChild(parent, n)`, `insertBefore(n, ref)` and `prependChild(parent, n)` insert *n's children*, in their current order, at the target position and leave n empty whenever `isFragment(n)` is true; otherwise they insert n itself. `ContainerPart.insert` and the `cache` directive both ride on this. `cache` parks a range one node at a time into a fragment and returns the whole fragment in a single insert, so what has to survive the round trip is the interleaved order of markers *and* real nodes, not the order of the real nodes alone.
2. **The host owns the order of siblings.** `nextSiblingOf` is the only thing `rangeNodes` walks, so a host whose sibling chain disagrees with what it renders hands back the wrong range. A host that keeps its own ledger — because its markers are not members of its real tree — must project that ledger onto the host's child order, never the reverse.
3. **A host need not have text nodes, but it is still asked for one per interpolation.** `createText` and `setText` exist for the hosts that do. The throw a text-less host wants is a backstop for `PrimitivePart` only: `createElement` in `render/part/index.ts` builds the marker-only text node of *every* text-position interpolation through `createNode`, and `TextPart` removes it inside its own constructor. `fakeHost.test.ts` pins that transient node — a single interpolation costs two `createText` calls and one `removeChild`. A host with no text primitive has to answer `createText` for that boundary, or `part/index.ts` has to build it with `createMarker` instead.
4. **A marker is a host node, not a comment.** `createMarker(value)` returns whatever that host can park in the sibling chain and hand back to `isMarker`, `parentOf` and `nextSiblingOf`; the DOM answers a `Comment`. Nothing outside the adapter may assume a marker is renderable, or even a member of the host's own tree.
5. **A value reaches the host raw when it is the whole attribute.** See Attribute values: one marker vs many, below.
6. **The component context and the fragment bridges belong to the host.** `createComponentContext(startNode, eventBus)` builds the `ctx` an `FC` receives — `host`, a live `parentElement`, `dispatchEvent` — so `ObservableComponentPart.createContext()` is a one-line delegation and the DOM's `document.body` default, `getRootNode()` walk and `ShadowRoot`/`DocumentFragment` branches live only in `domAdapter`. `bridgeFragment(fragment, root)` is its pair: one call installs whatever a parked fragment needs to go on behaving as if it were still under `root`, and returns one destroy. The DOM installs its context bridge and then its host bridge, in that order, and hands `cache` a single function.

`innerHTML` and the adopted-stylesheet registry in `template/vCSSStyleSheet.ts` sit outside the seam on purpose: they are DOM primitives with no host-neutral meaning, so a non-DOM host throws rather than adapting them.

### The helper, and how a Part gets one

`createHostHelper(adapter)` in `src/render/helper.ts` derives the seven operations the parts need that are not adapter methods — `createNode`, `setAttr`, `insertBeforeNode`, `insertAfterNode`, `removeNode`, `isNode` and `rangeNodes` — and carries the adapter's own methods alongside them, so one `HostHelper` answers everything a `Part` asks of its host. The adapter is **spread** into that object, so a host must expose its methods as own enumerable properties: an object literal like `domAdapter`, not a class instance whose methods live on a prototype.

`domHelper` is the DOM binding. The named exports beside it (`createNode`, `setAttr`, `insertBeforeNode`, `insertAfterNode`, `removeNode`, `isNode`, `rangeNodes`, plus `appendChild`, `createMarker`, `createFragment` and `isHostNode`) are that binding under its old names, and they are what the modules a helper does not reach still import: `directives/node/innerHTML.ts`, which is DOM-only by contract, and `getPartType`. `createNode` is the one whose exported signature keeps the narrower DOM return type its callers read.

The helper travels by constructor argument. `ContainerPart` takes one (or defaults to `domHelper`) and hands it to `createTemplate` → `createElement`, which passes it to every `Part` it builds; `createPart` carries it on to the text parts, `ComponentPart` to `ObservableComponentPart`, and `createAttrPart` to `AttributePart`, `BooleanPart` and `EventPart` — the three that write to the host rather than to a props object. `ObservableComponentPart` hands its own helper to the `EventPart` it binds to the event bus. **Every one of those parameters defaults to `domHelper`**, which is what keeps the DOM call sites — and the specs that construct parts directly — unchanged.

One discrimination is still DOM-bound on purpose-by-omission: `getPartType` in `render/part/node/text/helper.ts` reads the module-level `isHostNode`, the DOM binding, because `arrayDiff.ts` calls it with no helper in hand. Under a non-DOM host a raw host node used as a template value therefore classifies as `object`, not `node`, and gets an `ObjectPart`. Nothing in the scene path puts a bare host node in a text position, but a host that wants `NodePart` has to thread the helper through `getPartType` and `valuesToDiffItems` first.

### One host, one template instance

`createHostTemplate(adapter)` in `src/render/hostTemplate.ts` is the seam's entry point: it takes an adapter and hands back the `html` and `svg` tags plus the `render` that host writes through. The tags are the same parse for every host — a template literal becomes a `tNode` before anything host-shaped happens — so they ride along only to give a host one place to take its own tag from. What is per-instance is the container `WeakMap` inside `render` and the `HostHelper` every `ContainerPart` it builds is constructed with, which is why two hosts can never answer for one root.

`src/render/index.ts` is now just the DOM instance: one `createHostTemplate<Container>(domAdapter)` whose three members are the `html`, `svg` and `render` this package exports. One adapter layer was added and nothing else moved — `render` still takes `Element | ShadowRoot | DocumentFragment`, still caches per container, and still recommits when the strings match.

The container type is the instance's type argument. `HostContainer` is `HostNode`, and `HostTemplate<T extends HostContainer>` narrows `render` to whatever `T` a host names, so the DOM instance keeps its exact `Container` and a Konva one takes a `Stage` without either widening the other.

The same shape appears wherever a type used to name a DOM node: `NodeDirectiveProps<T extends HostNode = HostNode>` and `ComponentPartClass<T extends HostNode = HostNode>` are host-neutral, and the DOM stays the *default* one layer out — at `createNodeDirective`, whose own `T` defaults to `Comment`, and at `mixinHmrComponent`, which infers `T` from the class it wraps.

### Node directives carry their host

`NodeDirectiveProps` — what a `createNodeDirective` creator receives — is `{ startNode, endNode, helper? }`, and three things about that shape are load-bearing.

- **The markers are generic, and the DOM default sits on the factory.** `NodeDirectiveProps<T extends HostNode = HostNode>` types both markers as `T`; `createNodeDirective<F, T extends HostNode = Comment, D>` is where `T` picks up its DOM default, so a directive written against the DOM keeps its `Comment` ergonomics and needs no type argument, while a non-DOM host passes its node type as the second one. `DirectivePart` builds the props from its own `HostNode` markers with no cast, and `repeat` and `cache` annotate their creator as `NodeDirectiveProps` because they run under every host — only `innerHTML` takes the `Comment` default, being DOM-only by contract.
- **`helper` is optional, and a directive defaults it to `domHelper`.** `DirectivePart` always supplies one, but a creator invoked directly — which the specs do, `cache(null)[1]({ startNode, endNode })` — supplies none.
- **`helper` is non-enumerable.** It is a capability handle, not part of the props' identity, so `Object.keys`, spreads, structural equality and serialization still see the marker pair alone. `createNodeDirectiveProps` is the only thing that builds these props; do not assemble the object literally.

`repeat` and `cache` do all their tree work through that helper — markers, ranges, moves, the parked fragment and its bridge — which is what makes them host-neutral. `innerHTML` deliberately does not.

### Attribute values: one marker vs many

`AttributePart` decides once, in its constructor, whether the attribute is exactly one marker — one marker tuple, and the trimmed attribute text equal to it (`#isSingleMarker`). The two commit branches then differ:

- one marker → `setAttribute(node, name, value, true)`, the committed value itself. A host that can hold a number, an array or an object receives one; stringifying is the DOM adapter's own decision (`safeToString`, then `trim`).
- otherwise → the merged-string path, unchanged: one `String.prototype.replace` per marker over the original attribute text, then `trim`, then the DOM write.

The split is also where one old bug is fixed, deliberately. `replace` reads `$&`, `` $` ``, `$'`, `$n` and `$$` *in the replacement* as substitution directives, so a value of `$&` used to write the marker text back into the attribute and `$$` used to collapse to a single `$`. The single-marker path inserts the value literally, so those spellings now mean what they say. The multi-marker path still goes through `replace` and still substitutes — this is the one point where the two branches disagree. `src/render/part/attribute/attribute.singleMarker.test.ts` pins both halves against a reference implementation of the old pipeline.

`safeToString` lives in `src/render/value.ts` so the parts and every host adapter share one copy.

### The fake host

`src/render/__fake-host__/` is the second `HostAdapter` implementation this package carries, and the only evidence that the seam is a contract rather than a description of the DOM. `tree.ts` is an in-memory tree whose siblings are a doubly linked chain, so the order the adapter answers for is the only order there is; `adapter.ts` builds the 24 methods over it and wraps every one in a counter, so a spec can assert the *shape* of the work — how many host calls, of which kind — instead of a wall clock. It is excluded from `tsconfig.build.json` and never reaches `dist/`.

`src/render/fakeHost.test.ts` drives it through `createHostTemplate` and asserts node creation, insertion, removal, keyed `repeat` reordering, attribute diffing, events, conditionals, the component lifecycle, `ref` and `cache` — plus the fragment splice on all three insert entry points and the parked-range order `cache` depends on. Two of its assertions are the ones the DOM cannot make: a single-marker attribute reaches the host as the committed value itself (the number `42`, not `'42'`), and reversing a keyed list of 1000 items costs zero `createMarker`, zero `createText` and zero `removeChild`. The last three specs are the reconciliation gate — inserting 1000 nodes costs about 15 host calls each and reversing them about 11, and the count grows by the same factor as the list, which is what fails loudly if per-call reconciliation ever replaces per-commit reconciliation.

