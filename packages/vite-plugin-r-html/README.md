# vite-plugin-r-html

> Compiles JSX into `@dineug/r-html` tagged templates, and marks component modules as HMR boundaries.

Internal to the erd-editor monorepo, not published to npm. Consume it as a workspace
dependency (`"@dineug/vite-plugin-r-html": "workspace:*"`).

`@dineug/r-html` renders from `html` / `svg` tagged templates, which give up the tooling JSX
brings — attribute type checking, formatting, editor support. This plugin lets a package be
authored in `.tsx` while the runtime keeps reading tagged templates; the JSX never survives the
build.

## Setup

```ts
// vite.config.ts
import { rHtml } from '@dineug/vite-plugin-r-html';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  plugins: [rHtml()],
});
```

The consuming `tsconfig.json` needs `"jsx": "preserve"` and `"jsxImportSource": "@dineug/r-html"`
too: this plugin owns the JSX, so nothing downstream should try to compile it.

## JSX transform

Runs on `.tsx` only. Output is spliced into the original source, so line numbers hold. The
attribute mapping is the part worth knowing:

| JSX | Emitted template |
| --- | --- |
| `<div class={['a', b]} style={{ top: 0 }} />` | unchanged — `class=${['a', b]} style=${{ top: 0 }}` |
| `<input bool:disabled={x} />` | `?disabled=${x}` |
| `<div on:click={h} />` | `@click=${h}` |
| `<div on:input={a} on:input__2={b} />` | two `@input` bindings — the `__2` suffix only makes the JSX key unique |
| `<input prop:value={v} />` | `.value=${v}` |
| `<div use:ref={ref(root)} />` | a bare `${ref(root)}` directive |
| `<div {...attrs} />` | `...${attrs}` |
| `<Icon name="x" />` | `<${Icon} .name="x" />` |
| `<Menu><span /></Menu>` | `<${Menu} .children=${html`<span />`} />` |

Every attribute on a component tag is emitted with a leading dot, because r-html reads a bare
name starting with `on` as an event — an undotted `once=` would become an event named `ce`.
`on:` still maps to `@` on a component, so events stay events. A template whose root is an
SVG-only element (`svg`, `path`, `g`, …) is tagged `svg` instead of `html`.

Unsupported constructs fail the build with a file:line message rather than emitting something
subtly wrong: spread children, an unknown `ns:` prefix, `use:` without a value, and a component
given both a `children` attribute and JSX children.

## HMR

Dev server only. A module whose named exports are all component-shaped (capitalized) and whose
`export default` carries a name — `export default Foo`, or `export default function Foo() {}` — is
appended an `import.meta.hot.accept` that hands the old and new component to r-html's own swap
listener. An anonymous default export is declined rather than self-accepted, so the update still
propagates. No entry file has to call `hmr()` — each boundary imports a virtual module that does
it once.

## Options

`rHtml({ include, exclude, importSource })` applies to both halves; `jsx` and `refresh` take the
same keys to narrow one half, or `false` to drop it.

## Development

```sh
pnpm exec vp run --filter @dineug/vite-plugin-r-html --fail-if-no-match test
pnpm --filter @dineug/vite-plugin-r-html test:coverage
```
