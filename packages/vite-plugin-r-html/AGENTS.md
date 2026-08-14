<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-08 -->

# vite-plugin-r-html (`@dineug/vite-plugin-r-html`)

## Purpose

A Vite plugin that gives `@dineug/r-html` components hot module replacement. It parses each matched
module with Babel, decides whether the module is an HMR _boundary_ (i.e. its named exports are all
component-shaped), and if so appends an `import.meta.hot.accept` block that dispatches a
`hmr:r-html` `CustomEvent` carrying the original and replacement components. `r-html`'s
`src/render/hmr.ts` listens for that event and swaps the component in place.

Used only during development: `packages/erd-editor/vite.config.ts` enables it when
`command === 'serve'` and the lib mode target is active.

## Key Files

| File             | Description                                                                            |
| ---------------- | -------------------------------------------------------------------------------------- |
| `src/index.ts`   | The entire plugin — `rHtml(options)` returning a Vite `Plugin` with a `transform` hook |
| `vite.config.mts` | CJS/ESM lib build with `vite-plugin-dts`                                               |
| `tsconfig.json`  | Extends the root app config                                                            |

### Options

| Option    | Default                | Meaning                                        |
| --------- | ---------------------- | ---------------------------------------------- |
| `include` | _(none)_               | Passed to `@rollup/pluginutils` `createFilter` |
| `exclude` | `'**/node_modules/**'` | Modules never transformed                      |

## For AI Agents

### Working In This Directory

- The plugin is named `vite:r-html-refresh` and runs in the `transform` hook. It parses with
  `@babel/core` (`ast: true, code: false`) purely to inspect the export shape — it never re-emits
  Babel's output, so it must not be relied on for syntax downleveling.
- Boundary detection walks `ExportNamedDeclaration` nodes; a module with a non-component named export
  is not a boundary and is left untouched. Loosening that check causes stale-component bugs rather
  than build errors, so change it deliberately.
- The injected snippet builds `import.meta.hot` from string fragments
  (`` `${'import'}.${'meta'}.${'hot'}` ``) on purpose — writing it literally would let Vite's own
  scanner rewrite it. Keep the indirection.
- This is the only package that is CommonJS-shaped (no `"type": "module"`), because it runs inside
  Vite's Node process.
- `private: true`; `@babel/core` and `@rollup/pluginutils` are real runtime `dependencies` here, not
  dev deps.

### Testing Requirements

- No `test` target. Verify by running the editor dev server —
  `pnpm --filter @dineug/erd-editor dev` — editing a component under
  `packages/erd-editor/src/components/`, and confirming the DOM updates without a full reload.
- A silent failure mode is "HMR falls back to full reload"; check the browser console for the
  `hmr:r-html` event when debugging.

### Common Patterns

- Single-file plugin. Keep it that way unless the AST logic grows past readability.
- `// @ts-ignore` on the Babel import and AST access is intentional — `@babel/core` types are not
  installed.

## Dependencies

### Internal

Pairs with `@dineug/r-html` (`src/render/hmr.ts`) but does not import it.

### External

- `@babel/core` — parsing modules to an AST
- `@rollup/pluginutils` — `createFilter`
- `vite` — peer environment (typed via the `Plugin` interface)

### Consumers

`@dineug/erd-editor` (dev/serve only).

<!-- MANUAL: -->
