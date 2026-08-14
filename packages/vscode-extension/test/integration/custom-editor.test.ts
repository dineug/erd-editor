import * as assert from 'assert/strict';
import * as vscode from 'vscode';

/**
 * These specs run inside a real Extension Host (see `.vscode-test.mjs`), so
 * `vscode` is the genuine API and the extension is loaded from this folder via
 * `--extensionDevelopmentPath`. `test/fixtures/workspace` is the open folder.
 *
 * Scope note: the custom editor paints `@dineug/erd-editor-vscode-webview`
 * into an out-of-process webview, and its DOM is not reachable from the
 * Extension Host — there is no API that returns webview content. Everything
 * below therefore stops at the host-side contract (documents, tabs, commands);
 * the rendered editor surface belongs to the Playwright suite in
 * `packages/erd-editor`.
 */

const EXTENSION_ID = 'dineug.vuerd-vscode';
const VIEW_TYPE = 'editor.erd';
const POLL_INTERVAL = 50;
// Kept well under the 30s mocha timeout in `.vscode-test.mjs` so that a spec
// with several waits still fails with `waitUntil`'s description rather than
// with an anonymous mocha timeout.
const POLL_TIMEOUT = 5_000;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * The workbench settles asynchronously and the extension's command handlers do
 * not return their promises, so a fixed sleep would be both slower and flakier
 * than re-reading the observable state until it agrees.
 */
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

  // The deadline can elapse during the last sleep, so give the predicate one
  // final chance before declaring a timeout.
  if (predicate()) return;

  assert.fail(`timed out after ${timeout}ms waiting until ${description}`);
}

function allTabs(): vscode.Tab[] {
  return vscode.window.tabGroups.all.flatMap(group => group.tabs);
}

function erdEditorTabsFor(uri: vscode.Uri): vscode.Tab[] {
  return allTabs().filter(
    tab =>
      tab.input instanceof vscode.TabInputCustom &&
      tab.input.viewType === VIEW_TYPE &&
      tab.input.uri.fsPath === uri.fsPath
  );
}

function sourceTabsFor(uri: vscode.Uri): vscode.Tab[] {
  return allTabs().filter(
    tab =>
      tab.input instanceof vscode.TabInputText &&
      tab.input.uri.fsPath === uri.fsPath
  );
}

function viewColumnsOf(tabs: vscode.Tab[]): Set<vscode.ViewColumn> {
  // `TabGroup` object identity is an implementation detail; `viewColumn` is the
  // documented, comparable value.
  return new Set(tabs.map(tab => tab.group.viewColumn));
}

function openErdEditor(
  uri: vscode.Uri,
  viewColumn?: vscode.ViewColumn
): Thenable<unknown> {
  return vscode.commands.executeCommand(
    'vscode.openWith',
    uri,
    VIEW_TYPE,
    viewColumn
  );
}

async function closeAllEditors(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  await waitUntil('every editor tab is closed', () => allTabs().length === 0);
}

