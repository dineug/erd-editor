<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-16 -->

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

| File                          | Description                                                                                                                                                                                                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main.tsx`                | Entry — Sentry init (production only), the `react-router` route table, jotai `Provider`, `registerSW` (production only)                                                                                                                                                                   |
| `src/store.ts`                | The jotai store instance, plus the `BroadcastChannel` handlers that apply remote tab mutations (schema list + session start/stop)                                                                                                                                                             |
| `src/registerSW.ts`           | Workbox window-side registration of `/sw.js`. `vite-plugin-pwa` runs with `injectRegister: null`, so this file is the only registration path                                                                                                                                                  |
| `src/sw.ts`                   | The service worker — precache manifest, `cleanupOutdatedCaches`, `CacheFirst` for content-hashed same-origin assets, `StaleWhileRevalidate` for un-hashed same-origin images/fonts, two Google Fonts routes                                                                                   |
| `src/env.d.ts`                | `ImportMetaEnv` — the two build-time values (`MODE`, `NOSTR_RELAY_URLS`) plus the `*.css` module declaration                                                                                                                                                                                  |
| `src/styles.css`              | One line — `@import url('@radix-ui/themes/styles.css')`. The app's real global styles are Emotion's `Global` in `src/routes/root/Root.styles.ts`, not here                                                                                                                                    |
| `src/internal-types/index.ts` | `AnyAction`, `ReducerRecord`, `ValuesType`, `EntityType` and friends                                                                                                                                                                                                                          |
| `index.html`                  | The Vite entry, at the package root rather than in `public/` — it carries `<base href="/">`, the Google Fonts links and the `<script type="module" src="/src/main.tsx">`                                                                                                                      |
| `vite.config.ts`              | `@vitejs/plugin-react` (Emotion JSX runtime), `VitePWA` (`injectManifest` + the web manifest), the `gtag` `transformIndexHtml` plugin, the `static/**` output names and the separate `worker` block — plus this package's `run.tasks` (`build`/`test`, each fronted by a `tsc --noEmit` gate) |
| `tsconfig.json`               | Extends the root `tsconfig.app.json`; `@/*` → `src/*`, `jsxImportSource: @emotion/react`, `lib` includes `WebWorker`. `include` is `src` only — that is the program `tsc --noEmit` gates (tests included), and `e2e/` carries its own tsconfig                                                |
| `vitest.config.mts`           | Vitest (happy-dom) over `src/**/*.test.ts`; coverage scoped to the collaboration transport and the utilities it builds on. `.mts` because `package.json` is CommonJS                                                                                                                          |
| `vitest.setup.ts`             | Swaps in Node's `webcrypto` — happy-dom's `crypto` stub has no `subtle`, which the E2E encryption is built entirely on                                                                                                                                                                        |
| `playwright.config.ts`        | Chromium e2e against the `vp dev` server (`:5175`) plus a local nostr relay (`:5176`); the WebRTC launch flags live here (see `e2e/README.md`)                                                                                                                                                |

## Subdirectories

| Directory                            | Purpose                                                                                                                                                                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/atoms/modules/`                 | jotai state, one module per concern — `schema` (the diagram list), `sidebar` (selection + the replication write path), `sidebar-sash` (layout), `collaborative` (sessions, nickname, `useCollaborativeHost`), `theme`            |
| `src/components/app/`                | `App.tsx` — the main layout (sidebar + sash + viewer) and the mount point for `useCollaborativeHost()`                                                                                                                           |
| `src/components/sidebar/`            | Schema list, `sidebar-add-item/`, `sidebar-item/` and its `sidebar-collaborative/` session controls (which build the invite link)                                                                                                |
| `src/components/sidebar-sash/`       | Draggable sidebar resizer                                                                                                                                                                                                        |
| `src/components/viewer/`             | `Viewer.tsx` and `editor/Editor.tsx` — the React↔custom-element boundary                                                                                                                                                         |
| `src/components/live-collaborative/` | `LiveCollaborative.tsx` (the `/live` guest view, lazily routed) and `live-collaborative-error/`                                                                                                                                  |
| `src/routes/root/`                   | `Root.tsx` — the Radix `Theme` shell, Emotion `Global`, and the router `Outlet`                                                                                                                                                  |
| `src/services/collaborative/`        | The main-thread WebRTC transport — `room.ts` (trystero wrapper, ref-counted joins, `STRATEGIES`), `guest.ts` (the `/live` side), `host.ts` (session owner), `leader.ts` (Web Locks election), `index.ts` (the barrel)            |
| `src/services/indexeddb/`            | `index.ts` (worker selection + Comlink wrap), `appDatabaseService.ts` (the Dexie service, also the main-thread fallback), `indexeddb.worker.ts` / `indexeddb.shared-worker.ts`, and `modules/schema/` + `modules/collaborative/` |
| `src/utils/`                         | `broadcastChannel.ts` (the typed cross-tab bridge), `crypto.ts` (AES-GCM E2E), `clipboard.ts`, `text.ts` (`toWidth`, via `OffscreenCanvas`), `errors.ts` (`InvalidHashError`, `NotFoundHostError`, `HostStopSessionError`)       |
| `src/__test-utils__/`                | `room.ts` — a fake `CollaborativeRoom` tests drive by invoking the handlers the service under test assigned                                                                                                                      |
| `e2e/`                               | `specs/` (`collaboration`, `leadership`, `live-errors`), `support/AppPage.ts` (the `AppPage` and `LivePage` page objects) and `support/relay.mjs` — a local nostr relay (`e2e/README.md`)                                        |
| `public/`                            | Copied verbatim to the output root — favicon/SVG logos and the PWA icon set. The HTML shell moved out to `index.html`, and `manifest.json` is generated by `vite-plugin-pwa` rather than checked in                              |

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
  either run in dev. ⚠️ That also means **nothing in this repo ever executes `Sentry.init()`** — not
  the Vitest suite, not the Playwright e2e (which drives the dev server). `tsc` proves the types and
  stops there. Verifying an SDK change takes a production build served locally, with the ingest host
  blocked at the network layer so the smoke traffic never reaches the real project.
