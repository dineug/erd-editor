<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-09-22 | Updated: 2026-09-23 -->

# mcp-server

## Purpose

`@dineug/erd-editor-mcp` is the stdio MCP server a coding agent runs with `npx -y @dineug/erd-editor-mcp`. It exposes 59 tools: six session tools (`erd_list_documents`, `erd_open_document`, `erd_read`, `erd_save`, `erd_undo`, `erd_redo`) and one per entry of its own `actionTools` (`src/tools/registry/`, 53), each with a `path` argument in front of the registry's own. Every document gets one long-lived agent peer, driven through `createPeerStore` from `@dineug/erd-editor/peer.js`, live through a VS Code window's hub (`packages/agent-hub` protocol) or headless on the file. Published to npm on its own version line (0.1.0), manually, like the other published packages.

## Key Files

| File | Description |
| --- | --- |
| `src/main.ts` | The entry: `startStdioServer()`, a failure logged and `exitCode = 1` |
| `src/server.ts` | `createErdMcpServer` (McpServer + manager + tools, no transport) and `startStdioServer` (stdio, idle sweep timer, shutdown on stdin end); `SERVER_VERSION` is pinned to package.json by `server.test.ts` |
| `src/io.ts` | `McpIo`, every net / fs / process call the server makes, and `nodeIo`, the one real binding |
| `src/hubClient.ts` | `connectHub` (lock protocol check, connect, `hello` with the lock token) and `createHubClient` (JSON lines, id matching, 30 s request timeout, notifications) |
| `src/paths.ts` | `resolveDocumentPath` (cwd-relative, ERD extensions only, `.erd.json` added on create, realpath of the longest existing prefix), `sessionKey` |
| `src/errors.ts` | `SessionError` with a hub code or the server's own (`blocked`, `hubAppeared`, `hubUnreachable`, `hubGone`, `disconnected`, `timeout`, `conflict`, `invalidDocument`, `invalidPath`, `notSaved`) |
| `src/session/resolve.ts` | `discover`: lock directory → `selectHub`; dead windows' locks, temp files and sockets deleted, malformed live ones left |
| `src/session/live.ts` | `createLiveSession`: `openDocument` → `join` → reseed, `applyActions` per outbound batch, the transition table |
| `src/session/headless.ts` | `openHeadlessSession`: reload when the file changed, temp file + `(size, mtimeMs)` compare + rename |
| `src/session/disk.ts` | `assertDocumentText`, `readDocumentFile`, `createEmptyDocument`, `readFromDisk`, `listDiskDocuments` |
| `src/session/manager.ts` | One session per document, chosen again on every call; per-document queue, idle sweep (`IDLE_TTL_MS` 30 min) |
| `src/tools/registry/index.ts` | `ActionTool` and its argument kinds, `actionTools` (53) and `toolByName`; the seven module files beside it (`table`, `column`, `relationship`, `indexes`, `memo`, `settings`, `import`) declare the tools |
| `src/tools/reachability.ts` | `NOT_EMITTED`, `NO_DEDICATED_TOOL`, `EXCLUSION_REASONS`, `PENDING_COVERAGE` — why a change type has no tool |
| `src/tools/read.ts`, `snapshot.ts` | `readDocument` (snapshot, sql, json), `READ_FORMATS`, `SQL_VENDORS`; `toAgentSnapshot`, the document as the tools name it |
| `src/tools/validate.ts`, `run.ts`, `errors.ts` | Argument and entity liveness checks; one tool as one dispatch with its counts held against the declaration; `ToolError` |
| `src/tools/copy.ts` | Every word an agent reads: `TOOL_COPY`, `ARG_COPY`, `SERVER_INSTRUCTIONS` |
| `src/tools/schema.ts` | `ToolArgKind` → zod, exhaustive by a `never` default |
| `src/tools/register.ts`, `result.ts` | Registration with annotations; results as compact JSON, refusals as `isError` results carrying `{ code, message }` |
| `src/__test-utils__/` | `memoryIo`, `fakeHub`, `mcp` (in-memory client), `documents`, `seed` and `scenarios` (the registry fixture, one call per tool), `toolSurface` (the normalizer and the recorded 0.1.0 surface) — out of coverage |
| `vite.config.ts` | The SSR single-file build and the `build` / `test` tasks |

## For AI Agents

### Working In This Directory

