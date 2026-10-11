<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-09-22 | Updated: 2026-10-11 -->

# agent-hub

## Purpose

`@dineug/erd-editor-agent-hub` is the one specification of the document hub that lets a coding agent's MCP server join an editor's collaboration stream. The editor is a VS Code window, an Obsidian vault window or a JetBrains IDE. The package defines the protocol version and message types, the lock file schema and where it lives, JSON lines framing, path authorization and hub discovery. `mcp-server` builds the client on it and `agent-hub-host` the editor window's side. The IntelliJ plugin ports it to Kotlin with no build edge to it, and is held to it by the conformance corpus. A change that an older peer cannot read bumps `HUB_PROTOCOL_VERSION`, because every side reads the same wire and lock bytes.

## Making a Change

1. **Read the files of the other hub sides** (root step 1). A change to a message, the lock, framing or a path rule reaches every side, so read `packages/agent-hub-host/AGENTS.md`, `packages/mcp-server/AGENTS.md` and `packages/intellij-plugin/AGENTS.md` before writing it.
2. **Write the change with its vectors** (root step 2). A rule another implementation must match gets its vector in `src/__fixtures__/conformance.json` rather than in a spec, unless JSON cannot carry it (Testing Requirements, Each vector has one home). A change an older peer cannot read bumps `HUB_PROTOCOL_VERSION` (Rules, Protocol).
3. **Run the `test` task** (root step 3), which runs `tsc --noEmit` and then Vitest:

   ```sh
   pnpm exec vp run --filter @dineug/erd-editor-agent-hub --fail-if-no-match test
   ```

   A change to an export, a type or a message also runs `pnpm test` (root step 3), because the consumers type-check against this package's `dist/**/*.d.ts`.
4. **Run the coverage gate** (root step 4), perFile 80% on all four metrics:

   ```sh
   pnpm --filter @dineug/erd-editor-agent-hub test:coverage
   ```

5. **Run `pnpm check`, then `pnpm build`** (root step 5).
6. **Check the consumers this suite cannot see** (root step 6). After a protocol or lock change, follow `packages/agent-hub-host/AGENTS.md` (Making a Change, steps 5 to 8). They cover every side: both hosts' suites, `agent-hub-host` itself, `mcp-server` and its `fakeHub.ts`, and the Kotlin hub, which ends in `ERD_MCP_CONFORMANCE=required ./gradlew check` in `packages/intellij-plugin`.
7. **Update the e2e peer after a lock change.** It is the Extension Host e2e peer, `packages/vscode-extension/test/integration/agent-hub.test.ts`; the steps of step 6 name it only for a frame or protocol change. It imports nothing from this package. It writes the corpus's frame bytes by hand and reads the lock (`~/.erd-editor/ide/<pid>.json`, its `pipe`, `token` and `hub`) by hand too, so a lock change reaches it.
8. **Report what ran** (root step 7), naming each consumer step of steps 6 and 7 that you left to the owner or to another platform, with the reason.

## Key Files