- **v10 changed three behaviours the call site cannot show you.** The `init()` call looks identical
  to the v7 one, so read these from here rather than from the code: user IPs are no longer inferred
  (`sendDefaultPii` now gates it, effective 10.4.0) — events group anonymously; `cultureContext`
  joined the default integrations, so every event now carries `locale`, `timezone` and `calendar`;
  and `browserTracingIntegration()` self-disables for bot user agents, with no option to turn that
  off. The first two were left at v10's defaults deliberately. Measured in a real browser, not read
  from a changelog.
- **Service worker changes need a cache-invalidation story.** `src/sw.ts` routes content-hashed
  same-origin assets through `CacheFirst` and un-hashed same-origin **images and fonts** through
  `StaleWhileRevalidate` (`ASSET_EXTENSIONS` — png/svg/jpg/jpeg/gif/woff/woff2/eot/ttf/otf). Nothing
  else is routed: un-hashed `.js`/`.css` and navigations fall through to precache or the network. A
  wrong strategy strands users on a stale build.
- **The output file names are a contract with that router, not a style choice.**
  `build.rolldownOptions.output` pins `hashCharacters: 'hex'` and dot-separated `[hash:8]`
  (`static/js/bundle.<hex8>.js`, `static/css/bundle.<hex8>.css`, `static/media/[name].<hex8>[extname]`)
  because `src/sw.ts` decides what is immutable with `/\.[0-9a-f]{8,}\./`. Rolldown's default base64
  hashes never match it, and the failure is silent: nothing errors, the route just stops matching and
  `CacheFirst` caches nothing.
- **Workers need their own copy of that.** Workers do not inherit `build.rolldownOptions.output`, so
  `vite.config.ts` repeats `hashCharacters` / `entryFileNames` / `chunkFileNames` under a separate
  `worker` block (`format: 'es'`). Without it the two IndexedDB workers land in `assets/` with base64
  hashes and drop out of the same route. ⚠️ Use `[name]` in those templates — `[id]` was webpack's
  placeholder and rolldown has none, so writing it emits a file named literally `[id].<hash>.js` with
  no error.
