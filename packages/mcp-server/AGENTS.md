<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-09-22 | Updated: 2026-09-22 -->

# mcp-server

## Purpose

`@dineug/erd-editor-mcp` is the stdio MCP server a coding agent runs with `npx -y @dineug/erd-editor-mcp`. It exposes 59 tools: six session tools (`erd_list_documents`, `erd_open_document`, `erd_read`, `erd_save`, `erd_undo`, `erd_redo`) and one per entry of `actionTools` from `@dineug/erd-editor/agent.js` (53), each with a `path` argument in front of the registry's own. Every document gets one long-lived agent peer, live through a VS Code window's hub (`packages/agent-hub` protocol) or headless on the file. Published to npm on its own version line (0.1.0), manually, like the other published packages.

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
| `src/tools/copy.ts` | Every word an agent reads: `TOOL_COPY`, `ARG_COPY`, `SERVER_INSTRUCTIONS` |
| `src/tools/schema.ts` | `ToolArgKind` → zod, exhaustive by a `never` default |
| `src/tools/register.ts`, `result.ts` | Registration with annotations; results as compact JSON, refusals as `isError` results carrying `{ code, message }` |
| `src/__test-utils__/` | `memoryIo`, `fakeHub`, `mcp` (in-memory client), `documents` — out of coverage |
| `vite.config.ts` | The SSR single-file build and the `build` / `test` tasks |

## For AI Agents

### Working In This Directory

- **stdout is the MCP channel.** Nothing but the SDK transport writes to it; diagnostics go through `log()` (`console.error`). A stray `console.log` corrupts the client's stream.
- **The build is one ESM file with no bare import.** `vite.config.ts` copies `vscode-extension`'s SSR shape — `ssr.noExternal: true`, node builtins the only externals — with three differences: `format: 'es'` (no `main` contract forces CJS, and the ESM-only dependencies inline without a bridge), `minify: true` + `sourcemap: false` (npx downloads the tarball on every cold start), and a `#!/usr/bin/env node` banner. An SSR build ignores `lib.fileName` and strips no whitespace, so `rolldownOptions.output` sets `entryFileNames` and `minify` itself. `bin.test.ts` runs a copy of the built file from a folder with no `node_modules`.
- **Everything is a devDependency** — the MCP SDK, zod, `@dineug/erd-editor`, `@dineug/erd-editor-agent-hub` — because it is all inlined; `dependencies` stays empty. `@dineug/erd-editor` resolves to its built `dist/agent/index.js`, so the `build` and `test` tasks depend on the siblings' builds and track both `dist/**/*.d.ts` globs, which `check-task-inputs.mjs` matches to the declared dependencies. The `test` task also builds this package first, for `bin.test.ts`; `pnpm --filter @dineug/erd-editor-mcp test:coverage` does not, so build before it.
- **Prose lives in `tools/copy.ts`, in English.** The engine registry is machine-readable only (plan axis b). `copy.exhaustive.test.ts` fails on a tool or argument without prose and on an entry nothing uses; an argument that means something particular in one tool (`value` always does) gets that tool's own entry. Keep descriptions short: every agent reads `tools/list` (40,821 bytes at 0.1.0, logged by `toolSurface.test.ts`) before its first call.
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
- `headless.test.ts` and `io.test.ts` also touch the real file system and a real unix socket under the temp directory.
- `toolSurface.test.ts` logs the `tools/list` byte count with `console.info` as an observation, not a gate.

## Dependencies

### Internal

`@dineug/erd-editor` (`agent.js`: `createAgentPeer`, `actionTools`, `READ_FORMATS`, `SQL_VENDORS`, `AgentToolError`), `@dineug/erd-editor-agent-hub` (protocol, lock, framing, `selectHub`).

### External

`@modelcontextprotocol/sdk` 1.30 (`McpServer`, `StdioServerTransport`; `Client` and `InMemoryTransport` in specs), `zod` 4. The SDK brings `ajv` into the bundle; the engine brings `graphql` (about 32 KB raw, 7.6 KB gzip of the 843 KB / 213 KB file).

<!-- MANUAL: notes added below this line are preserved on regeneration -->
