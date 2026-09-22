import * as assert from 'assert/strict';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

const EXTENSION_ID = 'dineug.vuerd-vscode';
const VIEW_TYPE = 'editor.erd';
const PROTOCOL_VERSION = 1;
const FIXTURE_FILE = 'sample.erd.json';
const POLL_INTERVAL = 50;
const POLL_TIMEOUT = 5_000;

type Lock = {
  pipe: string;
  token: string;
  hub: boolean;
  workspaceFolders: string[];
  documents: string[];
};

type Frame = Record<string, any>;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitUntil(
  description: string,
  predicate: () => boolean,
  timeout = POLL_TIMEOUT
): Promise<void> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (predicate()) return;
    await delay(POLL_INTERVAL);
  }
  if (predicate()) return;

  assert.fail(`timed out after ${timeout}ms waiting until ${description}`);
}

/** The extension runs in this very process, so its lock is named after this pid. */
function lockPath(): string {
  return path.join(os.homedir(), '.erd-editor', 'ide', `${process.pid}.json`);
}

function readLock(): Lock | undefined {
  try {
    return JSON.parse(fs.readFileSync(lockPath(), 'utf8'));
  } catch {
    return undefined;
  }
}

function erdTabs(): vscode.Tab[] {
  return vscode.window.tabGroups.all
    .flatMap(group => group.tabs)
    .filter(
      tab =>
        tab.input instanceof vscode.TabInputCustom &&
        tab.input.viewType === VIEW_TYPE
    );
}

async function closeAllEditors(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  await waitUntil(
    'every editor tab is closed',
    () => vscode.window.tabGroups.all.flatMap(group => group.tabs).length === 0
  );
}

/**
 * A peer built from node builtins and a hand-written JSON lines codec, so the
 * wire format the hub speaks is checked here as bytes, not through the same
 * library that produced it.
 */
class FakePeer {
  readonly notifications: Frame[] = [];
  private buffer = '';
  private nextId = 1;
  private readonly pending = new Map<number, (frame: Frame) => void>();

  private constructor(private readonly socket: net.Socket) {
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => this.receive(chunk));
  }

  static connect(pipe: string): Promise<FakePeer> {
    return new Promise((resolve, reject) => {
      const socket = net.connect(pipe);
      socket.once('connect', () => resolve(new FakePeer(socket)));
      socket.once('error', reject);
    });
  }

  /** The actions notifications received so far, as their action arrays. */
  actionBatches(): Frame[][] {
    return this.notifications
      .filter(frame => frame.method === 'actions')
      .map(frame => frame.params.actions);
  }

  request(method: string, params: Record<string, unknown>): Promise<Frame> {
    const id = this.nextId++;
    return new Promise(resolve => {
      this.pending.set(id, resolve);
      this.socket.write(`${JSON.stringify({ id, method, params })}\n`);
    });
  }

  /** Sends a request and hands back its result, failing the spec on an error response. */
  async call(method: string, params: Record<string, unknown>): Promise<any> {
    const response = await this.request(method, params);
    assert.strictEqual(response.method, method);
    assert.ok(
      response.ok,
      `${method} failed: ${JSON.stringify(response.error)}`
    );
    return response.result;
  }

  close(): void {
    this.socket.destroy();
  }

  private receive(chunk: string): void {
    this.buffer += chunk;
    let newline = this.buffer.indexOf('\n');
    while (newline !== -1) {
      const line = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 1);
      if (line.trim() !== '') this.dispatch(JSON.parse(line));
      newline = this.buffer.indexOf('\n');
    }
  }

  private dispatch(frame: Frame): void {
    if (typeof frame.id !== 'number') {
      this.notifications.push(frame);
      return;
    }
    const resolve = this.pending.get(frame.id);
    this.pending.delete(frame.id);
    resolve?.(frame);
  }
}

/**
 * A table with a primary key column, shaped like the Step 0 spike batch:
 * tagged shared (1), so a webview applies it without relaying it back.
 */
function tableBatch(tableId: string, version: number): Frame[] {
  const meta = { editorId: 'agent-hub-e2e', nickname: 'e2e' };
  const columnId = `${tableId}c`;
  const action = (type: string, payload: Frame) => ({
    type,
    payload,
    version,
    tags: 1,
    meta,
  });

  return [
    action('table.add', { id: tableId, ui: { x: 120, y: 120, zIndex: 2 } }),
    action('column.add', { id: columnId, tableId }),
    action('column.changeName', { id: columnId, tableId, value: 'id' }),
    action('column.changePrimaryKey', { id: columnId, tableId, value: true }),
  ];
}

function mentions(batches: Frame[][], tableId: string): boolean {
  return batches.some(batch =>
    batch.some(action => action.payload?.id === tableId)
  );
}