- **The collaboration view tears down through the effect cleanup.** `LiveCollaborative` builds the
  editor, the guest and every timer inside one `useLayoutEffect` and undoes all of it in the returned
  cleanup; a resource added there needs a matching line in that cleanup or it leaks across a room
  change.
- Styling is Radix Themes + Emotion; component styles live in a sibling `*.styles.ts`. The Emotion
  `css` prop needs its own JSX runtime, and `tsconfig.json`'s `jsxImportSource` only informs the type
  checker — the transform is told separately, by `react({ jsxImportSource: '@emotion/react' })` in
  `vite.config.ts`. Changing one means changing the other.
- **Builds with Vite** (`@vitejs/plugin-react` + `vite-plugin-pwa`) on TypeScript 7.0.2 — the single
  version the whole workspace pins, through `overrides` in `pnpm-workspace.yaml`. webpack, `swc-loader`,
  the `@swc-jotai/*` plugins, `tsconfig-paths-webpack-plugin` and `core-js` are all gone from this
  package; `HtmlWebpackPlugin`'s inlined analytics snippet is now the local `gtag` plugin, which
  rewrites `</body>` in production only.
- **There is no `vite` binary.** `vite` is a pnpm-catalog alias for `@voidzero-dev/vite-plus-core`, so
  `node_modules/.bin/vite` does not exist. `vp` is the CLI; any instruction reading `vite build` or
  `vite serve` fails with "command not found", not with a useful message.
- **`build.target` is imported, not spelled out.** `BROWSER_TARGET` from the root `build-target.ts`
  (`chrome87` / `edge88` / `firefox78` / `safari14.1`) is the repo's one browser floor, and this app
  is on it alongside the nine libraries — only the two webviews opt out, because their host ships its
  own Chromium. ⚠️ Dropping the key rather than the value is the quiet failure: Vite's default is
  chrome111 / safari16.4, which narrows who can load the app without anything going red.
- **`run.tasks` in `vite.config.ts` is what the root `pnpm build` and `pnpm test` actually run**, and
  each is fronted by `tsc --noEmit`. Rolldown strips types without reading them, exactly as swc did, so
  a bare `vp build` still proves nothing about types — the gate is the first command in the task, not
  the bundler.
- **Both tasks depend on `build` `from: ['dependencies', 'devDependencies', 'peerDependencies']`.**
  This package is one of the three whose workspace edges are all in `dependencies` — Vite Task's
  default — so the full field list buys it nothing today; it is spelled out to match the nine libraries,
  where the edges sit in `devDependencies` and the default would empty the graph. ⚠️ Either way the
  failure mode is the same and it is not an error: a dependency that falls out of the graph produces a
  green run against a stale `dist/`.
- The `build` task also declares `output: ['dist/**']`. Drop it and a cache hit replays the terminal
  output without restoring `dist/`.
- **The `input` globs are written by hand, and they have to be.** TypeScript 7's `tsc` is a native
  binary, so Vite Task's automatic file tracking never observes what it reads — every file the
  typecheck depends on is spelled out (`src/**`, `index.html`, `public/**`, `package.json`,
  `vite.config.ts`, `vitest.config.*`, `vitest.setup.ts`, `tsconfig.json`, the workspace-based
  `tsconfig.app.json`, and one `packages/<dep>/dist/**/*.d.ts` glob per workspace dependency).
  ⚠️ Widen `tsconfig.json`'s `include` without widening `input` and the failure is a cache hit: `tsc`
  is not re-run and the task goes green. Only the three dependency globs are enforced, by
  `scripts/check-task-inputs.mjs` (part of `pnpm check`); the tsconfig ↔ `input` pairing is unguarded.
