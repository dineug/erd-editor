<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-15 -->

# app (`@dineug/erd-editor-app`)

## Purpose

The web application at [erd-editor.io](https://erd-editor.io) — the only **React** package in the
workspace. It wraps the `<erd-editor>` custom element in a schema-management shell: a sidebar of saved
diagrams, local-first persistence to IndexedDB, cross-tab synchronization, offline support via a
service worker, and end-to-end-encrypted real-time collaboration.

### The four subsystems worth knowing

1. **Local-first persistence** — every diagram lives in IndexedDB (Dexie), accessed through a
   `SharedWorker` (falling back to a dedicated `Worker`, then to the main thread) over Comlink. The
   worker keeps a headless `createReplicationStore()` from `@dineug/erd-editor/engine.js` per schema,
   applies incoming action batches to it, and writes the store's serialized `value` back to Dexie.
2. **Cross-tab sync** — a `BroadcastChannel` bridge replays schema mutations and editor action streams
   into every other open tab, so two tabs on the same diagram stay live.
3. **Live collaboration** — a serverless [trystero](https://github.com/dmotz/trystero) WebRTC mesh
   where the _host_ shares its editor action stream. The invite link carries `#<roomId>,<secretKey>`;
   the key never reaches any relay. There is no backend — peers find each other through public
   nostr/MQTT relays and then talk directly.
4. **PWA/offline** — a Workbox service worker with content-hash-aware caching strategies.

### End-to-end encryption

`src/utils/crypto.ts` generates an **AES-GCM 128** key via `crypto.subtle`. The key is minted in the
IndexedDB worker (`CollaborativeService.startSession`), exported as a JWK and carried as its raw `k`
value in the URL fragment, which browsers never send to a server —
`SidebarCollaborative.tsx` builds the invite as `${location.origin}/live/#${roomId},${secretKey}`.
It is used twice:

- as the **trystero password**, which encrypts the WebRTC session descriptions exchanged over the
  relay — a peer without the key cannot even complete the handshake, let alone join;
- as the **payload key** — every message is encrypted client-side (`encryptToJson`) and decrypted by
  peers (`decryptFromJson`), so a relay only ever carries ciphertext.

### Where the peer connections live

`RTCPeerConnection` does not exist inside a worker, so — unlike the rest of the schema plumbing — the
collaboration transport runs on the **main thread** (`src/services/collaborative/`). The IndexedDB
worker keeps only the session _registry_ (`roomId` + `secretKey` per schema, in memory), which is what
lets a session outlive the tab that started it as long as one tab holds the SharedWorker open.
`navigator.locks` elects one tab as the leader; every other tab forwards its editor action stream to
that tab over the BroadcastChannel bridge (`collaborativeDispatch`).

## Key Files

| File                          | Description                                                                                                                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main.tsx`                | Entry — Sentry init (production only), the `react-router-dom` route table, jotai `Provider`, `registerSW` (production only)                                                                                 |
| `src/store.ts`                | The jotai store instance, plus the `BroadcastChannel` handlers that apply remote tab mutations (schema list + session start/stop)                                                                           |
| `src/registerSW.ts`           | Workbox window-side registration                                                                                                                                                                            |
| `src/sw.ts`                   | The service worker — precache manifest, `cleanupOutdatedCaches`, `CacheFirst` for content-hashed same-origin assets, `StaleWhileRevalidate` for un-hashed same-origin images/fonts, two Google Fonts routes |
| `src/env.d.ts`                | `ImportMetaEnv` — the two build-time values (`MODE`, `NOSTR_RELAY_URLS`) plus the `*.css` module declaration                                                                                                |
| `src/styles.css`              | One line — `@import url('@radix-ui/themes/styles.css')`. The app's real global styles are Emotion's `Global` in `src/routes/root/Root.styles.ts`, not here                                                  |
| `src/internal-types/index.ts` | `AnyAction`, `ReducerRecord`, `ValuesType`, `EntityType` and friends                                                                                                                                        |
| `webpack.config.js`           | swc-loader (+ jotai swc plugins), `DefinePlugin`, HtmlWebpackPlugin (inlines the GA snippet in production), CopyPlugin, MiniCssExtract, `WebpackPwaManifest`, `InjectManifest`                              |
| `tsconfig.json`               | Extends the root `tsconfig.app.json`; `@/*` → `src/*`, `jsxImportSource: @emotion/react`, `lib` includes `WebWorker`. `include` is `src` only — `e2e/` carries its own tsconfig                             |
| `vitest.config.mts`           | Vitest (happy-dom) over `src/**/*.test.ts`; coverage scoped to the collaboration transport and the utilities it builds on. `.mts` because `package.json` is CommonJS                                        |
| `vitest.setup.ts`             | Swaps in Node's `webcrypto` — happy-dom's `crypto` stub has no `subtle`, which the E2E encryption is built entirely on                                                                                      |
| `playwright.config.ts`        | Chromium e2e against the dev server (`:5175`) plus a local nostr relay (`:5176`); the WebRTC launch flags live here (see `e2e/README.md`)                                                                   |

## Subdirectories

| Directory                            | Purpose                                                                                                                                                                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/atoms/modules/`                 | jotai state, one module per concern — `schema` (the diagram list), `sidebar` (selection + the replication write path), `sidebar-sash` (layout), `collaborative` (sessions, nickname, `useCollaborativeHost`), `theme`            |
| `src/components/app/`                | `App.tsx` — the main layout (sidebar + sash + viewer) and the mount point for `useCollaborativeHost()`                                                                                                                           |
| `src/components/sidebar/`            | Schema list, `sidebar-add-item/`, `sidebar-item/` and its `sidebar-collaborative/` session controls (which build the invite link)                                                                                                |
| `src/components/sidebar-sash/`       | Draggable sidebar resizer                                                                                                                                                                                                        |
| `src/components/viewer/`             | `Viewer.tsx` and `editor/Editor.tsx` — the React↔custom-element boundary                                                                                                                                                        |
| `src/components/live-collaborative/` | `LiveCollaborative.tsx` (the `/live` guest view, lazily routed) and `live-collaborative-error/`                                                                                                                                  |
| `src/routes/root/`                   | `Root.tsx` — the Radix `Theme` shell, Emotion `Global`, jotai `DevTools`, and the router `Outlet`                                                                                                                                |
| `src/services/collaborative/`        | The main-thread WebRTC transport — `room.ts` (trystero wrapper, ref-counted joins, `STRATEGIES`), `guest.ts` (the `/live` side), `host.ts` (session owner), `leader.ts` (Web Locks election), `index.ts` (the barrel)            |
| `src/services/indexeddb/`            | `index.ts` (worker selection + Comlink wrap), `appDatabaseService.ts` (the Dexie service, also the main-thread fallback), `indexeddb.worker.ts` / `indexeddb.shared-worker.ts`, and `modules/schema/` + `modules/collaborative/` |
| `src/utils/`                         | `broadcastChannel.ts` (the typed cross-tab bridge), `crypto.ts` (AES-GCM E2E), `clipboard.ts`, `text.ts` (`toWidth`, via `OffscreenCanvas`), `errors.ts` (`InvalidHashError`, `NotFoundHostError`, `HostStopSessionError`)       |
| `src/__test-utils__/`                | `room.ts` — a fake `CollaborativeRoom` tests drive by invoking the handlers the service under test assigned                                                                                                                      |
| `e2e/`                               | `specs/` (`collaboration`, `leadership`, `live-errors`), `support/AppPage.ts` (the `AppPage` and `LivePage` page objects) and `support/relay.mjs` — a local nostr relay (`e2e/README.md`)                                        |
| `public/`                            | HTML shell, favicon/SVG logos, and the PWA icon set                                                                                                                                                                              |

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
- **Joins are reference counted, teardowns are awaited.** Trystero hands back the _same_ room object
  for a given `appId` + `roomId`, and `leave()` destroys it asynchronously — a StrictMode remount is
  enough to let the first caller's `leave()` kill the second caller's peers seconds later.
  `joinCollaborativeRoom` is the only supported way in; don't call `joinRoom` directly.
- **`APP_ID` is the shared namespace.** Trystero derives its relay topics from `appId` + `roomId`, so
  changing `'io.erd-editor'` in `room.ts` partitions every existing invite link off from new ones.
- **The cross-tab and peer streams are not the same stream.** `replicationSchemaEntity` strips
  `editor.sharedMouseTracker` (noise for a replica); `collaborativeDispatch` keeps it (shared cursors).
  Don't collapse the two.
- **The host is on every relay, a guest is on one.** A guest walks `STRATEGIES` and keeps the first
  relay that answers, so the host has to bridge messages between the nostr and mqtt meshes. Adding a
  strategy means both halves keep working. Setting `ERD_EDITOR_NOSTR_RELAY_URLS` collapses
  `STRATEGIES` to nostr alone, which is how the e2e suite runs offline.
- **The host has no outbound buffer.** A batch dispatched before its rooms are open is dropped (see
  the `TODO` in `host.ts`), so edits made in the seconds after a leadership handover never reach the
  guests. A guest _does_ buffer — its shared store holds actions while disconnected and flushes on
  reconnect.
- **All three storage paths must keep working.** `getAppDatabaseService()` tries `SharedWorker`, then
  `Worker`, then an in-thread `AppDatabaseService`. Safari and some mobile browsers land on the
  fallbacks — anything added to the service must be Comlink-safe _and_ work synchronously in-thread.
- **The BroadcastChannel payloads are a protocol.** `BridgeActionType` in `utils/broadcastChannel.ts`
  is one half of the contract; the handlers are spread over three places — `store.ts` (schema list and
  session start/stop), `Editor.tsx` (`replicationSchemaEntity`) and `CollaborativeHostService`
  (`collaborativeDispatch`). A new action needs both halves, and payloads must be
  structured-cloneable. Note `dispatch()` does not echo to the posting tab; use `dispatchAll()` when
  the current tab has to see the action too.
- **Only the object-shaped atoms are immer-backed.** `withImmer` (`jotai-immer`) wraps exactly two —
  `themeAtom` and `sidebarSashAtom` — so `store.set(atom, draft => ...)` mutates a draft there. The
  third persisted atom, `nicknameStorageAtom`, is a plain `atomWithStorage<string>` and is consumed
  raw; a `string` cannot take an immer draft.
- **Sentry is production-only** and initialized before the router, as is `registerSW()`. Don't let
  either run in dev.
- **Service worker changes need a cache-invalidation story.** `src/sw.ts` routes content-hashed
  same-origin assets through `CacheFirst` and un-hashed same-origin **images and fonts** through
  `StaleWhileRevalidate` (`ASSET_EXTENSIONS` — png/svg/jpg/jpeg/gif/woff/woff2/eot/ttf/otf). Nothing
  else is routed: un-hashed `.js`/`.css` and navigations fall through to precache or the network. A
  wrong strategy strands users on a stale build.
- **The collaboration view tears down through the effect cleanup.** `LiveCollaborative` builds the
  editor, the guest and every timer inside one `useLayoutEffect` and undoes all of it in the returned
  cleanup; a resource added there needs a matching line in that cleanup or it leaks across a room
  change.
- Styling is Radix Themes + Emotion; component styles live in a sibling `*.styles.ts`.
- Builds with **webpack + swc** (with `@swc-jotai/debug-label` and `@swc-jotai/react-refresh`) on
  TypeScript 5.4.5 — not Vite, and not the 5.8.2 the libraries use.
- `private: true`, version `0.1.0`, and CommonJS — no `"type": "module"`, which is why the Vitest
  config is `.mts`. There is no backend; the only build-time values are the two `DefinePlugin` entries
  (`import.meta.env.MODE` and `import.meta.env.NOSTR_RELAY_URLS`, fed by `ERD_EDITOR_NOSTR_RELAY_URLS`),
  declared in `src/env.d.ts`. A third means touching both files.

### Testing Requirements

- `pnpm --filter @dineug/erd-editor-app test` runs Vitest over `src/**/*.test.ts` (`test:dev` for
  watch mode); `test:coverage` enforces 80% per-file thresholds on the files listed in
  `vitest.config.mts` — `services/collaborative/**`, `services/indexeddb/modules/collaborative/**`,
  `utils/broadcastChannel.ts` and `utils/crypto.ts`. Everything else is verified by hand.
- `typecheck` matters here — swc-loader strips types without checking them, so `pnpm build` alone will
  not catch a type error. `tsconfig.json` only includes `src`, so the e2e specs need the separate
  `e2e:typecheck` (`e2e/tsconfig.json`). Beyond that, verification is `dev` (webpack-dev-server, opens
  automatically unless `E2E` is set) and `build`.
- **Persistence changes**: reload and confirm diagrams survive; then check with the SharedWorker
  disabled (Safari, or devtools) so the fallback path is actually exercised.
- **Cross-tab changes**: open two tabs, edit in one, confirm the other follows.
- `e2e` runs the Playwright suite: two browser contexts against a local nostr relay, covering the
  parts no unit test reaches — the snapshot handoff, edits in both directions, the leadership lock
  handover, and the `/live` error states. `e2e:headed` and `e2e:dev` (Playwright UI) are the debugging
  entry points; `e2e:report` opens the HTML report from `e2e/.report`. `e2e/README.md` explains the
  relay, the reopened shadow root, and the two Chromium WebRTC flags without which ICE never completes
  headless. **This suite is not wired into CI** — only the `erd-editor` and `vscode-extension` e2e
  jobs run there — so it is a local gate you have to remember.
- **Collaboration changes**: run `e2e` first, then confirm by hand against the public relays — start a
  session in one browser profile and join the `/live/#...` URL in another. Watch
  `chrome://webrtc-internals` for the peer connection, and confirm in the network tab that the relay
  only ever carries ciphertext.
- **Service-worker changes**: build, serve the production bundle, and verify offline load plus that a
  second build actually supersedes the first.
- `build:analyzer` runs webpack-bundle-analyzer.

### Common Patterns

- `Component.tsx` + `Component.styles.ts`, one directory per component.
- Route-level code splitting via `react-router-dom`'s `lazy` (see the `/live` route).
- Action-type maps declared as `as const` objects paired with a same-named type via `ValuesType`.
- jotai modules export write-only `atom(null, async (get, set, arg) => ...)` setters wrapped in
  `useSetAtom` hooks (`useAddSchemaEntity`, `useStartSession`, …), never the raw atoms.

## Dependencies

### Internal

- `@dineug/erd-editor` — the editor element, plus the `engine.js` subpath for the headless
  `createReplicationStore()` the IndexedDB worker runs
- `@dineug/erd-editor-shiki-worker` — highlighting (lazily imported and registered)
- `@dineug/shared` — `nanoid`, `isObject`, `safeCallback`

### External

- `react` 18 + `react-dom` + `react-router-dom` 6
- `jotai` + `jotai-immer` + `immer` — state; `jotai-devtools` is a devDependency but `Root.tsx`
  imports it unconditionally
- `@radix-ui/themes` + `@radix-ui/react-icons` + `@emotion/react` — UI
- `dexie` — IndexedDB; `comlink` — worker RPC
- `@trystero-p2p/nostr` + `@trystero-p2p/mqtt` — serverless WebRTC collaboration transport, both
  lazily imported so neither relay client lands in the main bundle. Note that most `trystero/*`
  subpaths (`mqtt`, `firebase`, `ipfs`, `supabase`, `torrent`) are deprecated stubs that throw on
  import — `trystero/nostr` is the exception and just re-exports `@trystero-p2p/nostr`. Depend on the
  `@trystero-p2p/*` packages directly rather than relying on which subpath still works.
- `vitest` + `happy-dom` + `@vitest/coverage-v8` — unit tests; `@playwright/test` + `ws` (the local
  e2e relay) — end-to-end
- `workbox-*` (+ `workbox-webpack-plugin`, `webpack-pwa-manifest`) — service worker and PWA
- `@sentry/react` — production error reporting
- `base64-arraybuffer` (ciphertext/IV transport — the key itself travels as the `k` field of an
  exported JWK, not through this), `lodash-es`. `luxon` is still declared but no longer
  imported anywhere in `src`.
- webpack 5 + `swc-loader` + `tsconfig-paths-webpack-plugin`, `core-js`

<!-- MANUAL: -->
