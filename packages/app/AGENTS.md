<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-08 -->

# app (`@dineug/erd-editor-app`)

## Purpose

The web application at [erd-editor.io](https://erd-editor.io) — the only **React** package in the
workspace. It wraps the `<erd-editor>` custom element in a schema-management shell: a sidebar of saved
diagrams, local-first persistence to IndexedDB, cross-tab synchronization, offline support via a
service worker, and end-to-end-encrypted real-time collaboration.

### The four subsystems worth knowing

1. **Local-first persistence** — every diagram lives in IndexedDB (Dexie), accessed through a
   `SharedWorker` (falling back to a dedicated `Worker`, then to the main thread) over Comlink.
2. **Cross-tab sync** — a `BroadcastChannel` bridge replays schema mutations and editor action streams
   into every other open tab, so two tabs on the same diagram stay live.
3. **Live collaboration** — a serverless [trystero](https://github.com/dmotz/trystero) WebRTC mesh
   where the _host_ shares its editor action stream. The room URL carries `#<roomId>,<secretKey>`;
   the key never reaches any relay. There is no backend — peers find each other through public
   nostr/MQTT relays and then talk directly.
4. **PWA/offline** — a Workbox service worker with content-hash-aware caching strategies.

### End-to-end encryption

`src/utils/crypto.ts` generates an **AES-GCM 128** key via `crypto.subtle`. The key is exported into
the URL fragment (`location.hash`), which browsers never send to a server. It is used twice:

- as the **trystero password**, which encrypts the WebRTC session descriptions exchanged over the
  relay — a peer without the key cannot even complete the handshake, let alone join;
- as the **payload key** — every message is encrypted client-side (`encryptToJson`) and decrypted by
  peers (`decryptFromJson`), so a relay only ever carries ciphertext.

### Where the peer connections live

`RTCPeerConnection` does not exist inside a worker, so — unlike the rest of the schema plumbing — the
collaboration transport runs on the **main thread** (`src/services/collaborative/`). The IndexedDB
worker keeps only the session _registry_ (`roomId` + `secretKey` per schema), which is what lets a
session outlive the tab that started it. `navigator.locks` elects one tab as the leader; every other
tab forwards its editor action stream to that tab over the BroadcastChannel bridge
(`collaborativeDispatch`).

## Key Files

| File                          | Description                                                                                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main.tsx`                | Entry — Sentry init (production only), the `react-router-dom` route table, jotai `Provider`, `registerSW`                                                        |
| `src/store.ts`                | The jotai store instance, plus the `BroadcastChannel` handlers that apply remote tab mutations                                                                   |
| `src/registerSW.ts`           | Workbox window-side registration                                                                                                                                 |
| `src/sw.ts`                   | The service worker — precache manifest, `cleanupOutdatedCaches`, and route strategies (`CacheFirst` for content-hashed assets, `StaleWhileRevalidate` otherwise) |
| `src/styles.css`              | Global styles, layered under the Radix Themes reset                                                                                                              |
| `src/internal-types/index.ts` | `AnyAction`, `ReducerRecord`, `ValuesType` and friends                                                                                                           |
| `webpack.config.js`           | swc-loader (+ jotai swc plugins), HtmlWebpackPlugin, MiniCssExtract, `WebpackPwaManifest`, `InjectManifest`, React Refresh in dev                                |
| `vitest.config.mts`           | Vitest (happy-dom) over `src/**/*.test.ts`; coverage scoped to the collaboration transport and the utilities it builds on                                        |
| `vitest.setup.ts`             | Swaps in Node's `webcrypto` — happy-dom's `crypto` stub has no `subtle`, which the E2E encryption is built entirely on                                           |
| `playwright.config.ts`        | Chromium e2e against the dev server plus a local nostr relay; the WebRTC launch flags live here (see `e2e/README.md`)                                            |

## Subdirectories

| Directory                            | Purpose                                                                                                                                                                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/atoms/modules/`                 | jotai state, one module per concern — `schema` (the diagram list), `sidebar`, `sidebar-sash` (layout), `collaborative` (active sessions), `theme`                                                                                |
| `src/components/app/`                | `App.tsx` — the main layout (sidebar + sash + viewer)                                                                                                                                                                            |
| `src/components/sidebar/`            | Schema list, `sidebar-add-item/`, `sidebar-item/` and its `sidebar-collaborative/` session controls                                                                                                                              |
| `src/components/sidebar-sash/`       | Draggable sidebar resizer                                                                                                                                                                                                        |
| `src/components/viewer/`             | `Viewer.tsx` and `editor/Editor.tsx` — the React↔custom-element boundary                                                                                                                                                        |
| `src/components/live-collaborative/` | `LiveCollaborative.tsx` (the `/live` guest view, lazily routed) and `live-collaborative-error/`                                                                                                                                  |
| `src/routes/root/`                   | `Root.tsx` — router shell and error boundary host                                                                                                                                                                                |
| `src/services/collaborative/`        | The main-thread WebRTC transport — `room.ts` (trystero wrapper), `guest.ts` (the `/live` side), `host.ts` (session owner), `leader.ts` (Web Locks election)                                                                      |
| `src/services/indexeddb/`            | `index.ts` (worker selection + Comlink wrap), `appDatabaseService.ts` (the Dexie service, also the main-thread fallback), `indexeddb.worker.ts` / `indexeddb.shared-worker.ts`, and `modules/schema/` + `modules/collaborative/` |
| `src/utils/`                         | `broadcastChannel.ts` (the typed cross-tab bridge), `crypto.ts` (AES-GCM E2E), `clipboard.ts`, `text.ts`, `errors.ts` (typed router errors: `InvalidHashError`, `NotFoundHostError`, `HostStopSessionError`)                     |
| `src/__test-utils__/`                | `room.ts` — a fake `CollaborativeRoom` tests drive by invoking the handlers the service under test assigned                                                                                                                      |
| `e2e/`                               | Playwright specs, the `AppPage`/`LivePage` page objects, and `support/relay.mjs` — a local nostr relay that makes the peer-to-peer specs offline and deterministic (`e2e/README.md`)                                             |
| `public/`                            | HTML shell, icons, and PWA assets                                                                                                                                                                                                |

## For AI Agents

### Working In This Directory

- **React lives only in the shell.** The editor itself is a custom element — `Editor.tsx` creates it
  imperatively via refs and drives it through element methods (`setInitialValue`, `getSharedStore`,
  `setPresetTheme`). Never try to control editor internals with React props or re-render it into
  existence.
- **The secret key must stay in the URL fragment.** `LiveCollaborative` parses
  `location.hash.replace('#','').split(',')` into `[roomId, secretKey]`. Moving it into a query string,
  a path segment, or any request body would leak it to a relay and break the E2E guarantee.
- **Collaboration cannot move into a worker.** `RTCPeerConnection` is a window-only API. Anything that
  touches trystero belongs in `src/services/collaborative/`, on the main thread; the worker keeps only
  the session registry. `useCollaborativeHost()` (mounted by `App.tsx`) is what starts it.
- **Only the leader tab talks to peers.** `leader.ts` holds a `navigator.locks` lock for the lifetime
  of the tab. New outbound traffic must go through the `collaborativeDispatch` bridge action, not
  straight to a room, or a second tab will double-send.
- **The cross-tab and peer streams are not the same stream.** `replicationSchemaEntity` strips
  `editor.sharedMouseTracker` (noise for a replica); `collaborativeDispatch` keeps it (shared cursors).
  Don't collapse the two.
- **The host is on every relay, a guest is on one.** A guest walks `STRATEGIES` and keeps the first
  relay that answers, so the host has to bridge messages between the nostr and mqtt meshes. Adding a
  strategy means both halves keep working.
- **All three storage paths must keep working.** `getAppDatabaseService()` tries `SharedWorker`, then
  `Worker`, then an in-thread `AppDatabaseService`. Safari and some mobile browsers land on the
  fallbacks — anything added to the service must be Comlink-safe _and_ work synchronously in-thread.
- **The BroadcastChannel payloads are a protocol.** `BridgeActionType` in `utils/broadcastChannel.ts`
  and the handlers in `store.ts` are two halves of the same contract; a new action needs both, and
  payloads must be structured-cloneable.
- **jotai state is immer-backed** (`jotai-immer`) — `store.set(atom, draft => ...)` mutates a draft.
  Don't mix in manual immutable spreads.
- **Sentry is production-only** and initialized before the router. Don't let it run in dev.
- **Service worker changes need a cache-invalidation story.** `src/sw.ts` distinguishes content-hashed
  assets (`CacheFirst`) from everything else; a wrong strategy strands users on a stale build.
- Uses `@dineug/go` for cancellable async flows in the collaboration view (`go`, `cancel`,
  `attachCancel`, `isCancel`) — prefer that over ad-hoc `AbortController` chains to match the codebase.
- Styling is Radix Themes + Emotion; component styles live in a sibling `*.styles.ts`.
- Builds with **webpack + swc** (with `@swc-jotai/debug-label` and `@swc-jotai/react-refresh`) on
  TypeScript 5.4.5 — not Vite, and not the 5.8.2 the libraries use.
- `private: true`; there is no backend, so the only build-time env value is `import.meta.env.MODE`.

### Testing Requirements

- `pnpm --filter @dineug/erd-editor-app test` runs Vitest over `src/**/*.test.ts`; `test:coverage`
  enforces 80% per-file thresholds on the files listed in `vitest.config.mts`. `typecheck` matters
  here — swc-loader strips types without checking them, so `pnpm build` alone will not catch a type
  error. Beyond that, verification is `dev` (webpack-dev-server, opens automatically) and `build`.
- **Persistence changes**: reload and confirm diagrams survive; then check with the SharedWorker
  disabled (Safari, or devtools) so the fallback path is actually exercised.
- **Cross-tab changes**: open two tabs, edit in one, confirm the other follows.
- `e2e` runs the Playwright suite: two browser contexts against a local nostr relay, covering the
  parts no unit test reaches — the snapshot handoff, edits in both directions, the leadership lock
  handover, and the `/live` error states. `e2e/README.md` explains the relay and the two Chromium
  WebRTC flags without which ICE never completes headless.
- **Collaboration changes**: run `e2e` first, then confirm by hand against the public relays — start a
  session in one browser profile and join the `/live#...` URL in another. Watch
  `chrome://webrtc-internals` for the peer connection, and confirm in the network tab that the relay
  only ever carries ciphertext.
- **Service-worker changes**: build, serve the production bundle, and verify offline load plus that a
  second build actually supersedes the first.
- `build:analyzer` runs webpack-bundle-analyzer.

### Common Patterns

- `Component.tsx` + `Component.styles.ts`, one directory per component.
- Route-level code splitting via `react-router-dom`'s `lazy` (see the `/live` route).
- Action-type maps declared as `as const` objects paired with a same-named type via `ValuesType`.

## Dependencies

### Internal

- `@dineug/erd-editor` — the editor element
- `@dineug/erd-editor-shiki-worker` — highlighting (lazily imported and registered)
- `@dineug/go` — cancellable async flows
- `@dineug/shared`

### External

- `react` 18 + `react-dom` + `react-router-dom` 6
- `jotai` + `jotai-immer` + `immer` — state
- `@radix-ui/themes` + `@radix-ui/react-icons` + `@emotion/react` — UI
- `dexie` — IndexedDB; `comlink` — worker RPC
- `@trystero-p2p/nostr` + `@trystero-p2p/mqtt` — serverless WebRTC collaboration transport, both
  lazily imported so neither relay client lands in the main bundle. Note that `trystero/mqtt` and the
  other `trystero/*` subpaths are deprecated stubs that throw on import — depend on the
  `@trystero-p2p/*` packages directly.
- `vitest` + `happy-dom` + `@vitest/coverage-v8` — unit tests; `@playwright/test` + `ws` (the local
  e2e relay) — end-to-end
- `workbox-*` — service worker and PWA
- `@sentry/react` — production error reporting
- `base64-arraybuffer`, `lodash-es`, `luxon`
- webpack 5 + swc, `core-js`

<!-- MANUAL: -->
