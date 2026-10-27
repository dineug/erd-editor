# app e2e

Playwright specs for what a unit test cannot reach: for live collaboration, two
real browser contexts, a real `RTCPeerConnection` and a real `navigator.locks`
handover between tabs; for the schema list, the real editor, IndexedDB behind its
worker, the URL, file choosers, downloads, the pre-paint theme script and the
browser's language; for the policy pages, `/privacy`, `/terms` and `/support` as
static files with JavaScript off; for `/embed`, the real viewer fetching a
document from another origin under the browser's CORS rules, at the top level
and in another site's frame; for `/gdrive`, the real auth relay under
`vp dev`, a popup, cookies, tabs sharing a file and its lock, and the editor
saving to a Drive in memory.

```bash
pnpm --filter @dineug/erd-editor-app e2e            # builds erd-editor, then both runs, headless
pnpm --filter @dineug/erd-editor-app e2e:dev        # Playwright UI, run 1
pnpm --filter @dineug/erd-editor-app e2e:headed     # headed Chromium, run 1
pnpm --filter @dineug/erd-editor-app e2e:typecheck  # the only type check of e2e/ and playwright.config.ts
pnpm --filter @dineug/erd-editor-app exec playwright test e2e/specs/theme.spec.ts   # one spec of run 1
pnpm --filter @dineug/erd-editor-app exec playwright test --config e2e/gdrive/playwright.config.ts   # run 2 alone
```

## Two runs

`e2e` builds `@dineug/erd-editor` first, since both dev servers load its `dist/`,
and runs neither suite if that build fails. It then runs Playwright twice, one
after the other, and exits non-zero if either failed; the second runs even when
the first fails, so a broken local spec never hides the Drive results. `e2e:dev`,
`e2e:headed` and the `exec playwright test` lines build nothing: on a fresh clone,
or after a change to the editor, run
`pnpm exec vp run --filter @dineug/erd-editor --fail-if-no-match build` before
them, or they fail to load the editor or test a stale one.

| Run | Config                            | Servers                                                      | Specs                        |
| --- | --------------------------------- | ------------------------------------------------------------ | ---------------------------- |
| 1   | `playwright.config.ts`            | nostr relay :5176, `vp dev` :5175 without a Google client id | `e2e/specs/*.spec.ts`        |
| 2   | `e2e/gdrive/playwright.config.ts` | fake Google token server :5178, `vp dev` :5177 with a client | `e2e/gdrive/specs/*.spec.ts` |

The table's paths are from `packages/app`, like every path here that starts with `e2e/`, `src/`,
`public/` or `google-workspace/`; a `support/…` or `gdrive/…` path is under `e2e/`. Move a run
off a taken port with `E2E_PORT` and `E2E_RELAY_PORT` (run 1) or `E2E_GDRIVE_PORT` and
`E2E_GDRIVE_OAUTH_PORT` (run 2); the specs read their URLs from these. By
default erd-editor's bench takes 5175 and r-html's e2e takes 5176.

Only one dev server is ever up, so the two never race over `node_modules/.vite`.
Vite prefers the environment to `packages/app/.env.local`, where a real client may
live, so each run sets what its dev server must not take from that file: run 1 only an
empty `VITE_GOOGLE_CLIENT_ID` (beside `ERD_EDITOR_NOSTR_RELAY_URLS`), which leaves
`/gdrive` and the auth relay unconfigured whatever else that file holds; run 2 the
client, `GOOGLE_CLIENT_SECRET`, `COOKIE_KEY` and `ERD_EDITOR_E2E_GOOGLE_OAUTH_URL`, in
`support/gdrive/server.ts`. Neither dev server nor the token server is ever
reused (`reuseExistingServer: false`): a server started by hand on one of their
ports makes the run fail at once, with Playwright's
`… is already used … or set reuseExistingServer:true` (do not take that hint),
rather than test the wrong one. `--strictPort` matters only when the port is held
by something Playwright's probe does not take for a server (no HTTP answer, or a
404 and above): `vp dev` then fails instead of moving to the next port. Run 1's
relay is the exception outside CI (`reuseExistingServer: !process.env.CI`):
whatever answers `:5176/health`, r-html's e2e dev server included, is taken for
the relay, so run the two suites apart or set `E2E_RELAY_PORT`.

## What makes it deterministic

**A local relay.** `support/relay.mjs` is a small in-memory nostr relay —
enough of NIP-01 for trystero to complete a WebRTC handshake — whose HTTP side
also answers `/health` and the `/embed` specs' two paths (Documents on another
origin for `/embed`, below). `playwright.config.ts` starts it alongside the Vite
dev server (`vp dev`) and points the app at it with
`ERD_EDITOR_NOSTR_RELAY_URLS`, so with that variable unset in your shell no test
touches a public relay. A value already exported there is used instead:
`ERD_EDITOR_NOSTR_RELAY_URLS=''` runs the suite against the public relay pool
and the mqtt fallback, a slow, network-dependent smoke test. Pointing the
variable at a relay also drops the mqtt fallback (see
`src/services/collaborative/room.ts`), which keeps the relay list to one.

