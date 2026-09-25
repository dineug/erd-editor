# app e2e

Playwright specs for what a unit test cannot reach: for live collaboration, two
real browser contexts, a real `RTCPeerConnection` and a real `navigator.locks`
handover between tabs; for the schema list, the real editor, IndexedDB behind its
worker, the URL, file choosers, downloads and the pre-paint theme script; for
`/gdrive`, the real auth relay under `vp dev`, a popup, cookies, tabs sharing a
file and its lock, and the editor saving to a Drive in memory.

```bash
pnpm --filter @dineug/erd-editor-app e2e            # both runs, headless
pnpm --filter @dineug/erd-editor-app e2e:dev        # Playwright UI, run 1
pnpm --filter @dineug/erd-editor-app e2e:typecheck
pnpm --filter @dineug/erd-editor-app exec playwright test --config e2e/gdrive/playwright.config.ts   # run 2 alone
```

## Two runs

`e2e` runs Playwright twice, one after the other, and exits non-zero if either
failed; the second runs even when the first fails, so a broken local spec never
hides the Drive results.

| Run | Config                            | Servers                                                      | Specs                     |
| --- | --------------------------------- | ------------------------------------------------------------ | ------------------------- |
| 1   | `playwright.config.ts`            | relay :5176, `vp dev` :5175 without a Google client id       | `specs/*.spec.ts`         |
| 2   | `gdrive/playwright.config.ts`     | fake Google token server :5178, `vp dev` :5177 with a client | `gdrive/specs/*.spec.ts`  |

Only one dev server is ever up, so the two never race over `node_modules/.vite`.
Each run names every variable its dev server reads (run 1 an empty
`VITE_GOOGLE_CLIENT_ID`; run 2 the client, `GOOGLE_CLIENT_SECRET`, `COOKIE_KEY`
and `ERD_EDITOR_E2E_GOOGLE_OAUTH_URL`, in `support/gdrive/server.ts`), since Vite
prefers the environment to `packages/app/.env.local`, where a real client may
live. Neither reuses a server: a dev server started by hand on one of these
ports makes the run fail at once (`--strictPort`) rather than test the wrong one.

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

**A fake Google for run 2.** `support/gdrive/fakeGoogleOAuth.mjs` is Google's
token and revoke endpoints, which the real dev relay calls: codes bound to the
client, `redirect_uri` and PKCE challenge, refresh tokens live until revoked,
`/__control/*` for the specs. `support/gdrive/fakeGoogle.ts` routes the rest in
the browser context: the authorize page (it registers a code with the token
server and sends the popup to the real callback, or denies, closes, or leaves
Drive out), the GIS script, userinfo, and a Drive in memory that answers only the
`fields` asked for, pages by two, shows each account only the files it may see,
each owned by one of them (`owner`, which `ownedByMe` answers), refuses an upload without its `uploadType` and a metadata PATCH that is not JSON,
reads a list's `q` of the terms the app sends (`trashed`, `mimeType`,
`appProperties has`) and answers any other with a 400, so an unmatched query lists
nothing, reports a file in the trash or a shared drive through any folder above it
(`trashed`, `driveId`), leaves a shared drive's files out of a list without
`includeItemsFromAllDrives` and out of reach without `supportsAllDrives`, puts a
create that names no parent in My Drive (`root`), as Drive does, which the ERD
Editor folder's JSON POST relies on (so the specs check each new file's `parents`
to catch a file left loose there), and one that names a parent only in a folder
the account can reach and add to (`canAddChildren`, a 404 or a 403 otherwise),
finds the ERD Editor folders by their marker (`appFolders()`), records each request
with its tab, and can hold PATCHes, lose a PATCH's answer or fail the next requests. Any other Google host aborts. The browser follows a redirect past every route, so the relay's `start`
is routed too: its real answer, cookie included, comes back as a page that
navigates to the authorize URL, marked so the popup does not take it for a stray
page. `support/gdrive/fakeAuth.ts` makes `/api/auth/*` fail its JSON contract
for the fallback spec. The clickjacking check frames `/gdrive` from the token
server's own `/__framer`: Chrome blocks a routed origin from framing localhost.
Neither dev server reads `public/_headers`, so the check covers the app's own
refusal (`isFramed`) alone; `src/pagesHeaders.test.ts` holds the file's two
`/gdrive` rules in the unit tests.

