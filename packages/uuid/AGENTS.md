<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-10-05 | Updated: 2026-10-11 -->

# uuid

## Purpose

`@dineug/uuid` (private) writes UUIDv7 (RFC 9562) and the Uuid25 encoding itself, with no dependency. `uuid25()` is a UUIDv7 written as 25 lowercase base 36 digits. It is the id of every entity `erd-editor`, `erd-editor-schema` and `mcp-server` create, and of every other id the editor mints. It replaced `nanoid` in those packages; `app` still draws its IndexedDB and room ids from `nanoid`, and `mcp-server` names its temp files with `randomUUID`. A change here keeps the ids of one generator in creation order and adds no rule about what an id looks like.

## Making a Change

1. **Read the consumers' files for a change they see.** A change to an export of `src/index.ts`, or to the form or order of the ids, reaches `erd-editor-schema`, `erd-editor` and `mcp-server`. Read their `AGENTS.md` too (root step 1).
2. **Write the change with an independent spec.** Its expected values come from outside the code (Testing Requirements). A change to the bit layout or the encoding also updates Key Files here and the package `README.md`, which describes both.
3. **Run the test task:** `pnpm exec vp run --filter @dineug/uuid --fail-if-no-match test`. For a change to an export or a type, run `pnpm test` as well (root step 3), because `erd-editor-schema`, `erd-editor` and `mcp-server` import this package and type-check against its `dist/index.d.ts`.
4. **Run `pnpm --filter @dineug/uuid --fail-if-no-match test:coverage`** for a change under `src/` (root step 4).
5. **Run root step 5 with `pnpm peer-graph` and `pnpm size`.** `erd-editor` inlines this package, so a change under `src/` changes `erd-editor`'s output. `pnpm peer-graph` is the gate that holds this code to the peer graph's rules (Rules, Runtime).
6. **Check the two bundle budgets.** Code added here reaches `erd-editor`'s `budgetGzip`, which `pnpm size` checks (step 5), and `mcp-server`'s `BUNDLE_GZIP_BUDGET`, which its `bin.test.ts` checks on the built file. Run `pnpm exec vp run --filter @dineug/erd-editor-mcp --fail-if-no-match test` unless step 3 ran `pnpm test`. Past either budget, follow root § Making a Change on size gates.
7. **Finish with root steps 6 and 7.**

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | Public surface: `uuid25`, `toUuid25`, `createUuidv7`, `uuidv7`, `Uuidv7Options` |
| `src/uuidv7.ts` | `createUuidv7({ now, random })`: 48 bits of Unix milliseconds, the version, a 42-bit counter (the 12 bits after the version, the top 30 after the variant), 32 random bits; `uuidv7`, the module's own generator |
| `src/uuid25.ts` | `toUuid25(bytes)`: the 128 bits as a `BigInt`, `toString(36)`, padded to 25 digits; any length but 16 bytes throws a `RangeError`. `uuid25()` = `toUuid25(uuidv7())` |

## Rules

### Id shape

- **No id has a shape to rely on.** Documents saved before this package hold `nanoid` ids, 21 characters of `A-Za-z0-9_-`. A v2 `.vuerd` file keeps its hyphenated UUIDs through `v2ToV3`, which mints only the index column ids. A file, a paste, an import or a peer on an older release brings more of them, so one document holds several forms for good.
- **Treat every id as an opaque string.** No code parses, validates or migrates an id, whether in the schema, the editor, `mcp-server`'s tool inputs or `json-schema/schema.json`. A check of length or alphabet in any of them would refuse documents that exist.

### Order

- **Ids from one generator sort by creation.** They sort as strings too, since Uuid25 always pads to 25 digits, all lowercase. A new millisecond seeds the counter with 41 random bits under a clear top bit. The same or an earlier millisecond adds one to it.
- **A clock that steps back keeps the order.** The generator keeps the last timestamp until real time passes it, so the ids it mints meanwhile still sort after the earlier ones.
- **Nothing handles counter overflow.** The clear top bit leaves 2^41 increments before the 42-bit counter fills, which is more ids than a session mints.
- **Each module copy orders its own ids.** `uuidv7` is the one generator every caller of a copy of this module shares. `mcp-server`'s bundle carries the engine's copy and its own: their ids are ordered apart, and unique across both by the random bits.

### Runtime

- **Read the clock and random source per call.** The random source is `crypto.getRandomValues` and the clock `Date.now`, read at each call, never at import. Both exist in every realm the editor runs in: browsers, workers, Node 22, Electron and JCEF.
- **Keep the code inside the peer graph's rules.** `erd-editor`'s `peer.js` reaches this package, so the code names no `window.`, `document.`, `navigator.`, `SharedWorker` or `customElements`. `pnpm peer-graph` checks it after `pnpm build` (root § Testing Requirements; `packages/erd-editor/src/peer/AGENTS.md`).

## Testing Requirements

- `pnpm exec vp run --filter @dineug/uuid --fail-if-no-match test` runs `tsc --noEmit`, then Vitest in the node environment.
- **Expected values are independent of the code.** `uuid25.test.ts` takes the examples of the Uuid25 reference implementation. `uuidv7.test.ts` checks layouts computed by hand from RFC 9562 for a fixed clock and fixed random words. A new case keeps to this.
- **Fix the clock and random source through options.** A spec builds its generator with `createUuidv7({ now, random })` and hands it fixed values; `Uuidv7Options` exists for that.

## Dependencies

### Internal

None: a leaf package. `erd-editor-schema` names it in `dependencies`, so its `dist/` keeps the import bare; `erd-editor` and `mcp-server` list it as a devDependency and inline it (root § Working In This Directory, Externals).

### External

None. `BigInt` and `DataView` are inside the browser floor (`build-target.ts`).

<!-- MANUAL: notes added below this line are preserved on regeneration -->
