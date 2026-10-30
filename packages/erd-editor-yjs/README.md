# @dineug/erd-editor-yjs

> Keeps [ERD Editor](https://github.com/dineug/erd-editor) diagrams in step through a
> [Yjs](https://github.com/yjs/yjs) document

`bindErdEditor` binds an `<erd-editor>` element, and `bindPeerStore` a headless peer store from
`@dineug/erd-editor/peer.js`, to a `Y.Doc`. Whatever provider carries the `Y.Doc` carries the
diagram: a websocket server, WebRTC, IndexedDB or your own. The edits travel as the editor's own
action batches, so the editor's version registers decide every merge, as they do in its other
collaboration, and cursors, focus and selection travel through Awareness.

- **Offline edits** — a client cut off keeps editing, and its edits land when it reconnects
- **Presence** — cursors, focus and selection through Awareness, cleared as soon as a client leaves
- **Persistence** — a `Y.Doc` a persistence provider hands back opens the diagram it holds
- **Compaction** — an optional Node sidecar folds the room's history into one snapshot

## Install

```sh
npm install @dineug/erd-editor-yjs @dineug/erd-editor yjs y-protocols
npm install y-websocket # or another provider
```

`@dineug/erd-editor`, `yjs` and `y-protocols` are peer dependencies, so a page holds one copy of
each. This package takes only their types and works on the `Y.Doc` and `Awareness` you pass, so it
loads no Yjs of its own. Two copies of Yjs in one page break each other's type checks, and the
second logs "Yjs was already imported"; when your code and a provider resolve it from two places,
dedupe it in the bundler (Vite: `resolve.dedupe: ['yjs']`). The compactor below runs on Node.js
22.12 or later.

## Usage

Bind and seed only once the provider has synced. A seed made before the room's diagram arrives is
made at once with the seed that diagram came from, and can win over it:

```js
import '@dineug/erd-editor/erd-editor.js';

import { bindErdEditor } from '@dineug/erd-editor-yjs';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

const doc = new Y.Doc();
const provider = new WebsocketProvider('wss://yjs.example.com', 'my-diagram', doc);
const editor = document.createElement('erd-editor');
document.body.appendChild(editor);

provider.on('sync', function onSync(synced) {
  if (!synced) return;
  provider.off('sync', onSync);

  const binding = bindErdEditor(editor, doc, {
    awareness: provider.awareness,
    getNickname: () => 'Ada',
  });
  binding.on('error', error => console.error(error));
  binding.on('rejoin', reason => console.info('reopened on the room', reason));
  binding.seed(); // false, and nothing written, once the room holds a diagram
});
```

| Option | Description |
| --- | --- |
| `awareness` | The `Awareness` that carries cursors, focus, selection and the screen, such as the provider's. Without it, only the diagram syncs. |
| `getNickname` | The name the others see on this editor's cursor. |

The provider and the `Y.Doc` stay yours: the binding never connects, disconnects or destroys them.

### Seeding a room

`binding.seed(value?)` writes the room's first snapshot from the editor's diagram, after loading
`value`, a document JSON string, into the editor when one is given. It returns `false` and writes
nothing once the room holds a snapshot, so every client can call it after binding.

Until a room holds a snapshot, a binding writes nothing to it. What the editor holds meanwhile goes
into its own seed, and gives way to the diagram of another client's seed when that one arrives.
When two clients seed at once, one seed wins on every client: the other seeder reopens on it with
`rejoin('seedLost')` and loses what it edited since its seed, and so does a client that joined the
losing seed first, with `rejoin('snapshot')`.

### Events

`binding.on(event, listener)` returns a function that removes the listener.

| Event | Description |
| --- | --- |
| `rejoin` | `(reason) => void`. The binding reopened the editor on the room's snapshot. `'snapshot'`: the snapshot holds edits the binding had not applied, because it was away while a compactor folded them, or a compactor put back, in a fold of its own, what it had folded apart from another (One compactor per room), or it is the first snapshot to reach a binding of an empty room, or another seed's. `'seedLost'`: another client's seed won over this binding's own. |
| `error` | `(error) => void`. The binding refused: the editor or peer store is already bound to this `Y.Doc`; its `@dineug/erd-editor` was built before this package and lacks the methods a binding needs; the room's diagram was written in a layout this release does not read (`ERD_YJS_FORMAT`), at bind time binding nothing and later stopping the binding; or, for `bindPeerStore`, the peer store was destroyed before the binding (Destroying a binding), `compactAfter` is not a positive integer, or `synced` rejected, which also takes the binding out of the election. An error at bind time reaches a listener added right after the call. |

A rejoin onto a snapshot of the seed the binding joined replays every edit the snapshot does not
hold, this client's own made while it was away among them, so none of them is lost. A binding that
moves to another seed keeps nothing it edited in the losing one, with either reason, and one that
the first snapshot reaches keeps nothing it held before (Seeding a room). Every rejoin clears the
undo history, the selection and the focus, and closes an open Flow view, a relationship draw and a
memo, group name or cell editor, since they can name what the snapshot no longer holds; a group name
typed and not yet entered is dropped. A binding that had joined the room keeps what its reader sees:
the scroll and zoom, the tab, the name view and the code settings while their locks hold through the
rejoin, even over an unlock, a change and a relock the snapshot took while it was away, and the
settings a readonly reader turned, while `value` reports the snapshot's. An element not shown since
its last load, and a binding that had not joined yet, open where the snapshot puts them.

### Destroying a binding

`binding.destroy()` sends the drags, resizes and colour strokes the editor still holds, clears the
binding's Awareness field and stops. An element's binding also releases the shared store it took
from the element; a peer store, the `Y.Doc` and the provider stay yours to destroy, after the
binding. A peer store destroyed first never sends the drags it still held, and its binding stops
with `error` the next time the room changes or it is asked to seed or compact, rather than open the
room on a closed store or fold one into the snapshot. Destroy a binding before binding the same
editor or peer store to the same `Y.Doc` again.

## Compacting a room

The room's history grows with every edit, and a client that joins replays it all, until something
folds it. `bindPeerStore` binds a peer store, and one bound in a Node process beside the server, a
sidecar, folds the history into a snapshot of its own diagram:

```sh
npm install @dineug/erd-editor-yjs @dineug/erd-editor yjs y-protocols y-websocket ws
```

```js
import { createPeerStore } from '@dineug/erd-editor/peer.js';
import { bindPeerStore } from '@dineug/erd-editor-yjs';
import WebSocket from 'ws';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

const doc = new Y.Doc();
const provider = new WebsocketProvider('wss://yjs.example.com', 'my-diagram', doc, {
  WebSocketPolyfill: WebSocket,
});
const synced = new Promise(resolve => {
  provider.on('sync', function onSync(isSynced) {
    if (!isSynced) return;
    provider.off('sync', onSync);
    resolve();
  });
});

const peer = createPeerStore({ nickname: 'compactor', presence: false });
const binding = bindPeerStore(peer, doc, {
  awareness: provider.awareness,
  compactAfter: 1000,
  synced,
});
binding.on('error', error => console.error(error));

process.on('SIGTERM', () => {
  binding.destroy(); // first, so the peer store's held drags still reach the room
  peer.destroy();
  provider.destroy();
  doc.destroy(); // ends the provider's Awareness timer, so the process can exit
});
```

| Option | Description |
| --- | --- |
| `awareness` | Shows the compactor in the room's Awareness, so compactors that see each other elect one to fold, and one that sees no other client folds nothing on its own. |
| `compactAfter` | Fold on its own once the history holds this many entries a fold would take. No default: without it, or without `synced`, only `compact()` folds, and the fold that puts back (One compactor per room). |
| `synced` | A promise that resolves once the provider has synced. No fold comes before it, `compact()` included. |
| `electionGraceMs` | With `awareness`, how long after `synced`, and again whenever other clients show after none did, the compactor watches the room before it folds on its own. 3,000 ms by default. |
| `retainMs` | How long a fold's entries stay held to put back (One compactor per room), counted from the first update the room sends after the fold. 600,000 ms (ten minutes) by default. |

`binding.compact()` folds at once, with no election and no grace, and answers
`{ compacted: true, generation }`, or `{ compacted: false, reason }` with `'destroyed'` once the
binding or its peer store was destroyed, even before `synced`, `'not-synced'` before `synced`
resolves, or `'no-snapshot'` in a room no client has seeded.

Every fold rewrites the whole diagram into the snapshot, so each one sends every client an update
about the size of the diagram's runtime JSON and registers together, however few entries it takes.
Set `compactAfter` high enough that the entries a fold takes outweigh one copy of the diagram. A
peer store bound with no `compactAfter` and no `compact()` call is an ordinary headless peer.

### One compactor per room

Run exactly one compactor per room, and start a new one only once the old one has stopped. Nothing
enforces this. Compactors that see each other in Awareness fold on their own only on the one with
the smallest client id, and when it leaves, or its `synced` rejects, the next one takes over at
once. A compactor whose Awareness shows no other client, as when its own socket closes and drops
them all, folds nothing on its own until others show again and it has watched the room for the
grace. Two cut off from each other, or a restart whose predecessor is still running, can still each
fold. The room then keeps one of the two snapshots, and the compactor whose snapshot lost puts back
what it folded that the winner does not hold, for as long as it holds it: `retainMs`, and at most
its latest 1,000 entries, however large each is.

So nothing is lost when the compactor whose snapshot loses is the one that reconnects, as long as
it folded no more than 1,000 entries while apart. When it is the one that stayed online, and its
hold has run out, the room's snapshot and history lack what it folded until it folds again: a
client that missed those edits, or one that joins meanwhile, lacks them, and holds back the later
edits of each writer whose edits it folded. Its next fold brings them all back, unless the winning
snapshot held edits it lacked, which reopens it on that snapshot and loses what it folded for good.

A compactor puts back in a fold of its own, made once it has caught up with the winning snapshot,
with no election or grace, and every client reopens on that fold. The edits it puts back reach no
client apart from that fold, so a client online throughout ends with the others and with one that
joins later, even when another writer's later edit builds on one of them, such as a rename of a
table another client added. Each put-back costs every client that rejoin, with what a rejoin loses
(Events). When two compactors put back at once, every client still ends alike, though an edit can
stay applied ahead of one it builds on. A binding destroyed or stopped before that fold runs, as
when a `rejoin` listener destroys it, puts the edits back on their own instead, so none is lost,
but then a client online throughout can apply one after another writer's edit that builds on it
and end apart from one that joins later.

## Limits

- **The viewport stays on each screen.** Scrolling, zooming and switching tabs never enter the
  room's history. Each reader keeps their own, and the binding shows it only in its Awareness
  state, which nothing reads yet. With the viewport or tab lock off, each client's `value` saves its
  own; under the locks, which a new document has on, every client saves the locked one.
- **A rejoin loses the undo history**, the selection, the focus, an open Flow view and an edit left
  open, and keeps the screen (Events).
- **The snapshot grows by one entry per binding.** It keeps, for every binding that ever wrote to the
  room, how far its edits are folded, and never drops one. A binding made again, or one that moved
  to another seed, counts anew, and so does each fold that puts back (One compactor per room). An
  entry is a 32-character id and a number, so ten thousand writing sessions add a few hundred
  kilobytes to every snapshot and every fold.
- **A room with no compactor keeps all its history.** An element's binding never folds, so the room
  holds every edit since its seed and each client that joins replays them all.
- **One compactor per room** is a deployment rule nothing enforces (One compactor per room).
- **A hub and a room relay nothing between them.** An element bound to a room and to a coding
  agent's hub, or to any other transport through `getSharedStore()`, at once applies the edits of
  both, but neither hears the other's, since a shared store never sends on what it received.
- **Editors built before this package cannot join.** Their `@dineug/erd-editor` lacks the methods a
  binding needs, so binding one raises `error` and binds nothing.
- **Adds made at once can be listed apart.** Tables or memos two clients add at once can stand in
  another order in each client's diagram.
- **A leaving cursor waits on the server.** The binding clears a peer's cursor as soon as Awareness
  drops it. A server that, when a socket closes, removes only the Awareness states that socket
  first added leaves a client that reconnected on the others' screens until Awareness times it out,
  30 seconds later.

## API

| Export | Description |
| --- | --- |
| `bindErdEditor(editor, doc, options?)` | Binds an `<erd-editor>` element. Returns `{ seed, on, destroy }` (`ErdYjsBinding`). |
| `bindPeerStore(peer, doc, options?)` | Binds a peer store. Returns the same with `compact` (`ErdYjsPeerBinding`). |
| `ERD_YJS_FORMAT` | The layout of the `Y.Doc` this release writes; a binding refuses a room written in another. |

Types: `BindOptions`, `PeerBindOptions`, `CompactOptions`, `CompactResult`, `BindingEvents`,
`RejoinReason`, `ErdYjsBinding`, `ErdYjsPeerBinding`.

The binding keeps the diagram under the `Y.Doc`'s `erd:` names and sets the `erd` field of the
local Awareness state. Their layout is private and may change with `ERD_YJS_FORMAT`, so read a room
through a binding alone and leave both names to it.

## Development

```sh
pnpm exec vp run --filter @dineug/erd-editor-yjs --fail-if-no-match build # builds the editor too
pnpm --filter @dineug/erd-editor-yjs dev   # two editors on two linked Y.Docs; ?room=&ws= joins a server
pnpm exec vp run --filter @dineug/erd-editor-yjs --fail-if-no-match test
pnpm --filter @dineug/erd-editor-yjs e2e   # Playwright through a websocket relay and a compactor
```

What a change runs and carries is in
[AGENTS.md](https://github.com/dineug/erd-editor/blob/main/packages/erd-editor-yjs/AGENTS.md).

## Issues

Found a bug or want a feature? [Open an issue](https://github.com/dineug/erd-editor/issues).

## License

[MIT](https://github.com/dineug/erd-editor/blob/main/LICENSE) © SeungHwan-Lee
