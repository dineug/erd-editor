<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-09-22 | Updated: 2026-09-22 -->

# agent-hub

## Purpose

`@dineug/erd-editor-agent-hub` is the one specification of the document hub that lets a coding agent's MCP server join an IDE window's collaboration stream: the protocol version and message types, the lock file schema and where it lives, JSON lines framing, path authorization and hub discovery. It is pure functions over strings; each side puts its own net / fs adapter on top. `private: true`; `effect` is its one peer dependency.

## Key Files

| File | Description |
| --- | --- |
| `src/protocol.ts` | `HUB_PROTOCOL_VERSION`, `HubRequest` / `HubResponse` / `HubNotification` (derived from `HubRequestParams`, `HubResultMap`, `HubNotificationParams`), the direction types `PeerToHubMessage` / `HubToPeerMessage`, `HubErrorCode`, `HUB_REQUEST_METHODS` / `HUB_NOTIFICATION_METHODS`, `HubRequestError`, `protocolMismatchMessage` |
| `src/lock.ts` | `LockRecord`, `lockDirPath` / `lockFilePath` / `pipePath`, `lockFilePid` (file name → pid), `pipePathFits`, `parseLock` / `serializeLock`, the modes and `MAX_PIPE_PATH_BYTES` |
| `src/framing.ts` | `encodeFrame` (JSON + `\n`), `createFrameDecoder`, `MAX_FRAME_BYTES` (64 MiB) |
| `src/paths.ts` | `toSegments`, `isInside`, `isSamePath`, `longestPrefixIndex`, `isAuthorized` / `assertAuthorized` |
| `src/discovery.ts` | `selectHub` — lock files → `live` / `blocked` / `headless` plus the `stale` list |
| `src/framing.wire.test.ts` | The byte-level contract a hand-written peer is held to |
| `src/node-free.test.ts` | Scans every `src/**/*.ts` for a `node:` import and every non-test file for any bare specifier |
| `vite.config.ts` | `defineLibraryConfig(import.meta.url, { dts, minify: false, preserveModules: true })` — the private-library shape |

## For AI Agents

### Working In This Directory

