# agent-hub

> The protocol, lock file and discovery rules that let a coding agent join a diagram in ERD Editor

`@dineug/erd-editor-agent-hub` specifies the document hub. An editor (VS Code, Obsidian or a
JetBrains IDE) listens on a local socket and advertises it in a lock file; the MCP server,
`@dineug/erd-editor-mcp`, reads the locks, connects to the editor that owns a file and joins that
document's collaboration stream as one more peer. Every message and the lock file are effect
`Schema`s, and the types, the frame decoders and the request and notification encoders are derived
from them. The package is private, never published to npm, and `effect` is its one peer
dependency. Its consumers depend on it as `"@dineug/erd-editor-agent-hub": "workspace:*"`:
[`agent-hub-host`](../agent-hub-host), the editor's side on Node, names it in `dependencies`;
[`mcp-server`](../mcp-server), [`vuerd-vscode`](../vscode-extension) and
[`obsidian-plugin`](../obsidian-plugin) list it in `devDependencies` and inline it into their
bundles. The IntelliJ plugin ports the spec to Kotlin with no build edge to this package.

## Usage

Finding the editor that owns a file and opening its hub with `hello`, in a Node consumer that
provides effect's `FileSystem` through `@effect/platform-node`:

```ts
import { connect } from 'node:net';
import { homedir } from 'node:os';

import {
  encodePeerToHubFrame,
  HUB_PROTOCOL_VERSION,
  readLockDirectory,
  selectHub,
} from '@dineug/erd-editor-agent-hub';
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import { Effect } from 'effect';

// Signal 0. The MCP server's own check also asks again on Windows when it fails with EPERM.
const isAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const { selected } = await Effect.runPromise(
  readLockDirectory(homedir()).pipe(
    Effect.flatMap(locks =>
      selectHub(locks, '/work/shop/schema.erd.json', process.platform, isAlive)
    ),
    Effect.provide(NodeFileSystem.layer)
  )
);

if (selected.kind === 'live') {
  const { pipe, token } = selected.candidate.record;
  const socket = connect(pipe);
  socket.setEncoding('utf8');
  socket.write(
    encodePeerToHubFrame({
      id: 1,
      method: 'hello',
      params: {
        token,
        protocolVersion: HUB_PROTOCOL_VERSION,
        client: 'my-agent',
      },
    })
  );
}
```

Read the answers through `decodeHubToPeerFrames`, a `Stream` step over the socket's text. The
`setEncoding('utf8')` above, or `Stream.decodeText` over the bytes, keeps a character split between
two reads intact. The step skips blank lines and hands each other line over as a `Result`: the
decoded response or notification, or a `RefusedFrame` (`{ value, issue }`) holding the parsed
value. A line that is not JSON, or a frame over `MAX_FRAME_BYTES`, fails the stream with a
`FrameError`; close the connection then. The MCP server does all of this in
[`src/hub/discovery.ts`](../mcp-server/src/hub/discovery.ts) and
[`src/hub/client.ts`](../mcp-server/src/hub/client.ts), over its own `FileSystem` layer
([`src/io/fileSystem.ts`](../mcp-server/src/io/fileSystem.ts)) and socket adapter
([`src/io/netSocket.ts`](../mcp-server/src/io/netSocket.ts)).

## Modules

| Module | |
| --- | --- |
| `protocol.ts` | `HUB_PROTOCOL_VERSION`; the schemas `HubRequest` / `HubResponse` / `HubNotification` and the direction unions `PeerToHubMessage` / `HubToPeerMessage`; `DocumentInfo`, `JoinResult`, `HubError`; `HubErrorCode` and `HubErrorCodeSchema`; `HUB_REQUEST_METHODS` / `HUB_NOTIFICATION_METHODS`; `HubRequestError`, `protocolMismatchMessage` |
| `lock.ts` | `LockRecord`, `parseLock` / `serializeLock`; `lockDirPath`, `lockFilePath`, `lockFilePid`, `pipePath`, `pipePathFits`; `LOCK_DIR_MODE` / `LOCK_FILE_MODE`, `MAX_PIPE_PATH_BYTES`; `ideDisplayName` |
| `framing.ts` | JSON lines: `encodeFrame`; one schema reader per direction (`decodePeerToHubFrames` / `decodeHubToPeerFrames`) and the schema writers `encodePeerToHubFrame` (requests) and `encodeHubNotificationFrame` (notifications); the generic `decodeFrameResults` / `decodeFrames`; `RefusedFrame`, `FrameError`, `MAX_FRAME_BYTES` (64 MiB) |
| `paths.ts` | Path comparison and authorization: `toSegments`, `isInside`, `isSamePath`, `longestPrefixIndex`, `isAuthorized`, `authorize`; `unsafeSegment`, the Windows name rule; the `Platform` type |
| `discovery.ts` | `readLockDirectory`, which reads the lock files unparsed, and `selectHub`, which picks the editor that owns a path, ranked by `matchRank` and `outranks` |