- **stdout is the MCP channel.** Nothing but the SDK transport writes to it; diagnostics go through `log()` (`console.error`). A stray `console.log` corrupts the client's stream.
- **The build is one ESM file with no bare import.** `vite.config.ts` copies `vscode-extension`'s SSR shape — `ssr.noExternal: true`, node builtins the only externals — with three differences: `format: 'es'` (no `main` contract forces CJS, and the ESM-only dependencies inline without a bridge), `minify: true` + `sourcemap: false` (npx downloads the tarball on every cold start), and a `#!/usr/bin/env node` banner. An SSR build ignores `lib.fileName` and strips no whitespace, so `rolldownOptions.output` sets `entryFileNames` and `minify` itself. `bin.test.ts` runs a copy of the built file from a folder with no `node_modules`.
- **The floor is Node 22.12, the root's.** `engines.node` (`>=22.12.0`), `build.target: 'node22'` and `@types/node` `^22` are raised by hand together, and nothing gates them; `bin.test.ts` runs the build on the toolchain's Node (22.23.2), not on the floor.
- **Everything is a devDependency** — the MCP SDK, zod, `@dineug/erd-editor`, `@dineug/erd-editor-agent-hub` — because it is all inlined; `dependencies` stays empty. `@dineug/erd-editor` resolves to its built `dist/peer/index.js`, so the `build` and `test` tasks depend on the siblings' builds and track a `dist/**/*.d.ts` glob per workspace dependency, which `check-task-inputs.mjs` matches to the declared dependencies. The `test` task also builds this package first, for `bin.test.ts`; `pnpm --filter @dineug/erd-editor-mcp test:coverage` does not, so build before it.
- **The registry reaches the engine only through `./peer.js`.** Action creators come from the per-module barrels (`tableActions.changeTableNameAction`, `tableActions$.addTableAction$`), constants and `bHas` from the same entry, the document parser from `@dineug/erd-editor-schema` and `CompositionActions` from `@dineug/r-html`. `src/peerSurface.test.ts` holds the entry's 43 exported values to the names this package imports, so neither side keeps a dead one.
- **Prose lives in `tools/copy.ts`, in English.** The registry is machine-readable only (plan axis b). `copy.exhaustive.test.ts` fails on a tool or argument without prose and on an entry nothing uses; an argument that means something particular in one tool (`value` always does) gets that tool's own entry. Keep descriptions short: every agent reads `tools/list` (40,821 bytes at 0.1.0, logged by `toolSurface.test.ts`) before its first call.

**The five rules a tool obeys**

- **A tool is one dispatch and declares what it does, in machine terms only**: a generator where the engine has one, otherwise an atom whose `atomReason` says why no generator fits; `actionTypes`, `undoable`, `stream`, `expectedBatches` / `expectedHistory` (a number, or a range when state decides), `focus`, `snapshotPaths`, `args`. `runTool` holds the measured counts against the declared ones, and a new tool needs its call in `__test-utils__/scenarios.ts`.
- **Every change type is reachable or excluded with a reason.** `tools/reachability.test.ts` pins 56 `ChangeActionTypes`, 49 emitted by some tool and the 7 of `NOT_EMITTED`, and requires every tool to emit only what it declares. A new change type gets a tool, or a `NOT_EMITTED` entry plus its `EXCLUSION_REASONS` line; `PENDING_COVERAGE` (`tools/reachability.ts`, empty) is where one waits for its tool.
- **Viewer-local settings have no tool.** Zoom, scroll and `settings.changeCanvasType` are `SharedFollowingActionTypes`, which every receiver drops, so a tool would report success while no one's screen or file changed; the spec keeps `SharedFollowingActionTypes` inside `NOT_EMITTED`. `table.move` / `memo.move` are relative drag steps with `moveTo` twins.
- **`erd_sort_tables` sends `table.moveTo`, never `table.sort`.** `sortTable` places by each replica's own `toWidth`, so replaying it lands tables apart; the tool dispatches the engine generator `sortTablesToMoveAction$`, which runs the reducer on copies of the live tables and sends the absolute points in one undoable batch (0 or 1). An import's `table.sort` is safe because the widths travel inside its `loadJson` payload.
- **Value-setting tools send nothing when the value already holds**: the four column flags, `erd_set_show`, `erd_set_index_unique`, `erd_set_index_column_order`, and `erd_add_index_column` on a covered column, each declaring 0 or 1 batch and entry. The engine's undo records the negation of what was sent, so a repeated set would leave an undo that flips a value that never changed. The column flags, `erd_set_index_unique` and `erd_set_index_column_order` are atoms because their generators toggle (`toggleColumnValueAction$`, `changeColumnPrimaryKeyAction$`, `changeIndexUniqueAction$`, `changeIndexColumnOrderTypeAction$`), which an agent's retry would flip back; `erd_set_show` is an atom because no generator sets it, and `erd_add_index_column` is a generator, `addIndexColumnOnceAction$`, that skips a covered column.
- **A write never lands on disk under an editor.** Discovery runs before every call. A hub false lock refuses writes (its message says the hub is off or failed to start in that window); a hub appearing over a headless session refuses that one write and closes the session, so the next call joins live; a live session drops to the file only when its window's lock is gone and its pid is dead, and says so in `notes`.
- **The live write path**: `openDocument` on every write (the hub answers at once for a ready editor), `join` when the editor was just opened or this agent is not registered, then `setInitialValue` + `mergeClock(snapshotVersion)` + `setReadonly`. The peer subscribes only after its first registered join; each outbound batch becomes one `applyActions`, sent in order, and a call waits for the ones it produced. A `notOpen` refusal rejoins and runs the call once more; any other refused batch, `readonly` included, forgets the join so the next call reseeds the edit the editor never took. A reseed with undoable agent edits behind it adds a note that they can no longer be undone.
- **`mergeClock` is what lets an agent edit win** on a field the user changed before the agent joined: without it the agent's versions start below the editor's and the webview's LWW drops them while the call reports success. `live.test.ts` pins it.
- **`documentClosed` with agent edits behind it** makes every call, `erd_save` included, carry `CLOSED_NOTE` (those edits are in the file only if saved before the editor closed) until the next join reseeds. `saved: false` from the hub has two causes (no replica confirmed the last batch, or VS Code kept the tab dirty), so the `notSaved` message names both; the protocol carries no reason.
- **`joinAndSeed` has no `await` between the join result and the reseed**, and `hubClient` hands notifications on in a microtask, so actions the hub sends after a join response (even in the same chunk) land on the seeded peer while those sent before it, which the snapshot already holds, are wiped by the reseed. `hubClient.test.ts` pins both orders.
- **A read never opens an editor.** Without a registered join it sends `join` alone: the hub answers from disk for a closed document without registering, and registers for an open one.
- **Headless writes** go to `.<name>.<id>.tmp` beside the document, created with the document's permission bits (owner write added so the temp file can always be removed), then compare the `(size, mtimeMs)` taken at load before the rename; a mismatch reloads and returns `conflict` without writing. Load takes that stat before reading, and a write keeps the temp file's stat (a rename keeps size and mtime), so no outside write can become the baseline unseen. A file changed between calls is simply reloaded, with a note when that dropped undo history. `memoryIo.rename` keeps mtime and mode for the same reason.
- **Text the engine cannot read is refused, never seeded.** `setInitialValue` falls back to an empty document on a parse failure, so `assertDocumentText` (non-blank text must be a JSON object, and a non-empty one must carry a v3 or v2 top-level key) runs on every disk read and on every `join` answer, and fails with `invalidDocument` before anything is written.
- **Calls on one document run one at a time** (`serialize`), different documents side by side; a sweep never closes a document with a call running.
- New documents start as an empty peer's `value`, which carries the `$schema` stamp; never `'{}'`.