Run it with `E2E_RELAY_DEBUG=1` to log every `REQ`/`EVENT` it handles. Outside CI
a relay already answering `:5176/health` is reused (Two runs, above), so the
variable reaches only a relay this run starts, or one you start yourself from
`packages/app` with `E2E_RELAY_DEBUG=1 node e2e/support/relay.mjs`.

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
Production code is untouched. Konva draws the diagram as pixels on its own `<canvas>`
layers, so the specs read tables from `editor.value` or the stored document and cursor
labels from the Konva stages, never through a locator. With the root open, a window listener's
`event.composedPath()` also lists the nodes a closed root hides, so what relies
on the closed root (`tokenManager.ts` taking the `<erd-editor>` host for a field
inside it) is held by `tokenManager.test.ts`, not here.

**A fake Google for run 2.** `support/gdrive/fakeGoogleOAuth.mjs` is Google's
token and revoke endpoints, which the auth relay under `vp dev`
(`gdriveDevServer`, pointed here by `ERD_EDITOR_E2E_GOOGLE_OAUTH_URL`) calls:
codes bound to the client, `redirect_uri` and PKCE challenge, refresh tokens live
until revoked, `/__control/*` for the specs. It is one process for the whole run,
so its codes, refresh tokens, counters and token lifetime outlive a test until
`resetOAuthServer()` (`/__control/reset`), which `gdrive-auth`, `gdrive-files`
and `gdrive-save` call in `beforeEach` before `installFakeGoogle(context)`.
`support/gdrive/fakeGoogle.ts` routes the rest in the browser context: the authorize
page (it registers a code with the token server and sends the popup to the real callback,
or denies, closes, or leaves Drive out), the GIS script, userinfo, and a Drive in memory
that answers only the `fields` asked for (a field outside `FILE_SCHEMA` / `LIST_SCHEMA`
gets a 400 `invalidParameter`, so a field `driveClient.ts` starts asking for fails run 2
until the fake knows it), pages by two, shows each account only the files it may see,
each owned by one of them (`owner`, which `ownedByMe` answers), refuses an upload
without its `uploadType` and a metadata PATCH that is not JSON,
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
with its tab, and can hold content PATCHes (`holdPatches()` / `releasePatches()`),
apply one and lose its answer (`dropNextPatchResponse()`), or fail the next
requests of a method (`failNext()`); a rename's PATCH is never held. Any other
Google host aborts. The browser follows a redirect past every route, so the auth
relay's `start` is routed too: its real answer, cookie included, comes back as a page that
navigates to the authorize URL, marked so the popup does not take it for a stray
page. `support/gdrive/fakeAuth.ts` makes `/api/auth/*` fail its JSON contract
for the fallback spec. The clickjacking check frames `/gdrive` from the token
server's own `/__framer`: Chrome blocks a routed origin from framing localhost.
Neither dev server reads `public/_headers`, so the check covers the app's own
refusal (`isFramed`) alone; `src/pagesHeaders.test.ts` holds the file's two
`/gdrive` rules in the unit tests.

**Documents on another origin for `/embed`.** `support/embed.ts` routes
`https://docs.e2e.test` in the browser context, every frame included, and names
each answer's `Access-Control-Allow-Origin`, `*` or another origin: Playwright
adds that header, from the request's `Origin`, to a routed cross-origin answer
that lacks one, so the answer with none comes from the relay's own HTTP side,
`/__docs/no-cors.erd.json`, a real server on another port. Another site's frame is
the relay's `/__framer?src=…`, which frames the URL it is given as it stands:
Chrome lets no routed origin frame localhost. The specs build both from
`E2E_RELAY_PORT`, so a run moved off :5176 stays right. A GitHub page's address is
fetched from GitHub's raw host, which the spec routes, while `github.com` is
refused, so nothing leaves the machine. A relay started by hand before these
paths existed is reused outside CI (Two runs, above) and answers them 404, so
start it again.

**Static policy pages.** Pages answers `/privacy`, `/terms` and `/support` with
their files in `public/`; `vp dev` would answer them with the app, so
`policyPages` in `vite.config.ts` rewrites the three paths, and `policy.spec.ts` reads them with
JavaScript off, as Google's reviewers may, along with the links `/` keeps for
that case in `index.html`.

## Marketplace assets

