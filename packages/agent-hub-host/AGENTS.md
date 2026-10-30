<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-09-26 | Updated: 2026-10-11 -->

# agent-hub-host

## Purpose

`@dineug/erd-editor-agent-hub-host` is the editor window's side of the document hub that `agent-hub` specifies. It holds the pipe a window listens on, serving one connection (hello, authorization, routing, framing), path authorization over the real file system, the lock file and the sweep of dead windows' locks, and the hub's lifecycle as the host's state changes. `vscode-extension` and `obsidian-plugin` build their document sides on it; the IntelliJ plugin re-implements it in Kotlin (`packages/intellij-plugin`) with no build edge to it. A change keeps the three hubs alike in the `documentRules.ts` texts, the `joinWindow.ts` rules and what `serveConnection` answers, which `src/__fixtures__/conformance.json` holds them to. It is `private: true` and built for Node.

## Making a Change

1. **Read the other sides too.** For a change a host or an agent can see, read the AGENTS.md of `agent-hub`, `vscode-extension`, `obsidian-plugin`, `mcp-server` and `intellij-plugin` (Coding-Agent Hub), as each specifies, hosts, joins or copies the hub.
2. **Put corpus-shaped behaviour in the corpus.** A change to a connection answer, a `documentRules.ts` text, a `joinWindow.ts` table, a pipe path or an authorization result updates its vector in `src/__fixtures__/conformance.json`, since the Kotlin hub's Gradle tests read the same file.
3. **Run this package's checks** (root steps 3 and 4; Vitest runs in a node environment):

   ```sh
   pnpm exec vp run --filter @dineug/erd-editor-agent-hub-host --fail-if-no-match test
   pnpm --filter @dineug/erd-editor-agent-hub-host test:coverage
   ```