`readLockDirectory` requires effect's `FileSystem` service; the home directory, the platform and
the pid liveness check are arguments the caller passes.

[`src/__fixtures__/conformance.json`](./src/__fixtures__/conformance.json) is the conformance
corpus, the vectors a second implementation must meet: the shared constants (the protocol version,
`MAX_FRAME_BYTES`, the error codes in order, the lock modes, `MAX_PIPE_PATH_BYTES`); the wire
frames and the encoders' output; frame bytes, chunked streams, a character split between reads and
the blank-line set; the protocol mismatch texts; lock bytes and parsing; lock and pipe paths; the
path rules, the Windows name rule and `ideDisplayName`. `conformance.test.ts` holds this package to
every vector. The IntelliJ plugin's Gradle tests hold its Kotlin hub to every vector but
`ideDisplayName`, since that hub names no editor.

## The hub in brief

- **Lock file.** Each editor (a VS Code or Obsidian window, or a JetBrains IDE process for all its
  projects) writes `~/.erd-editor/ide/<pid>.json` (directory `0o700`, file `0o600`) with its pipe,
  workspace folders, open documents, `ide`, version, protocol version, a token and `hub`. An editor
  whose `hub` is false still guards its files but accepts no agent. The socket is `<pid>.sock`
  beside the lock, or `<tmpdir>/erd-editor-ide-<pid>.sock` when that path is over
  `MAX_PIPE_PATH_BYTES` (100 UTF-8 bytes), or `\\.\pipe\erd-editor-ide-<pid>` on Windows. A peer
  connects to the lock's `pipe` rather than computing the path.
- **Discovery.** `selectHub` ranks the live locks against a target path: an open document
  outranks any folder, a deeper folder a shallower one, then the newest lock, then the higher pid.
  The answer is `live` (connect), `blocked` (an editor holds the file with `hub` false, so do not
  write it) or `headless` (no editor; edit the file on disk). It also lists the `stale` locks:
  `dead` ones, whose pid is gone and which are safe to delete with their sockets, and `malformed`
  ones, a live pid's lock that does not parse, which must be left alone.
- **Paths are compared, never resolved.** Callers pass absolute, normalized paths with symlinks
  resolved. Matching is per segment, and case-insensitive on Windows and macOS only. On Windows
  every side refuses a name Windows would not store as written, which `unsafeSegment` finds: a
  stream (any colon), another character Win32 refuses (`<>"|?*` or a character below U+0020), a
  device name, a trailing dot or space.
- **Framing.** One compact JSON value per `\n`-terminated line, at most `MAX_FRAME_BYTES` of UTF-8.
- **Protocol.** A peer sends requests only: `hello` (token, protocol version, client name),
  `listDocuments`, `openDocument`, `join`, `applyActions`, `leave` and `save`. The hub refuses a
  `hello` of another protocol version with `protocolMismatch`, and sends the `actions` and
  `documentClosed` notifications. Error codes say whose fault a refusal is: `notFound` means only
  that the named file does not exist (or, for `openDocument` with `create`, the folder to create it
  in), and `internal` is the hub failing.

## Development

From the repository root:

```sh
pnpm exec vp run --filter ./packages/agent-hub --fail-if-no-match test
pnpm --filter ./packages/agent-hub --fail-if-no-match test:coverage
pnpm --filter ./packages/agent-hub --fail-if-no-match test:dev
pnpm exec vp run --filter ./packages/agent-hub --fail-if-no-match build
```

`test` runs `tsc --noEmit`, then Vitest; `test:coverage` runs Vitest with v8 coverage, and
`test:dev` in watch mode; `build` runs `tsc --noEmit`, then writes `dist/` and its `.d.ts`. This
suite cannot see a consumer break. The rules for changing the package, and the checks a change
runs, are in [AGENTS.md](./AGENTS.md).