`gdrive/assets.config.ts`, whose one spec is `gdrive/assets/marketplace-assets.spec.ts`, is not
a third run and starts no server.
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
| `schema-url.spec.ts`    | `?schema=` follows the selection, survives a reload, back and forward; the tab title (`<name> · ERD Editor`) on a selection, a reload and back; an id naming no schema, or one in the trash, cleared, the title back to `ERD Editor` |
| `import-export.spec.ts` | Sources stored parsed as new documents, an SQL one with its tables placed by their relationships, kept on reload, opened without a bump; Import files and a drop while an import runs, until it ends; a backup round trip |
| `theme.spec.ts`         | System by default, following a light and a dark system; a Dark pick kept over it; a stored Light painted before the app script on a dark system |
| `locale.spec.ts`        | The app and the editor in a German browser's language while nothing is picked, storing nothing; an editor pick stored as JSON, kept on reload and followed by the other tabs' app and editor; System stored as `"system"`, back to the browser's language; the sidebar's language menu switching the app and the editor, Arabic right to left on `<html>` and the editor, then System; the welcome screen on a new schema until its first table |
| `gdrive-not-configured.spec.ts` | `/gdrive` without a client id; `/` loads no Drive module or GIS script         |
| `policy.spec.ts`        | `/privacy`, `/terms` and `/support` with JavaScript off: 200, no script, the points each must make, no email address but `support@erd-editor.io` and no governing law, GitHub Issues, no link to the site but each other, no request to another origin, both themes; `/`'s `<noscript>` links; the sidebar's links in a new tab, none to `/gdrive`; the empty viewer's Editing Guide and GitHub, with `rel="noopener"`, checked on `/gdrive` too by the same `support/resourceLinks.ts` |
| `embed.spec.ts`         | `/embed?src=`: the viewer filling the viewport alone, no app chrome, the title `ERD Editor`, no framing header from `vp dev`; the erd-editor.io link in the lower right corner, in a new tab with no referrer, clear of the controls; the document drawn in another site's 480 px frame; neither the stored language, no Korean dictionary asked for, nor the stored theme, and no `lang` on `<html>`; a version 3 and a version 2 document; the viewer's own error alone for a 404, an answer that is no JSON, one with no CORS header, which the relay is first checked to send, and one allowing another origin; the theme, name view, minimap, controls and language the URL names; a GitHub file page fetched from the raw host, never from `github.com` |
| `gdrive/specs/gdrive-auth.spec.ts` | The relay popup, the refresh cookie, one renewal between two tabs, sign-out, the state through sign-in, its `userId` as the first sign-in's `login_hint`, the account switch and the ways out of it, Drive left out, a stray callback link, a preview origin, the CSRF gate |
| `gdrive/specs/gdrive-fallback.spec.ts` | The token client after a 200 HTML, a 429, a 1027 page or the SPA; no relay call until sign-out; Reconnect Google; no renewal while typing in the editor |
| `gdrive/specs/gdrive-files.spec.ts` | The list's four extensions, groups and search; opening each; Drive's open and create states, and the ERD Editor folder a create state without a folder uses and a refused one falls back to; rename, disabled for a file Drive lets the account view only or not rename; New file and import, each into one ERD Editor folder the next file reuses, a reloaded page too by its marker after a rename and a move, and the list leaves out; another account's ERD Editor folder shared with this one passed over for one of its own; a backup among the imported files skipped, since backups stay in the local app; an SQL import with its tables placed by their relationships; both Import files while an import runs, until it ends; the account, Sign out and the policy links; the empty viewer's Editing Guide and GitHub, with no files and with some; v2 saved as v3 only once edited; a file that is not an ERD Editor document (no editor) and a view-only one (View only, a read-only editor, no banner), neither ever saved |
| `gdrive/specs/gdrive-save.spec.ts` | The debounced save with its icon turning while saving (slower under reduced motion) and green once saved, a zoom saving nothing, the conflict banner, a save Drive kept refusing and Try again, edit access lost with the edits downloaded, tabs and their leader, the next leader after one gone past its PATCH and Check Drive, `beforeunload` right after an edit, a frame |

## Reading a failure

`workers: 1` and `fullyParallel: false`: the collaboration, leadership and participants specs drive
several contexts at once, and a handover reads better when nothing else is racing the relay. Traces
land in `e2e/.results` on a retry (run 2's in `e2e/.results/gdrive`), which only
CI makes (`retries: 2` there, 0 locally); add `--trace on` to an
`exec playwright test` line for one locally. Both runs write an HTML report on CI
only (the local reporter is `list`): run 1's to `e2e/.report`, which
`pnpm --filter @dineug/erd-editor-app e2e:report` opens, and run 2's to
`e2e/.report/gdrive`, which
`pnpm --filter @dineug/erd-editor-app exec playwright show-report e2e/.report/gdrive`
opens. CI's `app-e2e` job uploads both as `app-playwright-report` when it fails.

The usual suspect for a flake here is timing around a handover — the host has no
outbound buffer, so an edit made in the second or two before the successor tab has
rejoined the room is dropped. The guest buffers (its shared store holds actions
while disconnected and flushes on reconnect), but only once it has seen the host
go: an edit it makes in the moment after the leader tab closes is sent to that tab
and lost, unless the dying tab still relays it, as it usually does. So
`leadership.spec.ts` drives the handover from the guest side and has the guest edit
only after the successor's own participants list shows a nickname typed after the
leader closed, the check `participants.spec.ts` uses for a handover.
