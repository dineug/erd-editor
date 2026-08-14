# app e2e

Playwright specs for the parts of live collaboration a unit test cannot reach: two
real browser contexts, a real `RTCPeerConnection`, and a real `navigator.locks`
handover between tabs.

```bash
pnpm --filter @dineug/erd-editor-app e2e            # headless
pnpm --filter @dineug/erd-editor-app e2e:dev        # Playwright UI
pnpm --filter @dineug/erd-editor-app e2e:typecheck
```

## What makes it deterministic

**A local relay.** `support/relay.mjs` is a ~100-line in-memory nostr relay —
enough of NIP-01 for trystero to complete a WebRTC handshake, and nothing else.
`playwright.config.ts` starts it alongside the webpack dev server and points the
app at it with `ERD_EDITOR_NOSTR_RELAY_URLS`, so no test ever touches a public
relay. Setting that variable also drops the mqtt fallback (see
`src/services/collaborative/room.ts`), which keeps the relay list to one.

Run it with `E2E_RELAY_DEBUG=1` to log every `REQ`/`EVENT` it handles.

**Two browser flags.** Chromium hides local IPs behind `.local` mDNS candidates
that never resolve between two contexts of a headless browser, so signalling would
succeed and ICE would then fail, every time. `--disable-features=WebRtcHideLocalIpsWithMdns`
and `--force-webrtc-ip-handling-policy=default` are what make peer-to-peer work
here at all.

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
