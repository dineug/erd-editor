# r-html

> Tagged-template rendering framework and store

A small UI framework built on tagged template literals: templates, scoped CSS, Proxy-based state
batched on a microtask, function components as custom elements and a Redux-like store. The renderer
is host-neutral: the exported `html` / `svg` / `render` are its DOM instance, and
`createHostTemplate(adapter)` builds the same three over any other `HostAdapter`. It is private,
never published to npm. [`erd-editor`](../erd-editor) is built on it, since the editor core needs
a custom element with no third-party UI framework runtime, and lists it as a devDependency,
`"@dineug/r-html": "workspace:*"`, so its build inlines it; it also renders its Konva scene through
a second host, [`r-html-konva`](../r-html-konva), which depends on this package, as the canvas grid
[`grid`](../grid) on that host does.
[`mcp-server`](../mcp-server) lists it the same way for the store's action types (`AnyAction`,
`CompositionActions`) and, in its specs, `compositionActionsFlat`.

## Usage

```ts
import { css, defineCustomElement, FC, html, observable, render } from '@dineug/r-html';

const incrementBtn = css`
  color: green;
`;
const decrementBtn = css`
  color: red;
`;

const Counter: FC = () => {
  const state = observable({ count: 0 });

  return () => html`
    <div>Counter: ${state.count}</div>
    <button class=${incrementBtn} @click=${() => state.count++}>Increment</button>
    <button class=${decrementBtn} @click=${() => state.count--}>Decrement</button>
  `;
};

const App: FC<{}, HTMLElement> = () => {
  return () => html`<${Counter} />`;
};

defineCustomElement('my-app', {
  render: App,
});

render(document.body, html`<my-app></my-app>`);
```

It is `src/index.dev.ts`, served by the `dev` script; the buttons are coloured because `my-app` has
a shadow root (Styles).

## API

Every name below comes from `src/index.ts`.

- **Templates** — `html` / `svg` parse each template once per call site into a template tree, and
  `render(container, templateLiterals)` (`null` unmounts) builds update parts from it that commit
  only the values that changed. Node directives: `repeat(list, getKey, render)`, `cache`,
  `innerHTML`. Attribute directive: `ref` with `createRef`. `createNodeDirective` /
  `createAttributeDirective` make your own. A binding's position and prefix decide what it does:

  | Binding | What it does |
  | --- | --- |
  | `title=${v}`, `.value=${v}` | Sets the attribute, or with `.` the property. |
  | `class=${v}` | Keeps the classes the element had before its first value and swaps the rest for: a single class name, a `css` literal, a `{ name: truthy }` object, or nested arrays of those. |
  | `style=${v}` | Sets each property of an object (kebab-case keys) and removes the ones the previous object set; a string sets nothing. |
  | `@click=${fn}`, `onclick=${fn}` | Adds a listener (a function or a `[handler, options]` pair); any name starting with `on` is an event. |
  | `?disabled=${v}` | Adds the attribute, empty, when the value is truthy and not the string `'false'`; removes it otherwise. |
  | `...${obj}` | Sets each entry as a property of the element, or as a prop of a component. |
  | `<input ${ref(r)} />` | Runs an attribute directive; it takes the bare position. |
  | `<${Comp} name=${v} />` | Renders a component; `name`, `.name` and `?name` set its `name` prop, and `@name` listens for what it sends with `ctx.dispatchEvent`. |

- **Styles** — `css` returns a literal that stringifies to a generated class name; `css.global`
  opts out of scoping. Sheets are constructable, with a `<style>` fallback, and are adopted only
  into registered shadow roots: the one `defineCustomElement` attaches (`shadow: 'open'` by
  default) or one you pass to `addCSSHost(shadowRoot)`. A `css` class used in the document's own
  tree matches no rule. `setGlobalStyleOrder([...])` pins the cascade order of `css.global` sheets.
  `setCSSDiagnostics(true | handler)` sends the CSS compiler's diagnostics to the console or your
  handler, `false` turns them off, and `null` leaves it to a `__RHTML_CSS_DIAGNOSTICS__` global.
- **Reactivity** — `observable(state, { shallow })`, `observer(fn)` (returns an unsubscribe) and
  `watch(proxy)`, which returns `{ subscribe }`: its observer receives the name of each property
  that changed, once per tick. Await `nextTick(() => {})`, which runs its required callback after
  the queued renders, before reading the DOM back.
- **Components** — `FC<Props, Ctx>` returns a render closure and receives a `ctx` carrying `host`,
  `parentElement` and `dispatchEvent`. Lifecycle hooks: `onBeforeMount`, `onMounted`,
  `onUnmounted`, `onBeforeFirstUpdate`, `onFirstUpdated`, `onBeforeUpdate`, `onUpdated`.
  `defineCustomElement(name, { render, observedProps, shadow })` registers one as an element
  (`shadow: false` renders without a shadow root). `createContext` / `useProvider` /
  `useContext` pass values down without props. `NoopComponent` renders nothing, and
  `closestElement` / `queryShadowSelector` / `queryShadowSelectorAll` look across shadow roots.
- **Store** — `createStore({ context, state, reducers, enableObservable })` returns `context`,
  `state`, `dispatch`, `dispatchSync`, `subscribe`, `pipe` and `destroy`. `enableObservable`
  defaults to true and makes `state` observable; `dispatch` reduces on the next microtask,
  `dispatchSync` at once. Actions come from `createAction`, are flattened by
  `compositionActionsFlat`, and `reduxDevtools(store)` attaches the devtools bridge.
- **Hosts** — `createHostTemplate` (above), typed by `HostAdapter`, `HostNode`, `HostContainer`
  and `HostTemplate`.

## JSX

r-html has no JSX runtime functions: the tags are the runtime. `@dineug/erd-editor` writes JSX,
which [`vite-plugin-r-html`](../vite-plugin-r-html) rewrites into these tags under `dev`
and `build` alike (`html` / `svg` from this package, or the `konva` tag of
[`r-html-konva`](../r-html-konva) in a `/** @jsxHost konva */` file); under `dev` it also wires
HMR through the exported `hmr()`. The JSX types live here, in the declarations-only
`./jsx-runtime` entry: set `"jsx": "preserve"` and `"jsxImportSource": "@dineug/r-html"`, as
`packages/erd-editor/tsconfig.json` does.

## Development

From the repository root:

```sh
pnpm exec vp run --filter ./packages/r-html --fail-if-no-match test
pnpm --filter ./packages/r-html --fail-if-no-match test:coverage
pnpm --filter ./packages/r-html --fail-if-no-match test:dev
pnpm exec vp run --filter ./packages/r-html --fail-if-no-match build
pnpm --filter ./packages/r-html --fail-if-no-match dev
pnpm --filter ./packages/r-html --fail-if-no-match e2e:typecheck
pnpm --filter ./packages/r-html --fail-if-no-match e2e
```

`test` runs `tsc --noEmit`, then Vitest; `test:coverage` and `test:dev` (watch mode) run Vitest
alone. `e2e` runs Playwright in Chromium; [`e2e/README.md`](./e2e/README.md) covers that suite,
its scripts and its port. The rules for changing the package, and the checks a change runs, are
in [AGENTS.md](./AGENTS.md).
