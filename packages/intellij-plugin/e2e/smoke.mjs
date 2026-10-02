// Runs the IDE with the built plugin through runIdeSmoke on a throwaway sandbox
// and project, and drives its coding-agent hub with the real MCP server, a
// hand-written peer, the editor pages over CDP and, in Phase B, the robot.
import { execFileSync, spawn } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { startMcp } from './mcp.mjs';
import { mentions, Peer, tableBatch } from './peer.mjs';
import { connectRobot } from './robot.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const MCP_BIN = resolve(ROOT, '..', 'mcp-server', 'dist', 'erd-editor-mcp.js');
// The two-table v2 document the Obsidian smoke opens, the format .vuerd files were saved in.
const LEGACY_FIXTURE = resolve(
  ROOT,
  '..',
  'obsidian-plugin',
  'e2e',
  'fixtures',
  'legacy.vuerd.json'
);
const LOCK_DIR = join(homedir(), '.erd-editor', 'ide');
const WORK_PREFIX = 'erd-intellij-smoke-';
const PAGE_URL = 'https://erd-editor-jetbrains-plugin/index.html';
const HUB_THREAD_PREFIX = 'erd-editor-hub';

// SMOKE_PHASE is A, B or all; SMOKE_ONLY names the steps to run, such as A11,B7; SMOKE_KEEP=1
// leaves the IDE running; SMOKE_SIGTERM=1 ends A14 by SIGTERM; SMOKE_PLATFORM names another IDE.
const PHASE = process.env.SMOKE_PHASE ?? 'all';
const KEEP = process.env.SMOKE_KEEP === '1';
const SIGTERM = process.env.SMOKE_SIGTERM === '1';
const CDP_PORT = Number(process.env.SMOKE_CDP_PORT ?? 9334);
const ROBOT_PORT = Number(process.env.SMOKE_ROBOT_PORT ?? 8082);
const PLATFORM = process.env.SMOKE_PLATFORM;
// A build without the hub writes no lock, so only B7's loader verdict means anything there.
const NO_HUB = process.env.SMOKE_NO_HUB === '1';
const ONLY = (process.env.SMOKE_ONLY ?? (NO_HUB ? 'B7' : ''))
  .split(',')
  .map(name => name.trim())
  .filter(Boolean);

// What a fresh 2026.1 sandbox stops at, found by launching one and listing its windows through
// the robot: Confirm Exit on a graceful quit, the Islands onboarding dialog a moment after the
// project opens, and the This Window or New Window question B3's second project asks.
const SEEDS = {
  'options/ide.general.xml': `<application>
  <component name="GeneralSettings">
    <option name="confirmExit" value="false" />
    <option name="confirmOpenNewProject2" value="0" />
  </component>
  <component name="Registry">
    <entry key="ide.experimental.ui.onboarding" value="false" />
  </component>
</application>
`,
};

// The replica answers 200 ms after the last change; this leaves it room.
const REPLICA_SETTLE_MS = 600;
const CLOSED_NOTE = /was closed after this agent's last edit/;
const RESEED_NOTE = /joined again from the editor/;
const FELL_BACK_NOTE =
  /^The JetBrains IDE that served this document no longer serves it, so this call edited the file on disk instead/;
const ENABLE_HUB =
  'Turn on Coding agents under Settings | Tools | ERD Editor in that IDE, or restart that IDE if it is on, then call again.';
const OTHER_HOSTS = /VS Code|dineug\.erd-editor\.agentHub|Trust the workspace|Obsidian/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// What DynamicPlugins logs when it unloads a plugin, refuses to, or gives up on it.
const UNLOAD_REPORT =
  /is not unload-safe|classloader unload checked=|restart required|requir(es|ing) restart|Not allowing load\/unload/;

const pluginVersion = readFileSync(join(ROOT, 'gradle.properties'), 'utf8').match(
  /^pluginVersion\s*=\s*(\S+)/m
)?.[1];

let failed = false;
let passed = 0;
const manual = [];
// Named in each page error, which the run only reports at its end.
let lastStep = 'start';
const errors = [];

function step(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
  lastStep = name;
  if (ok) passed++;
  else failed = true;
}

/** A value the run records for the report, neither passed nor failed. */
function info(name, detail) {
  console.log(`INFO ${name} - ${detail}`);
}

function manualStep(name, todo) {
  console.log(`MANUAL ${name}: ${todo}`);
  manual.push(name);
  failed = true;
}

const selected = id => !ONLY.length || ONLY.includes(id);
const inPhase = phase => PHASE === 'all' || PHASE === phase;
const runsPhase = phase =>
  inPhase(phase) &&
  (!ONLY.length || ONLY.some(id => id.startsWith(phase)));

async function waitFor(check, timeout, interval = 250) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await Promise.resolve()
      .then(check)
      .catch(() => null);
    if (value) return value;
    if (Date.now() >= deadline) return null;
    await sleep(interval);
  }
}

// ---- The work dir: a project, a second one, the sandbox, the fixtures ----

/** Work dirs earlier runs left, except one a running process still names. */
function removeEarlierRuns() {
  const commands = execFileSync('ps', ['-Aww', '-o', 'args='], {
    encoding: 'utf8',
  });
  for (const name of readdirSync(tmpdir())) {
    if (!name.startsWith(WORK_PREFIX)) continue;
    const dir = join(tmpdir(), name);
    let real = dir;
    try {
      real = realpathSync.native(dir);
    } catch {
      // Gone already.
    }
    if (commands.includes(real) || commands.includes(dir)) continue;
    rmSync(dir, { recursive: true, force: true });
  }
}

removeEarlierRuns();
// Real paths throughout, so the project the IDE opens and the paths the hub lists agree.
const work = realpathSync.native(mkdtempSync(join(tmpdir(), WORK_PREFIX)));
const project = join(work, 'project');
const project2 = join(work, 'project2');
const sandbox = join(work, 'sandbox');
const gradleLog = join(work, 'gradle.log');
const ideaLog = join(sandbox, 'log_runIdeSmoke', 'idea.log');
const at = path => join(project, path);