- **No `node:*` — a choice, not a constraint.** `defineLibraryConfig` builds for `BROWSER_TARGET` and `createExternal` does not externalize builtins, but a bespoke Node-target config would be allowed (`check-task-inputs.mjs`'s `sharedTaskCount` would go 1 → 2). Pure functions with injected `isAlive` / `homeDir` / `platform` were chosen because three runtimes read the same spec — the extension's CJS bundle, the MCP server's ESM bundle and the Extension Host e2e's unbundled fake peer — and because the suite then reaches perFile 80% without fs. `node-free.test.ts` enforces it; byte counts use `TextEncoder`, never `Buffer`.
- **`engines.node` (`>=22.12.0`, the root's floor) is a declaration only.** This package builds for `BROWSER_TARGET` and imports nothing from `node:`, so the floor binds only the consumer bundles it is inlined into: the MCP server's `node22` build and the extension's, on the VS Code 1.101 host (Node 22.15).
- **The protocol is a wire format.** A new method goes into `HubRequestParams` + `HubResultMap` (or `HubNotificationParams`) and the matching `HUB_*_METHODS` list; `protocol.test.ts` fails `tsc` when a list and its type disagree. Any change that an older peer cannot read bumps `HUB_PROTOCOL_VERSION`; it stayed 1 through the unreleased `applyActions` change below. There is no `rejoin` message: reseeding after an auto open is a session step of the MCP server.
- **A peer sends requests only; notifications flow hub → peer.** A peer hands over its own actions with the `applyActions` request (`{ path, actions }` → `{ webviews }`), so a refusal (`notOpen`, `readonly`) reaches it and the session can rejoin; the `actions` notification carries the actions of webviews and of other peers to a joined peer, and `documentClosed` tells it the editor went away. The hub answers a frame without an `id` with nothing.
- **Error codes say whose fault it is.** `badRequest` is a malformed request, an unknown method or a missing `path`; `internal` is the hub failing (a handler threw something other than `HubRequestError`, or its result could not be framed). `notFound` means only that the named document does not exist, so an MCP server never reads a hub bug as a missing file.
- **Lock location is computed here only.** Locks are `<home>/.erd-editor/ide/<pid>.json` (dir `0o700`, file `0o600`); the socket is `<pid>.sock` beside it, or `\\.\pipe\erd-editor-ide-<pid>` on win32. `lockFilePid` is the inverse of `lockFilePath` and ignores anything else in the directory, temp files of an atomic rewrite included.
- **`MAX_PIPE_PATH_BYTES` is 100** — under the kernel's `sun_path` field of 104 bytes on macOS and 108 on Linux. `pipePathFits` measures UTF-8 bytes and always passes win32 named pipes; a path that does not fit is the adapter's cue to bind under the temp directory and write that path into the lock's `pipe`. The lock itself never moves.
- **Socket path, measured 2026-09-22** on macOS 26 (Darwin 25.6, arm64), Node 22.23.2, libuv 1.51.0: `<home>/.erd-editor/ide/<pid>.sock` came to 40 bytes for a 13-byte home, and `net.createServer().listen` bound it and accepted a connection. Paths up to 104 bytes bind as given; a longer one is not rejected — `listen` succeeds on its first 104 bytes and a client given the same long path still connects — so `pipePathFits` is the only guard and the adapter checks it before `listen`. The path is home + 22 + pid digits bytes, so the longest home that fits is 73 bytes on macOS (5-digit pids) and 71 on Linux (`pid_max` up to 4194304). Not measured yet: Linux `listen` and the win32 named pipe ACL.
- **`parseLock` is lenient forward, strict on types.** Unknown fields are dropped so a newer writer still parses; a missing field or a wrong type returns `null`. `serializeLock` writes the eight fields in a fixed order and nothing else, so no extra property leaks to disk.
- **Paths are compared, never resolved.** Inputs are absolute and normalized by the caller, with symlinks resolved by `realpath` on both sides (the extension's `HubIo`, the MCP server's resolver); nothing here touches the file system. Rules: segment-wise (`/a/bc` is not inside `/a/b`), case-insensitive on `win32` and `darwin` only, backslashes folded and the drive letter lowercased on `win32` only (on POSIX a backslash is part of a file name), a `..` segment or a relative path matches nothing, a folder counts as inside itself.
- **Authorization and discovery use one rule**: inside a workspace folder, or exactly equal to one of the lock's `documents`. A window with no folder therefore admits only the documents it has open.
- **`selectHub` takes lock files unparsed** (`{ pid, raw, mtimeMs }`) so it can report both stale kinds. A dead pid is `stale: 'dead'` whatever its content — the only kind that is safe to delete with its socket. A live pid whose lock does not parse is `stale: 'malformed'` and is skipped but must be left alone: it may be mid-write or from a newer schema. Among live parsed locks, a `documents` match outranks any folder, a deeper folder outranks a shallower one, then the newest `mtimeMs`, then the higher pid. A `hub: false` winner is `blocked`; no match is `headless`.
- **Framing**: one JSON value per `\n`-terminated line, compact `JSON.stringify` output. The decoder takes strings (the adapter decodes bytes with a streaming UTF-8 decoder), skips blank lines and throws on a non-JSON line or a frame over `MAX_FRAME_BYTES` — measured in UTF-8 bytes, on both encode and decode. After a throw the stream is out of step: drop the decoder and close the connection.
- `assertAuthorized` throws `HubRequestError` with code `outsideWorkspace`; an adapter turns any `HubRequestError` into a `HubError` response carrying the same code.

### Testing Requirements

- `pnpm exec vp run --filter @dineug/erd-editor-agent-hub --fail-if-no-match test` (node environment); `pnpm --filter @dineug/erd-editor-agent-hub test:coverage` for the perFile 80% gate.
- `framing.test.ts` builds strings of `MAX_FRAME_BYTES` to test the real limit, which takes about a second.
- This suite cannot see consumer breakage: after a protocol or lock change run `pnpm build`, and update the hand-written frames of the Extension Host e2e peer (`packages/vscode-extension/test/integration/agent-hub.test.ts`), which imports nothing from this package.

### Common Patterns

- `HubErrorCode` is an `as const` map paired with a same-named type.
- Message unions are derived from a params map by a distributive conditional type, so narrowing on `method` narrows `params` and `result` too.

## Dependencies

### External

`effect` (`catalog:`) as a peerDependency, which `createExternal` keeps a bare import, plus a devDependency for this package's own build and specs. Consumers list this package as a devDependency and bundle it inline, as `vuerd-vscode` does, and list `effect` beside it so one copy resolves for both.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
