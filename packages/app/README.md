# app

> The React PWA at [erd-editor.io](https://erd-editor.io)

`@dineug/erd-editor-app` is the site: a React shell around the `<erd-editor>` custom element and,
at `/embed`, the read-only `<erd-viewer>`. It depends on `"@dineug/erd-editor": "workspace:*"` for
both elements and the headless replica (`engine.js`). It is private and never published to npm,
and no package imports it. Cloudflare Pages builds it, with the root
[`functions/`](../../functions) as its Pages Functions, and serves it as erd-editor.io, which
deploys only when the owner starts it, never on a push.

## Usage

The package has no `src/index.ts`; its entry and output:

- `index.html` — the HTML entry: the pre-paint theme script and `<noscript>` policy links.
- `src/main.tsx` — the boot: it renders the route table in a browser router and, in production,
  starts Sentry and registers the service worker.
- `src/routes/routes.tsx` — the route table: `/` (the schema list and the editor), `/live` (a
  collaboration guest), `/gdrive` (the Google Drive editor) and `/embed` (the document its `?src=`
  names, in a viewer filling the page another site frames, or without one the builder of that URL
  and its iframe), the last three loaded lazily; any other path redirects to `/`.
- `src/sw.ts` — the Workbox service worker, which precaches the build.
- `public/privacy.html`, `terms.html`, `support.html` — static pages served at `/privacy`,
  `/terms` and `/support`, outside the React app.
- `src/server/auth/` — the app's one server part: `/gdrive`'s Google OAuth token relay behind
  `/api/auth/*`, which never sees a file. The root `functions/api/auth/[[route]].ts` re-exports its
  `pages.ts` as the Pages Function, and `vite.config.ts` serves the same handlers under `vp dev`.
- `dist/` — what the `build` task writes and Pages serves.

### Storage and sync

On `/`, the Dexie service in `src/services/indexeddb/` stores schemas in IndexedDB from a
SharedWorker where the browser has one, else a dedicated Worker (both over Comlink), else the
page; tabs stay in sync over a BroadcastChannel (`src/utils/broadcastChannel.ts`), and the service
worker serves the app offline. Collaboration (`src/services/collaborative/`) runs over WebRTC from
one tab per browser, elected over `navigator.locks`, with no server holding the schema: a nostr or
mqtt relay carries signaling only, the schema, its edits and the participant list are encrypted
with AES-GCM, and the key reaches a guest only in the share link's URL fragment, which browsers
leave out of every request. The
[root README](../../README.md#real-time-collaboration) draws the architecture.

`/gdrive` keeps no IndexedDB: its client in `src/services/gdrive/` reads and saves the Drive file,
one tab per file saving under a Web Lock, and gets its access tokens from the relay, or from
Google's token client while the relay is unavailable.

## Features

What erd-editor.io adds around the editor, and the editor options it turns on; the editor's own
features are in the [root README](../../README.md#features):

- **Installable PWA** — works offline, and asks before loading a new version.
- **Local-first** — every schema autosaves to the browser, and open tabs stay in sync.
- **Schema list** — ordered by last edit, grouped by date (Today, Yesterday, Previous 7 Days,
  …), with search by name. The open schema is in the URL as `/?schema=<id>`.
- **Trash** — keeps deleted schemas to restore for 30 days, or until you delete one permanently
  or empty the trash.
- **Import and backup** — import `.erd`, `.vuerd`, `.json`, SQL, DBML, AML and GraphQL files from
  the menu or by dropping them anywhere. Each of the last four lands laid out by its relationships
  (on a grid with fewer than two tables, no relationship, or a layout that cannot run), in the
  Google Drive editor's import too. A backup exports every schema outside the trash, and
  importing one adds its schemas as new copies.
- **Start screen** — with no schema open, offers New schema, Import files and Open sample (a
  bookstore schema).
- **Real-time collaboration** — start a session from a schema in the sidebar and share its
  link; guests join peer-to-peer, end-to-end encrypted, and a list shows each
  participant's nickname.
- **Theme** — system (the default, following your operating system), light or dark.
- **Display language** — the app's own screens and the editor in the same 25 languages, picked
  from the language button under the sidebar or from the editor's toolbar or command palette, and
  shared by every tab; until you pick one they follow your browser's language, or English when the
  editor lacks it. Arabic, Hebrew and Persian lay the app out right to left. The privacy policy,
  terms and support pages stay in English.
- **Welcome screen** — on an empty diagram, with its first steps: a new table or memo, import,
  the command palette and the shortcuts.
- **Google Drive editor** — `/gdrive`, listed on the
  [Google Workspace Marketplace](https://workspace.google.com/marketplace/app/erd_editor/428467403360):
  it opens diagrams from Drive's Open with and New menus, or from its own searchable list of the
  diagrams it created or opened, and saves back to the same file. Files it creates or imports go
  in an ERD Editor folder, unless you chose New inside another Drive folder.

## Development

From the repository root:

```sh
pnpm exec vp run --filter ./packages/app --fail-if-no-match test
pnpm --filter ./packages/app --fail-if-no-match test:coverage
pnpm --filter ./packages/app --fail-if-no-match test:dev
pnpm exec vp run --filter ./packages/app --fail-if-no-match build
pnpm --filter ./packages/app --fail-if-no-match dev
pnpm --filter ./packages/app --fail-if-no-match typecheck
pnpm --filter ./packages/app --fail-if-no-match e2e:typecheck
pnpm --filter ./packages/app --fail-if-no-match e2e
```

The `test` and `build` tasks build workspace dependencies, then run `tsc --noEmit` and Vitest or
`vp build`; `dev` builds `@dineug/erd-editor` and serves on :5173. `test:coverage`, `test:dev`,
`typecheck`, `e2e:dev` and `e2e:headed` build nothing and read `@dineug/erd-editor`'s `dist/`, so
build it first with `pnpm exec vp run --filter ./packages/erd-editor --fail-if-no-match build`.

`e2e` builds `@dineug/erd-editor` too, then runs `playwright.config.ts` and, for `/gdrive`,
`e2e/gdrive/playwright.config.ts`; [e2e/README.md](./e2e/README.md) describes both runs, each spec
and the other `e2e:*` scripts. After an icon change, `google-workspace:assets` renders the PNGs in
`google-workspace/` from `public/erd-editor_icon.svg`, and `google-workspace:check` checks their
pixel dimensions against `assets.json`.

To sign in with Google on `/gdrive` locally, use an OAuth web client in a Google Cloud project
whose consent screen is in Testing, with `http://localhost:5175` as origin and
`http://localhost:5175/api/auth/callback` as redirect URI. Put its `VITE_GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET`, and a `COOKIE_KEY` of 32 random bytes in base64
(`openssl rand -base64 32`), in the environment or `packages/app/.env.local`. Then, with
`@dineug/erd-editor` built, serve on that port with
`pnpm --filter ./packages/app --fail-if-no-match exec vp dev --port 5175 --strictPort`.
Without a client id, `/gdrive` says Google Drive integration is not configured.

The rules for changing the package, and the checks a change runs, are in [AGENTS.md](./AGENTS.md).