describe('document hub for coding agents', () => {
  let folder: string;
  let documentUri: vscode.Uri;
  let documentPath: string;
  let original: Uint8Array;
  let lock: Lock;
  const peers: FakePeer[] = [];

  async function connectPeer(client: string): Promise<FakePeer> {
    const peer = await FakePeer.connect(lock.pipe);
    peers.push(peer);
    const hello = await peer.call('hello', {
      token: lock.token,
      protocolVersion: PROTOCOL_VERSION,
      client,
    });
    assert.strictEqual(hello.protocolVersion, PROTOCOL_VERSION);
    return peer;
  }

  /** Opens the fixture through the hub, then waits out the webview's first handshake. */
  async function openThroughHub(peer: FakePeer): Promise<void> {
    const opened = await peer.call('openDocument', { path: documentPath });
    assert.strictEqual(opened.path, documentPath);
    assert.ok(opened.webviews >= 1, 'openDocument answered with no webview');
    await delay(500);
  }

  before(async () => {
    const folders = vscode.workspace.workspaceFolders ?? [];
    assert.strictEqual(folders.length, 1);
    folder = fs.realpathSync(folders[0].uri.fsPath);
    documentUri = vscode.Uri.joinPath(folders[0].uri, FIXTURE_FILE);
    documentPath = fs.realpathSync(documentUri.fsPath);
    original = await vscode.workspace.fs.readFile(documentUri);

    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(extension, `${EXTENSION_ID} is not installed in this host`);
    await extension.activate();
    await closeAllEditors();
    await waitUntil('the lock names a serving hub', () => !!readLock()?.hub);
    lock = readLock() as Lock;
  });

  afterEach(async () => {
    peers.splice(0).forEach(peer => peer.close());
    // A dirty editor would stop closeAllEditors on a save prompt.
    if (erdTabs().some(tab => tab.isDirty)) {
      await vscode.workspace.save(documentUri);
    }
    await closeAllEditors();
  });

  after(async () => {
    await vscode.workspace.fs.writeFile(documentUri, original);
  });

  it('writes its lock before any ERD editor is open', () => {
    assert.strictEqual(erdTabs().length, 0);
    const current = readLock();

    assert.ok(current, `no lock at ${lockPath()}`);
    assert.strictEqual(current.hub, true);
    assert.ok(current.pipe !== '' && current.token !== '');
    assert.ok(current.workspaceFolders.includes(folder));
    if (process.platform !== 'win32') {
      assert.strictEqual(fs.statSync(lockPath()).mode & 0o777, 0o600);
    }
  });

  it('lists the fixture documents through the activation glob without opening them', async () => {
    const peer = await connectPeer('e2e-list');

    const { documents } = await peer.call('listDocuments', {});

    const paths = documents.map((document: Frame) => document.path);
    assert.ok(paths.includes(documentPath), `${documentPath} is not listed`);
    assert.ok(paths.includes(path.join(folder, 'sample.erd')));
    assert.ok(documents.every((document: Frame) => document.open === false));
    assert.strictEqual(erdTabs().length, 0);
  });

  it('takes a batch from a peer into the editor, turns it dirty, and saves it to disk', async () => {
    const peer = await connectPeer('e2e');
    await openThroughHub(peer);
    assert.strictEqual(erdTabs().length, 1);
    const joined = await peer.call('join', { path: documentPath });
    assert.strictEqual(joined.readonly, false);
    assert.strictEqual(JSON.parse(joined.initialValue).version, '3.0.0');
    const tableId = `e2e${Date.now()}`;

    const applied = await peer.call('applyActions', {
      path: documentPath,
      actions: tableBatch(tableId, joined.snapshotVersion + 1),
    });

    assert.deepStrictEqual(applied, { webviews: 1 });
    await waitUntil('the ERD tab turns dirty', () =>
      erdTabs().some(tab => tab.isDirty)
    );
    assert.ok(!fs.readFileSync(documentPath, 'utf8').includes(tableId));

    const saved = await peer.call('save', { path: documentPath });

    assert.deepStrictEqual(saved, { saved: true });
    const onDisk = JSON.parse(fs.readFileSync(documentPath, 'utf8'));
    assert.ok(onDisk.doc.tableIds.includes(tableId));
    assert.ok(erdTabs().every(tab => !tab.isDirty));
  });

  it('hands one peer batch to the other peer, and never back to its sender', async () => {
    const a = await connectPeer('e2e-a');
    const b = await connectPeer('e2e-b');
    await openThroughHub(a);
    const joined = await a.call('join', { path: documentPath });
    await b.call('join', { path: documentPath });
    await delay(100);
    const tableId = `e2e${Date.now()}`;
    const batch = tableBatch(tableId, joined.snapshotVersion + 1);

    await a.call('applyActions', { path: documentPath, actions: batch });

    await waitUntil('the other peer receives the batch', () =>
      mentions(b.actionBatches(), tableId)
    );
    // Well past the replica round trip: an echo would have arrived by now.
    await delay(1_000);
    assert.deepStrictEqual(
      b.actionBatches().filter(actions => mentions([actions], tableId)),
      [batch]
    );
    assert.strictEqual(mentions(a.actionBatches(), tableId), false);
    assert.deepStrictEqual(await a.call('save', { path: documentPath }), {
      saved: true,
    });
  });
});
