# vite-plugin-r-html

> JSX to `@dineug/r-html` or Konva tagged templates, and component modules as HMR boundaries

`rHtml()` returns two Vite plugins. The JSX half rewrites `.tsx` into the `html` / `svg` tagged
templates `@dineug/r-html` renders, or into `konva` templates in a Konva scene file, so a package
is written in JSX with its tooling while the runtime reads only tagged templates. The HMR half, in
serve mode only, lets r-html swap an edited component in place. The package is private, never
published; its consumers, [`erd-editor`](../erd-editor) and the Konva host
[`r-html-konva`](../r-html-konva), list it in `devDependencies` as
`"@dineug/vite-plugin-r-html": "workspace:*"`.

## Usage

```ts
// vite.config.ts
import { defineConfig, lazyPlugins } from 'vite-plus';

const rHtmlPackage: string = '@dineug/vite-plugin-r-html';
const rHtmlPlugins = () =>
  lazyPlugins(async () => {
    const { rHtml } = await import(rHtmlPackage);
    return [rHtml({ jsx: { konvaImportSource: '@dineug/r-html-konva' } })];
  });

export default defineConfig({
  plugins: [rHtmlPlugins()],
  worker: { plugins: () => [rHtmlPlugins()] },
});
```

`vite.config.ts` loads the plugin lazily: Vite Task reads it for its tasks before this package's
`dist/` exists on a clean checkout, where a static import would fail. A worker build inherits no
plugin, so `worker.plugins` repeats it, with fresh instances per call as Vite asks. A
`vitest.config.*`, which Vitest reads instead and no task lookup reads, imports `rHtml` statically
with the same `jsx` option and `refresh: false`, since Vitest runs in serve mode, where the HMR
half applies.

The consuming `tsconfig.json` needs `"jsxImportSource": "@dineug/r-html"`, whose types-only
`jsx-runtime` export types the JSX, and `"jsx": "preserve"`, because this plugin owns the JSX and
nothing downstream should compile it; [erd-editor's `tsconfig.json`](../erd-editor/tsconfig.json)
says what `react-jsx` breaks.

| Option | Default and effect |
| --- | --- |
| `include` | JSX half: `/\.tsx$/`, and never another extension. HMR half: every module |
| `exclude` | `**/node_modules/**` |
| `importSource` | `@dineug/r-html`: the JSX half imports `html` / `svg` from it, the HMR half `hmr` |
| `jsx` | `JsxOptions`: the three keys above for the JSX half alone, or `false` to drop it |
| `jsx.konvaImportSource` | None. The module whose `konva` export tags a Konva file, which fails the build without it |
| `refresh` | `RefreshOptions`: the three keys for the HMR half alone, or `false` to drop it |

Top-level keys reach both halves, and a key under `jsx` or `refresh` overrides them for that half.
The package also exports `transformJsxToTagged(code, filename?, importSource?, konvaImportSource?)`,
the JSX half as a function returning the new source or `null` for a file with no JSX, and the
`Options`, `JsxOptions` and `RefreshOptions` types.

## JSX transform

Each replacement is spliced into the original source and padded back to the line count it
replaced, so line numbers hold. The tags a file uses are imported at the start of line 1, as
`import { html as __rHtml, svg as __rSvg } from '<importSource>';`, so a `.tsx` file imports no tag
itself, and a hand-written `html` import beside the aliases keeps working.

| JSX | Emitted template |
| --- | --- |
| `<div class={['a', b]} style={{ top: 0 }} />` | unchanged: `class=${['a', b]} style=${{ top: 0 }}` |
| `<input bool:disabled={x} />` | `?disabled=${x}` |
| `<div on:click={h} />` | `@click=${h}` |
| `<div on:input={a} on:input__2={b} />` | two `@input` bindings; the `__2` suffix only makes the JSX key unique |
| `<input prop:value={v} />` | `.value=${v}` |
| `<div use:ref={ref(root)} />` | a bare `${ref(root)}` directive |
| `<div {...attrs} />` | `...${attrs}` |
| `<Icon name="x" />` | `<${Icon} .name="x" />` |
| `<Menu><span /></Menu>` | ``<${Menu} .children=${__rHtml`<span />`} />`` |

Every plain attribute on a component tag is emitted with a leading dot, because r-html reads a bare
name starting with `on` as an event: an undotted `once=` would become an event named `ce`. Prefixed
forms and a spread keep their mapping, so `on:` still emits `@`. JSX children of a component ride
in as its `children` prop, since r-html has no slot. A template whose root is an SVG-only element
(`svg`, `path`, `g`, …) is tagged `svg` instead of `html`.

A file with a `/** @jsxHost konva */` block comment above its first statement is a Konva file:
every template in it, component children included, is tagged `konva`, imported as `__rKonva` from
`jsx.konvaImportSource` instead of r-html. It holds only `k-*` intrinsic tags and components, since
the host is the file's, never a tag's. `@dineug/erd-editor` writes its Konva scene this way, against
`@dineug/r-html-konva`. `@jsxHost dom`, the default, is accepted too.

Unsupported constructs fail the build with a `[r-html-jsx] file:line:column` message. In any file
these include spread children, an unknown `ns:` prefix, `use:` without an expression value, and a
component given both a `children` attribute and JSX children. For the host pragma and the Konva
host they are a `@jsxHost` pragma outside a block comment above the first statement or naming a
host other than `dom` / `konva`, a Konva file compiled without `konvaImportSource`, a DOM tag in a
Konva file or a `k-*` tag in a file without the pragma, a text child or a string or number literal
child (`{'x'}`, `{1}`) in a Konva file, and a spread, `class`, `style` or `zIndex` on `k-*`. A
`.tsx` file with no JSX is returned unchecked, a misplaced pragma included.

## HMR

In serve mode only, any module the filter passes, `.ts` included, becomes a boundary when its
`export default` carries a name (`export default Foo`, or `export default function Foo() {}`) and
every named export starts with an uppercase letter. Exported class declarations and `export * from`
go unchecked. The plugin appends a snippet, so no line moves: an import of `virtual:r-html-hmr`,
a module that calls r-html's `hmr()` once, and an `import.meta.hot.accept` that dispatches a
`hmr:r-html` event on `globalThis` with the old and new component. r-html swaps the component in
place, in a dev-server worker too, and no entry file needs to call `hmr()`. An anonymous default
export gets no snippet, so the module is not a boundary and the update propagates to its importers.

## Development

From the repository root:

```sh
pnpm exec vp run --filter ./packages/vite-plugin-r-html --fail-if-no-match test
pnpm --filter ./packages/vite-plugin-r-html --fail-if-no-match test:coverage
pnpm --filter ./packages/vite-plugin-r-html --fail-if-no-match test:dev
pnpm exec vp run --filter ./packages/vite-plugin-r-html --fail-if-no-match build
```

`test` runs `tsc --noEmit` and the Vitest specs; `test:dev` watches the specs with no type check.
`erd-editor`'s `test` task runs the parity specs in
[`src/__jsx-parity__/`](../erd-editor/src/__jsx-parity__) against this output. The rules for
changing the package, and the checks a change runs, are in [AGENTS.md](./AGENTS.md).