| File | Description |
| --- | --- |
| `src/protocol.ts` | `HUB_PROTOCOL_VERSION`; the union schemas `HubRequest` / `HubResponse` / `HubNotification`, each a type of the same name narrowed by `method`, and `HubRequestParams` / `HubResultMap` / `HubNotificationParams` read off them; the direction schemas `PeerToHubMessage` / `HubToPeerMessage`; `HubError`, `JoinResult`, `DocumentInfo`; `HubErrorCode` and its `HubErrorCodeSchema`; `HUB_REQUEST_METHODS` / `HUB_NOTIFICATION_METHODS`; `HubRequestError` (a `Schema.TaggedError`); `protocolMismatchMessage` |
| `src/lock.ts` | `LockRecord` (schema and type), `lockDirPath` / `lockFilePath` / `pipePath`, `lockFilePid` (file name → pid), `pipePathFits`, `parseLock` / `serializeLock` (one `Schema.fromJsonString` codec), the modes and `MAX_PIPE_PATH_BYTES`, `ideDisplayName` (a lock's `ide` → the editor's name) |
| `src/framing.ts` | `encodeFrame` (JSON + `\n`); `decodeFrameResults(schema)`, a `Stream<string>` → `Stream<Result<message, RefusedFrame>>` step; `decodeFrames(schema)`, the same but failing on the first refusal; their `FrameError`; `decodePeerToHubFrames` / `decodeHubToPeerFrames`, the two directions' readers, which the hub and the MCP server stream frames through; `encodePeerToHubFrame`, the MCP server's request writer; `encodeHubNotificationFrame`, the hub's notification writer; `MAX_FRAME_BYTES` (64 MiB) |
| `src/paths.ts` | `toSegments`, `isInside`, `isSamePath`, `longestPrefixIndex`, `isAuthorized` and its Effect, `authorize`; `unsafeSegment`, the win32 name rule |
| `src/discovery.ts` | `readLockDirectory(homeDir)`, the lock files over `FileSystem`; `selectHub`, lock files → an Effect of `HubSelection` (`live` / `blocked` / `headless` plus the `stale` list); its ranking, `matchRank(record, target, platform)` (`Infinity` for a document, the deepest folder's depth, or `-1`) and `outranks(a, b)` on `RankedCandidate`s |
| `src/__fixtures__/conformance.json` | The conformance corpus: the vectors this package and the IntelliJ plugin's Kotlin hub are both held to (Testing Requirements) |
| `src/conformance.test.ts` | The corpus's TypeScript reader, which holds this package to every vector |
| `src/node-free.test.ts` | Scans every `src/**/*.ts` for a `node:` import and for an effect specifier other than effect's named entries, and every non-test file for any other bare specifier. The named entries are `effect` and an `effect/<group>` such as `effect/testing`, except `effect/index`, `effect/schema` and `effect/sql` |
| `src/__test-utils__/effect.ts` | `itEffect` / `runTest`; outside coverage and outside the declaration build |
| `vite.config.ts` | `defineLibraryConfig(import.meta.url, { dts, minify: false, preserveModules: true })`, the private-library shape |

## Rules

### Shape of the spec

- **Schemas first, types derived from them.** Every message and the lock file is an effect `Schema`. The types of the same names, the frame decoders and the request encoder are derived from those schemas.
- **Effects for authorization, selection and streams.** Path authorization and hub selection return Effects, and frames stream through `Stream` steps. The one service any of them requires is effect's `FileSystem`, in `readLockDirectory`. The path rules underneath stay pure functions over strings.
- **Each side brings its layers and adapter.** Each side provides the layers and its own net adapter. The MCP server does so as the client; `agent-hub-host` does so as the editor window's side, which the VS Code extension and the Obsidian plugin both build on.
- **No `node:*` import, by choice.** `defineLibraryConfig` builds this package for `BROWSER_TARGET`, and `createExternal` externalizes no builtin. Its `node: true` would build it for Node, as it does `agent-hub-host`; this package does not set it.
  - The code is pure functions with injected `isAlive`, `homeDir` and `platform`, and Effect functions that name effect's `FileSystem` tag in their requirements instead of calling `node:fs`.
  - The first reason: three bundles read the same spec. They are the extension's CJS bundle, the Obsidian plugin's CommonJS `main.js` and the MCP server's ESM bundle, the first two through `agent-hub-host`.
  - The second reason: the suite reaches perFile 80% without fs, since `readLockDirectory` runs over `FileSystem.layerNoop`.
  - `node-free.test.ts` enforces it. Count bytes with `TextEncoder`, never Node's `Buffer`, for the same reasons.
- **`engines.node` is a declaration only.** The field is `>=22.12.0`, the root's floor. This package builds for `BROWSER_TARGET` and imports nothing from `node:`, so the floor binds only the consumer bundles it is inlined into. Those are the MCP server's `node22` build, the extension's on the VS Code 1.101 host (Node 22.15), and the Obsidian plugin's on the Node of Obsidian's Electron.

### Importing effect

- **Import effect as root § Dependencies says.** Write `import { Schema, Stream } from 'effect'`, never a module path such as `effect/Schema`; the root lint rule and `node-free.test.ts` both refuse one.
- **A consumer of the `.d.ts` needs `skipLibCheck`** (root § Working In This Directory, Externals decide what ships). Without it, the consumer needs a lib with the DOM names, because effect's `Channel.d.ts` names `TextDecoderOptions`.

### Protocol

- **A new method is a schema member.** Add a `request(...)` member to `HubRequest` and its `response(...)` pair to `HubResponse`, or a `notification(...)` member to `HubNotification`. `HubRequestParams`, `HubResultMap` and the `HUB_*_METHODS` lists are read off those members. `protocol.test.ts` pins the names and fails `tsc` when a request has no response.
- **The corpus frames round-trip byte for byte.** The corpus's `frames` are the lines today's peers write. `conformance.test.ts` decodes and re-encodes each one and expects the same bytes back.
- **An unknown field never fails a decode.** A struct drops it. `listDocuments` params and the `leave` result, which nothing reads, are open records that take any object.
- **A notification never carries an `id`.** This is the one exception to dropping unknown fields: every `notification(...)` member refuses the key. A frame with an id therefore never reads as a notification, and a peer still takes it for an answer, as it did before it decoded by schema.
- **A missing field fails the decode.** This includes `hello`'s `client`, which the hub still reads by hand and defaults to `''`. The direction readers hand such a frame over as a `RefusedFrame` holding the parsed value. A reader that keeps fallbacks reads that value itself (Framing).
- **Bump `HUB_PROTOCOL_VERSION` for an unreadable change.** Any change that an older peer cannot read bumps it, so that a peer and a hub of different versions refuse each other with `protocolMismatchMessage` rather than edit together.
  - It is 2. It was raised when saved files took the storage form and a join's `initialValue` became the runtime value the editor holds, else the file. `JoinResult` kept its shape.
- **There is no `rejoin` message.** Reseeding after an auto open is a session step of the MCP server.
- **Peers send requests; the hub sends notifications.** A peer hands over its own actions with the `applyActions` request (`{ path, actions }` → `{ webviews }`), so a refusal (`notOpen`, `readonly`) reaches it and the session can rejoin.
  - The `actions` notification carries the actions of webviews and of other peers to a joined peer.
  - `documentClosed` tells a joined peer that the editor went away.
  - The hub answers a frame without an `id` with nothing.
- **Error codes say whose fault it is.** `badRequest` is a malformed request, an unknown method or a missing `path`. `internal` is the hub failing: a handler threw something other than `HubRequestError`, or its result could not be framed. `notFound` means only that the named document does not exist, so an MCP server never reads a hub bug as a missing file.
- **`HubRequestError` validates its code.** It is a `Schema.TaggedError` (`_tag` `HubRequestError`, yieldable, caught with `Effect.catchTag`), built as `new HubRequestError({ code, message })`. A code outside `HubErrorCode` throws at construction. An adapter turns any `HubRequestError` into a `HubError` response carrying the same code.
- **`protocolMismatchMessage` names no host.** An older hub is told to update the ERD Editor extension or plugin in the editor, and an older client to update the MCP server. The corpus pins both texts byte for byte, and `protocol.test.ts` checks that neither names an editor.

### Lock file

- **The lock's `ide` is an open string.** A new host needs no schema change, because its lock still parses. `ideDisplayName` names the window for a client: `VS Code` for `vscode`, `Obsidian` for `obsidian`, `JetBrains IDE` for `intellij`. Any other `ide` is named as spelled, trimmed, and a blank one is `an editor`. The MCP server uses it in its refusals and notes, through its `src/hub/host.ts`.
- **IntelliJ writes one lock per IDE process.** One IDE process runs every project it opens, so the Kotlin hub writes one lock for all of them under its pid, with `ide` `intellij`, whichever JetBrains product it runs in.
- **Lock location is computed here only.** Locks are `<home>/.erd-editor/ide/<pid>.json`, the directory mode `0o700` and the file mode `0o600`. The socket is `<pid>.sock` beside the lock, or `\\.\pipe\erd-editor-ide-<pid>` on win32. `lockFilePid` is the inverse of `lockFilePath` and ignores anything else in the directory, the temp files of an atomic rewrite included.
- **`MAX_PIPE_PATH_BYTES` is 100.** It stays under the kernel's `sun_path` field, 104 bytes on macOS and 108 on Linux. `pipePathFits` measures UTF-8 bytes and always passes win32 named pipes. A path that does not fit is the adapter's cue to bind under the temp directory and write that path into the lock's `pipe`. The lock itself never moves.
- **Socket path length, measured 2026-09-22.** Measured on macOS 26 (Darwin 25.6, arm64), Node 22.23.2, libuv 1.51.0.
  - `<home>/.erd-editor/ide/<pid>.sock` came to 40 bytes for a 13-byte home, and `net.createServer().listen` bound it and accepted a connection.
  - Paths up to 104 bytes bind as given. A longer one is not rejected: `listen` succeeds on its first 104 bytes, and a client given the same long path still connects. So `pipePathFits` is the only guard, and the adapter checks it before `listen`.
  - The path is home + 22 + pid digits bytes. The longest home that fits is 73 bytes on macOS (5-digit pids) and 71 on Linux (`pid_max` up to 4194304).
  - Not measured yet: Linux `listen`. The win32 named pipe's security descriptor, measured 2026-09-27, is in `agent-hub-host`'s AGENTS.md.
- **`parseLock` is lenient forward, strict on types.** Unknown fields are dropped, so a newer writer's lock still parses. A missing field or a wrong type returns `null`; `protocolVersion` is `Schema.Int`, a safe integer.
- **`serializeLock` writes the pinned bytes.** It encodes through the same codec: the eight fields in declaration order, two-space indent, a final newline, nothing else, so no extra property leaks to disk. The bytes are those of the pre-schema writer, and the corpus's `lock.serialize` pins them.

### Paths and authorization

- **Paths are compared, never resolved.** The caller passes absolute, normalized inputs, with symlinks resolved by `realpath` on both sides. Nothing here resolves a path; the only file system access is `readLockDirectory`'s listing and reads.
  - The two realpaths are `FileSystem.realPath` in `agent-hub-host`'s `src/authz.ts`, which both editor hosts serve through, and the MCP server's `realPath` in its `src/paths.ts`.
  - Each is a native realpath over `NodeFileSystem`, because the JS realpath that `NodeFileSystem` brings keeps a spelling the disk does not hold: a case, or NFC for a name stored in NFD on macOS.
  - Nothing here folds more than case, so the two sides must spell a path alike, and a native realpath is what makes them do so.
- **The comparison rules.** Comparison is segment-wise: `/a/bc` is not inside `/a/b`.
  - Case-insensitive on `win32` and `darwin` only.
  - Backslashes folded and the drive letter lowercased on `win32` only, because on POSIX a backslash is part of a file name.
  - A `..` segment or a relative path matches nothing.
  - A folder counts as inside itself.
- **Authorization and discovery share one rule.** A path qualifies when it is inside a workspace folder or exactly equal to one of the lock's `documents`. A window with no folder therefore admits only the documents it has open.
- **A second spelling of a file is refused.** The rule compares strings, so a file reached by two spellings matches only the spelling the lock holds. Windows reaches a file of its own that way through a share (`\\localhost\C$\…`) or a mapped drive. The hubs refuse the other spelling as `outsideWorkspace`. The MCP server finds the window by file identity, ranking the windows with this package's `matchRank` and `outranks`, and refuses the call, naming the window's path (`packages/mcp-server/AGENTS.md`).
- **`authorize` fails with `outsideWorkspace`.** `authorize(folders, documents, target, platform)` checks `isAuthorized` when it runs. It fails with a `HubRequestError` of code `outsideWorkspace`: `<target> is neither inside a workspace folder nor an open document`.
- **`unsafeSegment` flags names Windows stores otherwise.** `unsafeSegment(path, platform)` names what Windows does not store as written, and every side refuses such a path rather than disagree about it. Off `win32` it answers `null`. On `win32` it answers the first name after the root that:
  - holds a colon or another character Win32 refuses (`<>:"|?*`, U+0000–U+001F; U+007F passes);
  - ends in a dot or a space;
  - or is a device before its first dot once trailing spaces are trimmed: `CON`, `PRN`, `AUX`, `NUL`, `COM0`–`COM9`, `LPT0`–`LPT9`, and `COM` or `LPT` with a superscript ¹²³, in any ASCII case.

  It flags `NUL.erd`, `con .erd.json` and a folder `AUX`, and passes `CONSOLE.erd`, `COM10.erd` and `CONIN$.erd`. `..` passes, and a `\\?\` or `\\.\` prefix and the drive after it are not names.
- **Why such names are refused, measured 2026-09-27.** Measured on Windows 11 (build 26200) with Node 22.21.1. Node opens every path through `\\?\`, so the Node side and the JDK side would name two different files.
  - Node writes `orders:v2.erd`, or a timestamp `…T10:00.erd`, as the file `orders` plus a stream. It writes `NUL.erd`, `CON`, `trail.erd.` and a folder `sub.` as those very names.
  - A Win32 caller reads the stream's file, a device, or the name without its dot or space. Win32 callers include the JDK, and so the IntelliJ hub, and also cmd and .NET. The device reading holds on Windows 10; build 26200 reads `NUL.erd` as a file.
- **Every side refuses such a path.** The MCP server refuses it with `invalidPath` before it touches the disk, and leaves such names out of its disk listing. Both hubs' `authorizePath` refuse it with `badRequest`, on the target before the realpath climb and again on the real path.
- **Keep the name rule at parity with Kotlin.** The corpus's `paths.unsafeSegment` holds both of these traps.
  - The trim takes spaces alone: `/ +$/` here, `trimEnd(' ')` in Kotlin. Never use `trimEnd()`, which also takes a tab or U+00A0.
  - The device test folds ASCII letters only, as JavaScript's `i` without `u` does and Java's `CASE_INSENSITIVE` without `UNICODE_CASE`. Kotlin's `RegexOption.IGNORE_CASE` would add `UNICODE_CASE`.

### Discovery

- **`readLockDirectory` is the one lock reader.** The MCP server's discovery and `agent-hub-host`'s stale-lock cleanup both read locks through it.
  - A missing or unreadable directory is no locks.
  - A name `lockFilePid` refuses is skipped, and so is a lock whose read or stat fails between listing and reading.
  - Listing order is kept.
  - `mtimeMs` comes from `FileSystem`'s `mtime`, a `Date`, so it is whole milliseconds, where Node's `mtimeMs` carries a fraction. A file system with no mtime reads as 0.
- **`selectHub` takes lock files unparsed.** It takes `{ pid, raw, mtimeMs }` so it can report both stale kinds. It returns an Effect that asks `isAlive` each time it runs, so it chains onto the read: `readLockDirectory(home).pipe(Effect.flatMap(locks => selectHub(locks, target, platform, isAlive)))`.
- **Reading and selecting stay two functions.** They are not merged into one `discoverHub`, because `agent-hub-host`'s stale cleanup filters out its own pid between them and wants only `stale`.
- **Only a dead pid's lock is deletable.** A dead pid goes into `stale` with `reason: 'dead'` whatever its content — the only kind that is safe to delete with its socket. A live pid whose lock does not parse goes there with `reason: 'malformed'`. That lock is skipped but must be left alone, since it may be mid-write or from a newer schema.
- **The ranking among live parsed locks.** A `documents` match outranks any folder, and a deeper folder outranks a shallower one. Ties go to the newest `mtimeMs`, then the higher pid. A `hub: false` winner is `blocked`; no match is `headless`.

### Framing

- **One JSON value per line.** A frame is one JSON value on a `\n`-terminated line, in compact `JSON.stringify` output.
- **The decoders take strings, not bytes.** The adapter decodes bytes with a streaming UTF-8 decoder: `Stream.decodeText`, or `setEncoding('utf8')` on the `node:net` socket. The `fromNetSocket` of `agent-hub-host` and of the MCP server call `setEncoding('utf8')`, so that `Socket.readerString` only passes strings through. `readerString` over byte chunks decodes each chunk on its own and turns a character split between two reads into U+FFFD.
- **What `decodeFrameResults(schema)` skips and where it stops.** It skips blank and whitespace-only lines and leaves a `\r` before the `\n` to `JSON.parse`. It never parses an unterminated tail. It stops at a non-JSON line or at a frame over `MAX_FRAME_BYTES`.
  - The limit is measured in UTF-8 bytes, on both encode and decode, and checked before a partial line is buffered.
- **A misfit frame is refused; reading continues.** Each JSON value comes out as a `Result`: the message `schema` decoded, or a `RefusedFrame` for JSON that fits no message. A `RefusedFrame` is `{ value, issue }`, the parsed value and the schema's reason.
- **A `FrameError` ends the connection.** `decodeFrameResults` fails the stream with `FrameError` (`reason` `tooLarge` or `notJson`) and passes the text stream's own failures through. `decodeFrames(schema)` also fails at the first refused value, with `reason` `invalid`. After a `FrameError` the stream is out of step, so close the connection.
- **Each consumer decides what a refused frame gets.** The consumers read through `decodePeerToHubFrames` (`PeerToHubMessage`) and `decodeHubToPeerFrames` (`HubToPeerMessage`).
  - The hub reads a refused frame by hand, as it read every frame before the schema. So it keeps its old answer: a hang-up, `badRequest` with its id, or the handler with the params it can read.
  - The MCP server reads it by hand too, as its client did before the schema. A numeric `id` settles the pending request it names. A string `method` with object `params` goes to the session as a notification, an unknown method among them. Anything else is logged and skipped.
- **`encodePeerToHubFrame` writes requests through the schema.** It encodes through `PeerToHubMessage`, then `encodeFrame`: fields in schema order, unknown ones dropped, the bytes the corpus pins for today's requests. `openDocument`'s `create` and `initialValue` are `Schema.optional`, so one given as `undefined` is left out, as `encodeFrame` leaves it out; `optionalKey` would throw.
- **`encodeHubNotificationFrame` writes notifications the same way.** It encodes through `HubNotification` and writes the bytes `encodeFrame` wrote of the objects the hub builds.
- **The hub's responses stay plain `encodeFrame`.** They are `encodeFrame` of what the handlers return, because a result that JSON cannot frame must answer `internal` with JSON's own message. `encodeFrame` throws a `RangeError` over the limit.
- **Lines are split here, not by `Ndjson.decodeString`.** That filter drops only zero-length lines, so a whitespace-only line would fail `JSON.parse` instead of being skipped. Its `splitLines` also ends a line at a lone `\r` and flushes the unterminated tail at the end.

## Testing Requirements

- **The suite runs in the `node` environment.** Making a Change gives the `test` task and the `test:coverage` gate.
- **`framing.test.ts` tests the real 64 MiB limit.** It builds strings of `MAX_FRAME_BYTES` for `encodeFrame`, `decodeFrames` and `decodeFrameResults`, which takes about a second. Its assertions compare lengths and identity, not the strings, so a failure does not print 64 MiB.
- **Effect specs use the package's own helpers.** Use `itEffect` / `runTest` from `src/__test-utils__/effect.ts`, not `@effect/vitest`. No package depends on it, the two helpers are all the specs need, and `node-free.test.ts`, which reads the specs too, refuses every `@effect/*` specifier.
- **Services are layers.** For example, `discovery.test.ts` uses an in-memory `FileSystem.layerNoop({ readDirectory, readFileString, stat })`.
- **The conformance corpus.** `src/__fixtures__/conformance.json` holds the vectors a second implementation of this spec must meet byte for byte. The file's `$comment` fields say what each table means. It covers:
  - the shared constants: the protocol version, `MAX_FRAME_BYTES`, the error codes in order, the lock modes and `MAX_PIPE_PATH_BYTES`;
  - the wire frames and the encoders' output, frame bytes, chunked streams, a character split between reads and the blank-line set;
  - the protocol mismatch texts, lock bytes and parsing, and lock and pipe paths;
  - the path rules, the win32 name rule (`unsafeSegment`) and `ideDisplayName`.
- **Two suites read the corpus.** In `conformance.test.ts` this package is the oracle, so a vector it fails is a wrong vector. The Gradle tests of `packages/intellij-plugin` read it through the system property `erd.hub.wireCorpus` and hold the Kotlin hub to every vector but `ideDisplayName`, since the Kotlin hub names no editor.
- **Each vector has one home.** A table moved into the corpus left the spec that held it. A spec keeps only what JSON cannot carry (a 64 MiB frame, a schema, `undefined` or `NaN`) and what is JavaScript's own (the `SyntaxError` a `notJson` message names).
- **`conformance.test.ts` loads the corpus through the bundler.** It imports it with `?raw`, because `node-free.test.ts` scans the tests too and would refuse a `node:fs` read.

## Common Patterns

- `HubErrorCode` is an `as const` map paired with a same-named type; `HubErrorCodeSchema` is `Schema.Literals` of its values.
- A schema and its type share a name (`LockRecord`, `HubError`, `HubRequest`, ...), the type being `typeof X.Type`. Struct properties come out `readonly`. Arrays are `Schema.mutable`, so they still pass to the `string[]` / `unknown[]` parameters of `paths.ts` and the consumers.
- Message types are `Extract` over the union schema's type on `method`, so narrowing on `method` narrows `params` and `result` too.

## Dependencies

### Internal

None: this package depends on no workspace package. It is `private: true`.

### External

- **`effect` is the one peer dependency.** `effect` (`catalog:`) is a peerDependency plus a devDependency for this package's own build and specs. `createExternal` reads `peerDependencies`, so every `effect` import stays bare in `dist/*.js` and `dist/*.d.ts`.
- **The bundles inline this package and effect.** `mcp-server`, `vuerd-vscode` and `obsidian-plugin` list this package as a devDependency and inline it. They list `effect` beside it, from the same `catalog:` pin, so one copy resolves for both and each bundle inlines that one copy.
- **`agent-hub-host` names it in `dependencies`.** That keeps it a bare import in `agent-hub-host`'s `dist/`, so the two editor hosts inline one copy for themselves and `agent-hub-host` alike. Two copies would make two `HubRequestError` classes.
- **`sideEffects: false` holds.** No module here registers or mutates anything at load; it only builds schemas, classes and functions. `effect` declares its own `sideEffects` list.
- **What `dist/` imports, checked 2026-10-03 on effect 4.0.0.** `dist/*.js` imports `effect` only. `dist/*.d.ts` imports `effect` plus an inline `import('effect/Cause')` type that `tsc` writes itself, all bare.
  - That type is the `YieldableError` base of `FrameError` and `HubRequestError`, which no source here names. A grep for `from 'effect` misses it, and it resolves through effect's `./*` wildcard.
  - Nothing from `node_modules/effect` is inlined. `node_modules/.pnpm` holds one `effect@4.0.0`, the version this package and every consumer resolve.
- **Two consumers import from all five modules.**
  - The MCP server: `readLockDirectory` and `selectHub`, `matchRank` and `outranks`, `encodePeerToHubFrame` and `decodeHubToPeerFrames`, `lockFilePath`, `pipePath`, `parseLock` and `ideDisplayName`, `isSamePath`, `toSegments` and `unsafeSegment`, and the protocol's version, codes, `DocumentInfo` schema and `protocolMismatchMessage`.
  - `agent-hub-host`: `readLockDirectory` and `selectHub`, `encodeFrame`, `encodeHubNotificationFrame` and `decodePeerToHubFrames`, `lockFilePath`, `lockDirPath`, `pipePath` and `pipePathFits`, `serializeLock` and the lock modes, `authorize` and `unsafeSegment`, and the protocol's version, codes, `HubRequestError` and `protocolMismatchMessage`.
  - The two editor hosts' document sides import `isSamePath`, `HubErrorCode` and `HubRequestError` themselves, with `DocumentInfo`, `JoinResult` and `Platform` as types only. The extension's also imports `longestPrefixIndex` and `toSegments`, for `spelledUnder`.
- **File pruning is not exercised.** The two consumers above import from all five modules, so no module file is pruned. Inside a used module, a declaration initialized by a call stays even when unused: `HubRequestError` reaches the MCP bundle, which never imports it.
- **Of the three bundles, only `mcp-server`'s is gated.** Its `bin.test.ts` holds the one-file bundle, effect included, to `BUNDLE_GZIP_BUDGET` (`packages/mcp-server/AGENTS.md`, Rules § Build, size and imports). `vscode-extension`'s AGENTS.md (Testing Requirements § Build and debugging) says nothing gates its bundle's size. Nothing records the size of the Obsidian plugin's `main.js`.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
