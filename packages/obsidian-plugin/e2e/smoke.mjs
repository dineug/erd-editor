// Opens a throwaway vault in a real Obsidian with the built plugin, edits
// diagrams with the keyboard and through the real MCP server, and checks what
// reaches the files. The app runs on its own user data directory.
import { execFileSync, spawn } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { chromium } from '@playwright/test';

import { startMcp } from './mcp.mjs';

const WIN = process.platform === 'win32';
const OBSIDIAN =
  process.env.OBSIDIAN_BIN ??
  (WIN
    ? join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Obsidian', 'Obsidian.exe')
    : '/Applications/Obsidian.app/Contents/MacOS/Obsidian');
// An app bundle, obsidian-<version>.asar from Obsidian's own user data folder.
// A copy in the run's user data loads over the bundled app, as an update does.
const ASAR = process.env.OBSIDIAN_ASAR;
const PORT = Number(process.env.SMOKE_PORT ?? 9333);
const KEEP = process.env.SMOKE_KEEP === '1';
// The replica answers 200 ms after the last change; this leaves it room.
const REPLICA_SETTLE_MS = 600;
// Obsidian writes a file 2 s after the last requestSave.
const AUTOSAVE_MS = 2_000;
const WORK_PREFIX = 'erd-obsidian-smoke-';

const root = resolve(import.meta.dirname, '..');
const MCP_BIN = resolve(root, '..', 'mcp-server', 'dist', 'erd-editor-mcp.js');
const LOCK_DIR = join(homedir(), '.erd-editor', 'ide');
// The palette the editor builds its theme from, which the applied theme is checked against.
const palette = createRequire(join(root, '..', 'erd-editor', 'package.json'))(
  '@radix-ui/colors'
);
const CLOSED_NOTE = /was closed after this agent's last edit/;
const RESEED_NOTE = /joined again from the editor/;

/** Work directories earlier runs left, all but one a kept Obsidian still runs on. */
function removeEarlierRuns() {
  // Windows has no ps; CIM lists the command lines there.
  const commands = WIN
    ? execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          'Get-CimInstance Win32_Process | ForEach-Object { $_.CommandLine }',
        ],
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
      )
    : execFileSync('ps', ['-Aww', '-o', 'args='], { encoding: 'utf8' });
  for (const name of readdirSync(tmpdir())) {
    const dir = join(tmpdir(), name);
    if (!name.startsWith(WORK_PREFIX)) continue;
    if (commands.includes(`--user-data-dir=${join(dir, 'user-data')}`)) continue;
    rmSync(dir, { recursive: true, force: true, maxRetries: 40, retryDelay: 250 });
  }
}

removeEarlierRuns();
const work = mkdtempSync(join(tmpdir(), WORK_PREFIX));
const out = process.env.SMOKE_OUT ?? work;
const vault = join(work, 'vault');
const userData = join(work, 'user-data');
const pluginDir = join(vault, '.obsidian', 'plugins', 'erd-editor');

mkdirSync(pluginDir, { recursive: true });
mkdirSync(userData, { recursive: true });
mkdirSync(out, { recursive: true });
for (const name of ['main.js', 'manifest.json', 'styles.css']) {
  cpSync(join(root, 'dist', name), join(pluginDir, name));
}
const manifest = JSON.parse(
  readFileSync(join(pluginDir, 'manifest.json'), 'utf8')
);
writeFileSync(
  join(vault, '.obsidian', 'community-plugins.json'),
  JSON.stringify(['erd-editor'])
);
writeFileSync(join(vault, 'schema.erd'), '');
// A two-table v2 document, the format .vuerd files were saved in.
const fixture = join(import.meta.dirname, 'fixtures', 'legacy.vuerd.json');
for (const name of ['legacy.vuerd', 'legacy.vuerd.json']) {
  cpSync(fixture, join(vault, name));
}
const BROKEN = '{"doc": <<<<<<< HEAD';
writeFileSync(join(vault, 'broken.erd'), BROKEN);
writeFileSync(join(vault, 'untitled.erd'), '');
// What the tab seed, the slow close, the outside conflict, the theme, the
// welcome screen, the coding agent and the keys work on; notes.md is no diagram.
for (const name of [
  'deferred.erd',
  'slow-close.erd',
  'conflict.erd',
  'theme-a.erd',
  'theme-b.erd',
  'welcome.erd',
  'agent.erd',
  'closed.erd',
  'background.erd',
  'keys.erd',
]) {
  writeFileSync(join(vault, name), '');
}
writeFileSync(join(vault, 'notes.md'), '# notes');
// No locks and no origin, as releases before both wrote it, so it opens locked:
// the bytes are not the replica's, and a zoom or a scroll must not rewrite them.
const VIEW_ONLY = JSON.stringify({
  version: '3.0.0',
  settings: { ignoreSaveSettings: 3, zoomLevel: 1 },
  doc: { tableIds: [], relationshipIds: [], indexIds: [], memoIds: [] },
  collections: {},
});
writeFileSync(join(vault, 'view-only.erd'), VIEW_ONLY);
writeFileSync(
  join(userData, 'obsidian.json'),
  JSON.stringify({
    vaults: { a1b2c3d4e5f60718: { path: vault, ts: Date.now(), open: true } },
  })
);
if (ASAR) cpSync(ASAR, join(userData, basename(ASAR)));
const realVault = realpathSync.native(vault);
const real = path => join(realVault, path);

const app = spawn(
  OBSIDIAN,
  [`--user-data-dir=${userData}`, `--remote-debugging-port=${PORT}`],
  { stdio: 'ignore' }
);
const exited = new Promise(resolve => app.once('exit', resolve));

const errors = [];
let failed = false;
let passed = 0;
// Named in each page error, which the run only reports at its end.
let lastStep = 'start';
let browser = null;
let mcp = null;
let rendererPid = null;

function step(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
  lastStep = name;
  if (ok) passed++;
  else failed = true;
}

async function waitFor(check, timeout, interval = 250) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await check().catch(() => null);
    if (value) return value;
    await sleep(interval);
  }
  return null;
}

const alive = () => app.exitCode === null && app.signalCode === null;

/** Tables in a saved document, v3 or the v2 a .vuerd file holds until its first save. */
function tableCount(path) {
  const text = readFileSync(join(vault, path), 'utf8');
  if (!text) return 0;
  const json = JSON.parse(text);
  return json.doc ? json.doc.tableIds.length : json.table.tables.length;
}

/** The table ids of a v3 document on disk. */
function fileIds(path) {
  const text = readFileSync(join(vault, path), 'utf8');
  return text ? JSON.parse(text).doc.tableIds : [];
}

const lockPath = pid => join(LOCK_DIR, `${pid}.json`);

function readLock(pid) {
  try {
    return JSON.parse(readFileSync(lockPath(pid), 'utf8'));
  } catch {
    return null;
  }
}

const PIPE_ROOT = '\\\\.\\pipe\\';

/**
 * Whether a hub listens at path. On Windows a name the pipe root lists: a stat
 * of a live pipe connects to it, as a peer would.
 */
function isSocket(path) {
  try {
    return WIN
      ? path.startsWith(PIPE_ROOT) &&
          readdirSync(PIPE_ROOT).includes(path.slice(PIPE_ROOT.length))
      : statSync(path).isSocket();
  } catch {
    return false;
  }
}

const pipeGone = path => (WIN ? !isSocket(path) : !existsSync(path));
const expectedPipe = pid =>
  WIN ? `${PIPE_ROOT}erd-editor-ide-${pid}` : join(LOCK_DIR, `${pid}.sock`);

const mode = path => (statSync(path).mode & 0o777).toString(8);
const sameSet = (a, b) =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

/** Attaches Playwright to this run's own window, which the vault folder tells apart. */
async function connect() {
  const port = await waitFor(async () => {
    const text = readFileSync(join(userData, 'DevToolsActivePort'), 'utf8');
    return Number(text.split('\n')[0]) || null;
  }, 20_000);
  if (port !== PORT) {
    throw new Error(`Obsidian opened its debugging port on ${port}, not ${PORT}`);
  }
  const cdp = await waitFor(
    () => fetch(`http://127.0.0.1:${PORT}/json/version`).then(r => r.ok),
    20_000
  );
  if (!cdp) throw new Error('Obsidian did not open its debugging port');

  browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  const page = await waitFor(async () => {
    const pages = browser.contexts().flatMap(context => context.pages());
    return pages.find(p => p.url().startsWith('app://obsidian.md/index.html'));
  }, 20_000);
  if (!page) throw new Error('the vault window never opened');

  page.on('pageerror', error =>
    errors.push(`pageerror: ${error.message} (after: ${lastStep})`)
  );
  page.on('console', message => {
    if (message.type() === 'error') {
      errors.push(`console: ${message.text()} (after: ${lastStep})`);
    }
  });
  const ready = await waitFor(
    () => page.evaluate(() => window.app?.workspace?.layoutReady === true),
    20_000
  );
  if (!ready) throw new Error('the vault window never finished its layout');
  const base = await page.evaluate(() =>
    window.app.vault.adapter.getBasePath()
  );
  if (realpathSync.native(base) !== realVault) {
    throw new Error(`port ${PORT} serves another vault (${base})`);
  }
  return page;
}

async function detach() {
  await browser?.close().catch(() => undefined);
  browser = null;
}

/** Runs an expression in the vault window with Playwright detached, which would answer its beforeunload. */
async function rawEval(expression) {
  const targets = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r =>
    r.json()
  );
  const target = targets.find(
    t => t.type === 'page' && t.url.startsWith('app://obsidian.md/index.html')
  );
  if (!target) throw new Error('no vault window to evaluate in');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  const reply = new Promise(resolve => {
    socket.onmessage = event => resolve(JSON.parse(event.data));
    socket.onclose = () => resolve(null);
  });
  socket.send(
    JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression, returnByValue: true },
    })
  );
  const result = await Promise.race([reply, sleep(3_000)]);
  socket.close();
  return result?.result?.result?.value;
}

const vaultWindowGone = () =>
  fetch(`http://127.0.0.1:${PORT}/json/list`)
    .then(response => response.json())
    .then(
      targets =>
        !targets.some(({ url }) => url.startsWith('app://obsidian.md/index.html'))
    )
    // On Windows the quit ends the process, and its debugging port with it.
    .catch(error => {
      if (!alive()) return true;
      throw error;
    });

