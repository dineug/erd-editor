# r-html-konva

> The Konva host for `@dineug/r-html` templates

`@dineug/r-html` renders through a `HostAdapter`, and this package is the one that renders into a
Konva `Stage` instead of the DOM: a ledger that holds the order and the markers a Konva tree
cannot, reconciled once per parent per commit, and a draw gate that draws each layer a commit
touched once. It is private, not on npm, and depended on as `"@dineug/r-html-konva": "workspace:*"`.
[`erd-editor`](../erd-editor) draws its ERD scene through it and lists it in `devDependencies`, so
its build inlines it; [`grid`](../grid), the canvas grid, draws through it too and lists it in
`dependencies`. `konva` is a peer: the consumer supplies the one copy.

## Usage

`src/index.ts` exports the host (`konva`, `konvaAdapter`, `renderKonva`, `hostStats`,
`resetHostStats`, `MINIMAP_STAGE_NAME` and the `HostStats` type), the draw gate (`markDirty`,
`requestFlush`, `whenDrawn`, `onBeforeFlush`, `currentEpoch`, `beginAnimation`, `endAnimation`)
and the `KonvaIntrinsicElements` type.

A Konva file opens with `/** @jsxHost konva */`, and
[`@dineug/vite-plugin-r-html`](../vite-plugin-r-html) compiles its JSX into `konva` templates
when the consumer names this package as `konvaImportSource`:

```ts
// vite.config.ts
rHtml({ jsx: { konvaImportSource: '@dineug/r-html-konva' } });
```

```tsx
/** @jsxHost konva */
import { renderKonva, whenDrawn } from '@dineug/r-html-konva';
import { Stage } from 'konva/lib/Stage';

const stage = new Stage({ container, width: 200, height: 120 });

renderKonva(
  stage,
  <k-layer>
    <k-rect x={10} y={10} width={80} height={40} fill={'#0090ff'} />
    <k-text x={16} y={22} text={'users'} fontSize={14} />
  </k-layer>
);
await whenDrawn();
```

A template's root is a `k-layer`, and the tags are `k-circle`, `k-group`, `k-layer`, `k-line`,
`k-path`, `k-rect`, `k-shape` and `k-text`. A `k-shape` paints through its `sceneFunc`, which konva
calls with the layer's context on every draw of the layer: keep one function and ask a redraw with
`markDirty(layer)`, since writing the same function again draws nothing. Konva is imported through
`konva/lib/*` modules, never its barrel. Nothing draws behind the gate: `Konva.autoDrawEnabled` is
off, a write marks its layer and `whenDrawn()` resolves once the commit drew it; a Tween hands a
layer over with `beginAnimation` / `endAnimation`. `class`, `style`, `zIndex`, a spread, Konva's
own dragging and the DOM sigils (`bool:`, `prop:`) are refused, at compile time or by the types. A
component reads a context provided on a DOM element above the Stage container, as a DOM component
does.

## Development

From the repository root:

```sh
pnpm exec vp run --filter ./packages/r-html-konva --fail-if-no-match test
pnpm --filter ./packages/r-html-konva --fail-if-no-match test:coverage
pnpm --filter ./packages/r-html-konva --fail-if-no-match test:dev
pnpm exec vp run --filter ./packages/r-html-konva --fail-if-no-match build
```

Only `test` runs `tsc --noEmit` before Vitest; its `browser` project runs in headless Chromium.
The rules for changing the package, and the checks a change runs, are in [AGENTS.md](./AGENTS.md).