describe('custom editor', () => {
  let documentUri: vscode.Uri;

  before(async () => {
    const folders = vscode.workspace.workspaceFolders ?? [];
    assert.strictEqual(
      folders.length,
      1,
      'the fixture workspace must be the single open folder'
    );
    documentUri = vscode.Uri.joinPath(folders[0].uri, 'sample.erd');

    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(extension, `${EXTENSION_ID} is not installed in this host`);
    // `activationEvents` is `workspaceContains:**/*.{erd,vuerd}`, so the
    // fixture already triggers activation; awaiting it only removes the race.
    await extension.activate();
    assert.strictEqual(extension.isActive, true);

    // Whatever ran before this file must not decide what the first spec sees.
    await closeAllEditors();
  });

  afterEach(async () => {
    await closeAllEditors();
  });

  describe('the fixture document', () => {
    it('reads sample.erd out of the workspace folder as a v3 document', async () => {
      const bytes = await vscode.workspace.fs.readFile(documentUri);
      const parsed = JSON.parse(Buffer.from(bytes).toString('utf8'));

      // A guard on the fixture rather than on the extension: `ErdDocument`
      // hands these exact bytes to the webview untouched, so a fixture that
      // stopped being valid v3 JSON would silently gut every spec below.
      assert.strictEqual(parsed.version, '3.0.0');
    });
  });

  describe('opening the document', () => {
    it('resolves the custom editor and leaves a single erd tab, with no text editor on the file', async () => {
      // `vscode.openWith` only resolves once `resolveCustomEditor` has run, so
      // a throw from `bootstrapWebview` would surface right here.
      await openErdEditor(documentUri);

      await waitUntil(
        'an erd editor tab exists for sample.erd',
        () => erdEditorTabsFor(documentUri).length === 1
      );

      const [tab] = erdEditorTabsFor(documentUri);
      assert.strictEqual(tab.isActive, true);
      // Not implied by the filter above: nothing else opened the same file, so
      // the erd editor really is the editor showing sample.erd.
      assert.strictEqual(
        sourceTabsFor(documentUri).length,
        0,
        'openWith must not leave a text editor on the same file'
      );
      assert.strictEqual(
        allTabs().length,
        1,
        'resolving the erd editor must not open anything else'
      );
    });

    it('claims .erd by default, so a plain open never falls back to the text editor', async () => {
      // `vscode.openWith` names the viewType explicitly and would pass even if
      // the manifest selector were wrong. `vscode.open` is what a double-click
      // in the explorer does, so this is the spec that actually proves
      // `contributes.customEditors` (`priority: "default"`, `*.erd`) is wired.
      await vscode.commands.executeCommand('vscode.open', documentUri);

      await waitUntil(
        'the default editor for sample.erd is an erd editor tab',
        () => erdEditorTabsFor(documentUri).length === 1
      );
      assert.strictEqual(
        sourceTabsFor(documentUri).length,
        0,
        'the *.erd selector must win over the built-in text editor'
      );
    });
  });

  describe('vuerd.showSource', () => {
    it('opens the underlying file in a text editor so the JSON stays editable', async () => {
      await openErdEditor(documentUri);
      await waitUntil(
        'the erd editor is open',
        () => erdEditorTabsFor(documentUri).length === 1
      );

      // The command handler calls `showTextDocument` without returning its
      // promise, so `executeCommand` resolves before the editor is visible.
      await vscode.commands.executeCommand('vuerd.showSource', documentUri);

      await waitUntil(
        'sample.erd is the active text editor',
        () =>
          vscode.window.activeTextEditor?.document.uri.fsPath ===
          documentUri.fsPath
      );
      assert.strictEqual(
        erdEditorTabsFor(documentUri).length,
        1,
        'showSource opens the source alongside the erd editor, it does not replace it'
      );
    });
  });

  describe('vuerd.showSourceToSide', () => {
    it('puts the source in another group, which is the whole point of the alt action', async () => {
      await openErdEditor(documentUri);
      await waitUntil(
        'the erd editor is open',
        () => erdEditorTabsFor(documentUri).length === 1
      );
      const [erdTab] = erdEditorTabsFor(documentUri);
      const erdColumn = erdTab.group.viewColumn;

      await vscode.commands.executeCommand(
        'vuerd.showSourceToSide',
        documentUri
      );

      await waitUntil(
        'a source tab exists for sample.erd',
        () => sourceTabsFor(documentUri).length === 1
      );
      const [sourceTab] = sourceTabsFor(documentUri);
      assert.notStrictEqual(
        sourceTab.group.viewColumn,
        erdColumn,
        'the ViewColumn.Beside the command passes must land the source elsewhere'
      );
    });
  });

  describe('vuerd.showEditor', () => {
    it('takes a file that is open as text and shows it in the erd editor', async () => {
      await vscode.window.showTextDocument(documentUri);
      await waitUntil(
        'sample.erd is open as text',
        () => sourceTabsFor(documentUri).length === 1
      );

      // Also a fire-and-forget handler: it starts `vscode.openWith` and returns
      // undefined, so there is nothing to await but the observable tab state.
      await vscode.commands.executeCommand('vuerd.showEditor', documentUri);

      await waitUntil(
        'the erd editor took over sample.erd',
        () => erdEditorTabsFor(documentUri).length === 1
      );
    });
  });

  describe('vuerd.showEditorToSide', () => {
    it('opens the erd editor beside the source instead of over it', async () => {
      await vscode.window.showTextDocument(documentUri);
      await waitUntil(
        'sample.erd is open as text',
        () => sourceTabsFor(documentUri).length === 1
      );
      const [sourceTab] = sourceTabsFor(documentUri);
      const sourceColumn = sourceTab.group.viewColumn;

      await vscode.commands.executeCommand(
        'vuerd.showEditorToSide',
        documentUri
      );

      await waitUntil(
        'the erd editor is open',
        () => erdEditorTabsFor(documentUri).length === 1
      );
      const [erdTab] = erdEditorTabsFor(documentUri);
      assert.notStrictEqual(
        erdTab.group.viewColumn,
        sourceColumn,
        'the ViewColumn.Beside the command passes must land the editor elsewhere'
      );
      assert.strictEqual(
        sourceTabsFor(documentUri).length,
        1,
        'opening beside must leave the source tab where it was'
      );
    });
  });

  describe('supportsMultipleEditorsPerDocument', () => {
    it('keeps two erd editors open on one uri, which is what the broadcast logic assumes', async () => {
      await openErdEditor(documentUri);
      await waitUntil(
        'the first erd editor is open',
        () => erdEditorTabsFor(documentUri).length === 1
      );

      await openErdEditor(documentUri, vscode.ViewColumn.Beside);
      await waitUntil(
        'a second erd editor is open on the same uri',
        () => erdEditorTabsFor(documentUri).length === 2
      );

      // `ErdEditorProvider` maps one `ErdDocument` to a *set* of webviews and
      // `bootstrapWebview` relays every replication action to all of them but
      // the sender; without a second live editor that fan-out is dead code.
      // With `supportsMultipleEditorsPerDocument: false` VSCode would move the
      // single editor instead of resolving a second one.
      assert.strictEqual(
        viewColumnsOf(erdEditorTabsFor(documentUri)).size,
        2,
        'the second editor must resolve in its own group, not replace the first'
      );
    });
  });
});