### Testing Requirements

- `pnpm exec vp run --filter @dineug/erd-editor-mcp --fail-if-no-match test`, then `pnpm --filter @dineug/erd-editor-mcp test:coverage` for the perFile 80% gate (after a build).
- The specs drive the real server through the SDK's `InMemoryTransport` (`__test-utils__/mcp.ts`) against `fakeHub`, which speaks the agent-hub protocol over `memoryIo`'s in-memory socket pairs with a real agent peer standing in for the webview. `fakeHub` mirrors `vscode-extension`'s `src/hub/handlers.ts` and `documentRegistry.ts` by hand; after a hub behaviour change, update both.
- `scenarios.test.ts` is the completion gate for this package (plan AC-M1): the four spec scenarios, each ending with the agent's document equal to the editor's.
- `tools/registry.test.ts`, `tools/registry.undoable.test.ts` and `tools/reachability.test.ts` run every tool against a real peer on `__test-utils__/seed.ts`, and `tools/snapshot.test.ts` reads such a peer, driving one tool, `erd_remove_memo`, for the removal case; `toolSurface.parity.test.ts` holds the listed surface to the recorded 0.1.0 one.
- **`undoable` is checked in two halves.** `tools/registry.undoable.test.ts` holds each tool's flag to the entries a run on the engine reports; that the report itself matches the engine is `erd-editor`'s `src/engine/peer-store.undoable.test.ts`, which measures a bare store's history cursor beside the peer. `expectedHistory` is no substitute: several tools declare the range `0..1`.
- `headless.test.ts` and `io.test.ts` also touch the real file system and a real unix socket under the temp directory.
- `toolSurface.test.ts` logs the `tools/list` byte count with `console.info` as an observation, not a gate.

## Dependencies

### Internal

`@dineug/erd-editor` (`peer.js` only: `createPeerStore` and its errors, `RootState`, all eight `actions$` barrels — `settingsActions$` only in `tools/registry.kind.test.ts`'s generator census, since every settings tool is an atom — and all seven atom `actions` barrels, the `constants/schema` and `constants/layout` values, `createSchemaSQL`, the vendor list and map, `bHas`, `createEngineContext` and `defaultToWidth` for the specs), `@dineug/erd-editor-agent-hub` (protocol, lock, framing, `selectHub`), `@dineug/erd-editor-schema` (`parser`, `query`, `toJson`, `SchemaV3Constants`), `@dineug/r-html` (`AnyAction`, `CompositionAction`, `CompositionActions`, `compositionActionsFlat`).

### External

`@modelcontextprotocol/sdk` 1.30 (`McpServer`, `StdioServerTransport`; `Client` and `InMemoryTransport` in specs), `zod` 4, `es-toolkit` (+ `/compat`) and `nanoid` (`erd_link_columns` draws the relationship id). The SDK brings `ajv` into the bundle; the engine brings `graphql` (about 32 KB raw, 7.6 KB gzip of the 844 KB / 214 KB file at 0.1.0, gzip level 9). It stays in on purpose: the parser sits in the engine chunk, so dropping the import tools would not shed it.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