- `private: true`, version `0.1.0`, and no `"type": "module"` — which is why the Vitest config is still
  `.mts`. There is no backend, and `import.meta.env.MODE` is Vite's own, so exactly one `define` entry
  remains: `import.meta.env.NOSTR_RELAY_URLS`, fed by `ERD_EDITOR_NOSTR_RELAY_URLS` and declared in
  `src/env.d.ts`. A second value means touching both files. ⚠️ The `define` block is skipped entirely
  under Vitest (`process.env.VITEST`) — replacing `import.meta.env.X` inside the test runner's own
  module graph breaks specs that touch the same object.

### Testing Requirements

- `pnpm exec vp run --fail-if-no-match --filter @dineug/erd-editor-app test` runs the suite over
  `src/**/*.test.ts` (7 files / 82 cases, measured); the specs import `describe`/`it`/`expect`/`vi`
  from `vite-plus/test`, not `vitest`. It is part of the root `pnpm test` (`vp run -r test`).
- **`pnpm --filter @dineug/erd-editor-app test` and `... build` no longer exist.** Those two names are
  owned by `run.tasks`, and a `package.json` script sharing a task name makes the task graph fail to
  load — so both scripts were deleted. pnpm answers `ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`, which reads
  like a broken checkout rather than a renamed command.
- **The built-in `vp test` and `vp build` ignore `run.tasks`.** They run the bare step and skip the
  `tsc --noEmit` in front of it, so a type error passes silently. `test:dev` (`vp test dev`, watch) and
  `test:coverage` (`vp test run --coverage`) are both of those — useful, but not type gates. Reach them
  the usual way: `pnpm --filter @dineug/erd-editor-app test:dev`.
- **A `--filter` that matches no package exits 0.** `--fail-if-no-match` is what turns a renamed or
  moved package into a red run instead of a green one that tested nothing.
