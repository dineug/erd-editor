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
const POLL_TIMEOUT = 10_000;

type Frame = Record<string, any>;

type Peer = {
  call: (method: string, params: Record<string, unknown>) => Promise<Frame>;
  close: () => void;
};

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

function readLock(): Frame | undefined {
  const lockPath = path.join(
    os.homedir(),
    '.erd-editor',
    'ide',
    `${process.pid}.json`
  );
  try {
    return JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  } catch {
    return undefined;
  }
}

function erdTabUris(): string[] {
  return vscode.window.tabGroups.all
    .flatMap(group => group.tabs)
    .flatMap(tab =>
      tab.input instanceof vscode.TabInputCustom &&
      tab.input.viewType === VIEW_TYPE
        ? [tab.input.uri.toString()]
        : []
    );
}

/** A peer over the hub's JSON lines, written by hand as agent-hub.test.ts does. */
function connect(pipe: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(pipe);
    const pending = new Map<number, (frame: Frame) => void>();
    let buffer = '';
    let nextId = 1;

    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        const frame = line.trim() === '' ? undefined : JSON.parse(line);
        if (typeof frame?.id === 'number') pending.get(frame.id)?.(frame);
        newline = buffer.indexOf('\n');
      }
    });
    socket.once('error', reject);
    socket.once('connect', () =>
      resolve({
        call: (method, params) =>
          new Promise<Frame>(settle => {
            const id = nextId++;
            pending.set(id, settle);
            socket.write(`${JSON.stringify({ id, method, params })}\n`);
          }).then(response => {
            assert.ok(
              response.ok,
              `${method} failed: ${JSON.stringify(response.error)}`
            );
            return response.result;
          }),
        close: () => socket.destroy(),
      })
    );
  });
}

describe('a workspace folder opened through a link', () => {
  let explorerUri: vscode.Uri;
  let documentPath: string;
  let peer: Peer;

  before(async () => {
    const folders = vscode.workspace.workspaceFolders ?? [];
    assert.strictEqual(folders.length, 1);
    explorerUri = vscode.Uri.joinPath(folders[0].uri, FIXTURE_FILE);
    documentPath = fs.realpathSync.native(explorerUri.fsPath);
    assert.notStrictEqual(
      path.dirname(documentPath).toLowerCase(),
      folders[0].uri.fsPath.toLowerCase(),
      'the workspace folder is no link'
    );

    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(extension, `${EXTENSION_ID} is not installed in this host`);
    await extension.activate();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await waitUntil('the lock names a serving hub', () => !!readLock()?.hub);
    const lock = readLock() as Frame;
    peer = await connect(lock.pipe);
    await peer.call('hello', {
      token: lock.token,
      protocolVersion: PROTOCOL_VERSION,
      client: 'e2e-linked',
    });
  });

  after(async () => {
    peer?.close();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  it('opens a closed file under the folder as the Explorer spells it, so opening it there keeps one tab', async () => {
    const opened = await peer.call('openDocument', { path: documentPath });

    assert.deepStrictEqual(opened, {
      path: documentPath,
      opened: true,
      webviews: 1,
    });
    assert.deepStrictEqual(erdTabUris(), [explorerUri.toString()]);

    await vscode.commands.executeCommand('vscode.open', explorerUri);
    await delay(1_000);
    assert.deepStrictEqual(erdTabUris(), [explorerUri.toString()]);
    const again = await peer.call('openDocument', { path: documentPath });
    assert.strictEqual(again.opened, false);
  });
});
