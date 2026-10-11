<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-10-11 | Updated: 2026-10-11 -->

# peer

## Purpose

`src/peer/` holds `index.ts`, the entry the package exports as `@dineug/erd-editor/peer.js`, and the two specs that hold it to its rules. `mcp-server` inlines what the entry reaches into its one file and runs it in Node. So a change here keeps that graph free of the DOM and the entry free of tools. The same feature has rules in `src/engine/AGENTS.md` (the peer store internals) and `src/i18n/AGENTS.md` (the i18n modules kept out of this graph).

## Making a Change

1. For a change to what `peer.js` exports, read `packages/mcp-server/AGENTS.md` too, since `mcp-server` builds its tools from the entry (root step 1).
2. Change `src/peer/index.test.ts` with the key set, since it pins the set. Change the two allowlists together (Rules, Node graph).
3. Run the package's `test` task (package step 3), which runs `imports.test.ts`, `index.test.ts` and `engine/no-agent-concepts.test.ts`. A change to the key set also runs the `test` task of each package `src/engine/AGENTS.md` names under Peer store internals.
4. Run `pnpm peer-graph` after `pnpm build` (package step 5) when this package's output or a library it inlines changed (root step 5). It reads `dist/`, which `imports.test.ts` does not.

## Key Files

| File | Description |
| --- | --- |
| `index.ts` | The `peer.js` entry, with the per-module `actions` / `actions$` barrels; the package file's Key Files lists what it exports |
| `imports.test.ts` | Holds the sources the entry reaches to the peer graph's two rules in `pnpm test`, against its own `BARE_ALLOWLIST` |
| `index.test.ts` | Pins the entry's key set and the absence of the flat `actions` map |

## Rules

The peer store itself (the keys that serve specs alone, labelled undo units, the stream buffer option, `createRxStore`'s `observable` option, replicated sort): `src/engine/AGENTS.md` § Peer store internals.

### Node graph

- **The peer graph runs in Node with no DOM.** It has no bundler of its own either: `mcp-server` inlines what `src/peer/index.ts` reaches into one file. So that graph obeys the two rules root § Testing Requirements gives under `pnpm peer-graph`. They are no browser global, and no package outside its allowlist besides the workspace libraries it inlines.
- **Two checks hold the two rules.** `src/peer/imports.test.ts` holds the sources to them in `pnpm test`. `pnpm peer-graph` holds `dist/` after `pnpm build`. Change their allowlists together, `BARE_ALLOWLIST` in the spec and in `scripts/check-peer-graph.mjs`, since both hold one rule.
- **Shared helpers reach no konva, shiki or workers.** A shared helper that starts reaching konva, shiki, elkjs, comlink or a worker spawn is how the graph breaks. `imports.test.ts` has a case that fails on each of them.

### Values, never tools

- **The entry carries values, never tools.** Tool names, the registry, argument validation, reading and the reachability lists belong to `mcp-server`. `engine/no-agent-concepts.test.ts` fails on any of them reappearing in `src/`.
- **Export one barrel per module, no flat map.** `src/peer/index.test.ts` pins the entry's key set and the absence of the flat `actions` map. In that map `changeZIndexAction` would come from whichever module spread last, since memo and table both export one.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