mkdirSync(join(project, 'sub'), { recursive: true });
mkdirSync(project2, { recursive: true });
mkdirSync(join(work, 'outside'), { recursive: true });
for (const name of [
  'agent.erd',
  'closed.erd',
  'background.erd',
  'split.erd',
  'readonly.erd',
  'Upper.ERD',
  join('sub', 'moved.erd'),
]) {
  writeFileSync(at(name), '');
}
cpSync(LEGACY_FIXTURE, at('legacy.vuerd.json'));
// Both save switches off and no origin, as releases before the origin wrote it:
// the bytes are not the replica's, and a zoom or a scroll must not rewrite them.
const VIEW_ONLY = JSON.stringify({
  version: '3.0.0',
  settings: { ignoreSaveSettings: 3, zoomLevel: 1 },
  doc: { tableIds: [], relationshipIds: [], indexIds: [], memoIds: [] },
  collections: {},
});
writeFileSync(at('view-only.erd'), VIEW_ONLY);
writeFileSync(at('broken.erd'), '{"doc": <<<<<<< HEAD');
writeFileSync(at('notes.md'), '# notes');
writeFileSync(join(work, 'outside', 'planted.erd'), '');
symlinkSync(join(work, 'outside', 'planted.erd'), at('escape.erd'));
for (const name of ['x.erd', 'y.erd']) writeFileSync(join(project2, name), '');
for (const [file, text] of Object.entries(SEEDS)) {
  const path = join(sandbox, 'config_runIdeSmoke', file);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, text);
}

/** Every ERD file the hub lists for the project, by real path; notes.md is none. */
const LISTED = [
  'agent.erd',
  'closed.erd',
  'background.erd',
  'split.erd',
  'readonly.erd',
  'Upper.ERD',
  join('sub', 'moved.erd'),
  'legacy.vuerd.json',
  'view-only.erd',
  'broken.erd',
]
  .map(at)
  .concat(join(work, 'outside', 'planted.erd'));

// ---- The lock, the socket and the IDE process ----

const lockPath = pid => join(LOCK_DIR, `${pid}.json`);

function readLock(pid) {
  try {
    return JSON.parse(readFileSync(lockPath(pid), 'utf8'));
  } catch {
    return null;
  }
}

const lockNames = () =>
  new Set(existsSync(LOCK_DIR) ? readdirSync(LOCK_DIR) : []);

function isSocket(path) {
  try {
    return statSync(path).isSocket();
  } catch {
    return false;
  }
}

const mode = path => (statSync(path).mode & 0o777).toString(8);
const sameSet = (a, b) =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function argsOf(pid) {
  try {
    return execFileSync('ps', ['-ww', '-o', 'args=', '-p', String(pid)], {
      encoding: 'utf8',
    });
  } catch {
    return '';
  }
}

// The IDE is a child of the Gradle daemon, not of the gradlew this spawns, so it is
// found by the config dir runIdeSmoke passes it, which only this run's sandbox holds.
const CONFIG_ARG = `-Didea.config.path=${join(sandbox, 'config_runIdeSmoke')}`;

function findIdePid() {
  const lines = execFileSync('ps', ['-Aww', '-o', 'pid=,args='], {
    encoding: 'utf8',
  }).split('\n');
  for (const line of lines) {
    const match = line.trim().match(/^(\d+)\s+(.*)$/);
    if (match?.[2].includes(CONFIG_ARG)) return Number(match[1]);
  }
  return null;
}

/** The pids of every process whose command line names this run's work dir. */
function stillRunning() {
  return execFileSync('ps', ['-Aww', '-o', 'pid=,args='], { encoding: 'utf8' })
    .split('\n')
    .filter(line => line.includes(work))
    .map(line => line.trim().split(/\s+/)[0]);
}

let gradle = null;
let ide = null;
const pids = new Set();

function launch() {
  const args = [
    'runIdeSmoke',
    `-PsmokeProject=${project}`,
    `-PsmokeSandbox=${sandbox}`,
    `-PsmokeCdpPort=${CDP_PORT}`,
    `-PsmokeRobotPort=${ROBOT_PORT}`,
    ...(PLATFORM ? [`-PsmokePlatformVersion=${PLATFORM}`] : []),
    '--console=plain',
  ];
  const log = openSync(gradleLog, 'a');
  gradle = spawn('./gradlew', args, { cwd: ROOT, stdio: ['ignore', log, log] });
}

const gradleRunning = () =>
  gradle && gradle.exitCode === null && gradle.signalCode === null;

/** Launches the IDE and waits for its process and, with the hub, its lock. */
async function startIde() {
  const before = lockNames();
  launch();
  const started = Date.now();
  // Minus one ends the wait at once: gradle stopped before the IDE started.
  const pid = await waitFor(
    () => findIdePid() ?? (gradleRunning() ? null : -1),
    180_000
  );
  if (!pid || pid === -1) {
    const tail = existsSync(gradleLog)
      ? readFileSync(gradleLog, 'utf8').split('\n').slice(-30).join('\n')
      : '';
    throw new Error(`the IDE did not start within 180 s (${gradleLog}):\n${tail}`);
  }
  pids.add(pid);
  let lock = null;
  if (!NO_HUB) {
    lock = await waitFor(() => {
      if (!alive(pid)) return -1;
      const found = readLock(pid);
      return !before.has(`${pid}.json`) &&
        found?.ide === 'intellij' &&
        found.workspaceFolders?.includes(project) &&
        argsOf(pid).includes(sandbox)
        ? found
        : null;
    }, 180_000 - (Date.now() - started));
    if (!lock || lock === -1) {
      throw new Error(
        `pid ${pid} wrote no lock naming ${project} within 180 s (${ideaLog})`
      );
    }
  }
  ide = { pid, lock };
  console.log(`IDE pid ${pid}${lock ? `, lock ${lockPath(pid)}` : ''}`);
  return ide;
}

const ideLock = () => readLock(ide.pid);

/**
 * Quits the IDE as the user does, or by SIGTERM, which runs only the shutdown
 * hook; a dialog the seeds missed holds a graceful quit, which the robot then forces.
 */
async function quitIde(name, signal) {
  const { pid } = ide;
  const pipe = readLock(pid)?.pipe;
  const quitAt = Date.now();
  if (signal) {
    process.kill(pid, 'SIGTERM');
  } else {
    try {
      execFileSync('osascript', [
        '-l',
        'JavaScript',
        '-e',
        `ObjC.import("AppKit"); $.NSRunningApplication.runningApplicationWithProcessIdentifier(${pid}).terminate`,
      ]);
    } catch (error) {
      console.log(`osascript could not ask pid ${pid} to quit: ${error.message}`);
    }
  }
  // Exiting stops serving as it starts: the socket goes and the lock turns hub false, which keeps
  // the open editors guarded until the service's dispose deletes it. The IDE may put the exit off
  // first (2025.2 waits for indexing to end), so the bound is the exit's, not a few seconds.
  let sawHubOff = false;
  const released = await waitFor(
    () => {
      const lock = readLock(pid);
      if (lock?.hub === false) sawHubOff = true;
      return (!lock || lock.hub === false) && !(pipe && existsSync(pipe))
        ? Date.now() - quitAt
        : null;
    },
    30_000,
    50
  );
  const exited = await waitFor(
    () => (alive(pid) ? null : Date.now() - quitAt),
    30_000
  );
  const removed = !existsSync(lockPath(pid));
  if (!exited) {
    step(name, false, 'still running');
    await connectRobot(ROBOT_PORT)
      .exit()
      .catch(() => undefined);
    await waitFor(() => !alive(pid), 30_000);
  }
  await waitFor(() => !gradleRunning(), 30_000);
  return { released, sawHubOff, exited, removed };
}

