# uuid

> UUIDv7 generation and the Uuid25 encoding, with no dependency

`@dineug/uuid` implements RFC 9562 UUIDv7 and the Uuid25 encoding itself. Its `uuid25()` mints
the id of every entity [`erd-editor`](../erd-editor), [`erd-editor-schema`](../erd-editor-schema)
and [`mcp-server`](../mcp-server) create. The package is private, never published to npm, and
depended on as `"@dineug/uuid": "workspace:*"`:
`erd-editor-schema` names it in `dependencies`, so its `dist/` keeps the import bare, and
`erd-editor` and `mcp-server` list it in `devDependencies` and inline it.

## Usage

```ts
import { createUuidv7, toUuid25, uuid25, uuidv7 } from '@dineug/uuid';

uuid25(); // '03gzrxjv20bdlcak89q25d2m7': a new id

const bytes = uuidv7(); // Uint8Array(16), RFC 9562 version 7
toUuid25(bytes); // the same UUID as 25 base 36 digits

// A generator of its own, with a fixed clock and random source, as a spec builds one.
const next = createUuidv7({
  now: () => 1_700_000_000_000,
  random: words => words.fill(0),
});
toUuid25(next()); // '03amo4vrpsf2fgel572xxy1a8'
toUuid25(next()); // '03amo4vrpsf2fgel574wz239c': the same millisecond, one count later
```

- `uuid25()` — a new id: `toUuid25(uuidv7())`.
- `uuidv7()` — the 16 bytes of a new UUIDv7, from the generator every caller of one copy of the
  module shares (`mcp-server`'s bundle holds two), so the UUIDs that copy hands out stay in order.
- `toUuid25(bytes)` — the Uuid25 form of any 16-byte UUID; any other length throws a `RangeError`.
- `createUuidv7(options?)` — a generator of its own. `Uuidv7Options` takes two optional functions:
  `now`, which returns whole milliseconds since the Unix epoch (default `Date.now`), and `random`,
  which fills a `Uint32Array` with random 32-bit words and returns it (default
  `crypto.getRandomValues`).

`uuid25()` is the form of new ids only: a document can also hold the `nanoid` ids saved before
this package and the hyphenated UUIDs a v2 file keeps.

## UUIDv7

| Bits | Field |
| --- | --- |
| 48 | Unix milliseconds |
| 4 | version, `0111` |
| 12 | counter, high bits |
| 2 | variant, `10` |
| 30 | counter, low bits |
| 32 | random, drawn for each UUID |

A new millisecond seeds the 42-bit counter with 41 random bits under a clear top bit. The same or
an earlier millisecond keeps the last timestamp and adds one to the counter, so each UUID one
generator hands out sorts after the one before, through a clock that stalls or steps back.

## Uuid25

[Uuid25](https://github.com/uuid25/javascript) writes the 128 bits of a UUID as 25 lowercase base
36 digits, zero padded, so the strings sort as the bytes do: `8da942a4-1fbe-4ca6-852c-95c473229c7d`
is `8dx554y5rzerz1syhqsvsdw8t`. The ids of one generator therefore sort as strings in the order it
made them.

## Development

From the repository root:

```sh
pnpm exec vp run --filter ./packages/uuid --fail-if-no-match test
pnpm --filter ./packages/uuid --fail-if-no-match test:coverage
pnpm --filter ./packages/uuid --fail-if-no-match test:dev
pnpm exec vp run --filter ./packages/uuid --fail-if-no-match build
```

`test` runs `tsc --noEmit`, then Vitest; `test:coverage` (with coverage) and `test:dev` (watch
mode) run Vitest alone; `build` runs `tsc --noEmit`, then writes `dist/`. The specs are
`src/**/*.test.ts` and run in the Node environment. Consumers import the built `dist/` that
`package.json` exports, and their own `test` and `build` tasks build it first. The rules for
changing the package, and the checks a change runs, are in [AGENTS.md](./AGENTS.md).