/** Opens a file the way a link click does and waits for the diagram view. */
async function openDiagram(page, path) {
  // An unknown link target would be created as a new note instead.
  await waitFor(
    () =>
      page.evaluate(
        path => Boolean(window.app.vault.getAbstractFileByPath(path)),
        path
      ),
    5_000
  );
  await page.evaluate(
    path => window.app.workspace.openLinkText(path, '', true),
    path
  );
  return waitFor(
    () =>
      page.evaluate(path => {
        const view = window.app.workspace.getMostRecentLeaf()?.view;
        const editor = view?.contentEl.querySelector('erd-editor');
        return view?.getViewType() === 'erd-editor' &&
          view.file?.path === path &&
          editor?.isConnected
          ? {
              title: view.getDisplayText(),
              tables: JSON.parse(editor.value).doc.tableIds.length,
            }
          : null;
      }, path),
    10_000
  );
}

/** Closes every tab showing the file, the way closing a tab does. */
async function closeDiagram(page, path) {
  await page.evaluate(
    path =>
      window.app.workspace
        .getLeavesOfType('erd-editor')
        .filter(leaf => leaf.view.file?.path === path)
        .forEach(leaf => leaf.detach()),
    path
  );
}

/** The table ids each ERD tab of the file shows. */
const tabIds = (page, path) =>
  page.evaluate(
    path =>
      window.app.workspace
        .getLeavesOfType('erd-editor')
        .filter(leaf => leaf.view.file?.path === path)
        .map(leaf => {
          const editor = leaf.view.contentEl.querySelector('erd-editor');
          try {
            return JSON.parse(editor.value).doc.tableIds;
          } catch {
            return null;
          }
        }),
    path
  );

/** Waits until every tab of the file shows the table, at least one tab there. */
const shownInTabs = (page, path, id, timeout = 3_000) =>
  waitFor(
    async () => {
      const tabs = await tabIds(page, path);
      return tabs.length > 0 && tabs.every(ids => ids?.includes(id));
    },
    timeout,
    50
  );

async function pressAddTable(page) {
  await page.evaluate(() =>
    window.app.workspace
      .getMostRecentLeaf()
      ?.view.contentEl.querySelector('erd-editor')
      ?.focus()
  );
  await page.keyboard.press('Alt+KeyN');
}

/** Makes the first tab of the file the active one and focuses its editor, as a click does. */
async function focusDiagram(page, path) {
  await page.evaluate(path => {
    const { workspace } = window.app;
    const leaf = workspace
      .getLeavesOfType('erd-editor')
      .find(leaf => leaf.view.file?.path === path);
    workspace.setActiveLeaf(leaf, { focus: true });
    leaf.view.contentEl.querySelector('erd-editor').focus();
  }, path);
  await sleep(150);
}

/** Alt+N in the first tab of the file, focused the way a click focuses it. */
async function pressAddTableIn(page, path) {
  await focusDiagram(page, path);
  await page.keyboard.press('Alt+KeyN');
}

/** The first gray and the ninth accent step of a theme, from the palette the editor builds it from. */
function paletteOf({ appearance, grayColor, accentColor }) {
  const mode = appearance === 'dark' ? 'Dark' : '';
  return {
    gray1: palette[`${grayColor}${mode}`][`${grayColor}1`],
    accent9: palette[`${accentColor}${mode}`][`${accentColor}9`],
  };
}

/** The theme each ERD tab of the files shows, read off the custom properties its element publishes. */
const shownThemes = (page, paths) =>
  page.evaluate(
    paths =>
      window.app.workspace
        .getLeavesOfType('erd-editor')
        .filter(leaf => paths.includes(leaf.view.file?.path))
        .map(leaf => {
          const style = getComputedStyle(
            leaf.view.contentEl.querySelector('erd-editor')
          );
          return {
            gray1: style.getPropertyValue('--gray-color-1').trim(),
            accent9: style.getPropertyValue('--accent-color-9').trim(),
          };
        }),
    paths
  );

/** Waits until a tab of every file shows the theme, and every tab of them does. */
async function themedAs(page, paths, theme, timeout = 3_000) {
  const expected = paletteOf(theme);
  let shown = [];
  const ok = await waitFor(
    async () => {
      shown = await shownThemes(page, paths);
      return (
        shown.length >= paths.length &&
        shown.every(
          ({ gray1, accent9 }) =>
            gray1 === expected.gray1 && accent9 === expected.accent9
        )
      );
    },
    timeout,
    50
  );
  return { ok: Boolean(ok), shown: shown[0] };
}

/**
 * The languages the run may give Obsidian, each with the one the editor shows
 * for it; the plugin reads Obsidian's pt as European Portuguese, where the
 * editor alone would read a bare pt as Brazilian.
 */
const OBSIDIAN_LANGUAGES = { pt: 'pt-PT', ja: 'ja-JP' };

/** The lang each file's first tab carries on its editor's root, one file after the other. */
async function shownLangs(page, paths) {
  const langs = [];
  for (const path of paths) {
    langs.push(
      await inEditor(
        page,
        path,
        root => root.querySelector('[lang]')?.getAttribute('lang') ?? null
      )
    );
  }
  return langs;
}

/** Waits until the editor of every file shows the language. */
async function langsAs(page, paths, lang, timeout = 3_000) {
  let shown = [];
  const ok = await waitFor(
    async () => {
      shown = await shownLangs(page, paths);
      return shown.every(shownLang => shownLang === lang);
    },
    timeout,
    100
  );
  return { ok: Boolean(ok), shown };
}

const obsidianDark = page =>
  page.evaluate(() => document.body.classList.contains('theme-dark'));

/**
 * Switches Obsidian's own theme and waits until its config file holds it.
 * Obsidian 1.13 saves that file a moment later, and a second switch inside
 * that moment can be undone when the first write is read back.
 */
async function changeObsidianTheme(page, dark) {
  const theme = dark ? 'obsidian' : 'moonstone';
  await page.evaluate(theme => window.app.changeTheme(theme), theme);
  const written = await waitFor(
    async () =>
      JSON.parse(
        readFileSync(join(vault, '.obsidian', 'appearance.json'), 'utf8')
      ).theme === theme,
    5_000,
    50
  );
  await sleep(500);
  return Boolean(written) && (await obsidianDark(page)) === dark;
}

function pluginData() {
  try {
    return JSON.parse(readFileSync(join(pluginDir, 'data.json'), 'utf8'));
  } catch {
    return null;
  }
}

/** Waits until data.json holds every field of values; what it holds otherwise. */
async function savedAs(values, timeout = 3_000) {
  const holds = data =>
    Boolean(data) &&
    Object.entries(values).every(([key, value]) => data[key] === value);
  const saved = await waitFor(async () => holds(pluginData()), timeout, 50);
  return { ok: Boolean(saved), data: pluginData() };
}

/** Picks values in the plugin's settings tab as a user does, then closes it; returns what it showed before. */
const pickInSettings = (page, values) =>
  page.evaluate(async values => {
    const { setting } = window.app;
    setting.open();
    setting.openTabById('erd-editor');
    await new Promise(resolve => setTimeout(resolve, 500));
    const tab = setting.pluginTabs.find(t => t.id === 'erd-editor');
    const items = [...tab.containerEl.querySelectorAll('.setting-item')];
    const shown = {};
    for (const [name, value] of Object.entries(values)) {
      const select = items
        .find(
          item =>
            item.querySelector('.setting-item-name')?.textContent === name
        )
        ?.querySelector('select');
      if (!select) continue;
      shown[name] = select.value;
      select.value = value;
      // In Obsidian 1.13 the tab lives in a popout window, with its own Event.
      select.dispatchEvent(new select.ownerDocument.defaultView.Event('change'));
    }
    setting.close();
    return shown;
  }, values);

function findNode(node, match) {
  if (match(node)) return node;
  for (const child of [...(node.children ?? []), ...(node.shadowRoots ?? [])]) {
    const found = findNode(child, match);
    if (found) return found;
  }
  return null;
}

/**
 * Runs fn on the closed shadow root of the file's editor, which only the
 * DevTools protocol reaches, with the root and arg; returns what fn returns.
 */
async function inEditor(page, path, fn, arg) {
  await page.evaluate(path => {
    for (const leaf of window.app.workspace.getLeavesOfType('erd-editor')) {
      const editor = leaf.view.contentEl.querySelector('erd-editor');
      editor.toggleAttribute('data-smoke', leaf.view.file?.path === path);
    }
  }, path);
  const cdp = await page.context().newCDPSession(page);
  try {
    const { root } = await cdp.send('DOM.getDocument', {
      depth: -1,
      pierce: true,
    });
    const host = findNode(
      root,
      node =>
        node.localName === 'erd-editor' &&
        node.attributes?.includes('data-smoke')
    );
    const shadow = host?.shadowRoots?.[0];
    if (!shadow) return null;
    const { object } = await cdp.send('DOM.resolveNode', {
      nodeId: shadow.nodeId,
    });
    const { result } = await cdp.send('Runtime.callFunctionOn', {
      objectId: object.objectId,
      functionDeclaration: `function (arg) { return (${fn})(this, arg); }`,
      arguments: [{ value: arg }],
      returnByValue: true,
    });
    return result.value;
  } finally {
    await cdp.detach().catch(() => undefined);
  }
}

/** Clicks what pick finds in the editor's shadow root: pick runs there with the root and arg. */
const clickInEditor = (page, path, pick, arg) =>
  inEditor(
    page,
    path,
    `(root, arg) => {
      const element = (${pick})(root, arg);
      element?.click();
      return Boolean(element);
    }`,
    arg
  ).then(clicked => clicked === true);

/** The document the first tab of the file shows, as its editor serializes it. */
const editorValue = (page, path) =>
  page.evaluate(
    path =>
      window.app.workspace
        .getLeavesOfType('erd-editor')
        .find(leaf => leaf.view.file?.path === path)
        ?.view.contentEl.querySelector('erd-editor').value ?? null,
    path
  );

/** The column count of each table in a v3 document's text. */
function columnCounts(text) {
  if (!text) return [];
  const { doc, collections } = JSON.parse(text);
  return doc.tableIds.map(id => collections.tableEntities[id].columnIds.length);
}