// ---- The editor pages, over the DevTools protocol of JCEF ----

const sessions = new Map();
const pageOf = new Map();

async function cdpTargets() {
  try {
    const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`, {
      signal: AbortSignal.timeout(3_000),
    });
    return await response.json();
  } catch {
    return [];
  }
}

function pageEvent({ method, params }) {
  if (method === 'Runtime.exceptionThrown') {
    const details = params.exceptionDetails;
    errors.push(
      `exception: ${details.exception?.description ?? details.text} (after: ${lastStep})`
    );
  }
  if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
    const text = params.args.map(arg => arg.value ?? arg.description).join(' ');
    errors.push(`console: ${text} (after: ${lastStep})`);
  }
}

/** A DevTools session on one page, collecting its errors from the moment it attaches. */
async function attach(target) {
  const existing = sessions.get(target.id);
  if (existing) return existing;
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  const pending = new Map();
  let nextId = 1;
  const session = {
    id: target.id,
    send(method, params = {}) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise(resolve => {
        pending.set(id, resolve);
        setTimeout(() => {
          if (pending.delete(id)) {
            resolve({ error: { message: `${method} timed out` } });
          }
        }, 15_000);
      });
    },
    async evaluate(expression) {
      const reply = await session.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (reply.error) throw new Error(reply.error.message);
      const { result, exceptionDetails } = reply.result;
      if (exceptionDetails) {
        throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      }
      return result.value;
    },
    close() {
      socket.close();
    },
  };
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id === undefined) return pageEvent(message);
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  };
  socket.onclose = () => sessions.delete(target.id);
  sessions.set(target.id, session);
  await session.send('Runtime.enable');
  return session;
}

/** The ERD editor pages, each attached; other JCEF browsers of the IDE are left out. */
async function erdPages() {
  const pages = (await cdpTargets()).filter(
    target => target.type === 'page' && target.url.startsWith(PAGE_URL)
  );
  for (const page of pages) await attach(page).catch(() => undefined);
  return pages;
}

const pageIds = async () => new Set((await erdPages()).map(page => page.id));

const MOUNTED = `Boolean(document.querySelector('erd-editor')?.isConnected)`;

/**
 * Waits for count pages that were not there before, each showing its editor:
 * the page mounts it only once the host sends the initial value.
 */
function newPages(before, timeout, count = 1) {
  return waitFor(async () => {
    const fresh = (await erdPages()).filter(page => !before.has(page.id));
    if (fresh.length < count) return null;
    const mounted = await Promise.all(
      fresh.map(page =>
        (sessions.get(page.id)?.evaluate(MOUNTED) ?? Promise.resolve(false)).catch(
          () => false
        )
      )
    );
    return mounted.every(Boolean) ? fresh : null;
  }, timeout);
}

const pageFor = file => sessions.get(pageOf.get(file)) ?? null;

const IDS = `(() => {
  const editor = document.querySelector('erd-editor');
  if (!editor) return null;
  try { return JSON.parse(editor.value).doc.tableIds; } catch { return null; }
})()`;

async function idsIn(session) {
  try {
    return await session.evaluate(IDS);
  } catch {
    return null;
  }
}

/** Waits until every page shows the table, at least one page there. */
const shownIn = (pages, id, timeout = 3_000) =>
  waitFor(
    async () => {
      if (!pages.length || !id) return false;
      const shown = await Promise.all(pages.map(idsIn));
      return shown.every(ids => ids?.includes(id));
    },
    timeout,
    50
  );

/** Alt+N in the page, sent to its renderer, which adds a table as a user does. */
async function pressAddTable(session) {
  await session.evaluate(`document.querySelector('erd-editor').focus()`);
  for (const type of ['rawKeyDown', 'keyUp']) {
    await session.send('Input.dispatchKeyEvent', {
      type,
      modifiers: 1,
      key: 'n',
      code: 'KeyN',
      windowsVirtualKeyCode: 78,
      nativeVirtualKeyCode: 78,
    });
  }
}

/** A user edit in the page: the new table id, once the page shows it. */
async function userEdit(session) {
  const before = (await idsIn(session)) ?? [];
  await pressAddTable(session);
  const after = await waitFor(async () => {
    const ids = await idsIn(session);
    return ids?.length === before.length + 1 ? ids : null;
  }, 3_000);
  return after?.find(id => !before.includes(id)) ?? null;
}

function findNode(node, match) {
  if (match(node)) return node;
  for (const child of [...(node.children ?? []), ...(node.shadowRoots ?? [])]) {
    const found = findNode(child, match);
    if (found) return found;
  }
  return null;
}

/** The zoom the page's editor shows, read through its closed shadow root, which only DevTools reaches. */
async function zoomReadout(session) {
  const reply = await session.send('DOM.getDocument', { depth: -1, pierce: true });
  const root = reply.result?.root;
  const readout =
    root &&
    findNode(root, node => {
      const at = node.attributes?.indexOf('class') ?? -1;
      return at !== -1 && node.attributes[at + 1].split(' ').includes('zoom-level');
    });
  return readout?.children?.find(child => child.nodeType === 3)?.nodeValue ?? null;
}

/** Wheels over the middle of the page's editor; modifiers 2 holds Ctrl, which zooms. */
async function wheel(session, deltaY, modifiers = 0) {
  const { x, y } = await session.evaluate(`(() => {
    const { x, y, width, height } = document.querySelector('erd-editor').getBoundingClientRect();
    return { x: x + width / 2, y: y + height / 2 };
  })()`);
  for (const type of ['mouseMoved', 'mouseWheel']) {
    await session.send('Input.dispatchMouseEvent', { type, x, y, deltaX: 0, deltaY, modifiers });
  }
}

/** The table ids of a v3 document on disk. */
function fileIds(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8')).doc?.tableIds ?? [];
  } catch {
    return [];
  }
}

// ---- The agent, and the peers ----

let mcp = null;
const peers = [];

async function joinPeer(path, client) {
  const peer = await Peer.join(ideLock(), client);
  peers.push(peer);
  const joined = await peer.call('join', { path });
  return { peer, joined };
}

/** Opens the file through the agent and keeps the page that opened for it. */
async function openThroughAgent(file) {
  const before = await pageIds();
  const opened = await mcp.call('erd_open_document', { path: file });
  const fresh = opened.json?.opened ? await newPages(before, 5_000) : null;
  if (fresh?.length) pageOf.set(file, fresh[0].id);
  return { opened, fresh: fresh ?? [], page: pageFor(file) };
}

/** Polls erd_list until its text holds needle, for an edit relayed to the agent. */
function agentSees(file, needle, timeout = 3_000) {
  return waitFor(
    async () => {
      const listed = await mcp.call('erd_list', { path: file });
      return listed.text.includes(needle) ? listed : null;
    },
    timeout,
    250
  );
}

const logSize = () => (existsSync(ideaLog) ? statSync(ideaLog).size : 0);

const logSince = offset =>
  existsSync(ideaLog) ? readFileSync(ideaLog, 'utf8').slice(offset) : '';

// ---- Steps ----

async function run(id, title, body) {
  if (!selected(id)) return;
  const name = `${id} ${title}`;
  lastStep = name;
  try {
    await body(name);
  } catch (error) {
    step(name, false, error.stack);
  }
}

let robot = null;
let robotReady = false;

/** A step that needs the robot; one it cannot run is left to a person. */
async function robotStep(id, title, todo, body) {
  if (!selected(id)) return;
  const name = `${id} ${title}`;
  if (!robotReady) return manualStep(name, todo);
  lastStep = name;
  try {
    await body(name);
  } catch (error) {
    if (/^robot |fetch failed|aborted|timeout/i.test(error.message)) {
      manualStep(name, `${todo} (the robot failed: ${error.message.split('\n')[0]})`);
    } else {
      step(name, false, error.stack);
    }
  }
}

const real = {
  agent: at('agent.erd'),
  viewOnly: at('view-only.erd'),
  closed: at('closed.erd'),
  readonly: at('readonly.erd'),
  moved: at(join('sub', 'moved.erd')),
  moved2: at(join('sub2', 'moved.erd')),
  split: at('split.erd'),
  x: join(project2, 'x.erd'),
  y: join(project2, 'y.erd'),
};

async function phaseA() {
  const { pid, lock } = await startIde();

  await run('A1', 'lock: ide intellij, hub on, protocol 1, the plugin version, a UUID token', name =>
    step(
      name,
      lock.ide === 'intellij' &&
        lock.hub === true &&
        lock.protocolVersion === 1 &&
        lock.version === pluginVersion &&
        UUID.test(lock.token),
      JSON.stringify({ ...lock, token: `${lock.token.slice(0, 8)}...` })
    )
  );

  await run('A2', 'lock: a live socket beside it, a 0600 file in a 0700 folder', name =>
    step(
      name,
      lock.pipe === join(LOCK_DIR, `${pid}.sock`) &&
        isSocket(lock.pipe) &&
        mode(lockPath(pid)) === '600' &&
        mode(LOCK_DIR) === '700',
      `${lock.pipe} ${mode(lockPath(pid))} ${mode(LOCK_DIR)}`
    )
  );

  await run('A3', 'lock: written at startup with no ERD editor open, the project folder by real path', name =>
    step(
      name,
      Array.isArray(lock.documents) &&
        lock.documents.length === 0 &&
        sameSet(lock.workspaceFolders, [project]),
      JSON.stringify({ documents: lock.documents, workspaceFolders: lock.workspaceFolders })
    )
  );

  await run('A4', 'erd_list_documents: live, every ERD file once by real path, none open, no editor opened', async name => {
    const before = [...(await pageIds())];
    const list = await mcp.call('erd_list_documents', {});
    const documents = list.json?.documents ?? [];
    const paths = documents.map(document => document.path);
    // JCEF's DevTools port may open only with the first browser, so both page reads can be empty
    // whatever the listing did: the lock, which lists each ERD file an editor shows, stays empty.
    await sleep(1_000);
    const after = [...(await pageIds())];
    const opened = ideLock()?.documents;
    step(
      name,
      list.json?.mode === 'live' &&
        paths.length === new Set(paths).size &&
        sameSet(paths, LISTED) &&
        documents.every(document => !document.open) &&
        sameSet(after, before) &&
        Array.isArray(opened) &&
        opened.length === 0,
      `${list.ms} ms, lock documents ${JSON.stringify(opened)}: ${list.text.slice(0, 400)}`
    );
    info('A4 listing time', `${list.ms} ms for ${documents.length} documents`);
  });

  await run('A5', 'erd_open_document opens agent.erd in the background once its editor is ready', async name => {
    const { opened, fresh, page } = await openThroughAgent('agent.erd');
    const listed = await waitFor(
      () => ideLock()?.documents?.includes(real.agent),
      5_000
    );
    const focus = page ? await page.evaluate('document.hasFocus()') : null;
    const next = await mcp.call('erd_list_documents', {});
    const entry = (next.json?.documents ?? []).find(
      document => document.path === real.agent
    );
    const again = await mcp.call('erd_open_document', { path: 'agent.erd' });
    step(
      name,
      opened.json?.opened === true &&
        fresh.length === 1 &&
        Boolean(listed) &&
        focus === false &&
        entry?.open === true &&
        entry.active === false &&
        again.json?.opened === false &&
        again.ms < 1_000,
      JSON.stringify({
        opened: opened.text.slice(0, 200),
        pages: fresh.length,
        listed: Boolean(listed),
        hasFocus: focus,
        entry,
        again: again.json,
        againMs: again.ms,
      })
    );
  });

  let tableId = null;
  let written = null;
  await run('A6', 'erd_add_table shows live in the editor page', async name => {
    const page = pageFor('agent.erd') ?? (await openThroughAgent('agent.erd')).page;
    const added = await mcp.call('erd_add_table', { path: 'agent.erd' });
    const answeredAt = Date.now();
    tableId = added.json?.createdIds?.[0] ?? null;
    written = waitFor(
      () => (fileIds(real.agent).includes(tableId) ? Date.now() - answeredAt : null),
      5_000,
      25
    );
    const shown = page ? await shownIn([page], tableId) : null;
    step(name, added.json?.mode === 'live' && Boolean(shown), added.text.slice(0, 200));
  });

  await run('A7', 'IntelliJ writes an agent edit to the file within 1.5 s without erd_save', async name => {
    if (!written) {
      const added = await mcp.call('erd_add_table', { path: 'agent.erd' });
      const answeredAt = Date.now();
      tableId = added.json?.createdIds?.[0] ?? null;
      written = waitFor(
        () => (fileIds(real.agent).includes(tableId) ? Date.now() - answeredAt : null),
        5_000,
        25
      );
    }
    const after = await written;
    step(name, after !== null && after <= 1_500, `written ${after} ms after erd_add_table answered`);
  });

  await run('A8', 'erd_save answers saved in under 2 s and the file holds the edit', async name => {
    const saved = await mcp.call('erd_save', { path: 'agent.erd' });
    step(
      name,
      saved.json?.saved === true &&
        saved.ms < 2_000 &&
        (!tableId || fileIds(real.agent).includes(tableId)),
      `${saved.ms} ms: ${saved.text.slice(0, 200)}`
    );
  });

  await run('A9', 'a user edit in the editor page reaches the agent', async name => {
    const page = pageFor('agent.erd') ?? (await openThroughAgent('agent.erd')).page;
    const userId = page ? await userEdit(page) : null;
    const listed = userId ? await agentSees('agent.erd', userId) : null;
    step(name, Boolean(userId && listed), JSON.stringify({ userId, notes: listed?.notes }));
  });

  let peer = null;
  await run('A10', 'two peers: an agent edit reaches the other peer once, its batch reaches the agent and never comes back', async name => {
    if (!pageFor('agent.erd')) await openThroughAgent('agent.erd');
    const { peer: joinedPeer, joined } = await joinPeer(real.agent, 'erd-intellij-smoke-a10');
    peer = joinedPeer;
    await sleep(100);
    const added = await mcp.call('erd_add_table', { path: 'agent.erd' });
    const agentId = added.json?.createdIds?.[0];
    await peer.waitFor(p => mentions(p.actionBatches(real.agent), agentId), 3_000);
    // Well past the replica round trip: an echo would have arrived by now.
    await sleep(1_000);
    const agentBatches = peer
      .actionBatches(real.agent)
      .filter(batch => mentions([batch], agentId)).length;
    const peerId = `smoke${Date.now()}`;
    await peer.call('applyActions', {
      path: real.agent,
      actions: tableBatch(peerId, joined.snapshotVersion + 1),
    });
    const reached = await agentSees('agent.erd', peerId, 5_000);
    await sleep(1_000);
    const echoed = mentions(peer.actionBatches(real.agent), peerId);
    step(
      name,
      added.json?.mode === 'live' &&
        Boolean(agentId) &&
        agentBatches === 1 &&
        Boolean(reached) &&
        !echoed,
      JSON.stringify({
        agentEdit: added.json?.mode ?? added.text.slice(0, 200),
        agentBatches,
        reached: Boolean(reached),
        echoed,
      })
    );
  });

  await run('A11', 'K-13: 1,000 queries a page sends reach a peer in the order it sent them', async name => {
    const page = pageFor('agent.erd') ?? (await openThroughAgent('agent.erd')).page;
    if (!peer) peer = (await joinPeer(real.agent, 'erd-intellij-smoke-a11')).peer;
    const seqs = () =>
      peer
        .actionBatches(real.agent)
        .flat()
        .filter(
          action =>
            action.type === 'editor.sharedFocusTracker' &&
            typeof action.payload?.seq === 'number'
        )
        .map(action => action.payload.seq);
    const sentAt = Date.now();
    await page.evaluate(`(() => {
      for (let i = 0; i < 1000; i++) {
        window.cefQuery({
          request: JSON.stringify({
            type: 'hostSaveReplicationCommand',
            payload: { actions: [{ type: 'editor.sharedFocusTracker', payload: { seq: i }, tags: 1 }] },
          }),
          persistent: false,
          onSuccess() {},
          onFailure() {},
        });
      }
      return true;
    })()`);
    await waitFor(() => seqs().length >= 1_000, 10_000, 50);
    const got = seqs();
    const outOfOrder = got.findIndex((seq, index) => seq !== index);
    step(
      name,
      got.length === 1_000 && outOfOrder === -1,
      `${got.length} received in ${Date.now() - sentAt} ms, first out of order at ${outOfOrder}`
    );
    if (outOfOrder !== -1 || got.length !== 1_000) {
      info('A11', 'a failure here starts contingency X1 (sequence-stamped bridge commands)');
    }
  });

  await run('A12', 'erd_open_document opens Upper.ERD in the ERD editor', async name => {
    const { opened, fresh } = await openThroughAgent('Upper.ERD');
    step(name, opened.json?.opened === true && fresh.length === 1, opened.text.slice(0, 200));
  });

  await run('A15', 'a zoom and a scroll with both save switches off leave a file an older release wrote as it was', async name => {
    const { page } = await openThroughAgent('view-only.erd');
    await sleep(REPLICA_SETTLE_MS);
    const before = page ? await zoomReadout(page) : null;
    if (page) {
      await wheel(page, 240);
      await wheel(page, 240);
      await wheel(page, -240, 2);
    }
    const after = page
      ? await waitFor(async () => {
          const shown = await zoomReadout(page);
          return shown && shown !== before ? shown : null;
        }, 3_000)
      : null;
    // The replica's 200 ms, the autosave's 100 ms debounce and room for the write.
    await sleep(REPLICA_SETTLE_MS + 1_000);
    const onDisk = readFileSync(real.viewOnly, 'utf8');
    step(
      name,
      Boolean(page) && Boolean(after) && onDisk === VIEW_ONLY,
      JSON.stringify({ zoom: [before, after], onDisk: onDisk.slice(0, 120) })
    );
  });

  await run('A13', 'no page errors, no request failed in idea.log', async name => {
    const log = logSince(0);
    const pageLines = log.split('\n').filter(line => /\[LOGSEVERITY_(ERROR|FATAL)\]/.test(line));
    const failedLines = log
      .split('\n')
      .filter(line => line.includes('[erd-editor hub] request failed'));
    step(
      name,
      errors.length === 0 && pageLines.length === 0 && failedLines.length === 0,
      [...errors, ...pageLines, ...failedLines].join(' | ').slice(0, 1_500)
    );
  });

  for (const each of peers.splice(0)) each.close();

  // Phase B relaunches the same sandbox, so Phase A ends with the quit unless the IDE stays.
  if (runsPhase('B') || !KEEP) {
    const title = SIGTERM
      ? 'SIGTERM removes the lock and the socket (the shutdown hook)'
      : 'quitting turns the lock hub false as the exit starts and removes it by exit';
    const name = `A14 ${title}`;
    const quit = await quitIde(name, SIGTERM);
    if (selected('A14') && quit.exited) {
      step(
        name,
        Boolean(quit.released) && (SIGTERM || quit.sawHubOff) && quit.removed,
        JSON.stringify(quit)
      );
    }
    // An editor flushes its pending save as it closes, and a save that changed nothing is none.
    if (selected('A15') && quit.exited) {
      const onDisk = readFileSync(real.viewOnly, 'utf8');
      step('A15 the quit leaves view-only.erd as it was too', onDisk === VIEW_ONLY, onDisk.slice(0, 120));
    }
  }
}

async function phaseB() {
  if (!ide || !alive(ide.pid)) await startIde();
  robot = connectRobot(ROBOT_PORT);
  robotReady = await robot.waitReady(60_000);
  // Every page this phase maps to a file is one it opened itself.
  if (robotReady) await robot.closeAllEditors().catch(() => undefined);
  if (NO_HUB) return phaseBWithoutHub();

  await robotStep(
    'B1',
    'closing the last tab: the lock drops it, a read carries the closed note, a write reseeds and reopens it live',
    'close the agent.erd tab, then erd_list and erd_add_table agent.erd',
    async name => {
      await openThroughAgent('agent.erd');
      const added = await mcp.call('erd_add_table', { path: 'agent.erd' });
      await sleep(REPLICA_SETTLE_MS);
      const closedTabs = await robot.closeFile(real.agent);
      const unlisted = await waitFor(
        () => !ideLock()?.documents?.includes(real.agent),
        5_000
      );
      await sleep(500);
      const read = await mcp.call('erd_list', { path: 'agent.erd' });
      const before = await pageIds();
      const reseeded = await mcp.call('erd_add_table', { path: 'agent.erd' });
      const reseededId = reseeded.json?.createdIds?.[0];
      const fresh = (await newPages(before, 5_000)) ?? [];
      if (fresh.length) pageOf.set('agent.erd', fresh[0].id);
      const shown = await shownIn(fresh.map(page => sessions.get(page.id)).filter(Boolean), reseededId, 5_000);
      step(
        name,
        added.json?.mode === 'live' &&
          closedTabs > 0 &&
          Boolean(unlisted) &&
          read.notes.some(note => CLOSED_NOTE.test(note)) &&
          reseeded.json?.mode === 'live' &&
          // The read joins again first, so the reseed note lands on whichever call did it.
          [...read.notes, ...reseeded.notes].some(note => RESEED_NOTE.test(note)) &&
          Boolean(shown),
        JSON.stringify({
          closedTabs,
          unlisted: Boolean(unlisted),
          readNotes: read.notes,
          writeNotes: reseeded.notes,
          reopened: fresh.length,
        })
      );
    }
  );

  await robotStep(
    'B2',
    'Coding agents off: a hub-off lock, the socket gone, a write refused naming the JetBrains IDE and its setting',
    'untick Settings | Tools | ERD Editor | Coding agents, then erd_add_table agent.erd; tick it again',
    async name => {
      await openThroughAgent('agent.erd');
      const before = ideLock();
      await robot.setCodingAgents(false);
      const off = await waitFor(() => {
        const lock = ideLock();
        return lock?.hub === false ? lock : null;
      }, 5_000);
      // The lock turns hub false first and the pipe closes after it, as in every host.
      const socketGone = await waitFor(() => !existsSync(before.pipe), 5_000);
      const blocked = await mcp.call('erd_add_table', { path: 'agent.erd' });
      const checks = {
        noPipe: off?.pipe === '' && off.token === '',
        folders: sameSet(off?.workspaceFolders ?? [], before.workspaceFolders),
        documents: sameSet(off?.documents ?? [], before.documents),
        socketGone: Boolean(socketGone),
        refused:
          blocked.isError &&
          /a JetBrains IDE \(pid \d+\)/.test(blocked.text) &&
          blocked.text.includes(ENABLE_HUB) &&
          !OTHER_HOSTS.test(blocked.text),
      };
      step(
        name,
        Object.values(checks).every(Boolean),
        JSON.stringify({ checks, text: blocked.text.slice(0, 300) })
      );
      await robot.setCodingAgents(true);
      const on = await waitFor(() => {
        const lock = ideLock();
        return lock?.hub && isSocket(lock.pipe) ? lock : null;
      }, 5_000);
      const added = await mcp.call('erd_add_table', { path: 'agent.erd' });
      step(
        `${name.slice(0, 2)} Coding agents on again: a hub-on lock with a live socket, the agent edits live`,
        Boolean(on) && on.token !== before.token && added.json?.mode === 'live',
        added.text.slice(0, 300)
      );
    }
  );

  await robotStep(
    'B3',
    'a second project joins the lock; once it closes, writes to a disk-read and an editor-held file fall back to disk',
    'open project2 in a new window, erd_read x.erd, open and edit y.erd, close project2, then edit both',
    async name => {
      await robot.openProject(project2);
      const joined = await waitFor(
        () => ideLock()?.workspaceFolders?.includes(project2),
        15_000
      );
      const read = await mcp.call('erd_read', { path: real.x, format: 'json' });
      const openY = await mcp.call('erd_open_document', { path: real.y });
      const editY = await mcp.call('erd_add_table', { path: real.y });
      const closed = await robot.closeProject(project2);
      const left = await waitFor(
        () => !ideLock()?.workspaceFolders?.includes(project2),
        15_000
      );
      await sleep(500);
      const x = await mcp.call('erd_add_table', { path: real.x });
      const y = await mcp.call('erd_add_table', { path: real.y });
      const fellBack = result =>
        result.json?.mode === 'headless' &&
        result.notes.some(note => FELL_BACK_NOTE.test(note));
      step(
        name,
        Boolean(joined) &&
          !read.isError &&
          openY.json?.opened === true &&
          editY.json?.mode === 'live' &&
          closed === true &&
          Boolean(left) &&
          fellBack(x) &&
          fellBack(y),
        JSON.stringify({
          joined: Boolean(joined),
          read: read.isError ? read.text.slice(0, 200) : 'ok',
          openY: openY.json,
          editY: editY.json?.mode,
          left: Boolean(left),
          x: { mode: x.json?.mode, notes: x.notes },
          y: { mode: y.json?.mode, notes: y.notes },
        })
      );
    }
  );

  await robotStep(
    'B4',
    'under a modal dialog: erd_open_document answers within 5.5 s and erd_save within 13 s',
    'show any modal dialog, then erd_open_document closed.erd, erd_add_table and erd_save agent.erd',
    async name => {
      await openThroughAgent('agent.erd');
      await robot.showModal('ERD smoke', 'smoke modal');
      const shown = await waitFor(() => robot.hasDialog('ERD smoke'), 5_000);
      const opened = await mcp.call('erd_open_document', { path: 'closed.erd' });
      const edited = await mcp.call('erd_add_table', { path: 'agent.erd' });
      const saved = await mcp.call('erd_save', { path: 'agent.erd' });
      const closed = await robot.closeDialog('ERD smoke');
      info('B4 erd_open_document under the dialog', `${opened.ms} ms: ${opened.text.slice(0, 300)}`);
      info(
        'B4 erd_save under the dialog',
        `${saved.ms} ms, saved ${saved.json?.saved}, edit ${edited.json?.mode}: ${saved.text.slice(0, 200)}`
      );
      step(
        name,
        Boolean(shown) && opened.ms <= 5_500 && saved.ms <= 13_000 && closed === true,
        JSON.stringify({ shown: Boolean(shown), openMs: opened.ms, saveMs: saved.ms, closed })
      );
    }
  );

  await robotStep(
    'B5',
    'renaming agent.erd to agent.txt drops it from the lock and closes it for a joined peer',
    'with a peer joined to agent.erd, rename it to agent.txt in the Project view',
    async name => {
      await openThroughAgent('agent.erd');
      const { peer } = await joinPeer(real.agent, 'erd-intellij-smoke-b5');
      const renamed = await robot.rename(real.agent, 'agent.txt');
      const unlisted = await waitFor(
        () => !ideLock()?.documents?.includes(real.agent),
        5_000
      );
      const closed = await peer.waitFor(
        p => p.closedPaths().includes(real.agent),
        5_000
      );
      info(
        'B5 the editor of the renamed file',
        JSON.stringify({ renamed, editors: await robot.editorsOf(at('agent.txt')) })
      );
      step(name, Boolean(unlisted) && closed, JSON.stringify({ unlisted: Boolean(unlisted), closed }));
    }
  );

  await robotStep(
    'B5b',
    'renaming a folder closes its open diagram for a peer, the lock lists the new path, the agent edits it live',
    'with sub/moved.erd open and a peer joined, rename sub to sub2 in the Project view',
    async name => {
      await openThroughAgent(join('sub', 'moved.erd'));
      const { peer } = await joinPeer(real.moved, 'erd-intellij-smoke-b5b');
      await robot.rename(join(project, 'sub'), 'sub2');
      const closed = await peer.waitFor(
        p => p.closedPaths().includes(real.moved),
        5_000
      );
      const listed = await waitFor(
        () => ideLock()?.documents?.includes(real.moved2),
        5_000
      );
      const edited = await mcp.call('erd_add_table', { path: join('sub2', 'moved.erd') });
      step(
        name,
        closed && Boolean(listed) && edited.json?.mode === 'live' && !edited.isError,
        JSON.stringify({ closed, listed: Boolean(listed), edit: edited.text.slice(0, 200) })
      );
    }
  );

  await robotStep(
    'B6',
    'a file turning read-only makes its page read-only and closes it for a peer; writable again, the agent edits it live',
    'chmod a-w readonly.erd and refresh, check the editor refuses edits, chmod u+w and refresh',
    async name => {
      const { page } = await openThroughAgent('readonly.erd');
      const { peer } = await joinPeer(real.readonly, 'erd-intellij-smoke-b6');
      const readonlyShown = () =>
        page.evaluate(`document.querySelector('erd-editor').readonly`);
      execFileSync('chmod', ['a-w', real.readonly]);
      const writableAfterChmod = await robot.refresh(real.readonly);
      const locked = await waitFor(async () => (await readonlyShown()) === true, 5_000);
      const closed = await peer.waitFor(
        p => p.closedPaths().includes(real.readonly),
        5_000
      );
      execFileSync('chmod', ['u+w', real.readonly]);
      const writableAgain = await robot.refresh(real.readonly);
      const unlocked = await waitFor(async () => (await readonlyShown()) === false, 5_000);
      const edited = await mcp.call('erd_add_table', { path: 'readonly.erd' });
      step(
        name,
        writableAfterChmod === false &&
          Boolean(locked) &&
          closed &&
          writableAgain === true &&
          Boolean(unlocked) &&
          edited.json?.mode === 'live',
        JSON.stringify({
          writableAfterChmod,
          locked: Boolean(locked),
          closed,
          writableAgain,
          unlocked: Boolean(unlocked),
          edit: edited.text.slice(0, 200),
        })
      );
    }
  );

  await robotStep(
    'B7',
    'dynamic unload: the lock and socket go, no hub thread and no hub warning is left',
    'untick ERD Editor under Settings | Plugins, check ~/.erd-editor/ide and idea.log, then tick it again',
    async name => {
      const { hub } = await unloadAndReload(name);
      if (!hub) return;
      const added = await mcp.call('erd_add_table', { path: 'closed.erd' });
      step(
        'B7 loaded again: a new lock under the same pid with a new token, the agent edits live',
        hub.reloaded && added.json?.mode === 'live',
        JSON.stringify({ ...hub, edit: added.text.slice(0, 200) })
      );
    }
  );

  await robotStep(
    'B8',
    'a tab restored by a relaunch opens through the agent within 5 s',
    'open background.erd in a tab behind another, quit and relaunch the IDE, then erd_open_document background.erd',
    async name => {
      await robot.openFiles(project, [at('background.erd'), at('closed.erd')]);
      await sleep(1_000);
      // Always a graceful quit: SIGTERM skips the state save that restores the tabs.
      const quit = await quitIde(name, false);
      if (alive(ide.pid)) return;
      await startIde();
      robotReady = await robot.waitReady(60_000);
      const opened = await mcp.call('erd_open_document', { path: 'background.erd' });
      step(
        name,
        Boolean(quit.exited) && opened.json?.opened === true && opened.ms <= 5_000,
        `${opened.ms} ms: ${opened.text.slice(0, 200)}`
      );
    }
  );

  await robotStep(
    'B9',
    'split view: both editors are seeded and kept in step through the hub, then one closes and the save still lands',
    'open split.erd, split its editor, edit through the agent and by hand, close one half, erd_save',
    async name => {
      const { page: first } = await openThroughAgent('split.erd');
      const before = await pageIds();
      const split = await robot.split(real.split);
      if (!split) {
        return manualStep(name, 'split the split.erd editor (Window | Editor Tabs | Split Right) or open it in a second project frame, then rerun B9');
      }
      // An agent edit while the second editor is still loading, which its initial value must hold.
      const loading = await mcp.call('erd_add_table', { path: 'split.erd' });
      const loadingId = loading.json?.createdIds?.[0];
      const [secondTarget] = (await newPages(before, 10_000)) ?? [];
      const second = secondTarget ? sessions.get(secondTarget.id) : null;
      const both = [first, second].filter(Boolean);
      const seeded = second ? await shownIn([second], loadingId, 5_000) : null;
      // The ready editor count is in the hub's openDocument answer, which the MCP's result drops;
      // the hub answers it at once for a document an editor already shows.
      const probe = await Peer.join(ideLock(), 'erd-intellij-smoke-b9');
      peers.push(probe);
      const webviews = async count =>
        (await probe.call('openDocument', { path: real.split })).webviews === count;
      const two = await waitFor(() => webviews(2), 8_000, 500);
      const added = await mcp.call('erd_add_table', { path: 'split.erd' });
      const agentId = added.json?.createdIds?.[0];
      const agentShown = await shownIn(both, agentId);
      const userId = first ? await userEdit(first) : null;
      const userShown = second ? await shownIn([second], userId) : null;
      const userSeen = userId ? await agentSees('split.erd', userId) : null;
      await robot.closeInFirstWindow(real.split);
      const one = await waitFor(() => webviews(1), 8_000, 500);
      await sleep(REPLICA_SETTLE_MS);
      const saved = await mcp.call('erd_save', { path: 'split.erd' });
      const onDisk = fileIds(real.split);
      step(
        name,
        both.length === 2 &&
          Boolean(seeded) &&
          Boolean(two) &&
          Boolean(agentShown) &&
          Boolean(userShown) &&
          Boolean(userSeen) &&
          Boolean(one) &&
          saved.json?.saved === true &&
          onDisk.includes(agentId) &&
          onDisk.includes(userId),
        JSON.stringify({
          pages: both.length,
          seeded: Boolean(seeded),
          two: Boolean(two),
          agentShown: Boolean(agentShown),
          userShown: Boolean(userShown),
          userSeen: Boolean(userSeen),
          one: Boolean(one),
          saved: saved.json,
          onDisk: onDisk.length,
        })
      );
    }
  );

  for (const each of peers.splice(0)) each.close();
}

/**
 * B7 on both builds: the hub's verdict (PASS or FAIL) with the hub, and the class loader's
 * (INFO) always. The disable persists in the sandbox, which B8 relaunches, so the plugin is
 * enabled again whatever happened, a check that threw included.
 */
async function unloadAndReload(name) {
  const offset = logSize();
  const before = NO_HUB ? null : ideLock();
  if (!NO_HUB && !before) {
    step(name, false, 'no lock before the unload');
    return { hub: null };
  }
  let unloaded = false;
  let enabled = false;
  let hub = null;
  try {
    unloaded = await robot.disablePlugin();
    if (before && !unloaded) {
      step(name, false, 'the plugin did not unload without a restart; see B7 class loader');
    } else if (before) {
      const gone = await waitFor(
        () => !existsSync(lockPath(ide.pid)) && !existsSync(before.pipe),
        5_000
      );
      const threads = await waitFor(
        async () => ((await robot.threads(HUB_THREAD_PREFIX)).length ? null : []),
        5_000
      );
      const warnings = logSince(offset)
        .split('\n')
        .filter(line => line.includes(' WARN ') && line.includes('[erd-editor hub]'));
      step(
        name,
        Boolean(gone) && Boolean(threads) && warnings.length === 0,
        JSON.stringify({
          gone: Boolean(gone),
          threads: threads ? [] : await robot.threads(HUB_THREAD_PREFIX),
          warnings,
        })
      );
      hub = { unloaded };
    }
    let collected = false;
    for (let round = 0; unloaded && round < 20 && !collected; round++) {
      collected = await robot.loaderCollected();
      if (!collected) await sleep(500);
    }
    const reports = logSince(offset)
      .split('\n')
      .filter(line => UNLOAD_REPORT.test(line))
      .map(line => line.slice(0, 300));
    info(
      'B7 class loader',
      JSON.stringify({ unloadedWithoutRestart: unloaded, collectedWithin10s: collected, reports })
    );
  } finally {
    enabled = await robot.enablePlugin().catch(() => false);
  }
  if (!unloaded) return { hub: null };
  if (hub) {
    const lock = await waitFor(() => {
      const found = ideLock();
      return found?.hub && isSocket(found.pipe) && found.token !== before.token
        ? found
        : null;
    }, 10_000);
    hub.reloaded = enabled && Boolean(lock);
  } else {
    info('B7 enabled again', String(enabled));
  }
  return { hub };
}

async function phaseBWithoutHub() {
  await robotStep(
    'B7',
    'dynamic unload without the hub (baseline): the loader verdict only',
    'untick ERD Editor under Settings | Plugins and read idea.log for an unload report, then tick it again',
    async name => {
      await robot.openFiles(project, [at('agent.erd')]);
      await sleep(3_000);
      await unloadAndReload(name);
    }
  );
}

// ---- Run ----

let endedCleanly = false;
try {
  if (!NO_HUB && !existsSync(MCP_BIN)) {
    throw new Error(`${MCP_BIN} is missing; build @dineug/erd-editor-mcp first`);
  }
  if (!NO_HUB) {
    mcp = startMcp(MCP_BIN, project);
    await mcp.initialize();
  }
  if (runsPhase('A') && !NO_HUB) await phaseA();
  if (runsPhase('B')) await phaseB();
} catch (error) {
  step('smoke run', false, error.stack);
} finally {
  for (const session of sessions.values()) session.close();
  for (const each of peers.splice(0)) each.close();
  // The server's own log, the one place a crash or a failure it logged shows.
  if (failed && mcp?.stderr.length) {
    console.log(`MCP server stderr:\n${mcp.stderr.join('')}`);
  }
  mcp?.close();
  if (KEEP && ide && alive(ide.pid)) {
    console.log(`left running: pid ${ide.pid}, CDP port ${CDP_PORT}, robot port ${ROBOT_PORT}`);
    console.log(`project: ${project}\nidea.log: ${ideaLog}`);
    gradle?.unref();
  } else {
    endedCleanly = !ide || !alive(ide.pid);
    for (const pid of pids) {
      if (!alive(pid) || !argsOf(pid).includes(sandbox)) continue;
      process.kill(pid, 'SIGTERM');
      if (!(await waitFor(() => !alive(pid), 10_000))) process.kill(pid, 'SIGKILL');
      else endedCleanly = true;
    }
    if (gradleRunning()) gradle.kill('SIGTERM');
    await waitFor(() => !gradleRunning(), 10_000);
    // JCEF's helper processes outlive the IDE by a moment; the run ends once none names it.
    const settled = await waitFor(() => !stillRunning().length, 15_000);
    if (!settled) console.log(`still running, naming ${work}: ${stillRunning().join(', ')}`);
    // Only this run's IDE may have left a lock or a socket, and only if it failed.
    const left = [...pids]
      .flatMap(pid => [
        lockPath(pid),
        `${lockPath(pid)}.tmp`,
        join(LOCK_DIR, `${pid}.sock`),
        join(tmpdir(), `erd-editor-ide-${pid}.sock`),
      ])
      .filter(path => existsSync(path));
    for (const path of left) rmSync(path, { force: true });
    if (left.length && endedCleanly && !NO_HUB) {
      step('nothing left in ~/.erd-editor/ide', false, left.join());
    }
    if (existsSync(real.readonly)) chmodSync(real.readonly, 0o644);
    // A failed run keeps its work dir for the logs it names; the next run removes it.
    if (failed) console.log(`kept for its logs: ${work}\nidea.log: ${ideaLog}`);
    else rmSync(work, { recursive: true, force: true });
  }
  if (errors.length) console.log(`page errors:\n${errors.join('\n')}`);
  console.log(
    `${passed} passed, ${failed ? 'some failed' : 'none failed'}${manual.length ? `, manual: ${manual.join(', ')}` : ''}`
  );
}

process.exit(failed ? 1 : 0);