4. **Run `pnpm check`, then `pnpm build`** (root step 5). It also builds the MCP server for the conformance run in step 7 below.
5. **Run both hosts' suites.** This suite cannot see a host break, so run the `test` task and `test:coverage` of `vuerd-vscode` and `obsidian-plugin`. After a change in `agent-hub`, run those of this package and `mcp-server` too.
6. **Update the hand-written peers** when a peer can see the change (a frame, a refusal text, a join rule). Make `mcp-server`'s `src/__test-utils__/fakeHub.ts` answer the same and run its `test` task, because the MCP specs run against that hand copy, never against this package. A frame or protocol change also goes into `packages/vscode-extension/test/integration/agent-hub.test.ts`, the Extension Host e2e peer, which imports neither package and writes its frames by hand.
7. **Port it to the Kotlin hub** (`intellij-plugin`'s AGENTS.md, Coding-Agent Hub, Changing the hub) and run root step 6's `cd packages/intellij-plugin && ERD_MCP_CONFORMANCE=required ./gradlew check`. Without the variable a missing MCP build skips the conformance run instead of failing it.
8. **Run or name the in-editor checks.** Only `vuerd-vscode`'s Extension Host e2e and the Obsidian plugin's smoke run the hub inside its editor. Run the ones the change reaches (root step 6) and name any left out in the report (root step 7).

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | The public surface, every module's members but `HubEnvironment.ts`'s `isAlive`, which only `nodeHub.test.ts` imports, with the six `layer`s renamed apart: `lockFileLayer`, `hubEnvironmentLayer`, `hubListenerLayer`, `hubLoggerLayer`, `nativeFileSystemLayer`, `documentHubLayer`; `index.test.ts` pins the runtime names |
| `src/compose.ts` | `nodeHubServices(version)`: `LockFile` over this machine's `HubEnvironment`, `HubListener` and native file system; `withDocumentHub(documents, hub)`: the one runtime layer a host builds |
| `src/services/HubHost.ts` | `HubHost`, `HubDocuments` (with `DocumentPublisher`), `HubHandlerService`, `Unsubscribe`: what a host provides |
| `src/services/DocumentHub.ts` | `DocumentHub` and its `layer`: the state-change queue, `listensAhead`, the publisher and `PUBLISH_WAIT`, the lock repair (`LOCK_REPAIR_MS`, `LOCK_REPAIR_MAX_MS`), `close`, `releaseSync` |
| `src/server.ts` | `serveConnection` (hello, peer ids, a path authorized before its handler, reader and writer fibers, `drain`), `HubConnection`, `HubHandler`, `HubRoutedMethod`, `ServeOptions` |
| `src/authz.ts` | `realpathOrSelf`, `resolveRealPath` (symlinks resolved on the longest existing prefix), `authorizePath`, `AuthzScope` |
| `src/lockFile.ts` | `LockFile`: `write` (atomic through `<pid>.json.tmp`, retried on win32 by `isBusyReplace`), `remove`, `removeSync`, `cleanStale` |
| `src/pipePath.ts` | `choosePipePath` (beside the lock, else `<tmpdir>/erd-editor-ide-<pid>.sock`, else none), `tmpPipePath`, `socketFilePaths` |
| `src/joinWindow.ts` | The pure half of a join, generic over the host's view type: `QuietState` with `noteChange`, `noteSave`, `dropRecipient` and `waitForQuiet`; `filterJoinQueue` and `drainJoinQueue`; `JoinPeer`; `actionVersion`, `actionType`, `maxVersion`, `hasChangeAction`; `REPLICA_DEBOUNCE_MS` (200), `JOIN_QUIET_CAP_MS` (500) |
| `src/documentRules.ts` | `ERD_FILE_EXTENSIONS`, `erdFileProblem` / `assertErdFile`, `OPEN_READY_TIMEOUT_MS` (5,000), `SAVE_QUIET_CAP_MS` (2,000); the refusals every host answers alike, the Kotlin hub's included (`fileMissing`, `folderMissing`, `createNeedsInitialValue`, `editorCouldNotOpen`, `openTimedOut`, `notReadyForActions`, `notJoined`, `notOpenInEditor`, `closedBeforeSave`, `closedDuringJoin`); the `unsettledSave` log line and `stripBom` |
| `src/services/HubEnvironment.ts` | `HubEnvironment` (home, temp dir, platform, pid, the host's version, `randomToken`, `isAlive`, `lstat`, `removeFileSync`), `makeNodeEnvironment`, `HubEnvError`, `layer(version)` |
| `src/services/HubListener.ts` | `HubListener` over `node:net`: `listen(pipe)`, a stream of `Socket`s the scope stops; `HubListenError` |
| `src/services/netSocket.ts` | `fromNetSocket`: an effect `Socket` over a `node:net` socket |
| `src/services/nativeFileSystem.ts` | `withNativeRealPath` and `layer`: `NodeFileSystem` with `realPath` on `node:fs/promises`' `realpath` |
| `src/services/HubLogger.ts` | `warnUnsafe` and `layer`: every log line goes to `console.warn` under `[erd-editor hub]` |
| `src/imports.test.ts` | The import guard (Rules, Host boundary) |
| `src/__fixtures__/conformance.json` | The conformance corpus this package and the Kotlin hub are both held to (Testing Requirements) |
| `src/conformance.test.ts` | The corpus's TypeScript reader, which holds this package to every vector |
| `src/__test-utils__/hubLayers.ts` | The memory machine and doubles every spec here runs on; outside coverage and the declaration build |
| `src/__test-utils__/platform.ts` | `specPipePath(dir, name)`: what a spec on the node layers listens on, a socket in `dir`, or on Windows a named pipe `\\.\pipe\erd-spec-<pid>-<n>-<name>`; `mcp-server` keeps a twin |
| `vite.config.ts` | `defineLibraryConfig(import.meta.url, { dts, minify: false, node: true, preserveModules: true })` |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/services/` | The effect services and the host's three tags |
| `src/__fixtures__/` | `conformance.json`, the shared corpus |
| `src/__test-utils__/` | The memory machine, the doubles and `specPipePath` |

## Rules

### Host boundary

- **This package owns the hub; hosts own documents.** It owns what a connection meets before a document is involved, and the lock that advertises it. It came out of `vscode-extension` so that the Obsidian plugin could serve the same hub. Each host keeps its document side (`vscode-extension`'s registry and handlers over its webviews, `obsidian-plugin`'s over its tabs) and hands it in as three effect services:
  - `HubHost`: its name, whether it wants a hub, its root folders and the events that change them;
  - `HubDocuments`: the open documents the lock lists;
  - `HubHandlerService`: every request after `hello`.
- **Compose one runtime per host.** It is `withDocumentHub(<its documents layer>, documentHubLayer)`, the hub provided with the host's `HubHandlerService`, `HubHost` and `HubDocuments` layers, `nodeHubServices(version)` and `nativeFileSystemLayer`. See `vscode-extension`'s `src/hub/index.ts` and `obsidian-plugin`'s `src/hub/runtime.ts` and `src/main.ts`.
- **Keep editor APIs out of this package.** Shipping code imports only its own modules, `node:net`, `node:fs`, `node:fs/promises`, `node:os`, `node:crypto` and `node:path` (never a bare builtin name), effect's named entries, `@effect/platform-node/<Module>` and `@dineug/erd-editor-agent-hub`. Two editors inline it; either's API would break the other. `imports.test.ts` enforces the list and reads `require` and dynamic `import` calls as imports.
- **What `HubHost`'s members promise.** `ide` is what the lock's `ide` and every `hello` answer carry (`vscode`, `obsidian`; the Kotlin hub writes `intellij`), and what the MCP server names the editor by. `isEnabled()` may throw, as reading a broken setting does; the hub logs it and keeps the state it had. `folders()` gives the roots, each taken by its native real path; a folder whose realpath fails stays as given.
- **Keep the two host events apart.** An enabled change runs through `enqueueListen`, counted in `listensAhead` because it may listen; a folder change runs through `enqueue`. VS Code maps trust and `dineug.erd-editor.agentHub.enabled` to the first and workspace folders to the second. Obsidian maps its Coding agents setting to the first and has no folder event, since a vault window has one root.
- **`HubDocuments.setPublisher` publishes now, then on change.** The hub hands the publisher over at the end of its acquire without awaiting that first publish, which queues behind the startup task. So a window disposed in the same tick binds nothing and writes no lock.

### Failure handling

- **The hub never throws at the editor.** Every failure goes to `console.warn` under `[erd-editor hub]` (`HubLogger`, the prefix byte-for-byte as the extension always wrote it), so the editor keeps working.
- **Build the documents first, the hub on them.** `withDocumentHub` builds the host's documents first, which cannot fail, then the hub on them under `Layer.catchCause`. A hub that fails logs `could not start the document hub` and leaves the documents serving every editor; finalizers run hub first. It is one runtime of two layers: one layer would let a failed hub take the documents' IO down with it, and two runtimes a host would have to order and time out apart.
- **Listen before the lock names the pipe.** Rewrite the lock to `hub: false` before closing the pipe. State changes run on one promise queue whose `.catch` logs.
- **Fall back to a `hub: false` lock.** A hub that cannot listen still writes one, with an empty `pipe`, because a window with no lock invites headless writes over its open editors. One whose `hub: true` write failed after it listened closes the pipe, writes `hub: false`, and listens again on the lock repair (Lock file).
- **A peer's open handle does not block relisten.** Measured 2026-09-27 on Windows 11 26200 with Node 22.21.1's `listen` and the Kotlin hub's `NamedPipeListenerFactory` (`FILE_FLAG_FIRST_PIPE_INSTANCE`). Both bound the pipe name again at once after the hub stopped serving it, and again 1 s later. An agent still held its client handle (a raw handle, a paused socket, a half-open one).

### Publisher

- **Resolve at once while a listen is ahead.** The publisher queues every lock write in order but resolves at once while a task that may listen is queued ahead (the startup task, an `apply`, a repair). So an editor opening never waits on a hub coming up, a listen that does not return or a hub that failed.
- **Once up, wait for the listing.** It waits for the rewrite that lists the document, so an agent resolving the file finds this window's lock before the editor takes an edit. It waits `PUBLISH_WAIT` (one second) at most, then logs and lets the editor open. A task ahead of that rewrite can stall for good (the realpath of a folder just added or of a listed document on a stalled mount, or a lock write), and every later rewrite queues behind it. `DocumentHub.test.ts` pins the fast path, the wait and the warning.

### Shutdown

- **`close` runs after the queue.** It is the layer's finalizer: it deletes the lock, then closes the pipe and deletes the socket. VS Code's `deactivate` awaits it through the runtime's dispose. A stalled task or a listen that never returns also holds `close`.
- **Call `close` first, then wait interruptibly.** Both hosts bound the dispose with a 5 second `Effect.timeout`, which ends it only by interrupting it, and effect runs a scope's finalizers uninterruptibly (Effect-TS/effect#8512, a `ManagedRuntime`'s dispose included). So the finalizer calls `close` first and only then waits for it, under `Effect.interruptible`.
- **A timed-out dispose gives up only the wait.** The close goes on and still deletes the lock should the stalled task return (Same-pid restarts says what that can delete), and the finalizers after it still run. Awaited bare, the wait held the dispose for good, and with it VS Code's `deactivate` and the Obsidian plugin's next instance, which starts only once the last close settled. `DocumentHub.test.ts` pins the give-up and the late delete.
- **Keep the hub on the sequential scope chain.** Never put the hub layer under `Layer.merge`, `Layer.mergeAll` or an array handed to `Layer.provide` / `Layer.provideMerge`. The interrupt reaches the wait only on the fiber running the dispose. A parallel scope runs each finalizer on a forked fiber that inherits the uninterruptible close, which the timeout never interrupts, and awaits that fiber uninterruptibly, so the dispose holds for good again. `withDocumentHub` chains with `Layer.provideMerge`, VS Code's `documentHubLive` with one-layer `Layer.provide`s, Obsidian's runtime with `Layer.tap` and `Layer.provide`. Merging the hub's own dependencies (`nodeHubServices`, the memory machine) is harmless; merging the hub or a layer that holds it is not. `compose.test.ts` pins the give-up through `withDocumentHub`.
- **`releaseSync` serves a host going down unawaited.** That is a process or page that goes down without awaiting `close`: Obsidian's `quit` event and `pagehide` (a window closing, reloading or quitting, where `onunload` never runs). Before it returns it deletes the lock, its temp file and both socket files `socketFilePaths` names through `removeFileSync` (`unlinkSync`). It lets go of the host's events and marks the hub closed, so no queued task writes the lock again. A write already on its way to disk when it ran is deleted again when its rename lands (`keepUnlessReleased`). It is idempotent, and a `close` may still follow.

### Same-pid restarts

- **Clear the pipe path's socket file before listening.** Otherwise `listen` fails `EADDRINUSE`. A dead process with this pid can have left one. So can an earlier hub of this very process: an Obsidian reload, or the plugin disabled and enabled again or updated, which keep the renderer pid.
- **Serialize a new instance behind the old close.** A host whose new instance can start before the old one's `close` finished serializes the two, since both use the same paths. Obsidian keeps the closing promise under a `Symbol.for` key, and its next instance awaits it.
- **The serialization ends at the dispose timeout.** Past it the old close goes on beside the next instance. Should the task stalling it return, it deletes the lock and, on POSIX, the socket file at those paths, by then the next hub's. That lock comes back only with the next hub's next rewrite, and that socket file only when it listens again.
- **Windows blocks the next hub's listen (known limit).** While the old one still holds the pipe name, `listen` fails `EADDRINUSE`. The next hub writes a `hub: false` lock and listens again only when the host's enabled state changes, so the window refuses agents' writes until then.

### Windows pipe security

- **Keep libuv's default pipe descriptor, on purpose.** `HubListener` passes no `readableAll` / `writableAll`, so the pipe takes the default DACL of the window's token.
- **An elevated window's DACL omits the user.** Measured 2026-09-27 on Windows 11 26200, Node 22.21.1, libuv 1.51.0: unelevated `O:<user> D:(A;;FA;;;SY)(A;;FA;;;BA)(A;;FA;;;<user>)(A;;FR;;;WD)(A;;FR;;;AN)`, elevated `O:BA D:(A;;FA;;;SY)(A;;FA;;;BA)(A;;FA;;;BA)(A;;FR;;;WD)(A;;FR;;;AN)`. So a window started as administrator refuses an unelevated agent of its own user. Every window refuses an agent at Low integrity (a sandbox) through the implicit Medium no-write-up label. `connect` fails `EPERM` (`ERROR_ACCESS_DENIED`).
- **A refused agent still reads the lock.** The lock an elevated window writes inherits the profile's ACL, so such an agent reads it. It gets `hubUnreachable` with the MCP server's denied text (its `isAccessDenied`), never a headless write. An elevated agent reaches an unelevated window. Any other account opens the pipe read-only at most and cannot write the `hello` a peer needs.
- **`readableAll` / `writableAll` were refused on measurement.** `uv_pipe_chmod` prepends `(A;;0x12019f;;;WD)`, connect and create-instance rights for every account. A Node pipe does not reject remote clients (an SMB loopback client connected). The lock's token would then be the only gate, and another account could create an instance of the pipe to catch an agent's `hello` and its token. Node cannot set any other DACL without native code, which no host loads. The Kotlin hub's pipes take the same default descriptor, measured alike.

### Lock file

- **Write the lock atomically and owner-only.** `write` removes a leftover temp file, since a `writeFile` keeps an existing file's mode. It writes `<pid>.json.tmp` with `LOCK_FILE_MODE` (`0o600`) and renames it over the lock, so the lock is never readable by others. The directory is made `LOCK_DIR_MODE` (`0o700`).
- **Retry the replace on win32 only.** On Windows the rename is `MoveFileExW(REPLACE_EXISTING)`, which refuses the replace while any process has the lock open, whatever its share mode. Every reader holds it open for milliseconds: agent-hub's `readLockDirectory` 1.6 ms at the median and 21 ms at most, measured 2026-09-27 on Windows 11 26200. So on win32 alone it retries 5 times, 10 ms doubling, about 400 ms on Windows' timer, while the failure's reason tag is `Unknown` (libuv's `EPERM`, which platform-node folds into it), `PermissionDenied` or `Busy` (a held temp file). Deleting a lock a reader holds works at once on Windows too, so `remove`, `removeSync` and `cleanStale` need no retry.
- **`isBusyReplace` reads the reason tag alone.** The fold keeps no errno. Any other retry of a replace on Windows, such as `mcp-server`'s headless write, keeps a twin of it by the same three tags, documented on both sides, with a schedule of its own. The Kotlin hub's twin is `refusedWhileHeld`, by exception class.
- **Repair a failed write on a backoff.** A write that still fails logs `could not write <lock>` once and answers `false`. The hub repairs it `LOCK_REPAIR_MS` (1 s) later, doubling while repairs fail up to `LOCK_REPAIR_MAX_MS` (30 s), and back to 1 s once a write landed. The repair runs `apply` and rewrites the lock without waiting for the next state change. So a document outside the folders that the lock missed gets listed, and a stale `hub: true` of a hub turned off goes.
- **Queue a repair by whether it may listen.** A repair goes through `enqueueListen` only when its `apply` may listen (not serving and not turned off), else through `enqueue`. So a publish behind a repair that only rewrites still waits for its listing. `close` and `releaseSync` cancel its timer, and a repair already queued is skipped once closed.
- **Warn once per run of failures.** A run of failed lock writes warns once, and so does a run of failed listens (`lockFailing`, `listenFailing`). While a run lasts, every lock write's `could not write` and every listen's `could not listen` and socket-path warning stays quiet, whether a repair, a folder or document change or the setting asked for it. Otherwise a lock folder this user may not write would warn every 30 s for good. During a run `LockFile.write` runs under `MinimumLogLevel` `Error`, which never reaches the serving fibers. The write that ends a run logs `wrote <lock> again`; a listen that binds ends its run silently.
- **Sweep dead windows' locks at startup.** `cleanStale` reads the directory through agent-hub's `readLockDirectory` and `selectHub`, its own pid filtered out. It deletes the lock, temp file and both possible socket files of every pid that `selectHub`'s `stale` lists with `reason: 'dead'`. A live pid's malformed lock is left alone.

### Process liveness

- **`isAlive` falls back to `os.getPriority` on Windows.** It takes a pid for dead when signal 0 fails, except for `EPERM` on Windows, which asks again through `os.getPriority`. libuv opens the process there for `PROCESS_QUERY_LIMITED_INFORMATION` alone, while its signal asks for the terminate and query rights, which an elevated window refuses an unelevated reader. A success is alive, `EPERM` or `ESRCH` in the `SystemError`'s `info.code` is dead, and any other failure is alive.
- **Elevated windows stay alive to unelevated readers.** Windows grants that one right on every process of this user's logon session at any integrity level. The default DACL gives the logon SID `0x121411` (measured 2026-09-27 on Windows 11 26200, an elevated process `O:BA D:(A;;0x1fffff;;;BA)(A;;0x1fffff;;;SY)(A;;0x121411;;;<logon SID>)`). So its lock is never deleted, which would send agents writing its files behind the editor.
- **Other owners' reused pids count dead.** Windows refuses that right to SYSTEM, a service, a protected process or another user, none of which wrote a lock in this home. So a crashed window's pid reused by one of them counts dead and its lock is swept. An elevated reader may query those too and keeps such a lock, as root does on POSIX. On POSIX `EPERM` is another user's process, which a lock in this user's home never names, so a crashed window's pid reused by a root daemon still counts dead.
- **The twins sweep alike.** The MCP server's `isAlive` is the twin, and the Kotlin hub asks `OpenProcess` for the same right (`WindowsProcess`). On that machine the built sweeps of this package and of the Kotlin hub kept and swept the same locks, read at Medium and at High.
- **Liveness checks assume an unsandboxed reader.** A reader whose token may write `~/.erd-editor/ide` but not query the user's processes would count live windows dead and sweep their locks. By the descriptor above, so would an unelevated reader looking at an elevated window of another logon session of the user (a second sign-in, a scheduled task). A lock swept that way comes back only with that window's next state change, since no hub checks that its own lock still exists (accepted).
- **Administrator protection hides an elevated window.** Windows 11 Administrator protection (`TypeOfAdminApprovalMode` 2) runs an elevated window as a separate hidden account, `ADMIN_<user>`, with its own profile and `USERPROFILE`. Its lock lands in that profile's `.erd-editor\ide`, so no unelevated reader of this home reads or sweeps it, and an unelevated agent does not see that window at all and writes headless. That is Microsoft's documentation; the measuring machine runs mode 1, Admin Approval Mode's split token of one account.
- **Start no hub in a separate pid namespace.** Pids name windows only within one pid namespace. A host in a sandbox with its own namespace (Flatpak) starts no hub, as the Obsidian plugin does. Otherwise its sweep would take every window outside for dead, and a sweep outside would take its lock for dead.

### Path authorization

- **Resolve the real path, then call `authorize`.** `authz.ts` leaves the folder and document rule to agent-hub's `authorize` Effect.
- **Refuse Windows-unsafe names before touching disk.** On `win32`, a target holding a name agent-hub's `unsafeSegment` flags is refused as `badRequest` before the climb touches the disk. Such names are a colon (a stream, as in `notes.txt:x.erd`), a device such as `COM1.erd`, or a trailing dot or space; the why is in agent-hub's AGENTS.md. The text is `<path> holds "<name>", which Windows does not store as written: …`. A real path that meets such a name through a link into a folder `sub.` is refused too, and the text then names the real path.
- **The corpus pins the win32 cases.** Its first `win32` authorize vectors pin the text, and a non-ASCII name and a control character quoted as `JSON.stringify` quotes them. They also pin that a share spelling of a drive folder (`\\localhost\C$\ws\a.erd` against `C:\ws`) stays `outsideWorkspace`, since paths compare as strings.
- **Climb a missing tail only on two `NotFound`s.** It climbs only when `realPath` fails `NotFound` and `HubEnvironment.lstat` fails `NotFound` too. A dangling symlink, any other `realPath` error, or a `..` behind a missing directory is refused as `outsideWorkspace`, because `realpath` cannot see where a write through it would land.
- **Keep `lstat` on `HubEnvironment` with its raw errno.** Moving it to `FileSystem.readLink` would fold `EINVAL`, `EPERM`, `EIO` and `ENAMETOOLONG` all into `Unknown` in its `PlatformError`. The hub would then read a file it cannot examine as one that exists.

### Native realpath

- **Take every real path from the native realpath.** The lock's `workspaceFolders` and `documents`, authorization, and each host's registry keys and `listDocuments` resolve through `nativeFileSystem.ts`: `NodeFileSystem` with `realPath` on `node:fs/promises`' `realpath`. `mcp-server` resolves an agent's path the same way (its `io/fileSystem.ts`).
- **`NodeFileSystem`'s own `realPath` keeps the given spelling.** It is the JS `fs.realpath`. On macOS a differently cased path, and a folder handed over in NFC whose name the disk holds in NFD (as Finder writes Korean names), came back as given while the MCP server's came back as on disk. `selectHub` then found no lock covering a document open in the window, answered headless where a `hub: false` lock should have blocked, and a write landed under the editor.
- **Fall back to `NodeFileSystem` for the reason tag.** When the native realpath fails, `NodeFileSystem`'s runs, so the failure carries its reason tag. `nodeHub.test.ts` holds both spellings to the disk's through `realpathOrSelf`; `vscode-extension`'s `nodeRegistry.test.ts` does so through its registry's keys.

### Serving a connection

- **Decode with agent-hub's `decodePeerToHubFrames`.** A request `PeerToHubMessage` takes is served as decoded, with fields it does not know dropped. A frame it refuses is read by hand, which decides its answer:
  - a first frame that is no hello: a hang-up;
  - a hello whose token or protocol is off: `unauthorized` or `protocolMismatch`;
  - an unknown method, or a missing `path` or `actions`: `badRequest` with its id;
  - a `hello` without `client`: admission under the name `''`;
  - `listDocuments` without params: the handler, with `{}`;
  - after `hello`, a frame without an id: logged and skipped.
- **Admit a peer only on a valid `hello`.** A token of another length is refused at once; one of the same length is compared character by character to the end, whatever the first difference. A peer's id is taken when its `hello` passes, so a refused peer consumes none.
- **Encode with agent-hub's encoders.** Notifications go out through `encodeHubNotificationFrame`. A response is `encodeFrame` of what the handler returned, and one that JSON cannot frame answers `internal`. A `HubRequestError` answers with its code; any other failure or defect answers `internal`.
- **Only `applyActions` holds back later frames.** Frames pass authorization in arrival order. An `applyActions` holds the frames behind it until it is answered, so one peer's edits land in its own order. Any other request is left running and does not hold back the frames behind it.
- **Read in a fiber of its own.** `serveConnection` reads in its own fiber and serves from a queue, so a peer hanging up marks the connection closed at once rather than behind the request in flight. That request is forked detached, so a save or an open already writing runs to its end and only its response is dropped.
- **Closing the serving scope destroys every connection.** That includes one accepted in that very tick, which is also what lets `server.close` settle.
- **Keep the read and write halves apart.** Read frames with `Socket.readerString`, and drain the outbound queue through `socket.writer` in a fiber of its own. One duplex `Socket.toChannelString` channel would couple them: a write failure there fails the read side too, and a `CloseEvent` offered after it can no longer reach the socket. Apart, a write that cannot reach a peer is logged and leaves the connection serving. A hang-up still destroys the socket of a peer whose frame could not be read, where a refused `hello` only ends the write side. The connection waits on the writer fiber before its scope closes, so the last frames still go out.
- **`drain()` resolves once queued frames are out.** That is, every frame queued before the call was written or refused, or the connection stopped writing. Obsidian's plugin, turning off, sends `documentClosed` to its peers and awaits their drains (one second at most) before it disposes the runtime and the listener destroys the sockets.
- **Use `fromNetSocket`, not platform-node's `NodeSocket`.** `NodeSocket` would put `ws` into every host's bundle. `fromNetSocket` attaches its no-op `error` listener where the connection is accepted, not inside the reader: a reset peer emits `error` right before `close`, and a socket nothing has read yet would throw it in the host instead. It sets `setEncoding('utf8')`, a streaming decoder, so a character split between two reads survives.

### Join window

- **Apply the join rules alike in every host.** `joinWindow.ts` holds rules every host applies over its own view key (`vscode.Webview`, an Obsidian tab), so an agent meets one behaviour in every editor that serves the hub; the Kotlin hub is a third implementation, over its editor pages. The hosts' specs pin where each calls them.
- **A change waits for the views it reached.** It notes the ready views it reached, copied at that moment; each owes one replica save. The wait ends once every one of them saved or closed (`dropRecipient`) and at least one save came. So a view that becomes ready later never holds it open and its save settles nothing by itself, while a change that reached no view still waits for one save.
- **Ignore saves inside `REPLICA_DEBOUNCE_MS`.** A save sooner than that after a peer batch was sent cannot hold the wait and is not counted. A relay bounds nothing, since it can arrive after its replica saved.
- **The helpers' contracts.** `waitForQuiet` answers `true` at once with nothing pending and `false` at its cap. `filterJoinQueue` drops what the snapshot holds (a version up to `snapshotVersion`) and every version-less action, since a relative move applied twice moves twice. `hasChangeAction` counts every action but the six LWW and tracker types as a change, so a stranger only costs a wait.
- **`drainJoinQueue` ends a window.** It runs the captured batches through `filterJoinQueue` and logs a drop (`dropped <n> queued actions joining <path>: …`). It hands back those plus every batch queued after the capture, whole, in order. Each host's `endJoinWindow` delivers them if its peer is still the one that joined.

### Document rules

- **`documentRules.ts` is the one list of served files.** Anything else is refused with `badRequest` `<path> is not an ERD file; the hub serves .erd, .vuerd, .erd.json, .vuerd.json only`. The path is lowercased first, as the MCP server's own check does.
- **Hosts take their lists and waits from it.** `vscode-extension` builds its activation glob from `ERD_FILE_EXTENSIONS` and asserts the list against its manifest. The Obsidian plugin filters its vault listing with `erdFileProblem`. `OPEN_READY_TIMEOUT_MS` and `SAVE_QUIET_CAP_MS` are the two waits every host's `openDocument` and `save` use.
- **Write a shared refusal as a constructor here.** Every refusal an agent can meet in every host in the same situation is one, pinned once in the corpus, so the hosts cannot drift apart, the Kotlin hub included. One that names the editor takes its name (`editorCouldNotOpen('VS Code', …)`). A situation only one host has (the read-only views, Obsidian's plugin turning off) keeps the host's own words.

### Build

- **Build with `node: true`.** It makes `defineLibraryConfig` target `node22` and keep every builtin bare, `node:` or not. Without it a builtin resolves to Vite's empty browser stub with only a warning, and `net.createServer` is undefined at runtime.
- **Keep `@dineug/erd-editor-agent-hub` bare in `dist/`.** A copy inlined here would give a host two `HubRequestError` classes, and every refusal its handlers throw would fail `toHubError`'s `instanceof` and answer `internal`.
- **Keep `createLibraryTasks` out of `vite.config.ts`.** Even a comment counts, because `check-task-inputs.mjs` tells the two library helpers apart by it.
- **`engines.node` binds the host bundles.** Its `>=22.12.0`, the root's floor, binds the bundles this package is inlined into. One is the extension's, on the VS Code 1.101 host (Node 22.15). The other is the Obsidian plugin's `main.js`, on the Node of the Electron its installer brought: Node 22.22.1, Electron 39.8.3 under the Obsidian 1.12.7 installer, measured 2026-09-26; an older installer was not checked.

## Testing Requirements

- **Build unit specs on the memory layers.** Here or in a host, they build those of `src/__test-utils__/hubLayers.ts` (or the host's own). They never provide the node layers (`hubEnvironmentLayer`, `hubListenerLayer`, `NodeFileSystem.layer`, `nativeFileSystemLayer`, or `nodeHubServices`, which carries them), which would bind a socket and write a lock under the real home directory.
- **Two specs bind real sockets.** The exceptions are `src/services/nodeHub.test.ts` and `src/services/netSocket.test.ts`, the first running the node layers (and `authorizePath` on them), the second `fromNetSocket` over `node:net` itself, both against a `mkdtemp` directory and listening on `specPipePath`, a named pipe on Windows. `nodeHub.test.ts`'s errno case reads `ENOTDIR` under a file on POSIX and `EINVAL` for `\\.\pipe\` on Windows, where a path under a file answers `ENOENT`. Its `LockFile` case writes over a lock another handle holds open, which on Windows lands only through the rename retry.
- **The memory helpers.** The specs build the hub with `startMemoryHub` over `createMemoryHub()`: the file system, `HubEnvironment` and `HubListener` over maps and POSIX paths, every member a `vi.fn`, `connect` to a pipe. `createMemoryHost` gives `enabled`, `roots`, `fireEnabledChange`, `fireFoldersChange` and an `isEnabled` a spec can make throw. `createMemoryDocuments` publishes what it holds the moment it gets the publisher. `createMemoryHubServer` and `createMemorySocketPair` serve single connections, `createHubHandler` answers plausibly, and `runHub` / `runMemory` run effects under the hub's logger. They stand in for `@effect/vitest` (root § Dependencies, External), and `imports.test.ts`, which reads the specs too, refuses every `@effect/*` but a platform-node module path.
- **Run timing specs on fake timers.** The rename retry and repair specs do, with the exact delays as their bounds. `DocumentHub.test.ts`'s repair specs fake only `setTimeout` and `clearTimeout`, and let the hub settle over the real `setImmediate`, which effect's scheduler yields through.
- **Keep the test utilities private.** Nothing in `src/__test-utils__/` is exported. `vscode-extension` keeps its own `test/mocks/hubLayers.ts` over the production symbols. `obsidian-plugin` keeps its `src/__test-utils__/hub.ts`, whose socket specs run the shipping `serveConnection` over a real unix socket (a named pipe on Windows) through `fromNetSocket`.
- **The corpus binds a second implementation.** `src/__fixtures__/conformance.json` holds the vectors such an implementation meets, and its `$comment` fields say how each section is read:
  - connection scenarios: the raw pieces a peer sends, the exact frames the hub writes, whether it stays open, ends or hangs up, the paths handed to `authorize` (which pin that a request's params are checked before its path is authorized), the handler calls normalized and the log texts;
  - the `documentRules.ts` texts and the `joinWindow.ts` tables, with versions past 2^31 as an editor's slot makes them (counter times 2^22 plus the slot), which a hub reading a version as a 32-bit integer fails;
  - the pipe paths, and `resolveRealPath` / `authorizePath` over a memory machine per vector.
- **Two suites read the corpus.** `conformance.test.ts` drives `serveConnection` over `createMemorySocketPair` with `createHubHandler`, and the rest over the memory layers. It loads the file with `import.meta.glob` (`?raw`), as `imports.test.ts` reads the sources. This package is the oracle, so a vector it fails is a wrong vector. The Gradle tests of `packages/intellij-plugin` read it through the system property `erd.hub.hostCorpus`.
- **Give each vector one home.** A table moved into the corpus left the spec that held it. The spec keeps what the corpus normalizes away (the params object a handler gets, a log's detail) and what needs timing, a failing write, a second connection or a thrown defect. `joinWindow.test.ts` also keeps NaN, which JSON cannot hold.
- **Add a new non-change type to `joinWindow.nonChangeTypes`.** That list is checked one way only, each type in it changing nothing, since `joinWindow.ts` keeps its set unexported. A type added to the set goes into the list too; otherwise the Kotlin hub waits out the join cap on it for a save that never comes.

## Common Patterns

- Service tags are keyed `@dineug/erd-editor-agent-hub-host/<Name>`.
- A module with a node or memory implementation exports it as `layer`, which the barrel renames (Key Files, `src/index.ts`).
- `services/HubHost.ts` holds the three tags a host provides itself (`HubHandlerService` keyed `HubHandler`) and no layer.
- Every service a host provides is a plain object shape (`HubHostShape`, `HubDocumentsShape`, `HubHandler`), so a host adapter is `Layer.succeed` or a `Layer.effect` over its own registry.

## Dependencies

### Internal

- `@dineug/erd-editor-agent-hub` in `dependencies`, which keeps it a bare import (Rules, Build). This package uses all five of its modules: the protocol's version, codes, `HubRequestError` and `protocolMismatchMessage`; `encodeFrame`, `encodeHubNotificationFrame` and `decodePeerToHubFrames`; `lockFilePath`, `lockDirPath`, `pipePath`, `pipePathFits`, `serializeLock` and the lock modes; `authorize` and `unsafeSegment`; `readLockDirectory` and `selectHub`.

### External

- `effect` and `@effect/platform-node` (`catalog:`) are peerDependencies, which `createExternal` keeps bare imports, and devDependencies for this package's own build and specs. Platform-node is imported by module path, `NodeFileSystem` only.
- `vuerd-vscode` and `obsidian-plugin` list this package, `@dineug/erd-editor-agent-hub`, `effect` and `@effect/platform-node` as devDependencies and inline one copy each (root § Working In This Directory, Externals).
- A consumer program that type-checks `dist/*.d.ts` needs `@types/node` (`netSocket.d.ts` names `node:net`'s `Socket`) and `skipLibCheck` (effect's own declarations).
- `sideEffects: false` holds: no module registers or mutates anything at load.
- Checked 2026-10-03 on effect 4.0.0: `dist/*.js` imports `effect`, `effect/socket`, `@effect/platform-node/NodeFileSystem`, `@dineug/erd-editor-agent-hub` and the six `node:` builtins only, all bare. `dist/*.d.ts` names `effect`, `effect/socket`, `node:net` and `@dineug/erd-editor-agent-hub`, plus two inline `import('effect/Cause')` types `tsc` writes itself.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
