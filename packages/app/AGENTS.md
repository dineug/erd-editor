<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-09-19 -->

# app

## Purpose

`@dineug/erd-editor-app` (private) is the React PWA at erd-editor.io and the workspace's only React package. It wraps `<erd-editor>` in a backend-free shell: IndexedDB behind a Comlink worker, cross-tab sync over BroadcastChannel, a Workbox service worker, and end-to-end-encrypted peer-to-peer collaboration.

## Key Files

| File | Description |
| --- | --- |
| `src/main.tsx` | Entry — route table (`/`, lazy `/live`, catch-all → `/`), jotai `Provider`; `Sentry.init` and `registerSW()` in production only |
| `src/store.ts` | The jotai store and the `bridge.on` handlers applying other tabs' mutations |
| `src/sw.ts` | Service worker — `CacheFirst` for same-origin files matching `/\.[0-9a-f]{8,}\./`; `registerSW.ts` reloads when an update activates |
| `src/utils/broadcastChannel.ts` | The cross-tab protocol: `dispatch` does not echo to the posting tab, `dispatchAll` does |
| `src/utils/crypto.ts` | AES-GCM over `crypto.subtle`, so relays carry ciphertext only |
| `vite.config.ts` | react / PWA / legacy plugins, `static/**` output names, the `worker` output block, this package's own `run.tasks` |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/atoms/modules/` | jotai state — `schema`, `sidebar`, `sidebar-sash`, `collaborative`, `theme` |
| `src/components/` | `viewer/` is the React↔custom-element boundary, `live-collaborative/` the `/live` guest view |
| `src/services/collaborative/` | Main-thread WebRTC transport — `room.ts`, `host.ts`, `guest.ts`, `leader.ts` |
| `src/services/indexeddb/` | Dexie service; `index.ts` picks `SharedWorker`, then `Worker`, then in-thread |
| `e2e/` | Playwright specs, `support/AppPage.ts`, `support/relay.mjs` (a local nostr relay) |

## For AI Agents

### Working In This Directory

- **The editor is a custom element, not a React component**: `viewer/editor/Editor.tsx` creates it and drives it through its methods.
- **`import '@dineug/erd-editor';` on its own line registers `<erd-editor>`.** A file importing only the `ErdEditorElement` type loses the import to type elision and mounts an unupgraded element (`getSharedStore is not a function`), past `tsc` and the build. `erdEditorRegistration.test.ts` pins it beside every caller.
- **Collaboration stays on the main thread** — `RTCPeerConnection` is window-only. `leader.ts` elects one tab via `navigator.locks`; `atoms/modules/sidebar/index.ts` sends each batch as `collaborativeDispatch`, through `bridge.emit` in the leader and `dispatch` elsewhere, because BroadcastChannel never echoes to the poster.
- **Join rooms only via `joinCollaborativeRoom`**: it ref-counts one trystero room per strategy and room id, so a bare `joinRoom` lets one caller's `leave()` destroy another's peers.
- **The secret key stays in the URL fragment** (`/live/#<roomId>,<secretKey>`, read in `LiveCollaborative.tsx`): it doubles as the trystero password, and a query string would leak it to server logs and referrers.
- **Hex `[hash:8]` output names are a contract with `sw.ts`**, repeated under `worker` because workers inherit no `build` output options; base64 hashes silently stop matching `CacheFirst`.
- Take `RouterProvider` from `react-router/dom`; the root export of the same name lacks the `flushSync` wiring and still typechecks.
- `run.tasks` is bespoke: its inputs name `packages/erd-editor/dist/**/*.d.ts` by hand, so a newly typechecked sibling goes into that list.

### Testing Requirements

- `pnpm exec vp run --filter @dineug/erd-editor-app --fail-if-no-match test` — happy-dom; `vitest.setup.ts` installs Node `webcrypto` for `crypto.subtle`. `test:coverage` gates only the collaboration code (`include` in `vitest.config.mts`).
- `pnpm --filter @dineug/erd-editor-app e2e` builds `erd-editor`, then runs one Chromium worker against `vp dev` (:5175) and the local relay (:5176, also r-html's e2e port — run them apart or set `E2E_RELAY_PORT`). WebRTC needs the two launch flags in `playwright.config.ts`. No CI job runs it.
- CI's `check` job runs `typecheck` and `e2e:typecheck`; only the latter covers `e2e/` and `playwright.config.ts`.

### Common Patterns

- `Component.tsx` beside `Component.styles.ts`; Emotion `css` prop, Radix Themes for widgets.
- jotai modules export their state atoms but keep write-only `atom(null, …)` action atoms private behind `use*` hooks.

## Dependencies

### Internal

`@dineug/erd-editor` — the element, plus the `engine.js` subpath whose `createReplicationStore()` the IndexedDB service runs headless.

### External

- `dexie` stays at `^3` on purpose: it owns users' stored documents, so a major upgrade is its own verified change.
- `@trystero-p2p/nostr` / `mqtt` load dynamically; `ERD_EDITOR_NOSTR_RELAY_URLS` at build time points nostr at private relays.
- `luxon` and `@types/luxon` are declared but nothing imports them.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
