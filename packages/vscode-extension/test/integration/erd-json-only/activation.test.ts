import * as assert from 'assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

const EXTENSION_ID = 'dineug.vuerd-vscode';
const VIEW_TYPE = 'editor.erd';
const FIXTURE_FILE = 'sample.erd.json';
const POLL_INTERVAL = 50;
const POLL_TIMEOUT = 10_000;

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

function lockPath(): string {
  return path.join(os.homedir(), '.erd-editor', 'ide', `${process.pid}.json`);
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

function getExtension(): vscode.Extension<unknown> {
  const extension = vscode.extensions.getExtension<unknown>(EXTENSION_ID);
  assert.ok(extension, `${EXTENSION_ID} is not installed in this host`);
  return extension;
}

/**
 * Nothing here calls activate(): the spec holds only if the workspaceContains
 * event woke the extension for a folder whose one ERD file is a .erd.json.
 */
describe('activation in a folder holding only a .erd.json file', () => {
  let folder: string;

  before(() => {
    const folders = vscode.workspace.workspaceFolders ?? [];
    assert.strictEqual(folders.length, 1);
    folder = fs.realpathSync(folders[0].uri.fsPath);
  });

  it('opened the fixture whose only file is sample.erd.json', () => {
    const names = fs.readdirSync(folder).filter(name => !name.startsWith('.'));

    assert.deepStrictEqual(names, [FIXTURE_FILE]);
  });

  it('declares an activation glob that the workbench itself matches against sample.erd.json', async () => {
    const prefix = 'workspaceContains:';
    const globs: string[] = (getExtension().packageJSON.activationEvents ?? [])
      .filter((event: string) => event.startsWith(prefix))
      .map((event: string) => event.slice(prefix.length));

    const matches = await Promise.all(
      globs.map(glob => vscode.workspace.findFiles(glob))
    );

    assert.ok(
      matches.flat().some(uri => path.basename(uri.fsPath) === FIXTURE_FILE),
      `none of ${JSON.stringify(globs)} matches ${FIXTURE_FILE}`
    );
  });

  it('is active without any ERD editor having been opened', async () => {
    const extension = getExtension();

    await waitUntil(
      'workspaceContains activated the extension',
      () => extension.isActive
    );
    assert.strictEqual(erdTabs().length, 0);
  });

  it('writes a serving lock for the folder, listing no open document', async () => {
    await waitUntil('the lock exists', () => fs.existsSync(lockPath()));
    const lock = JSON.parse(fs.readFileSync(lockPath(), 'utf8'));

    assert.strictEqual(lock.hub, true);
    assert.deepStrictEqual(lock.workspaceFolders, [folder]);
    assert.deepStrictEqual(lock.documents, []);
    assert.strictEqual(erdTabs().length, 0);
  });
});
