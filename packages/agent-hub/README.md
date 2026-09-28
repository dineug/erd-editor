# agent-hub

> The protocol, lock file and discovery rules that let a coding agent join an open ERD editor

`@dineug/erd-editor-agent-hub` specifies the document hub. An editor window (VS Code, Obsidian or
a JetBrains IDE) listens on a local socket and advertises it in a lock file. The MCP server,
`@dineug/erd-editor-mcp`, reads the locks, connects to the window that owns a file and joins that
document's collaboration stream as one more peer. Every message and the lock file are effect
`Schema`s, and the types, frame decoders and encoders are derived from them.

Internal to the erd-editor monorepo and never published to npm. `effect` is its one peer
dependency. `mcp-server`, `vuerd-vscode` and `obsidian-plugin` list this package and `effect` as
devDependencies and inline one copy of each, while `agent-hub-host` names it in `dependencies`. The
IntelliJ plugin ports the spec to Kotlin with no build edge to this package.

## Modules

| Module | |
| --- | --- |
| `protocol.ts` | `HUB_PROTOCOL_VERSION`, `HubRequest` / `HubResponse` / `HubNotification`, `HubErrorCode`, `HubRequestError`, `protocolMismatchMessage` |
| `lock.ts` | `LockRecord`, `parseLock` / `serializeLock`, the lock and pipe paths, `ideDisplayName` |
| `framing.ts` | JSON lines: `encodeFrame`, one stream decoder per direction, `MAX_FRAME_BYTES` (64 MiB) |
| `paths.ts` | Path comparison and authorization: `isInside`, `isSamePath`, `authorize`, `unsafeSegment` |
| `discovery.ts` | `readLockDirectory` and `selectHub`, which pick the window that owns a path |

No module imports `node:*`. File access goes through effect's `FileSystem` service, and the caller
passes in the home directory, the platform and a pid liveness check, so one spec serves the MCP
server's ESM bundle, the VS Code extension's CommonJS bundle and the Obsidian plugin's `main.js`.

## The hub in brief

- **Lock file.** Each window writes `~/.erd-editor/ide/<pid>.json` (directory `0o700`, file
  `0o600`) with its pipe, workspace folders, open documents, `ide`, version, protocol version, a
  token and `hub`. A window whose `hub` is false still guards its files but accepts no agent. The
  socket is `<pid>.sock` beside the lock, or `\\.\pipe\erd-editor-ide-<pid>` on Windows.
- **Discovery.** `selectHub` ranks the live locks against a target path: an open document
  outranks any folder, a deeper folder a shallower one, then the newest lock, then the higher pid.
  The answer is `live` (connect), `blocked` (a window holds the file with `hub` false, so do not
  write it) or `headless` (no window; edit the file on disk). It also lists the `stale` locks:
  those of dead pids, which are safe to delete with their sockets, and the unparseable locks of
  live pids, which must be left alone.
- **Paths are compared, never resolved.** Callers pass real paths. Matching is per segment and
  case-insensitive on Windows and macOS only. On Windows every side refuses a name Windows would
  not store as written: a stream, a device name, a trailing dot or space.
- **Framing.** One compact JSON value per `\n`-terminated line.
- **Protocol.** A peer sends requests only: `hello` (token, protocol version, client name),
  `listDocuments`, `openDocument`, `join`, `applyActions`, `leave` and `save`. The hub sends the
  `actions` and `documentClosed` notifications. Error codes say whose fault a refusal is:
  `notFound` means only that the document does not exist, and `internal` is the hub failing.

## Usage

Finding the window that owns a file, as the MCP server does:

```ts
import { readLockDirectory, selectHub } from '@dineug/erd-editor-agent-hub';
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import { Effect } from 'effect';
import { homedir } from 'node:os';

// The MCP server's own check also asks again on Windows when signal 0 fails with EPERM.
const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const { selected, stale } = await Effect.runPromise(
  readLockDirectory(homedir()).pipe(
    Effect.flatMap(locks =>
      selectHub(locks, '/work/shop/schema.erd.json', process.platform, isAlive)
    ),
    Effect.provide(NodeFileSystem.layer)
  )
);
```

On `live`, connect to `selected.candidate.record.pipe` and open with a `hello`:

```ts
import { encodePeerToHubFrame, HUB_PROTOCOL_VERSION } from '@dineug/erd-editor-agent-hub';

socket.write(
  encodePeerToHubFrame({
    id: 1,
    method: 'hello',
    params: {
      token: selected.candidate.record.token,
      protocolVersion: HUB_PROTOCOL_VERSION,
      client: 'my-agent',
    },
  })
);
```

Read the answers through `decodeHubToPeerFrames`, a `Stream` step over the socket's text. It hands
each line over as a decoded message or as a `RefusedFrame` that holds the parsed value.

## Conformance corpus

`src/__fixtures__/conformance.json` holds the vectors every implementation must meet byte for
byte: wire frames, lock bytes, lock and pipe paths, the path rules and the Windows name rule.
`conformance.test.ts` holds this package to it, and the IntelliJ plugin's Gradle tests hold the
Kotlin hub to the same file. Update the corpus with the protocol or the lock. A change an older
peer cannot read also bumps `HUB_PROTOCOL_VERSION`.

## Development

```sh
pnpm exec vp run --filter @dineug/erd-editor-agent-hub --fail-if-no-match test
pnpm --filter @dineug/erd-editor-agent-hub test:coverage
```

This suite cannot see a consumer break. After a protocol or lock change, also run the `test` task
of `agent-hub-host`, `mcp-server`, `vuerd-vscode` and `obsidian-plugin`, and `./gradlew check` in
`packages/intellij-plugin`. `AGENTS.md` has the full rules.
