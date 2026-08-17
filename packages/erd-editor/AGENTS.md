<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-17 | Updated: 2026-08-17 -->

# erd-editor

## Purpose

The editor core: a framework-free `<erd-editor>` custom element built on `@dineug/r-html`, with a Redux-like
store whose actions carry a Lamport clock version and merge through the LWW registers in
`@dineug/erd-editor-schema`. Published to npm and depended on by `app`, `vscode-webview`, `intellij-webview` and `vscode-replication-store-worker`; three of those import the second entry for a headless replica. No React here.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | Public entry: side-effect-registers `<erd-editor>`, exports the `ErdEditorElement` type and the three host callbacks (`setGetShikiServiceCallback`, `setExportFileCallback`, `setImportFileCallback`) |
| `src/engine/index.ts` | Second published entry (`@dineug/erd-editor/engine.js`) — `createReplicationStore` only, deliberately DOM-free |
| `src/components/erd-editor/ErdEditor.tsx` | The element: `shadow: 'closed'`, the full `ErdEditorElement` API, and the `readonly` / `systemDarkMode` / `enableThemeBuilder` props |
| `src/engine/rx-store.ts` | UI store — stamps actions with `clock.getNextVersion()`, feeds the history and reducer pipelines, exposes `change$` (debounced 200 ms) and `HISTORY_LIMIT = 2048` |
| `src/engine/actions.ts` | The action-type classification lists: `ChangeActionTypes`, `HistoryActionTypes`, `SharedActionTypes`, `ReadonlyIgnoreActionTypes`, `StreamRegroup*` |
| `vite.config.ts` | `run.tasks` `build`/`test` (both lead with `tsc --noEmit`), two lib entries, `vite-plugin-dts` reading `tsconfig.build.json` (which drops `*.test.ts` and `__test-utils__` from `dist/`), `server.open` off under `E2E` |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/engine/` | `store` / `rx-store` / `shared-store` (collaboration) / `replication-store` (headless), `clock`, `history`, `tag`, plus `modules/` (eight state modules) and `rx-operators/` |
| `src/components/` | r-html FCs — `erd/` (canvas, minimap, context menus), `primitives/` (design system), and the `toolbar` / `schema-sql` / `generator-code` / `visualization` / `settings` / `theme-builder` / `quick-search` panels |
| `src/utils/` | `schema-sql/` (six DDL vendors), `generator-code/` (seven languages), `schema-sql-parser/` (SQL import), `draw-relationship/`, `collection/`, `file/`, `keyboard-shortcut/`, `rx-operators/` |
| `src/services/` | `schema-gc/` — orphan collection in a dedicated and a shared worker over comlink — plus `shikiService.ts` |
| `src/themes/`, `src/styles/` | Theme tokens and the radix palette; global style fragments (reset, typography, fonts, scrollbar). `src/__test-utils__/` holds vitest-only mount helpers, excluded from the dts build and from coverage |
| `e2e/` | Playwright — `fixture/` (deterministic mount page), `support/` (page object, seeds), `specs/` (six specs), `bench/` (routing benchmark, own config, never in CI), `README.md` |

## For AI Agents

### Working In This Directory

- Adding an action is a four-file change: the module's `actions.ts`, `atom.actions.ts` and `history.ts`, **plus** the classification lists in `src/engine/actions.ts`. Skipping the last compiles and then silently breaks undo, autosave or collaboration.
- Reducers must write through the LWW operators from `@dineug/erd-editor-schema` using `action.version`; a direct state write wins every merge and corrupts collaborative sessions.
- `readonly` is enforced by `readonlyIgnoreFilter` over `ReadonlyIgnoreActionTypes`, not in components. Exemptions live in the `hasReadonlyIgnore` list in `src/engine/actions.ts`.
- File IO and highlighting go through the three injected callbacks — the VSCode and IntelliJ webviews have no browser file dialog, so a direct `<input type=file>` is dead code there.
- `draw-relationship/sort.ts` runs the whole geometry pass: it picks each end's side, orders that side's anchors by the angle of the opposite table (walking the boundary clockwise, so anchors sharing a table cannot cross), then routes every connector orthogonally around the tables (`route.ts`) and pulls apart the routes that share a channel (`nudge.ts`). `pathFinding.ts` only draws, cutting each corner to 45 degrees on the way out (`chamfer.ts`) — the routed polyline itself stays orthogonal. Routing has to live there because it needs every table and every other route; `pathFinding` sees one relationship. Anchors land in schema fields and therefore serialise, so a rendering-only value — the routed polyline, the stub slot — belongs in the `WeakMap` side channels in `draw-relationship/index.ts`, never a new field.
- Everything renders inside a closed shadow root, so `document.querySelector` never finds editor internals; use `queryShadowSelector` / `closestElement`. Every dependency is a `devDependency` and the lib build declares no `external`, so anything added ships inside `dist/erd-editor.js` for all four consumers.

### Testing Requirements

- `vp run --filter @dineug/erd-editor --fail-if-no-match test` — `tsc --noEmit`, then `vp test run` over `src/**/*.test.ts` in happy-dom. `vitest.setup.ts` polyfills `ResizeObserver`, `IntersectionObserver`, `matchMedia` and `requestIdleCallback`.
- `test:coverage` — v8, per-file 80%; `test:dev` watches. Both are the built-in `vp test`: no type gate, no dependency builds.
- `pnpm --filter @dineug/erd-editor e2e` — builds this package, then Playwright/Chromium over `e2e/specs/`; also `e2e:dev`, `e2e:headed`, `e2e:report`, `e2e:typecheck`. Read `e2e/README.md` first — the fixture reopens the closed shadow root before the element registers.
- `pnpm --filter @dineug/erd-editor dev` builds the workspace deps then serves `vp dev` with r-html HMR; `dev:storybook` / `build:storybook` drive the Storybook 10 workbench. 313 colocated `*.test.ts` files, all importing from `vite-plus/test`, never `vitest`. `tsconfig.json` includes all of `src/`, so a type error in a test or in `__test-utils__` turns the run red.
- Specs stay `.ts` and keep tagged templates. `mount(template: DOMTemplateLiterals)` is orthogonal to how a component body is written, which is why all 313 went through the JSX migration unedited — and why they are the check that it changed nothing.

### Common Patterns

- One directory per component: `Foo.tsx` + `Foo.styles.ts` (r-html `css` tag) + `Foo.test.ts`, optionally `Foo.stories.tsx`. Tests mount through `src/__test-utils__` (`mountAndFlush`, `flush`).
- **Components are JSX.** `@dineug/vite-plugin-r-html` rewrites every tree into the `html`/`svg` tagged template r-html consumes before oxc sees the file, so the runtime never learns JSX exists. The mapping: `class`/`style` keep their names and array/object values; `?x` → `bool:x`, `@x` → `on:x`, `.x` → `prop:x` on a DOM element, a bare `${ref(r)}` → `use:ref={ref(r)}`, `...${o}` → `{...o}`; a mixed `attr="a ${x}"` becomes a template literal. On a component tag, drop the leading dot — the transform re-adds it to every attribute, which is what stops a prop named `onFoo` being classed as an event.
- `children` stays an explicit prop where it already was: `<C>{t}</C>` compiles to `` .children=${html`${t}`} ``, a second template around the one you had.
- JSX forbids a repeated attribute, so the second binding of one event is `on:x__2` — three tags need it. Empty templates have no JSX spelling: `GlobalStyles.ts` and one line of `Icon.tsx` keep theirs. `src/__jsx-parity__/parity.test.tsx` renders 28 shapes twice, JSX and tagged template, and compares the DOM — change the transform or the type layer and that is what says so.
- Generator actions are `somethingAction$` in `generator.actions.ts`, plain creators `somethingAction` in `atom.actions.ts`; bitmask flags (`settings.show`, `Tag`) go through `src/utils/bit.ts`.
- `@/*` → `src/*` is declared four times — `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `e2e/tsconfig.json`. A new alias needs all four.

## Dependencies

### Internal

`@dineug/r-html`, `@dineug/erd-editor-schema`, `@dineug/shared`, `@dineug/schema-sql-parser`, `@dineug/erd-editor-shiki-worker`, `@dineug/vite-plugin-r-html` (dev-time HMR only).

### External

- `rxjs` (action pipelines), `comlink` (schema-GC worker RPC), `d3` (force simulation in `visualization/` and `erd/automatic-table-placement/`, plus `drag` and the ordinal scale in the former), `tinykeys`, `fuse.js`, `luxon`, `html-to-image`, `@radix-ui/colors`, `@mdi/js` + FontAwesome icons, `@egjs/agent`.
- `es-toolkit`: `get`, `set`, `isEmpty` and `round` come from `es-toolkit/compat` on purpose — the main entry lacks the first three and rounds exact `.xx5` ties down into persisted LWW state. `@floating-ui/dom` and `framer-motion` are declared but imported nowhere in `src/`.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