**Static policy pages.** Pages answers `/privacy`, `/terms` and `/support` with
their files in `public/`; `vp dev` would answer them with the app, so
`policyPages` in `vite.config.ts` rewrites the three paths, and `policy.spec.ts` reads them with
JavaScript off, as Google's reviewers may, along with the links `/` keeps for
that case in `index.html`.

## Marketplace assets

`gdrive/assets.config.ts` is not a third run and starts no server.
`google-workspace:assets` runs it to render `google-workspace/` from
`public/erd-editor_icon.svg`: the icons, each on a page at its `assets.json`
scale, so an `@2x` file is the SVG drawn at twice the pixels, and the card
banner. `google-workspace:check` then reads the size of each PNG against
`google-workspace/assets.json`.

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
| `gdrive-not-configured.spec.ts` | `/gdrive` without a client id; `/` loads no Drive module or GIS script         |
| `policy.spec.ts`        | `/privacy`, `/terms` and `/support` with JavaScript off: 200, no script, the points each must make, no email address but `support@erd-editor.io` and no governing law, GitHub Issues, no link to the site but each other, no request to another origin, both themes; `/`'s `<noscript>` links; the sidebar's links in a new tab, none to `/gdrive`; the empty viewer's Editing Guide and GitHub, with `rel="noopener"`, checked on `/gdrive` too by the same `support/resourceLinks.ts` |
| `gdrive/specs/gdrive-auth.spec.ts` | The relay popup, the refresh cookie, one renewal between two tabs, sign-out, the state through sign-in, its `userId` as the first sign-in's `login_hint`, the account switch and the ways out of it, Drive left out, a stray callback link, a preview origin, the CSRF gate |
| `gdrive/specs/gdrive-fallback.spec.ts` | The token client after a 200 HTML, a 429, a 1027 page or the SPA; no relay call until sign-out; Reconnect Google; no renewal while typing in the editor |
| `gdrive/specs/gdrive-files.spec.ts` | The list's four extensions, groups and search; opening each; Drive's open and create states, and the ERD Editor folder a create state without a folder uses and a refused one falls back to; rename, disabled for a file Drive lets the account view only or not rename; New file and import, each into one ERD Editor folder the next file reuses, a reloaded page too by its marker after a rename and a move, and the list leaves out; the account, Sign out and the policy links; the empty viewer's Editing Guide and GitHub, with no files and with some; v2 saved as v3 only once edited; files never saved |
| `gdrive/specs/gdrive-save.spec.ts` | The debounced save with its icon turning while saving (slower under reduced motion) and green once saved, a zoom saving nothing, the conflict banner, a save Drive kept refusing and Try again, edit access lost with the edits downloaded, tabs and their leader, the next leader after one gone past its PATCH and Check Drive, `beforeunload` right after an edit, a frame |

## Reading a failure

`workers: 1` and `fullyParallel: false`: every spec drives several contexts at
once, and a handover reads better when nothing else is racing the relay. Traces
land in `e2e/.results` on a retry (run 2's in `e2e/.results/gdrive`);
`pnpm --filter @dineug/erd-editor-app e2e:report` opens run 1's HTML report, and
run 2 writes its own to `e2e/.report/gdrive` on CI.

The usual suspect for a flake here is timing around a handover — the host has no
outbound buffer, so an edit made in the second or two before the successor tab has
rejoined the room is dropped. The guest buffers (its shared store holds actions
while disconnected and flushes on reconnect), but only once it has seen the host
go: an edit it makes in the moment after the leader tab closes is sent to that tab
and lost, unless the dying tab still relays it, as it usually does. So
`leadership.spec.ts` drives the handover from the guest side and has the guest edit
only after the successor's own participants list shows a nickname typed after the
leader closed, the check `participants.spec.ts` uses for a handover.
