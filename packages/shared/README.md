# shared

> Runtime type guards and small helpers shared across the erd-editor packages

`@dineug/shared` is the bottom leaf of the workspace dependency graph: no internal dependencies, and
`nanoid` is the only external it bundles. It is internal to the erd-editor monorepo and is never
published to npm — depend on it as `"@dineug/shared": "workspace:*"`. `erd-editor-schema` and
`vscode-bridge` additionally declare it as a `peerDependency`, which their `vite.config.ts` turns
into a build external — their `dist/` imports `@dineug/shared` rather than inlining a copy each.

## Exports

| Group | Exports |
| --- | --- |
| Type guards | `isObjectRaw`, `isBigint`, `isBoolean`, `isFunction`, `isNumber`, `isString`, `isSymbol`, `isUndefined`, `isNull`, `isNill`, `isArray`, `isObject`, `isInteger`, `isPrimitive`, `isPromiseLike`, `isPromise`, `isIterator`, `isGenerator`, `nonNullable` |
| Callbacks | `safeCallback` — call a possibly-undefined callback, logging a throw instead of propagating it; `asap` — `queueMicrotask` with a `Promise.resolve().then` fallback |
| IDs | `nanoid` — 21-character URL-safe ID seeded from `globalThis.crypto.getRandomValues` |
| Array | `arrayHas` — a `Set`-backed membership predicate built from an array |
| Number | `createInRange` — a clamp built from a `min`/`max` pair |

Every guard except `isPrimitive` is a `value is T` predicate, so callers narrow for free.

## Usage

```ts
import { arrayHas, createInRange, isString, nanoid } from '@dineug/shared';

const id = nanoid(); // 'V1StGXR8_Z5jdHi6B-myT'

const isKeyword = arrayHas(['SELECT', 'FROM', 'WHERE']);
isKeyword('FROM'); // true

const clampZoom = createInRange(0.1, 4);
clampZoom(9); // 4

const label = (value: unknown) => (isString(value) ? value.trim() : `${value}`);
```

## Development

```sh
pnpm exec vp run --filter @dineug/shared --fail-if-no-match test
pnpm --filter @dineug/shared test:coverage
```