/** The view type of the active leaf, which decides whose scope Obsidian asks about a key first. */
const activeViewType = page =>
  page.evaluate(() => window.app.workspace.activeLeaf?.view.getViewType());

/** Adds a table with the editor's own shortcut and waits for the save. */
async function addTableAndWaitForSave(page, path) {
  const before = tableCount(path);
  await sleep(1_000);
  await pressAddTable(page);
  return waitFor(async () => tableCount(path) === before + 1, 15_000, 500);
}

/** Lock file states of this run's window as they change, for the reload step. */
const lockEvents = [];
let lastLock = '';
const lockWatch = setInterval(() => {
  if (!rendererPid) return;
  const lock = readLock(rendererPid);
  const state = lock
    ? `hub=${lock.hub} token=${String(lock.token).slice(0, 8)}`
    : 'absent';
  if (state !== lastLock) lockEvents.push((lastLock = state));
}, 20);

try {
  let page = await connect();
  step('vault opened', true);
  const version = await page.evaluate(() =>
    window.electron.ipcRenderer.sendSync('version')
  );
  console.log(
    `obsidian ${version} (${ASAR ? `from ${ASAR}` : `bundled with ${OBSIDIAN}`})`
  );

  // Obsidian reads its language once, as its window loads, so the run gives it
  // one the system's own list lacks: only the plugin's getLanguage can bring it
  // to the editor, which then never shows the language it would find alone.
  const obsidianLanguage = await page.evaluate(languages => {
    const own = navigator.languages.map(tag => tag.split('-')[0]);
    const language =
      languages.find(code => !own.includes(code)) ?? languages[0];
    localStorage.setItem('language', language);
    return language;
  }, Object.keys(OBSIDIAN_LANGUAGES));
  await detach();
  await rawEval(
    "setTimeout(() => window.app.commands.executeCommandById('app:reload'), 100); 'reloading'"
  );
  await sleep(1_500);
  page = await connect();
  let obsidianShown = null;
  const obsidianTook = await waitFor(
    async () => {
      obsidianShown = await page.evaluate(() => window.i18next?.language);
      return obsidianShown === obsidianLanguage;
    },
    5_000,
    100
  );
  step(
    "Obsidian shows the language the run gave it, which the system's lacks",
    Boolean(obsidianTook),
    JSON.stringify({ obsidianLanguage, obsidianShown })
  );

  await page.evaluate(async () => {
    const { plugins } = window.app;
    if (!plugins.isEnabled()) await plugins.setEnable(true);
    if (!plugins.plugins['erd-editor']) {
      await plugins.enablePluginAndSave('erd-editor');
    }
  });
  await page.keyboard.press('Escape');
  const loaded = await waitFor(
    () => page.evaluate(() => Boolean(window.app.plugins.plugins['erd-editor'])),
    10_000
  );
  step('plugin enabled', Boolean(loaded));

  const listed = await waitFor(
    () =>
      page.evaluate(() =>
        ['schema.erd', 'legacy.vuerd'].every(
          path =>
            document.querySelector(`.nav-file-title[data-path="${path}"]`)
              ?.offsetParent
        )
      ),
    5_000
  );
  step('.erd and .vuerd shown in the file explorer', Boolean(listed));

  const erd = await openDiagram(page, 'schema.erd');
  step('.erd opens in the ERD view', Boolean(erd), JSON.stringify(erd));

  const tabIcon = await page.evaluate(() => {
    const leaf = window.app.workspace.getMostRecentLeaf();
    const svg = leaf?.tabHeaderInnerIconEl?.querySelector('svg');
    return svg
      ? {
          icon: svg.classList.contains('erd-editor'),
          tables: svg.querySelectorAll('rect').length,
          stroke: getComputedStyle(svg.querySelector('rect')).strokeWidth,
        }
      : null;
  });
  step(
    'ERD tab shows the ERD Editor icon',
    tabIcon?.icon === true && tabIcon.tables === 2,
    JSON.stringify(tabIcon)
  );

  const contain = await page.evaluate(
    () =>
      getComputedStyle(
        document.querySelector('.erd-editor-view').closest('.workspace-leaf')
      ).contain
  );
  step(
    'ERD tab lets menus position against the viewport',
    contain === 'size style',
    contain
  );

  const size = await page.evaluate(() => {
    const rect = document
      .querySelector('.erd-editor-view erd-editor')
      ?.getBoundingClientRect();
    return rect ? { width: rect.width, height: rect.height } : null;
  });
  step(
    'editor fills the tab',
    Boolean(size && size.width > 300 && size.height > 300),
    JSON.stringify(size)
  );

  step(
    'Alt+N table saved to schema.erd',
    Boolean(await addTableAndWaitForSave(page, 'schema.erd'))
  );

  writeFileSync(
    join(vault, 'model.erd.json'),
    readFileSync(join(vault, 'schema.erd'))
  );
  const erdJson = await openDiagram(page, 'model.erd.json');
  step(
    '.erd.json opens in the ERD view',
    erdJson?.title === 'model',
    JSON.stringify(erdJson)
  );
  step(
    'Alt+N table saved to model.erd.json',
    Boolean(await addTableAndWaitForSave(page, 'model.erd.json'))
  );

  // A second tab of the open file, split beside it: an edit in either shows in
  // the other long before the save, and neither tab reloads the document.
  await page.evaluate(async () => {
    const { workspace, vault } = window.app;
    const a = workspace.getMostRecentLeaf();
    const b = workspace.createLeafBySplit(a, 'vertical');
    await b.openFile(vault.getAbstractFileByPath('model.erd.json'));
    window.__split = [a, b];
    window.__reloads = 0;
    for (const leaf of window.__split) {
      const editor = leaf.view.contentEl.querySelector('erd-editor');
      const load = editor.setInitialValue.bind(editor);
      editor.setInitialValue = value => {
        window.__reloads++;
        load(value);
      };
    }
  });
  const splitTables = () =>
    page.evaluate(() =>
      window.__split.map(
        leaf =>
          JSON.parse(leaf.view.contentEl.querySelector('erd-editor').value).doc
            .tableIds.length
      )
    );
  const pressIn = async index => {
    await page.evaluate(
      index =>
        window.__split[index].view.contentEl.querySelector('erd-editor').focus(),
      index
    );
    await page.keyboard.press('Alt+KeyN');
    await sleep(150);
  };
  // No write of the file under way: Obsidian 1.12 keeps a flag, 1.13 a count.
  const fileSettled = path =>
    page.evaluate(path => {
      const file = window.app.vault.getAbstractFileByPath(path);
      return Boolean(file) && !file.saving;
    }, path);
  await sleep(500);
  const [splitBefore] = await splitTables();
  await pressIn(0);
  const afterA = await splitTables();
  await pressIn(1);
  const afterB = await splitTables();
  const splitSaved = await waitFor(
    async () =>
      (await fileSettled('model.erd.json')) &&
      tableCount('model.erd.json') === splitBefore + 2,
    6_000,
    500
  );
  await sleep(1_000);
  const reloads = await page.evaluate(() => window.__reloads);
  step(
    'two tabs of one file stay in step as edits happen',
    afterA.every(n => n === splitBefore + 1) &&
      afterB.every(n => n === splitBefore + 2) &&
      Boolean(splitSaved) &&
      reloads === 0,
    JSON.stringify({ splitBefore, afterA, afterB, reloads })
  );
  await page.evaluate(() => window.__split[1].detach());

  // A tab split within 100 ms of an edit, before the replica saved it: it
  // waits for that save, read-only, starts with the edit, and once the first
  // tab closes it writes the file with it.
  await sleep(AUTOSAVE_MS + 500);
  const seedBefore = tableCount('model.erd.json');
  await page.evaluate(() => {
    window.addEventListener(
      'keydown',
      () => (window.__keyAt = performance.now()),
      { capture: true, once: true }
    );
    window.__split[0].view.contentEl.querySelector('erd-editor').focus();
  });
  await page.keyboard.press('Alt+KeyN');
  const atSplit = await page.evaluate(async () => {
    const { workspace, vault } = window.app;
    const file = vault.getAbstractFileByPath('model.erd.json');
    const { registry } = window.app.plugins.plugins['erd-editor'];
    const entry = [...registry.entries.values()].find(e => e.file === file);
    const state = {
      gapMs: Math.round(performance.now() - window.__keyAt),
      pending: entry?.quiet.pending === true,
    };
    const [a] = window.__split;
    const b = workspace.createLeafBySplit(a, 'vertical');
    window.__split = [a, b];
    await b.openFile(file);
    return {
      ...state,
      waiting: !entry.live.has(b.view),
      readonly: b.view.contentEl.querySelector('erd-editor').readonly,
    };
  });
  await sleep(1_500);
  const seedAtOpen = await splitTables();
  const readonlyAfterSeed = await page.evaluate(
    () => window.__split[1].view.contentEl.querySelector('erd-editor').readonly
  );
  await page.evaluate(() => window.__split[0].detach());
  await sleep(500);
  await page.evaluate(() => {
    window.__split = [window.__split[1]];
  });
  await pressIn(0);
  const seedWritten = await waitFor(
    async () =>
      (await fileSettled('model.erd.json')) &&
      tableCount('model.erd.json') === seedBefore + 2,
    8_000,
    250
  );
  const [seedTab] = await splitTables();
  step(
    'a tab split within 100 ms of an unsaved edit waits read-only, starts with it and, left alone, writes it',
    atSplit.pending &&
      atSplit.gapMs < 100 &&
      atSplit.waiting &&
      atSplit.readonly === true &&
      readonlyAfterSeed === false &&
      seedAtOpen.every(n => n === seedBefore + 1) &&
      Boolean(seedWritten) &&
      seedTab === seedBefore + 2,
    JSON.stringify({
      seedBefore,
      atSplit,
      readonlyAfterSeed,
      seedAtOpen,
      file: tableCount('model.erd.json'),
      seedTab,
    })
  );

  // The same wait, and the first tab closes during it: its close writes the
  // file, and the waiting tab, now the writer, closes before loading. It must
  // not write the text it opened with over what the first tab wrote.
  await openDiagram(page, 'deferred.erd');
  const focusDeferred = () =>
    page.evaluate(() => {
      const { workspace } = window.app;
      const leaf = workspace
        .getLeavesOfType('erd-editor')
        .find(leaf => leaf.view.file?.path === 'deferred.erd');
      window.__deferred = leaf;
      workspace.setActiveLeaf(leaf, { focus: true });
      leaf.view.contentEl.querySelector('erd-editor').focus();
    });
  await sleep(500);
  await focusDeferred();
  await sleep(150);
  await page.keyboard.press('Alt+KeyN');
  const deferredStart = await waitFor(
    async () => tableCount('deferred.erd') === 1 && 1,
    8_000,
    100
  );
  await sleep(500);
  // Replicated, not yet written by the 2 s save.
  await focusDeferred();
  await sleep(150);
  await page.keyboard.press('Alt+KeyN');
  await sleep(REPLICA_SETTLE_MS);
  const beforeSplit = tableCount('deferred.erd');
  await focusDeferred();
  await sleep(150);
  await page.keyboard.press('Alt+KeyN');
  const deferredSplit = await page.evaluate(async () => {
    const { workspace, vault } = window.app;
    const file = vault.getAbstractFileByPath('deferred.erd');
    const { registry } = window.app.plugins.plugins['erd-editor'];
    const entry = [...registry.entries.values()].find(e => e.file === file);
    const pending = entry?.quiet.pending === true;
    const a = window.__deferred;
    const b = workspace.createLeafBySplit(a, 'vertical');
    window.__deferred = b;
    await b.openFile(file);
    const waiting = !entry.live.has(b.view);
    a.detach();
    return { pending, waiting };
  });
  const afterFirstClose = await waitFor(
    async () =>
      tableCount('deferred.erd') > beforeSplit && tableCount('deferred.erd'),
    2_000,
    10
  );
  const firstCloseText = readFileSync(join(vault, 'deferred.erd'), 'utf8');
  const waitingWriter = await page.evaluate(async firstCloseText => {
    const view = window.__deferred.view;
    const { registry } = window.app.plugins.plugins['erd-editor'];
    const entry = [...registry.entries.values()].find(
      e => e.file === view.file
    );
    // The first tab leaves the file once its close write returned, and that
    // write's modify event moves this tab's saved text to it: before then, even
    // the open-time text would equal the saved one and write nothing.
    for (
      let i = 0;
      i < 100 &&
      (entry?.tabs[0] !== view || view.lastSaved() !== firstCloseText);
      i++
    ) {
      await new Promise(resolve => setTimeout(resolve, 2));
    }
    const state = {
      writer: entry?.tabs[0] === view,
      waiting: !entry?.live.has(view),
      savedFirstClose: view.lastSaved() === firstCloseText,
      unsaved: view.hasUnsavedValue(),
    };
    window.__deferred.detach();
    return state;
  }, firstCloseText);
  await sleep(1_500);
  const afterSecondClose = tableCount('deferred.erd');
  step(
    'a tab still waiting to load that became the writer closes without writing its open-time text',
    deferredStart === 1 &&
      beforeSplit === 1 &&
      deferredSplit.pending &&
      deferredSplit.waiting &&
      afterFirstClose > beforeSplit &&
      waitingWriter.writer &&
      waitingWriter.waiting &&
      waitingWriter.savedFirstClose &&
      waitingWriter.unsaved === false &&
      afterSecondClose === afterFirstClose,
    JSON.stringify({
      beforeSplit,
      deferredSplit,
      afterFirstClose,
      waitingWriter,
      afterSecondClose,
    })
  );

  const vuerd = await openDiagram(page, 'legacy.vuerd');
  step(
    '.vuerd opens its v2 document',
    vuerd?.title === 'legacy' && vuerd.tables === 2,
    JSON.stringify(vuerd)
  );
  step(
    'Alt+N table saved to legacy.vuerd',
    Boolean(await addTableAndWaitForSave(page, 'legacy.vuerd'))
  );

  const vuerdJson = await openDiagram(page, 'legacy.vuerd.json');
  step(
    '.vuerd.json opens its v2 document',
    vuerdJson?.title === 'legacy' && vuerdJson.tables === 2,
    JSON.stringify(vuerdJson)
  );
  await page.screenshot({ path: join(out, 'smoke.png') });

  await closeDiagram(page, 'legacy.vuerd.json');
  await sleep(2_500);
  step(
    'closing an unedited file leaves it as it was',
    readFileSync(join(vault, 'legacy.vuerd.json'), 'utf8') ===
      readFileSync(fixture, 'utf8')
  );

  // Past the replica's 200 ms, short of the 2 s save: closing writes its value.
  await openDiagram(page, 'schema.erd');
  const beforeQuickClose = tableCount('schema.erd');
  await sleep(1_000);
  await pressAddTable(page);
  await sleep(REPLICA_SETTLE_MS);
  const tabsBeforeClose = (await tabIds(page, 'schema.erd')).length;
  await page.evaluate(() => {
    window.__writes = 0;
    window.__writesRef = window.app.vault.on('modify', file => {
      if (file.path === 'schema.erd') window.__writes++;
    });
  });
  await closeDiagram(page, 'schema.erd');
  step(
    'an edit is saved when its tab closes before the timed save',
    Boolean(
      await waitFor(
        async () => tableCount('schema.erd') === beforeQuickClose + 1,
        5_000
      )
    )
  );
  // Two tabs showed schema.erd, and only the first may write: counted, since
  // overlapping writes leave Obsidian 1.12's saving flag set but bring 1.13's
  // count back to 0. The wait covers a timed save the edit may still owe.
  await sleep(AUTOSAVE_MS + 500);
  const settled = await waitFor(() => fileSettled('schema.erd'), 3_000);
  const writes = await page.evaluate(() => {
    window.app.vault.offref(window.__writesRef);
    return window.__writes;
  });
  step(
    'closing two tabs of one file writes it once',
    tabsBeforeClose === 2 && Boolean(settled) && writes === 1,
    JSON.stringify({ tabsBeforeClose, writes })
  );

  // The writer closes with an edit its 2 s save has not written, and the write
  // is slow. Obsidian's closing save empties the tab before it writes: a tab of
  // the file opened meanwhile must start from the edit, and never write less.
  await openDiagram(page, 'slow-close.erd');
  const slowFirstSave = Boolean(
    await addTableAndWaitForSave(page, 'slow-close.erd')
  );
  await waitFor(() => fileSettled('slow-close.erd'), 3_000);
  await sleep(500);
  await pressAddTable(page);
  await sleep(REPLICA_SETTLE_MS);
  const [slowShown] = await tabIds(page, 'slow-close.erd');
  const slowOnDisk = tableCount('slow-close.erd');
  const slowReopen = await page.evaluate(async () => {
    const { workspace, vault } = window.app;
    const { registry } = window.app.plugins.plugins['erd-editor'];
    const file = vault.getAbstractFileByPath('slow-close.erd');
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const modify = vault.modify;
    window.__restoreModify = () => (vault.modify = modify);
    vault.modify = async function (target, ...rest) {
      if (target === file) await wait(3_000);
      return modify.call(this, target, ...rest);
    };
    workspace
      .getLeavesOfType('erd-editor')
      .find(leaf => leaf.view.file === file)
      .detach();
    await wait(200);
    const leaf = workspace.getLeaf('tab');
    await leaf.openFile(file);
    window.__slowClose = leaf;
    let live = false;
    for (let i = 0; i < 60 && !live; i++) {
      const entry = [...registry.entries.values()].find(e => e.file === file);
      live = Boolean(entry?.live.has(leaf.view));
      if (!live) await wait(50);
    }
    return { live, writing: Boolean(registry.tabsOf(file)?.length === 2) };
  });
  const [slowOpened] = await tabIds(page, 'slow-close.erd');
  // The first tab's write lands 3 s late; the second tab closes after it.
  await waitFor(
    async () => tableCount('slow-close.erd') === slowShown?.length,
    8_000,
    100
  );
  await sleep(500);
  await page.evaluate(() => {
    window.__restoreModify();
    window.__slowClose.detach();
  });
  await sleep(AUTOSAVE_MS + 500);
  await waitFor(() => fileSettled('slow-close.erd'), 3_000);
  const slowAfter = tableCount('slow-close.erd');
  step(
    "a tab opened while the writer's close is still writing starts from its edit and never writes less",
    slowFirstSave &&
      slowShown?.length === slowOnDisk + 1 &&
      slowReopen.live &&
      slowReopen.writing &&
      slowOpened?.length === slowShown.length &&
      slowAfter === slowShown.length,
    JSON.stringify({
      shown: slowShown?.length,
      onDisk: slowOnDisk,
      slowReopen,
      opened: slowOpened?.length,
      after: slowAfter,
    })
  );

  const broken = await openDiagram(page, 'broken.erd');
  const readonly = await page.evaluate(
    () =>
      window.app.workspace
        .getMostRecentLeaf()
        ?.view.contentEl.querySelector('erd-editor')?.readonly
  );
  await page.mouse.move(700, 450);
  await page.mouse.wheel(0, 300);
  await sleep(500);
  await closeDiagram(page, 'broken.erd');
  await sleep(2_500);
  step(
    'an unreadable file opens read-only and is never written',
    Boolean(broken) &&
      readonly === true &&
      readFileSync(join(vault, 'broken.erd'), 'utf8') === BROKEN,
    JSON.stringify({ readonly })
  );

  // The tab wrote the file, then an outside change made it text the editor
  // cannot read: a tab opened beside it shows that text read-only too, never
  // what the writer handed Obsidian before, and closing both leaves the text.
  await openDiagram(page, 'conflict.erd');
  const conflictSaved = Boolean(
    await addTableAndWaitForSave(page, 'conflict.erd')
  );
  await waitFor(() => fileSettled('conflict.erd'), 3_000);
  await sleep(500);
  const CONFLICT = '{"doc": <<<<<<< HEAD\n=======\n>>>>>>> theirs\n';
  writeFileSync(join(vault, 'conflict.erd'), CONFLICT);
  const conflictTabs = () =>
    page.evaluate(() => {
      const { registry } = window.app.plugins.plugins['erd-editor'];
      return window.app.workspace
        .getLeavesOfType('erd-editor')
        .filter(leaf => leaf.view.file?.path === 'conflict.erd')
        .map(leaf => {
          const entry = [...registry.entries.values()].find(
            e => e.file === leaf.view.file
          );
          return {
            readonly: leaf.view.contentEl.querySelector('erd-editor').readonly,
            live: Boolean(entry?.live.has(leaf.view)),
            writer: entry?.tabs[0] === leaf.view,
            unsaved: leaf.view.hasUnsavedValue(),
          };
        });
    });
  const firstReadonly = Boolean(
    await waitFor(
      async () => (await conflictTabs())[0]?.readonly === true,
      5_000,
      50
    )
  );
  await page.evaluate(async () => {
    const { workspace, vault } = window.app;
    const file = vault.getAbstractFileByPath('conflict.erd');
    const a = workspace
      .getLeavesOfType('erd-editor')
      .find(leaf => leaf.view.file === file);
    const b = workspace.createLeafBySplit(a, 'vertical');
    await b.openFile(file);
    window.__conflict = [a, b];
  });
  await sleep(1_500);
  const [, conflictSplit] = await conflictTabs();
  await page.evaluate(() => window.__conflict[0].detach());
  await sleep(800);
  const [conflictLeft] = await conflictTabs();
  await page.evaluate(() => window.__conflict[1].detach());
  await sleep(1_500);
  step(
    'a tab opened beside a file changed outside to unreadable text shows it read-only and never writes over it',
    conflictSaved &&
      firstReadonly &&
      conflictSplit?.readonly === true &&
      conflictSplit.live === false &&
      conflictLeft?.writer === true &&
      conflictLeft.unsaved === false &&
      readFileSync(join(vault, 'conflict.erd'), 'utf8') === CONFLICT,
    JSON.stringify({ conflictSplit, conflictLeft })
  );

  await openDiagram(page, 'schema.erd');
  const outside = readFileSync(join(vault, 'model.erd.json'), 'utf8');
  await sleep(1_000);
  await pressAddTable(page);
  await sleep(300);
  writeFileSync(join(vault, 'schema.erd'), outside);
  await sleep(4_000);
  step(
    'an outside change during an unsaved edit leaves valid JSON',
    readFileSync(join(vault, 'schema.erd'), 'utf8') === outside
  );

  const nullOpen = await page.evaluate(async () => {
    try {
      await window.app.workspace.getLeaf(false).openFile(null);
      return 'ok';
    } catch (error) {
      return error.message;
    }
  });
  step('openFile(null) still returns quietly', nullOpen === 'ok', nullOpen);

  await page.evaluate(() =>
    window.app.commands.executeCommandById('erd-editor:create-diagram')
  );
  const created = await waitFor(
    () =>
      page.evaluate(() => {
        const view = window.app.workspace.getMostRecentLeaf()?.view;
        const path = view?.file?.path ?? '';
        return view?.getViewType() === 'erd-editor' &&
          /^Untitled( \d+)?\.erd$/.test(path)
          ? path
          : null;
      }),
    5_000
  );
  step(
    'new diagram skips a name taken in another case',
    created === 'Untitled 1.erd',
    String(created)
  );

  // ---- Keys Obsidian binds to commands of its own, which the ERD tab passes to the editor ----
  await openDiagram(page, 'keys.erd');
  await sleep(1_000);
  // Alt+N selects and focuses the new table, which Alt+Enter adds a column to.
  await pressAddTableIn(page, 'keys.erd');
  await sleep(300);
  const addColumnIn = await activeViewType(page);
  await page.keyboard.press('Alt+Enter');
  const shownColumns = await waitFor(async () => {
    const counts = columnCounts(await editorValue(page, 'keys.erd'));
    return counts.length === 1 && counts[0] === 1 ? counts : null;
  }, 2_000);
  const savedColumns = await waitFor(
    async () => {
      const text = readFileSync(join(vault, 'keys.erd'), 'utf8');
      const counts = columnCounts(text);
      return counts.length === 1 && counts[0] === 1 ? counts : null;
    },
    AUTOSAVE_MS + 3_000,
    100
  );
  step(
    "Alt+Enter, Obsidian's follow link, adds a column to the focused table in the ERD tab, then in the file",
    addColumnIn === 'erd-editor' && Boolean(shownColumns && savedColumns),
    JSON.stringify({
      addColumnIn,
      shown: columnCounts(await editorValue(page, 'keys.erd')),
      saved: columnCounts(readFileSync(join(vault, 'keys.erd'), 'utf8')),
    })
  );

  const quickSearchOpen = () =>
    inEditor(page, 'keys.erd', root =>
      Boolean(root.querySelector('.quick-search'))
    );
  await focusDiagram(page, 'keys.erd');
  const searchIn = await activeViewType(page);
  const searchBefore = await quickSearchOpen();
  await page.keyboard.press('ControlOrMeta+KeyK');
  const searchOpened = await waitFor(quickSearchOpen, 2_000, 100);
  await page.keyboard.press('Escape');
  const searchClosed = await waitFor(
    async () => (await quickSearchOpen()) === false,
    2_000,
    100
  );
  step(
    "Mod+K, Obsidian's insert link, opens the editor's quick search in the ERD tab, and Escape closes it",
    searchIn === 'erd-editor' &&
      searchBefore === false &&
      Boolean(searchOpened) &&
      Boolean(searchClosed),
    JSON.stringify({ searchIn, searchBefore, searchOpened, searchClosed })
  );

  const findReplaceOpen = () =>
    inEditor(page, 'keys.erd', root =>
      Boolean(root.querySelector('.find-replace'))
    );
  await focusDiagram(page, 'keys.erd');
  const findIn = await activeViewType(page);
  const findBefore = await findReplaceOpen();
  await page.keyboard.press('ControlOrMeta+KeyF');
  const findOpened = await waitFor(findReplaceOpen, 2_000, 100);
  await page.keyboard.press('Escape');
  const findClosed = await waitFor(
    async () => (await findReplaceOpen()) === false,
    2_000,
    100
  );
  step(
    "Mod+F, Obsidian's search current file, opens the editor's Find and Replace in the ERD tab, and Escape closes it",
    findIn === 'erd-editor' &&
      findBefore === false &&
      Boolean(findOpened) &&
      Boolean(findClosed),
    JSON.stringify({ findIn, findBefore, findOpened, findClosed })
  );

  // Nothing waits to be saved, so only Mod+S can write the edit this early.
  await sleep(AUTOSAVE_MS + 500);
  const tablesBeforeSave = tableCount('keys.erd');
  await pressAddTableIn(page, 'keys.erd');
  const editedAt = Date.now();
  await sleep(REPLICA_SETTLE_MS);
  const saveIn = await activeViewType(page);
  await page.keyboard.press('ControlOrMeta+KeyS');
  const savedByKey = await waitFor(
    async () => tableCount('keys.erd') === tablesBeforeSave + 1,
    AUTOSAVE_MS,
    50
  );
  const savedAfter = Date.now() - editedAt;
  step(
    'Mod+S in the ERD tab writes an edit before the 2 s autosave would',
    saveIn === 'erd-editor' &&
      Boolean(savedByKey) &&
      savedAfter < AUTOSAVE_MS,
    JSON.stringify({ saveIn, savedAfter, tables: tableCount('keys.erd') })
  );

  await focusDiagram(page, 'keys.erd');
  const paletteIn = await activeViewType(page);
  await page.keyboard.press('ControlOrMeta+KeyP');
  const palettePrompt = await waitFor(
    () =>
      page.evaluate(
        () =>
          document.querySelector('.modal-container .prompt-input')
            ?.placeholder ?? null
      ),
    2_000,
    100
  );
  await page.keyboard.press('Escape');
  const paletteClosed = await waitFor(
    () => page.evaluate(() => !document.querySelector('.modal-container')),
    2_000,
    100
  );
  step(
    "Mod+P in the ERD tab still opens Obsidian's command palette, and Escape closes it",
    paletteIn === 'erd-editor' &&
      Boolean(palettePrompt) &&
      Boolean(paletteClosed),
    JSON.stringify({ paletteIn, palettePrompt, paletteClosed })
  );
  await closeDiagram(page, 'keys.erd');

  const workerTargets = await page
    .context()
    .newCDPSession(page)
    .then(session => session.send('Target.getTargets'))
    .then(({ targetInfos }) =>
      targetInfos.filter(t => t.type.includes('worker')).map(t => t.type)
    )
    .catch(() => []);
  console.log(`worker targets: ${JSON.stringify(workerTargets)}`);

  // ---- The theme, checked on what the editors paint ----
  const themePaths = ['theme-a.erd', 'theme-b.erd'];
  for (const path of themePaths) await openDiagram(page, path);
  const obsidianTheme = await page.evaluate(() =>
    window.app.vault.getConfig('theme')
  );
  const colors = { grayColor: 'slate', accentColor: 'indigo' };
  const appearanceOf = dark => (dark ? 'dark' : 'light');
  const firstDark = await obsidianDark(page);
  const byDefault = await themedAs(page, themePaths, {
    ...colors,
    appearance: appearanceOf(firstDark),
  });
  const switchedToOther = await changeObsidianTheme(page, !firstDark);
  const otherDark = await obsidianDark(page);
  const followed = await themedAs(page, themePaths, {
    ...colors,
    appearance: appearanceOf(!firstDark),
  });
  step(
    "by default every diagram follows Obsidian's light or dark and switches with it",
    pluginData() === null &&
      byDefault.ok &&
      switchedToOther &&
      followed.ok,
    JSON.stringify({ firstDark, byDefault, followed })
  );

  // Named light or dark, the appearance stays when Obsidian switches; auto follows again.
  const shownInSettings = await pickInSettings(page, {
    Appearance: appearanceOf(otherDark),
    'Gray color': 'sand',
    'Accent color': 'crimson',
  });
  const picked = { grayColor: 'sand', accentColor: 'crimson' };
  const fromSettings = await themedAs(page, themePaths, {
    ...picked,
    appearance: appearanceOf(otherDark),
  });
  const savedFromSettings = await savedAs({
    appearance: appearanceOf(otherDark),
    grayColor: 'sand',
    accentColor: 'crimson',
  });
  const switchedBack = await changeObsidianTheme(page, firstDark);
  const kept = await themedAs(page, themePaths, {
    ...picked,
    appearance: appearanceOf(otherDark),
  });
  await pickInSettings(page, { Appearance: 'auto' });
  const autoAgain = await themedAs(page, themePaths, {
    ...picked,
    appearance: appearanceOf(firstDark),
  });
  const savedAuto = await savedAs({ appearance: 'auto' });
  step(
    'the settings re-theme every open diagram at once and save to data.json; light or dark stays, auto follows',
    shownInSettings.Appearance === 'auto' &&
      shownInSettings['Gray color'] === 'slate' &&
      shownInSettings['Accent color'] === 'indigo' &&
      fromSettings.ok &&
      savedFromSettings.ok &&
      switchedBack &&
      kept.ok &&
      autoAgain.ok &&
      savedAuto.ok,
    JSON.stringify({
      shownInSettings,
      fromSettings,
      savedFromSettings,
      switchedBack,
      kept,
      autoAgain,
      savedAuto,
    })
  );

  // The builder of one diagram: a color keeps auto, the other appearance replaces it, System is auto.
  const builderOpened = await clickInEditor(page, 'theme-a.erd', root =>
    root.querySelector('.toolbar-theme')
  );
  await sleep(300);
  const accentPicked = await clickInEditor(
    page,
    'theme-a.erd',
    (root, color) => root.querySelector(`.theme-builder span[title="${color}"]`),
    'grass'
  );
  const grassShown = await themedAs(page, ['theme-b.erd'], {
    grayColor: 'sand',
    accentColor: 'grass',
    appearance: appearanceOf(firstDark),
  });
  const savedAccent = await savedAs({
    appearance: 'auto',
    accentColor: 'grass',
  });
  // By place, as every label is in the editor's language: the builder's only
  // icons are those of its appearance buttons, System, Light and Dark in turn.
  const pickAppearance = label =>
    clickInEditor(
      page,
      'theme-a.erd',
      (root, index) =>
        root.querySelectorAll('.theme-builder .icon')[index]?.parentElement,
      ['System', 'Light', 'Dark'].indexOf(label)
    );
  const appearancePicked = await pickAppearance(firstDark ? 'Light' : 'Dark');
  const appearanceShown = await themedAs(page, ['theme-b.erd'], {
    grayColor: 'sand',
    accentColor: 'grass',
    appearance: appearanceOf(!firstDark),
  });
  const savedAppearance = await savedAs({
    appearance: appearanceOf(!firstDark),
    grayColor: 'sand',
    accentColor: 'grass',
  });
  const systemPicked = await pickAppearance('System');
  const systemShown = await themedAs(page, ['theme-b.erd'], {
    grayColor: 'sand',
    accentColor: 'grass',
    appearance: appearanceOf(firstDark),
  });
  const savedSystem = await savedAs({
    appearance: 'auto',
    grayColor: 'sand',
    accentColor: 'grass',
  });
  step(
    "one diagram's theme builder saves its pick and re-themes the other open diagram",
    builderOpened &&
      accentPicked &&
      grassShown.ok &&
      savedAccent.ok &&
      appearancePicked &&
      appearanceShown.ok &&
      savedAppearance.ok &&
      systemPicked &&
      systemShown.ok &&
      savedSystem.ok,
    JSON.stringify({
      grassShown,
      savedAccent,
      appearanceShown,
      savedAppearance,
      systemShown,
      savedSystem,
    })
  );
  // Obsidian reads data.json again when it changes on disk, as a sync changes it.
  const synced = {
    appearance: 'auto',
    grayColor: 'olive',
    accentColor: 'plum',
  };
  writeFileSync(
    join(pluginDir, 'data.json'),
    JSON.stringify({ ...pluginData(), ...synced })
  );
  const fromSync = await themedAs(
    page,
    themePaths,
    { ...synced, appearance: appearanceOf(firstDark) },
    10_000
  );
  const syncedSettings = await page.evaluate(() => {
    const { appearance, grayColor, accentColor } =
      window.app.plugins.plugins['erd-editor'].settings;
    return { appearance, grayColor, accentColor };
  });
  step(
    'data.json changed on disk, as a sync changes it, re-themes the open diagrams',
    fromSync.ok && JSON.stringify(syncedSettings) === JSON.stringify(synced),
    JSON.stringify({ fromSync, syncedSettings })
  );

  // ---- The display language, on the root of each editor, and the welcome screen ----
  // The language the run gave Obsidian, which the editor finds through the plugin alone.
  const defaultLang = OBSIDIAN_LANGUAGES[obsidianLanguage];
  const langByDefault = await langsAs(page, themePaths, defaultLang);
  step(
    "by default every diagram shows Obsidian's language, not the system's",
    (pluginData()?.locale ?? 'auto') === 'auto' && langByDefault.ok,
    JSON.stringify({ obsidianLanguage, langByDefault })
  );

  const pickedLang = 'de-DE';
  const shownLanguage = await pickInSettings(page, {
    'Display language': pickedLang,
  });
  const langFromSettings = await langsAs(page, themePaths, pickedLang);
  const savedLang = await savedAs({ locale: pickedLang });
  await pickInSettings(page, { 'Display language': 'auto' });
  const langAutoAgain = await langsAs(page, themePaths, defaultLang);
  const savedLangAuto = await savedAs({ locale: 'auto' });
  step(
    "the settings tab's Display language changes every open diagram at once and saves to data.json; Auto follows Obsidian again",
    shownLanguage['Display language'] === 'auto' &&
      langFromSettings.ok &&
      savedLang.ok &&
      langAutoAgain.ok &&
      savedLangAuto.ok,
    JSON.stringify({
      shownLanguage,
      langFromSettings,
      savedLang,
      langAutoAgain,
      savedLangAuto,
    })
  );

  await openDiagram(page, 'welcome.erd');
  const welcomeShown = () =>
    inEditor(page, 'welcome.erd', root =>
      Boolean(root.querySelector('.welcome-screen'))
    );
  const welcomeOpened = await waitFor(welcomeShown, 3_000, 100);
  await pressAddTableIn(page, 'welcome.erd');
  const welcomeGone = await waitFor(
    async () => (await welcomeShown()) === false,
    3_000,
    100
  );
  step(
    'a new empty diagram shows the welcome screen, and Alt+N takes it away',
    Boolean(welcomeOpened) && Boolean(welcomeGone),
    JSON.stringify({
      welcomeOpened,
      welcomeGone,
      tables: JSON.parse((await editorValue(page, 'welcome.erd')) ?? '{}').doc
        ?.tableIds.length,
    })
  );
  await closeDiagram(page, 'welcome.erd');
  await page.evaluate(
    theme => window.app.changeTheme(theme),
    obsidianTheme ?? 'system'
  );
  await closeDiagram(page, 'theme-a.erd');
  await closeDiagram(page, 'theme-b.erd');

  // ---- The coding-agent hub, driven by the real MCP server over stdio ----
  await page.evaluate(() =>
    window.app.workspace
      .getLeavesOfType('erd-editor')
      .forEach(leaf => leaf.detach())
  );
  await sleep(1_000);
  rendererPid = await page.evaluate(() => process.pid);
  const lock = await waitFor(async () => {
    const lock = readLock(rendererPid);
    return lock?.hub && isSocket(lock.pipe) ? lock : null;
  }, 10_000);
  step(
    'lock: ide obsidian, hub on, protocol 2, the manifest version, a token',
    lock?.ide === 'obsidian' &&
      lock.hub === true &&
      lock.protocolVersion === 2 &&
      lock.version === manifest.version &&
      lock.token?.length > 8,
    JSON.stringify(lock && { ...lock, token: `${lock.token.slice(0, 8)}...` })
  );
  step(
    WIN
      ? 'lock: a live named pipe of the renderer pid (Windows keeps no modes)'
      : 'lock: a live socket beside it, a 0600 file in a 0700 folder',
    lock?.pipe === expectedPipe(rendererPid) &&
      isSocket(lock.pipe) &&
      (WIN ||
        (mode(lockPath(rendererPid)) === '600' && mode(LOCK_DIR) === '700')),
    lock && `${lock.pipe} ${mode(lockPath(rendererPid))} ${mode(LOCK_DIR)}`
  );
  await openDiagram(page, 'agent.erd');
  const lockDocuments = await waitFor(async () => {
    const documents = readLock(rendererPid)?.documents;
    return documents?.length === 1 ? documents : null;
  }, 5_000);
  step(
    'lock: workspaceFolders is the vault real path, documents the open ERD file by real path',
    sameSet(lock?.workspaceFolders ?? [], [realVault]) &&
      sameSet(lockDocuments ?? [], [real('agent.erd')]),
    JSON.stringify({ workspaceFolders: lock?.workspaceFolders, lockDocuments })
  );

  // What the setting shows, checked before any hub restart: in Obsidian 1.13
  // settings open in a popout window, and a hub restarted while one is open
  // can leave the next agent call waiting 30 s for its hello.
  const settingShown = await page.evaluate(async () => {
    window.app.setting.open();
    window.app.setting.openTabById('erd-editor');
    await new Promise(resolve => setTimeout(resolve, 500));
    const tab = window.app.setting.pluginTabs.find(t => t.id === 'erd-editor');
    const item = [
      ...(tab?.containerEl.querySelectorAll('.setting-item') ?? []),
    ].find(item => item.querySelector('.checkbox-container'));
    const shown = {
      name: item?.querySelector('.setting-item-name')?.textContent,
      on: item
        ?.querySelector('.checkbox-container')
        .classList.contains('is-enabled'),
    };
    window.app.setting.close();
    return shown;
  });
  step(
    'the settings tab shows the Coding agents toggle, on by default',
    settingShown.name === 'Coding agents' && settingShown.on === true,
    JSON.stringify(settingShown)
  );

  if (!existsSync(MCP_BIN)) {
    throw new Error(`${MCP_BIN} is missing; build @dineug/erd-editor-mcp first`);
  }
  mcp = startMcp(MCP_BIN, vault);
  const server = await mcp.initialize();
  const erdFiles = readdirSync(vault)
    .filter(name => /\.(erd|vuerd)(\.json)?$/i.test(name))
    .map(real);
  const list = await mcp.call('erd_list_documents', {});
  const documents = list.json?.documents ?? [];
  step(
    'erd_list_documents: live, the open file first and active, every ERD file of the vault, no note',
    list.json?.mode === 'live' &&
      list.notes.length === 0 &&
      documents[0]?.path === real('agent.erd') &&
      documents[0].open &&
      documents[0].active &&
      documents.filter(document => document.open).length === 1 &&
      sameSet(
        documents.map(document => document.path),
        erdFiles
      ),
    `${server?.serverInfo?.name}: ${list.text.slice(0, 300)}`
  );

  const activeFile = () =>
    page.evaluate(() => window.app.workspace.activeLeaf?.view?.file?.path);
  const activeBefore = await activeFile();
  const opened = await mcp.call('erd_open_document', { path: 'closed.erd' });
  const openTabs = await page.evaluate(() =>
    window.app.workspace
      .getLeavesOfType('erd-editor')
      .map(leaf => leaf.view.file?.path)
  );
  const activeAfter = await activeFile();
  step(
    'erd_open_document on a closed file opens a background tab, focus stays',
    opened.json?.opened === true &&
      openTabs.includes('closed.erd') &&
      activeBefore === 'agent.erd' &&
      activeAfter === activeBefore,
    JSON.stringify({ opened: opened.text, openTabs, activeAfter })
  );

  // From a note, Obsidian focuses the new tab for a moment and hands focus
  // back to the note: the diagram the user looked at last stays the active one.
  await page.evaluate(async () => {
    const { workspace, vault } = window.app;
    const leaf = workspace.getLeaf('tab');
    await leaf.openFile(vault.getAbstractFileByPath('notes.md'));
    workspace.setActiveLeaf(leaf, { focus: true });
    window.__notes = leaf;
  });
  await sleep(500);
  const fromNote = await mcp.call('erd_open_document', {
    path: 'background.erd',
  });
  await sleep(300);
  const noteActive = await activeFile();
  const afterNote = await mcp.call('erd_list_documents', {});
  const activeAfterNote = (afterNote.json?.documents ?? [])
    .filter(document => document.active)
    .map(document => document.path);
  const background = (afterNote.json?.documents ?? []).find(
    document => document.path === real('background.erd')
  );
  step(
    'erd_open_document from a note keeps focus on the note and the last diagram in focus active',
    fromNote.json?.opened === true &&
      noteActive === 'notes.md' &&
      background?.open === true &&
      sameSet(activeAfterNote, [real('agent.erd')]),
    JSON.stringify({ noteActive, activeAfterNote, background })
  );
  await closeDiagram(page, 'background.erd');
  await page.evaluate(() => window.__notes.detach());

  const added = await mcp.call('erd_add_table', { path: 'agent.erd' });
  const addedId = added.json?.createdIds?.[0];
  const addedShown = await shownInTabs(page, 'agent.erd', addedId);
  step(
    'erd_add_table shows live in the Obsidian tab before the file has it',
    added.json?.mode === 'live' &&
      Boolean(addedShown) &&
      !fileIds('agent.erd').includes(addedId),
    added.text.slice(0, 200)
  );

  const saved = await mcp.call('erd_save', { path: 'agent.erd' });
  step(
    'erd_save writes the file at once',
    saved.json?.saved === true &&
      fileIds('agent.erd').includes(addedId) &&
      saved.ms < AUTOSAVE_MS,
    `${saved.ms} ms: ${saved.text}`
  );

  await sleep(AUTOSAVE_MS + 500);
  const autoAdded = await mcp.call('erd_add_table', { path: 'agent.erd' });
  const autoId = autoAdded.json?.createdIds?.[0];
  const autoStart = Date.now();
  const autoAfter = await waitFor(
    async () =>
      fileIds('agent.erd').includes(autoId) ? Date.now() - autoStart : null,
    8_000,
    25
  );
  step(
    'Obsidian saves an agent edit about 2 s later, as it saves the user',
    Boolean(autoId) && autoAfter >= 1_500 && autoAfter <= 4_000,
    `written ${autoAfter} ms after erd_add_table answered`
  );

  await sleep(500);
  const [idsBeforeUser] = await tabIds(page, 'agent.erd');
  await pressAddTableIn(page, 'agent.erd');
  const [idsAfterUser] =
    (await waitFor(async () => {
      const tabs = await tabIds(page, 'agent.erd');
      return tabs[0]?.length === idsBeforeUser.length + 1 ? tabs : null;
    }, 3_000)) ?? [];
  const userId = idsAfterUser?.find(id => !idsBeforeUser.includes(id));
  const fileHadUserEdit = fileIds('agent.erd').includes(userId);
  const agentList = await mcp.call('erd_list', { path: 'agent.erd' });
  step(
    'a user edit in Obsidian reaches the agent before the file has it',
    Boolean(userId) &&
      !fileHadUserEdit &&
      !agentList.isError &&
      agentList.text.includes(userId),
    JSON.stringify({ userId, fileHadUserEdit, notes: agentList.notes })
  );

  // The agent edits the background tab too, then both tabs close.
  const closedAdded = await mcp.call('erd_add_table', { path: 'closed.erd' });
  const closedId = closedAdded.json?.createdIds?.[0];
  await sleep(REPLICA_SETTLE_MS);
  for (const path of ['agent.erd', 'closed.erd']) {
    await closeDiagram(page, path);
  }
  const unlisted = await waitFor(
    async () => readLock(rendererPid)?.documents?.length === 0,
    5_000
  );
  await sleep(500);
  const agentOnDisk = fileIds('agent.erd');
  const readClosed = await mcp.call('erd_list', { path: 'closed.erd' });
  const reseeded = await mcp.call('erd_add_table', { path: 'agent.erd' });
  const reseededId = reseeded.json?.createdIds?.[0];
  const reopened = await shownInTabs(page, 'agent.erd', reseededId, 5_000);
  const [reopenedIds] = await tabIds(page, 'agent.erd');
  step(
    'closing the last tab: a read carries the closed note, a write reseeds and reopens the tab live',
    Boolean(unlisted) &&
      fileIds('closed.erd').includes(closedId) &&
      readClosed.notes.some(note => CLOSED_NOTE.test(note)) &&
      readClosed.text.includes(closedId) &&
      reseeded.json?.mode === 'live' &&
      reseeded.notes.some(note => CLOSED_NOTE.test(note)) &&
      reseeded.notes.some(note => RESEED_NOTE.test(note)) &&
      Boolean(reopened) &&
      reopenedIds?.length === agentOnDisk.length + 1,
    JSON.stringify({
      unlisted: Boolean(unlisted),
      readNotes: readClosed.notes,
      writeNotes: reseeded.notes,
      tab: reopenedIds?.length,
      disk: agentOnDisk.length,
    })
  );

  // The setting through the call its toggle makes, with no popout open.
  await sleep(AUTOSAVE_MS + 500);
  const pipe = readLock(rendererPid)?.pipe;
  await page.evaluate(() =>
    window.app.plugins.plugins['erd-editor'].setAgentHub(false)
  );
  const offLock = await waitFor(async () => {
    const lock = readLock(rendererPid);
    return lock?.hub === false ? lock : null;
  }, 5_000);
  const data = JSON.parse(readFileSync(join(pluginDir, 'data.json'), 'utf8'));
  const blocked = await mcp.call('erd_add_table', { path: 'agent.erd' });
  step(
    "Coding agents off: a hub-off lock, the socket gone, a write refused naming Obsidian's setting",
    offLock?.pipe === '' &&
      offLock.token === '' &&
      sameSet(offLock.workspaceFolders, [realVault]) &&
      offLock.documents.includes(real('agent.erd')) &&
      pipeGone(pipe) &&
      data.agentHub === false &&
      blocked.isError &&
      /an Obsidian window \(pid \d+\)/.test(blocked.text) &&
      blocked.text.includes(
        "Turn on the ERD Editor plugin's coding-agent setting, or reload Obsidian, then call again."
      ) &&
      !/VS Code|dineug\.erd-editor\.agentHub|Trust the workspace/.test(
        blocked.text
      ),
    blocked.text.slice(0, 400)
  );

  await page.evaluate(() =>
    window.app.plugins.plugins['erd-editor'].setAgentHub(true)
  );
  const onLock = await waitFor(async () => {
    const lock = readLock(rendererPid);
    return lock?.hub && isSocket(lock.pipe) ? lock : null;
  }, 5_000);
  const onAdded = await mcp.call('erd_add_table', { path: 'agent.erd' });
  const onShown = await shownInTabs(
    page,
    'agent.erd',
    onAdded.json?.createdIds?.[0]
  );
  step(
    'Coding agents on again: a hub-on lock with a live socket, the agent edits live',
    Boolean(onLock) && onAdded.json?.mode === 'live' && Boolean(onShown),
    onAdded.text.slice(0, 300)
  );

  await sleep(AUTOSAVE_MS + 500);
  const pipeBeforeDisable = readLock(rendererPid)?.pipe;
  await page.evaluate(() => window.app.plugins.disablePlugin('erd-editor'));
  const released = await waitFor(
    async () =>
      !existsSync(lockPath(rendererPid)) && pipeGone(pipeBeforeDisable),
    5_000
  );
  await sleep(500);
  const beforeFallback = fileIds('agent.erd').length;
  const fallback = await mcp.call('erd_add_table', { path: 'agent.erd' });
  step(
    "plugin disabled: lock and socket gone, the agent edits the file with the 'no longer serves it' note",
    Boolean(released) &&
      fallback.json?.mode === 'headless' &&
      fallback.notes.some(note =>
        /^The Obsidian window that served this document no longer serves it/.test(
          note
        )
      ) &&
      fileIds('agent.erd').length === beforeFallback + 1,
    JSON.stringify({ released: Boolean(released), notes: fallback.notes })
  );

  await page.evaluate(() => window.app.plugins.enablePlugin('erd-editor'));
  const back = await waitFor(async () => {
    const lock = readLock(rendererPid);
    return lock?.hub && isSocket(lock.pipe) ? lock : null;
  }, 10_000);
  // The session went to the file; a read finds the window serving it again.
  const backRead = await mcp.call('erd_list', { path: 'agent.erd' });
  const backAdded = await mcp.call('erd_add_table', { path: 'agent.erd' });
  const backShown = await shownInTabs(
    page,
    'agent.erd',
    backAdded.json?.createdIds?.[0],
    5_000
  );
  step(
    'plugin enabled again: the lock is back under the same pid, a read finds the window, the agent edits live',
    back?.pipe === expectedPipe(rendererPid) &&
      backRead.notes.some(note =>
        /^An Obsidian window now serves this document/.test(note)
      ) &&
      backAdded.json?.mode === 'live' &&
      Boolean(backShown),
    JSON.stringify({ readNotes: backRead.notes, write: backAdded.text })
  );

  // A reload within the 2 s autosave of an edit. 1.13 fires no quit on a
  // reload, only pagehide, and 1.12 turns a reload with a quit task queued into
  // a close: the tab writes the edit before either event returns, and queues none.
  await sleep(AUTOSAVE_MS + 500);
  const diskBeforeEdit = tableCount('agent.erd');
  await pressAddTableIn(page, 'agent.erd');
  await sleep(400);
  const diskBeforeReload = tableCount('agent.erd');
  const beforeReload = await page.evaluate(() => {
    window.__smokeMarker = true;
    return window.app.workspace
      .getLeavesOfType('erd-editor')
      .map(leaf => ({
        path: leaf.view.file?.path,
        unsaved: leaf.view.hasUnsavedValue?.(),
        tables: JSON.parse(
          leaf.view.contentEl.querySelector('erd-editor').value
        ).doc.tableIds.length,
      }));
  });
  const tokenBeforeReload = readLock(rendererPid)?.token;
  const eventsBeforeReload = lockEvents.length;
  await detach();
  await rawEval(
    "setTimeout(() => window.app.commands.executeCommandById('app:reload'), 100); 'reloading'"
  );
  await sleep(1_500);
  page = await connect();
  const afterReload = await page.evaluate(() => ({
    pid: process.pid,
    marker: window.__smokeMarker ?? null,
  }));
  const reloadLock = await waitFor(async () => {
    const lock = readLock(rendererPid);
    return lock?.hub && isSocket(lock.pipe) && lock.token !== tokenBeforeReload
      ? lock
      : null;
  }, 15_000);
  const reloadEvents = lockEvents.slice(eventsBeforeReload);
  const editedTab = beforeReload.find(tab => tab.path === 'agent.erd');
  step(
    'app:reload with an unsaved edit in an ERD tab reloads the window, same pid, a fresh page',
    alive() &&
      editedTab?.unsaved === true &&
      afterReload.pid === rendererPid &&
      afterReload.marker === null,
    JSON.stringify({ beforeReload, afterReload })
  );
  const diskAfterReload = tableCount('agent.erd');
  step(
    'a reload before the timed save keeps the edit and stays a reload',
    afterReload.pid === rendererPid &&
      editedTab?.tables === diskBeforeEdit + 1 &&
      diskBeforeReload === diskBeforeEdit &&
      diskAfterReload === editedTab.tables,
    JSON.stringify({ diskBeforeEdit, diskBeforeReload, diskAfterReload })
  );
  step(
    'the reload let the lock go before the new hub wrote its own under the same pid',
    Boolean(reloadLock) && reloadEvents.includes('absent'),
    JSON.stringify(reloadEvents)
  );
  const agentOpen = await tabIds(page, 'agent.erd');
  if (!agentOpen.length) await openDiagram(page, 'agent.erd');
  const reloadAdded = await mcp.call('erd_add_table', { path: 'agent.erd' });
  const reloadShown = await shownInTabs(
    page,
    'agent.erd',
    reloadAdded.json?.createdIds?.[0],
    5_000
  );
  step(
    'the agent reaches the reloaded window and edits live',
    reloadAdded.json?.mode === 'live' && Boolean(reloadShown),
    reloadAdded.text.slice(0, 300)
  );

  // The timed save and the close both write only a value the replica marked
  // changed, so a zoom and a scroll leave view-only.erd's bytes as they were.
  await openDiagram(page, 'view-only.erd');
  await sleep(REPLICA_SETTLE_MS);
  // Zoom in sits right after the zoom readout; its title is in the editor's language.
  const zoomIn = root => root.querySelector('.zoom-level')?.nextElementSibling;
  const zoomed =
    (await clickInEditor(page, 'view-only.erd', zoomIn)) &&
    (await clickInEditor(page, 'view-only.erd', zoomIn));
  const zoomShown = await inEditor(
    page,
    'view-only.erd',
    root => root.querySelector('.zoom-level')?.textContent ?? null
  );
  const viewBox = await page.evaluate(() => {
    const { x, y, width, height } = window.app.workspace
      .getMostRecentLeaf()
      .view.contentEl.querySelector('erd-editor')
      .getBoundingClientRect();
    return { x, y, width, height };
  });
  // Left of the welcome screen's menu, which this empty diagram shows at its
  // centre and which takes the pointer, so the wheel reaches the canvas.
  await page.mouse.move(viewBox.x + 60, viewBox.y + viewBox.height / 2);
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 240);
    await sleep(50);
  }
  await sleep(REPLICA_SETTLE_MS + AUTOSAVE_MS + 500);
  const viewOnlySaved = readFileSync(real('view-only.erd'), 'utf8');
  await closeDiagram(page, 'view-only.erd');
  await sleep(1_000);
  const viewOnlyClosed = readFileSync(real('view-only.erd'), 'utf8');
  step(
    'a zoom and a scroll under the viewport lock leave a file an older release wrote as it was, saved and closed',
    zoomed &&
      Boolean(zoomShown) &&
      zoomShown !== '100%' &&
      viewOnlySaved === VIEW_ONLY &&
      viewOnlyClosed === VIEW_ONLY,
    JSON.stringify({
      zoomed,
      zoomShown,
      saved: viewOnlySaved.slice(0, 120),
      closed: viewOnlyClosed.slice(0, 120),
    })
  );

  step('no page errors', errors.length === 0, errors.join(' | '));

  if (!KEEP) {
    // Quitting does not wait out the 2 s save, and on Windows the page unloads
    // within milliseconds whatever quit tasks hold it: every tab writes the
    // replica's last value inside the quit event. Last, since it ends the app.
    const quitPipe = readLock(rendererPid)?.pipe;
    const quitFiles = ['quit.erd', 'quit-2.erd'];
    for (const path of quitFiles) {
      await page.evaluate(async path => {
        const file = await window.app.vault.create(path, '');
        await window.app.workspace.getLeaf('tab').openFile(file);
      }, path);
    }
    await sleep(1_200);
    // A quit listener added after the plugin's runs after it, still inside
    // the event, and notes what each file holds by then.
    const probe = join(work, 'quit-probe.json');
    await page.evaluate(
      ({ probe, paths }) => {
        const fs = window.require('node:fs');
        const { vault, workspace } = window.app;
        workspace.on('quit', () => {
          const tables = paths.map(path => {
            try {
              const full = vault.adapter.getFullPath(path);
              const text = fs.readFileSync(full, 'utf8');
              return text ? JSON.parse(text).doc.tableIds.length : 0;
            } catch {
              return null;
            }
          });
          fs.appendFileSync(probe, `${JSON.stringify(tables)}\n`);
        });
      },
      { probe, paths: quitFiles }
    );
    const editedAt = Date.now();
    for (const path of quitFiles) await pressAddTableIn(page, path);
    await sleep(400);
    const beforeQuit = await page.evaluate(
      paths =>
        paths.map(path =>
          window.app.workspace
            .getLeavesOfType('erd-editor')
            .some(
              leaf =>
                leaf.view.file?.path === path && leaf.view.hasUnsavedValue()
            )
        ),
      quitFiles
    );
    const diskBeforeQuit = quitFiles.map(tableCount);
    await page.evaluate(() => {
      setTimeout(() => window.require('@electron/remote').app.quit(), 100);
    });
    // Obsidian holds the window with beforeunload while a quit task runs, and
    // a connected Playwright would answer that dialog and throw.
    await detach();
    const closed = await waitFor(vaultWindowGone, 10_000, 100);
    // Gone before either 2 s save could run, the window leaves the quit event
    // as the only way the edits reached the files.
    const closedAfter = Date.now() - editedAt;
    const inQuit = existsSync(probe)
      ? readFileSync(probe, 'utf8')
          .trim()
          .split('\n')
          .map(line => JSON.parse(line))
      : [];
    const afterQuit = quitFiles.map(tableCount);
    step(
      "quitting before the timed save keeps every tab's edit, on disk before the quit event returns",
      Boolean(closed) &&
        closedAfter < 2_000 &&
        beforeQuit.every(Boolean) &&
        diskBeforeQuit.every(tables => tables === 0) &&
        inQuit.length === 1 &&
        inQuit[0].every(tables => tables === 1) &&
        afterQuit.every(tables => tables === 1),
      JSON.stringify({
        closedAfter,
        beforeQuit,
        diskBeforeQuit,
        inQuit,
        afterQuit,
      })
    );
    const gone = await waitFor(
      async () => !existsSync(lockPath(rendererPid)) && pipeGone(quitPipe),
      5_000,
      50
    );
    const quitAt = Date.now();
    const exitedAfter = await Promise.race([
      exited.then(() => Date.now() - quitAt),
      sleep(20_000).then(() => null),
    ]);
    step(
      'quitting removes the lock and the socket',
      Boolean(gone),
      JSON.stringify({ pipe: quitPipe, appExitedAfterMs: exitedAfter })
    );
  }
} catch (error) {
  step('smoke run', false, error.stack);
} finally {
  clearInterval(lockWatch);
  // The server's own log, the one place a crash or a failure it logged shows.
  if (failed && mcp?.stderr.length) {
    console.log(`MCP server stderr:\n${mcp.stderr.join('')}`);
  }
  mcp?.close();
  if (KEEP) {
    await detach();
    console.log(`vault: ${vault}`);
    console.log(`left running on port ${PORT} (pid ${app.pid})`);
    app.unref();
  } else {
    await detach();
    if (alive()) app.kill();
    await Promise.race([exited, sleep(10_000)]);
    // Only this run's window may have left a lock or a socket, and only if it failed.
    const left = existsSync(LOCK_DIR)
      ? readdirSync(LOCK_DIR).filter(
          name => rendererPid && name.startsWith(`${rendererPid}.`)
        )
      : [];
    for (const name of left) rmSync(join(LOCK_DIR, name), { force: true });
    if (left.length) step('nothing left in ~/.erd-editor/ide', false, left.join());
    rmSync(work, { recursive: true, force: true, maxRetries: 40, retryDelay: 250 });
    if (out !== work) console.log(`screenshot: ${join(out, 'smoke.png')}`);
  }
  console.log(`${passed} passed, ${failed ? 'some failed' : 'none failed'}`);
}

process.exit(failed ? 1 : 0);
