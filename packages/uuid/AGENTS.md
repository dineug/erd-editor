<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-10-05 | Updated: 2026-10-05 -->

# uuid

## Purpose

`@dineug/uuid` (private) writes UUIDv7 (RFC 9562) and the Uuid25 encoding itself, with no dependency: `uuid25()` is a UUIDv7 as 25 lowercase base 36 digits, the id of every entity `erd-editor`, `erd-editor-schema` and `mcp-server` create and of every other id the editor mints. It replaced `nanoid` there; `app` still draws its IndexedDB and room ids from `nanoid`, and `mcp-server` names its temp files with `randomUUID`.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | Public surface: `uuid25`, `toUuid25`, `createUuidv7`, `uuidv7`, `Uuidv7Options` |
| `src/uuidv7.ts` | `createUuidv7({ now, random })`: 48 bits of Unix milliseconds, the version, a 42-bit counter (the 12 bits after the version, the top 30 after the variant), 32 random bits; `uuidv7`, the module's own generator |
| `src/uuid25.ts` | `toUuid25(bytes)`: the 128 bits as a `BigInt`, `toString(36)`, padded to 25 digits, anything but 16 bytes throwing a `RangeError`; `uuid25()` = `toUuid25(uuidv7())` |

## For AI Agents

### Working In This Directory

- **No id has a shape anything may rely on.** Every document saved before this package holds `nanoid` ids (21 characters of `A-Za-z0-9_-`), a v2 `.vuerd` file keeps its hyphenated UUIDs through `v2ToV3`, which mints only the index column ids, and a file, a paste, an import or a peer on an older release brings more of them, so one document holds several forms for good. Nothing parses, validates or migrates an id: a check of length or alphabet, in the schema, the editor, `mcp-server`'s tool inputs or `json-schema/schema.json`, would refuse documents that exist.
- **Ids from one generator sort in the order they were made**, as strings too, since Uuid25 pads to 25 digits in one case: a new millisecond seeds the counter with 41 random bits under a clear top bit, the same or an earlier one adds one to it. A clock that steps back keeps the last timestamp until real time passes it, so the order holds through it; the 2^41 increments before the counter would fill are more ids than a session mints, so nothing handles that overflow. Each copy of the module has its own generator: `mcp-server`'s bundle carries the engine's and its own, ordered apart, and unique across both by the random bits.
- **The random source is `crypto.getRandomValues`, the clock `Date.now`**, read at each call, never at import: both exist in every realm the editor runs in (browsers, workers, Node 22, Electron, JCEF). `peer.js` reaches this package, so it holds the peer graph's rules (no `window.`, `document.`, `navigator.`, `SharedWorker` or `customElements`; root Testing Requirements).

### Testing Requirements

- `pnpm exec vp run --filter @dineug/uuid --fail-if-no-match test` (node environment).
- The expected values are independent of the code: `uuid25.test.ts` takes the Uuid25 reference implementation's examples, `uuidv7.test.ts` layouts computed by hand from RFC 9562 for a fixed clock and fixed random words.

## Dependencies

### Internal

None — leaf package. `erd-editor-schema` names it in `dependencies`, so its `dist/` keeps the import bare; `erd-editor` and `mcp-server` list it as a devDependency and inline it.

### External

None. `BigInt` and `DataView` are inside the browser floor (`build-target.ts`).

<!-- MANUAL: notes added below this line are preserved on regeneration -->
