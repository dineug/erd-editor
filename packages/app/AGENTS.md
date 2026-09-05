<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-08-27 -->

# app

## Purpose

The React PWA at erd-editor.io (`@dineug/erd-editor-app`, `private: true`) — the only React package in the workspace.
It wraps the `<erd-editor>` custom element in a shell: saved diagrams in IndexedDB via a Comlink worker, cross-tab
sync over BroadcastChannel, a Workbox service worker, and end-to-end-encrypted peer-to-peer collaboration, no backend.

## Key Files

| File | Description |
| --- | --- |
| `src/main.tsx` | Entry — `Sentry.init` and `registerSW()` in production only, the `react-router` route table, jotai `Provider` |
| `src/store.ts` | The jotai store plus the `bridge.on({...})` handlers applying other tabs' schema and session mutations |
| `src/sw.ts` | Service worker — `CacheFirst` for same-origin js/css/media whose name matches `/\.[0-9a-f]{8,}\./`, `StaleWhileRevalidate` for the un-hashed images/fonts and the Google Fonts stylesheets |
| `src/registerSW.ts` | Production-only Workbox registration; reloads when an updated service worker activates |
| `src/utils/broadcastChannel.ts` | `BridgeActionType` and its action creators — the cross-tab protocol. `dispatch` does not echo to the posting tab, `dispatchAll` does |
| `src/utils/crypto.ts` | AES-GCM 128 over `crypto.subtle`; `encryptToJson` / `decryptFromJson` keep relays carrying ciphertext only |
| `vite.config.ts` | react/PWA/legacy plugins, the `gtag` HTML transform, `static/**` output names, a separate `worker` output block, `run.tasks` |
| `vitest.setup.ts` | Installs Node `webcrypto` — happy-dom's `crypto` stub has no `subtle` |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/atoms/modules/` | jotai state — `schema`, `sidebar`, `sidebar-sash`, `collaborative`, `theme` |
| `src/components/` | `app/`, `sidebar/`, `sidebar-sash/`, `viewer/` (the React↔custom-element boundary), `live-collaborative/` (the `/live` guest view) |
| `src/routes/root/` | `Root.tsx` — the Radix `Theme` shell, Emotion `Global`, and the router `Outlet` |
| `src/services/collaborative/` | Main-thread WebRTC transport — `room.ts` (trystero, `APP_ID`, `STRATEGIES`), `host.ts`, `guest.ts`, `leader.ts` |
| `src/services/indexeddb/` | Dexie service plus the `SharedWorker` → `Worker` → in-thread selection in `index.ts` |
| `src/utils/` | The cross-tab bridge and crypto above, plus `clipboard.ts`, `text.ts`, `errors.ts` |
| `e2e/` | Playwright specs (`collaboration`, `leadership`, `live-errors`), `support/AppPage.ts`, `support/relay.mjs` (a local nostr relay) |

## For AI Agents

### Working In This Directory

- **The editor is a custom element, not a React component.** `Editor.tsx` creates it via refs and drives it through element methods; props never reach its internals.
- The router serves the editor at `/` and the lazy live collaboration view at `/live`; the catch-all route redirects back to `/`.
- `VitePWA` uses `injectManifest` with `registerType: 'prompt'`, but `registerSW.ts` reloads on an update activation. The service worker keeps hashed JS/CSS in `static`, other images/fonts in `assets`, and Google Fonts in separate caches.
- **Collaboration cannot move into a worker** — `RTCPeerConnection` is window-only. `leader.ts` elects one tab via `navigator.locks`; `atoms/modules/sidebar/index.ts` routes every batch as `collaborativeDispatch`, `bridge.emit` in the leader and `dispatch` elsewhere, because BroadcastChannel never echoes to the poster.
- **Join rooms only via `joinCollaborativeRoom`.** trystero returns one room object per `appId`+`roomId`, so a bare `joinRoom` lets one caller's `leave()` destroy another's peers.
- **The secret key stays in the URL fragment** (`/live/#<roomId>,<secretKey>`, read in `LiveCollaborative.tsx`) — it doubles as the trystero password, so a query string would put it in server logs and referrers.
- **Hex `[hash:8]` output names are a contract with `sw.ts`**, repeated under `worker` because workers do not inherit them; base64 hashes stop matching `CacheFirst` silently.

### Testing Requirements

- `vp run --filter @dineug/erd-editor-app --fail-if-no-match test` — `src/**/*.test.ts`, happy-dom, `tsc --noEmit` first. `test:coverage` enforces 80% per file over `services/collaborative/**`, `services/indexeddb/modules/collaborative/**`, `utils/broadcastChannel.ts` and `utils/crypto.ts`.
- `pnpm --filter @dineug/erd-editor-app e2e` builds `erd-editor` and the Shiki worker, then runs one Chromium worker against `vp dev` (:5175) and the in-memory nostr relay (`e2e/support/relay.mjs`, :5176). `E2E=1` prevents Vite from opening a browser; WebRTC requires the two launch flags in `playwright.config.ts`. Never runs in CI.
- CI's `check` job runs `typecheck` (`tsconfig.json`, `include: ["src"]`) and `e2e:typecheck` (`e2e/tsconfig.json`) — the only program covering `e2e/` and `playwright.config.ts`.

### Common Patterns

- `Component.tsx` beside a `Component.styles.ts`; Emotion `css` prop, Radix Themes for widgets.
- jotai modules keep their write-only `atom(null, …)` action atoms private and expose them only as `use*` hooks; the immer state atoms (`schemaEntitiesAtom`, `collaborativeAtom`, `themeAtom`, `sidebarSashAtom`) are exported directly.
- Action-type maps are `as const` objects paired with a same-named type via `ValuesType` (`src/internal-types/`).

## Dependencies

### Internal

`@dineug/erd-editor` (the element, plus the `engine.js` subpath for the headless `createReplicationStore()` the IndexedDB worker runs), `@dineug/erd-editor-shiki-worker`. Type guards come from `es-toolkit`, ids from `nanoid`, and `safeCallback` is local (`src/utils/safeCallback.ts`).

### External

- `react` 19 / `react-router` 8 — take `RouterProvider` from `react-router/dom`; the root export of the same name omits the `flushSync` wiring and typechecks clean.
- `jotai` + `jotai-immer` + `immer`; `@radix-ui/themes` 3 + `@emotion/react`; `dexie` at `^3` on purpose (data migration); `comlink` for worker RPC.
- `@trystero-p2p/nostr` + `@trystero-p2p/mqtt`, both dynamically imported; `base64-arraybuffer` for ciphertext transport; `workbox-*` + `vite-plugin-pwa`; `@sentry/react`; `@vitejs/plugin-legacy` for modern polyfills only; `es-toolkit` (`omit` from the main entry, `isEmpty` from `/compat`). `luxon` is declared but unused in `src/`.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