- `test:coverage` enforces 80% per-file thresholds on the files listed in `vitest.config.mts` —
  `services/collaborative/**`, `services/indexeddb/modules/collaborative/**`, `utils/broadcastChannel.ts`
  and `utils/crypto.ts`. Everything else is verified by hand. Nothing in CI runs it (only r-html's), so
  check it yourself after adding a module to that list.
- `typecheck` still matters, and it is now enforced in three places rather than one. The program is
  unchanged — `tsconfig.json`'s `include: ["src"]`, which covers `src/**/*.test.ts` — but what runs it
  is: the `build` task, the `test` task, and CI's `check` job
  (`pnpm --filter @dineug/erd-editor-app typecheck`). Before, the script existed and nothing called it.
  The e2e specs and `playwright.config.ts` sit outside that program; `e2e:typecheck`
  (`e2e/tsconfig.json`) is the only thing that reads them, and the same `check` job runs it.
- `vite.config.ts` and `vitest.config.mts` sit outside this package's own program too. The root
  `tsconfig.json` collects every `packages/*/vite.config.*` and `packages/*/vitest.config.*`, and
  `pnpm check` (`vp check && tsc --noEmit && node scripts/check-task-inputs.mjs`) is the only thing
  that typechecks them — a typo in a `run.tasks` key is caught there and nowhere else.
- Beyond that, verification is `dev` and a build. `pnpm --filter @dineug/erd-editor-app dev` builds the
  three workspace dependencies first, then starts `vp dev` (which opens a browser unless `E2E` is set).
- **Persistence changes**: reload and confirm diagrams survive; then check with the SharedWorker
  disabled (Safari, or devtools) so the fallback path is actually exercised.
- **Cross-tab changes**: open two tabs, edit in one, confirm the other follows.
- `e2e` builds the same three dependencies and then runs the Playwright suite: two browser contexts
  against a local nostr relay, covering the parts no unit test reaches — the snapshot handoff, edits in
  both directions, the leadership lock handover, and the `/live` error states. `e2e:headed` and
  `e2e:dev` (Playwright UI) are the debugging entry points; `e2e:report` opens the HTML report from
  `e2e/.report`. `e2e/README.md` explains the relay, the reopened shadow root, and the two Chromium
  WebRTC flags without which ICE never completes headless. **The specs still do not run in CI** — only
  `e2e:typecheck` does, in the `check` job — so the suite itself is a local gate you have to remember.
- **Collaboration changes**: run `e2e` first, then confirm by hand against the public relays — start a
  session in one browser profile and join the `/live/#...` URL in another. Watch
  `chrome://webrtc-internals` for the peer connection, and confirm in the network tab that the relay
  only ever carries ciphertext.
- **Service-worker changes**: build, serve the production bundle, and verify offline load plus that a
  second build actually supersedes the first. Check the emitted names too — the `CacheFirst` route only
  fires on `/\.[0-9a-f]{8,}\./`.

### Common Patterns

- `Component.tsx` + `Component.styles.ts`, one directory per component.
- Route-level code splitting via `react-router`'s `lazy` route property (see the `/live` route). The
  function form (`lazy: async () => ({ Component })`) is still current in v8 — the object form added
  in 7.5 is an alternative, not a replacement.
- Action-type maps declared as `as const` objects paired with a same-named type via `ValuesType`.
- jotai modules export write-only `atom(null, async (get, set, arg) => ...)` setters wrapped in
  `useSetAtom` hooks (`useAddSchemaEntity`, `useStartSession`, …), never the raw atoms.

## Dependencies

### Internal

- `@dineug/erd-editor` — the editor element, plus the `engine.js` subpath for the headless
  `createReplicationStore()` the IndexedDB worker runs
- `@dineug/erd-editor-shiki-worker` — highlighting (lazily imported and registered)
- `@dineug/shared` — `nanoid`, `isObject`, `safeCallback`

All three are real `dependencies` here, unlike the libraries, which keep their workspace edges in
`devDependencies` — the `run.tasks` `dependsOn` block lists every field so both shapes work.

### External

- `react` 19 + `react-dom` 19 + `react-router` 8. ⚠️ There is no `react-router-dom` v8 — v7 turned it
  into a re-export shim and v8 deleted it, so DOM-only APIs come from `react-router/dom` and
  everything else from `react-router`. `RouterProvider` exists in **both**, and the root one is
  missing the `flushSync` wiring; importing the wrong one typechecks clean
- `jotai` + `jotai-immer` + `immer` — state
- `@radix-ui/themes` 3.3 + `@radix-ui/react-icons` + `@emotion/react` — UI. The 3.x line is what has a
  React 19 peer range; its text input is `TextField.Root` (the older `TextField.Input` is gone)
- `dexie` — IndexedDB; `comlink` — worker RPC
- `@trystero-p2p/nostr` + `@trystero-p2p/mqtt` — serverless WebRTC collaboration transport, both
  lazily imported so neither relay client lands in the main bundle. Note that most `trystero/*`
  subpaths (`mqtt`, `firebase`, `ipfs`, `supabase`, `torrent`) are deprecated stubs that throw on
  import — `trystero/nostr` is the exception and just re-exports `@trystero-p2p/nostr`. Depend on the
  `@trystero-p2p/*` packages directly rather than relying on which subpath still works.
- `vitest` + `happy-dom` + `@vitest/coverage-v8` — unit tests. The runner is Vitest 4, but the specs
  import their `describe`/`it`/`expect`/`vi` from `vite-plus/test`. `@playwright/test` + `ws` (the
  local e2e relay) — end-to-end
- `workbox-*` (+ `vite-plugin-pwa` and `workbox-build`) — service worker and PWA. `vite-plugin-pwa`
  replaces both `workbox-webpack-plugin`'s `InjectManifest` and `webpack-pwa-manifest`; the web
  manifest is spelled out in full in `vite.config.ts` because `start_url`, `scope` and `display` are
  what make the installed app open standalone, and losing one is invisible until someone installs it
- `@sentry/react` — production error reporting
- `base64-arraybuffer` (ciphertext/IV transport — the key itself travels as the `k` field of an
  exported JWK, not through this), `lodash-es`. `luxon` is still declared but no longer
  imported anywhere in `src`.
- `vite` (the catalog alias for `@voidzero-dev/vite-plus-core`), `vite-plus`, `@vitejs/plugin-react`,
  `typescript` 7.0.2 — build only

<!-- MANUAL: -->
