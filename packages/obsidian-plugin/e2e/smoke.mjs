// Opens a throwaway vault in a real Obsidian with the built plugin, edits a
// diagram with the keyboard and checks the edit reaches the file on disk.
// The app runs on its own user data directory, so your vaults are untouched.
import { spawn } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { chromium } from '@playwright/test';

const OBSIDIAN =
  process.env.OBSIDIAN_BIN ??
  '/Applications/Obsidian.app/Contents/MacOS/Obsidian';
const PORT = Number(process.env.SMOKE_PORT ?? 9333);
const KEEP = process.env.SMOKE_KEEP === '1';

const root = resolve(import.meta.dirname, '..');
const work = mkdtempSync(join(tmpdir(), 'erd-obsidian-smoke-'));
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
writeFileSync(
  join(userData, 'obsidian.json'),
  JSON.stringify({
    vaults: { a1b2c3d4e5f60718: { path: vault, ts: Date.now(), open: true } },
  })
);

const app = spawn(
  OBSIDIAN,
  [`--user-data-dir=${userData}`, `--remote-debugging-port=${PORT}`],
  { stdio: 'ignore' }
);

const errors = [];
let failed = false;

function step(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
  if (!ok) failed = true;
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

/** Tables in a saved document, v3 or the v2 a .vuerd file holds until its first save. */
function tableCount(path) {
  const text = readFileSync(join(vault, path), 'utf8');
  if (!text) return 0;
  const json = JSON.parse(text);
  return json.doc ? json.doc.tableIds.length : json.table.tables.length;
}

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

async function pressAddTable(page) {
  await page.evaluate(() =>
    window.app.workspace
      .getMostRecentLeaf()
      ?.view.contentEl.querySelector('erd-editor')
      ?.focus()
  );
  await page.keyboard.press('Alt+KeyN');
}

/** Adds a table with the editor's own shortcut and waits for the save. */
async function addTableAndWaitForSave(page, path) {
  const before = tableCount(path);
  await sleep(1_000);
  await pressAddTable(page);
  return waitFor(async () => tableCount(path) === before + 1, 15_000, 500);
}

try {
  const cdp = await waitFor(
    () => fetch(`http://127.0.0.1:${PORT}/json/version`).then(r => r.ok),
    20_000
  );
  if (!cdp) throw new Error('Obsidian did not open its debugging port');

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  const page = await waitFor(async () => {
    const pages = browser.contexts().flatMap(context => context.pages());
    return pages.find(p => p.url().startsWith('app://obsidian.md/index.html'));
  }, 20_000);
  if (!page) throw new Error('the vault window never opened');

  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  const ready = await waitFor(
    () => page.evaluate(() => window.app?.workspace?.layoutReady === true),
    20_000
  );
  step('vault opened', Boolean(ready));

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

  await openDiagram(page, 'schema.erd');
  const beforeQuickClose = tableCount('schema.erd');
  await sleep(1_000);
  await pressAddTable(page);
  await closeDiagram(page, 'schema.erd');
  step(
    'an edit made just before closing is saved',
    Boolean(
      await waitFor(
        async () => tableCount('schema.erd') === beforeQuickClose + 1,
        5_000
      )
    )
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
  console.log(`screenshot: ${join(out, 'smoke.png')}`);

  const workerTargets = await page
    .context()
    .newCDPSession(page)
    .then(session => session.send('Target.getTargets'))
    .then(({ targetInfos }) =>
      targetInfos.filter(t => t.type.includes('worker')).map(t => t.type)
    )
    .catch(() => []);
  console.log(`worker targets: ${JSON.stringify(workerTargets)}`);

  step('no page errors', errors.length === 0, errors.join(' | '));
  if (!KEEP) await browser.close();
} catch (error) {
  step('smoke run', false, error.message);
} finally {
  console.log(`vault: ${vault}`);
  if (KEEP) {
    console.log(`left running on port ${PORT} (pid ${app.pid})`);
    app.unref();
  } else {
    app.kill();
  }
}

process.exit(failed ? 1 : 0);
