# r-html

> Tagged templates framework

A small UI framework built on tagged template literals: `html` / `svg` compile to a
virtual node tree with fine-grained parts, `css` compiles to a scoped constructable
stylesheet, `observable` gives Proxy-based state batched on a microtask, and
`defineCustomElement` wraps a component as a custom element. `@dineug/erd-editor` is
built on it, which is why it lives here — the editor core needs a framework-free
custom element with no third-party UI framework runtime.

Internal to the erd-editor monorepo; not published to npm. `@dineug/erd-editor` is its
one consumer, depending on it as `"@dineug/r-html": "workspace:*"`.

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

## API

- **Templates** — `html`, `svg`, and `render(container, templateLiterals)` (pass `null` to unmount). Interpolation is typed by prefix: `class=${}` attribute, `@click=${}` event, `.value=${}` property, `?disabled=${}` boolean, and `<${Component} />` for a component. Directives: `repeat`, `cache`, `innerHTML`, `ref` / `createRef`, plus `createNodeDirective` / `createAttributeDirective` for your own.
- **Styles** — `css` returns a literal that stringifies to a generated class name; `css.global` opts out of scoping. `addCSSHost`, `setGlobalStyleOrder` and `setCSSDiagnostics` tune the adopted-stylesheet layer.
- **Reactivity** — `observable(state)`, `observer(fn)`, `watch(proxy)`. Updates are batched, so `await nextTick()` before reading the DOM back.
- **Components** — `FC<Props, Ctx>` returns a render closure and receives a `ctx` carrying `host`, `parentElement` and `dispatchEvent`. Lifecycle hooks: `onBeforeMount`, `onMounted`, `onUnmounted`, `onBeforeFirstUpdate`, `onFirstUpdated`, `onBeforeUpdate`, `onUpdated`. `defineCustomElement(name, { render, observedProps, shadow })` registers one as an element; `createContext` / `useProvider` / `useContext` pass values down without props.
- **Store** — `createStore({ context, state, reducers })` returns `context`, `state`, `dispatch`, `dispatchSync`, `subscribe`, `pipe` and `destroy`. Actions come from `createAction`, are flattened by `compositionActionsFlat`, and `reduxDevtools` attaches the devtools bridge.

## JSX

r-html emits no JSX runtime calls — the tags are the runtime. JSX authoring — what
`@dineug/erd-editor` uses — is a build-time transform in
[`../vite-plugin-r-html`](../vite-plugin-r-html), which compiles `.tsx` back to these
same tags and wires HMR through the exported `hmr()`. The JSX types live here, in the
declarations-only `./jsx-runtime` entry: set `jsx: "preserve"` and
`jsxImportSource: "@dineug/r-html"`.

## Development

```sh
pnpm exec vp run --filter @dineug/r-html --fail-if-no-match test
pnpm --filter @dineug/r-html test:coverage   # per-file 80%; CI gates this package on it
pnpm --filter @dineug/r-html e2e             # Playwright
```
