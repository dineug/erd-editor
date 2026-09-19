# app e2e

Playwright specs for what a unit test cannot reach: for live collaboration, two
real browser contexts, a real `RTCPeerConnection` and a real `navigator.locks`
handover between tabs; for the schema list, the real editor, IndexedDB behind its
worker, the URL, file choosers, downloads and the pre-paint theme script.

```bash
pnpm --filter @dineug/erd-editor-app e2e            # headless
pnpm --filter @dineug/erd-editor-app e2e:dev        # Playwright UI
pnpm --filter @dineug/erd-editor-app e2e:typecheck
```

## What makes it deterministic

**A local relay.** `support/relay.mjs` is a ~100-line in-memory nostr relay —
enough of NIP-01 for trystero to complete a WebRTC handshake, and nothing else.
`playwright.config.ts` starts it alongside the Vite dev server (`vp dev`) and
points the app at it with `ERD_EDITOR_NOSTR_RELAY_URLS`, so no test ever touches
a public relay. Setting that variable also drops the mqtt fallback (see
`src/services/collaborative/room.ts`), which keeps the relay list to one.

Run it with `E2E_RELAY_DEBUG=1` to log every `REQ`/`EVENT` it handles.

**Two browser flags.** Chromium hides local IPs behind `.local` mDNS candidates
that never resolve between two contexts of a headless browser, so signalling would
succeed and ICE would then fail, every time. `--disable-features=WebRtcHideLocalIpsWithMdns`
and `--force-webrtc-ip-handling-policy=default` are what make peer-to-peer work
here at all.

**Seeded times.** `support/backup.ts` builds a backup file with chosen
`updateAt` values, since an import keeps the times it is given, and works out the
expected date groups with `Date`, apart from the app's luxon, from the test's own
clock. `AppPage` reads IndexedDB directly to know a change has been stored before
asserting that the list did not move, and writes to it to seed a trash an earlier
session left, since a backup carries no `deletedAt`.

**A reopened shadow root.** `<erd-editor>` is defined with `shadow: 'closed'`.
`support/AppPage.ts` patches `Element.prototype.attachShadow` through
`addInitScript` — before any page script runs — so locators reach the canvas.
Production code is untouched.

## What the specs cover

| Spec                    | Covers                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `collaboration.spec.ts` | Snapshot handoff to a joining guest, edits in both directions, host stopping a session |
| `leadership.spec.ts`    | Cross-tab session visibility, a follower's edits relayed by the leader, lock handover  |
| `live-errors.spec.ts`   | Malformed invite links and the "host not found" path                                   |
| `participants.spec.ts`  | Who is in, and nicknames, on both sides, across tabs and a handover; cursor labels     |
| `schema-list.spec.ts`   | An edit moves a schema up while zoom and rename do not; date groups; the 30-day trash  |
| `schema-url.spec.ts`    | `?schema=` follows the selection, survives a reload, back and forward; bad ids cleared |
| `import-export.spec.ts` | Sources stored parsed, kept on reload, opened without a bump; a backup round trip      |
| `theme.spec.ts`         | Dark by default on a light system, the System option, no dark flash on reload          |

## Reading a failure

`workers: 1` and `fullyParallel: false`: every spec drives several contexts at
once, and a handover reads better when nothing else is racing the relay. Traces
land in `e2e/.results` on a retry; `pnpm --filter @dineug/erd-editor-app e2e:report`
opens the HTML report.

The usual suspect for a flake here is timing around a handover — the host has no
outbound buffer, so an edit made in the second or two before the successor tab has
rejoined the room is dropped. The guest does buffer (its shared store holds
actions while disconnected and flushes on reconnect), which is why
`leadership.spec.ts` drives the handover from the guest side.
