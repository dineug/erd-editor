import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';
import type {
  CustomDocumentBackupContext,
  CustomDocumentOpenContext,
  Uri as VscodeUri,
  WebviewPanel,
} from 'vscode';

import { VIEW_TYPE } from '@/constants/viewType';
import { CreateEditor } from '@/editor';
import { ErdDocument } from '@/erd-document';
import { ErdEditorProvider } from '@/erd-editor-provider';

import {
  createExtensionContext,
  createWebviewPanel,
  Disposable,
  MockExtensionContext,
  MockWebview,
  MockWebviewPanel,
  resetVscodeMock,
  Uri,
  window,
  workspace,
} from '../test/mocks/vscode';

const encoder = new TextEncoder();

type EditorDisposable = { dispose: () => void };
type DocToWebviewMap = Map<ErdDocument, Set<MockWebview>>;

/** Lets the event loop turn, so a promise that *can* settle already has. */
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

const resolveImmediately = (disposable: EditorDisposable) =>
  Promise.resolve(disposable);

function createEditorDouble(
  webview: MockWebview,
  bootstrap: (disposable: EditorDisposable) => Promise<EditorDisposable>
) {
  const disposable = { dispose: vi.fn() };

  return {
    webview,
    disposable,
    bootstrapWebview: vi.fn(() => bootstrap(disposable)),
  };
}

type EditorDouble = ReturnType<typeof createEditorDouble>;

/**
 * A `CreateEditor` double that records every editor it builds, so a spec can
 * tell the two editors of a split view apart.
 */
function createEditorFactory(
  bootstrap: (
    disposable: EditorDisposable
  ) => Promise<EditorDisposable> = resolveImmediately
) {
  const editors: EditorDouble[] = [];

  const createEditor = vi.fn(
    (
      _document: ErdDocument,
      webview: MockWebview,
      _context: MockExtensionContext,
      _docToWebviewMap: DocToWebviewMap
    ) => {
      const editor = createEditorDouble(webview, bootstrap);
      editors.push(editor);
      return editor;
    }
  );

  return { createEditor, editors };
}

/**
 * Builds a provider around an editor double. `createEditor` is the only seam
 * through which the private `docToWebviewMap` is observable — the provider
 * hands it the live map as the fourth argument.
 */
function createProvider(options?: {
  bootstrap?: (disposable: EditorDisposable) => Promise<EditorDisposable>;
}) {
  const context = createExtensionContext();
  const { createEditor, editors } = createEditorFactory(options?.bootstrap);

  const provider = new ErdEditorProvider(
    context as unknown as any,
    createEditor as unknown as CreateEditor
  );

  return { provider, context, createEditor, editors };
}

/** The map instance the provider really owns, as handed to `createEditor`. */
function liveMap(createEditor: { mock: { calls: any[][] } }): DocToWebviewMap {
  if (!createEditor.mock.calls.length) {
    throw new Error('createEditor has not run yet — resolve an editor first');
  }
  return createEditor.mock.calls[0][3];
}

/** Reference-identity view of the webviews registered for `document`. */
function webviewsOf(map: DocToWebviewMap, document: ErdDocument) {
  const set = map.get(document);
  if (!set) throw new Error('the document has no entry in docToWebviewMap');
  return set;
}

function openDocument(
  provider: ErdEditorProvider,
  path = '/workspace/sample.erd',
  openContext: Partial<CustomDocumentOpenContext> = {}
) {
  const context: CustomDocumentOpenContext = {
    backupId: undefined,
    untitledDocumentData: undefined,
    ...openContext,
  };

  return provider.openCustomDocument(
    Uri.file(path) as unknown as VscodeUri,
    context
  );
}

const asPanel = (panel: MockWebviewPanel) => panel as unknown as WebviewPanel;

/**
 * Opens a document whose `onDidChangeContent` subscriptions are observable.
 *
 * `ErdDocument.dispose()` tears down its own content emitter, so "a disposed
 * document notifies nobody" holds even if the provider never released the
 * subscription it took out. Watching the Disposable the provider was handed is
 * the only way to prove it actually unsubscribes.
 */
async function openDocumentTrackingSubscriptions(
  provider: ErdEditorProvider,
  path = '/workspace/sample.erd'
) {
  const document = ErdDocument.create(
    Uri.file(path) as unknown as VscodeUri,
    encoder.encode('initial')
  );
  const subscribe = document.onDidChangeContent;
  const subscriptions: Array<{ dispose: ReturnType<typeof vi.fn> }> = [];

  (document as any).onDidChangeContent = (listener: () => any) => {
    const subscription = subscribe(listener);
    const tracked = { dispose: vi.fn(() => subscription.dispose()) };
    subscriptions.push(tracked);
    return tracked;
  };

  const create = vi.spyOn(ErdDocument, 'create').mockReturnValue(document);
  const opened = await openDocument(provider, path);
  create.mockRestore();

  return { document: opened, subscriptions };
}

describe('ErdEditorProvider', () => {
  beforeEach(() => {
    resetVscodeMock();
  });

  afterEach(() => {
    // `openDocumentTrackingSubscriptions` and the delegation specs put spies on
    // real classes; leaving one behind would leak into the next spec.
    vi.restoreAllMocks();
  });

  describe('register', () => {
    it('registers the provider under the erd view type, keeping the webview alive when hidden', () => {
      const context = createExtensionContext();

      ErdEditorProvider.register(context as unknown as any, vi.fn() as any);

      expect(window.registerCustomEditorProvider).toHaveBeenCalledTimes(1);
      expect(window.registerCustomEditorProvider).toHaveBeenCalledWith(
        'editor.erd',
        expect.any(ErdEditorProvider),
        {
          webviewOptions: { retainContextWhenHidden: true },
          supportsMultipleEditorsPerDocument: true,
        }
      );
      expect(VIEW_TYPE).toBe('editor.erd');
    });

    it('returns the registration disposable so activate() can push it onto subscriptions', () => {
      const registration = new Disposable(() => undefined);
      window.registerCustomEditorProvider.mockReturnValue(registration);

      const result = ErdEditorProvider.register(
        createExtensionContext() as unknown as any,
        vi.fn() as any
      );

      expect(result).toBe(registration);
    });

    it('hands the registered provider the context and editor factory it was called with', async () => {
      const context = createExtensionContext('/registered-ext');
      const { createEditor } = createEditorFactory();

      ErdEditorProvider.register(
        context as unknown as any,
        createEditor as unknown as CreateEditor
      );
      const [, registered] = window.registerCustomEditorProvider.mock
        .calls[0] as unknown as [string, ErdEditorProvider];

      const document = await openDocument(registered);
      await registered.resolveCustomEditor(
        document,
        asPanel(createWebviewPanel())
      );

      expect(createEditor).toHaveBeenCalledTimes(1);
      const [, , passedContext] = createEditor.mock.calls[0];
      expect(passedContext).toBe(context);
    });
  });

  describe('openCustomDocument', () => {
    it('reads the file at the given uri when there is no backup to restore', async () => {
      const { provider } = createProvider();
      const onDisk = encoder.encode('on-disk');
      workspace.fs.readFile.mockResolvedValue(onDisk);

      const document = await openDocument(provider);

      expect(workspace.fs.readFile).toHaveBeenCalledTimes(1);
      const [readUri] = workspace.fs.readFile.mock.calls[0];
      expect(readUri.toString()).toBe('file:///workspace/sample.erd');
      expect(document.uri.toString()).toBe('file:///workspace/sample.erd');
      expect(document.content).toBe(onDisk);
    });

    it('reads from the backup uri when openContext.backupId is set — this branch is what restores unsaved work', async () => {
      const { provider } = createProvider();
      const backupId = Uri.file('/backups/sample.erd').toString();
      const backedUp = encoder.encode('unsaved edits');
      workspace.fs.readFile.mockResolvedValue(backedUp);

      const document = await openDocument(provider, '/workspace/sample.erd', {
        backupId,
      });

      expect(workspace.fs.readFile).toHaveBeenCalledTimes(1);
      const [readUri] = workspace.fs.readFile.mock.calls[0];
      expect(readUri.toString()).toBe(backupId);
      expect(readUri.path).toBe('/backups/sample.erd');
      // The document still belongs to the real file — only the content came
      // from the backup, otherwise a save would write back into the backup.
      expect(document.uri.toString()).toBe('file:///workspace/sample.erd');
      expect(document.content).toBe(backedUp);
    });

    // Characterises a gap against the real API: `CustomDocumentOpenContext`
    // says an untitled document arrives with its bytes attached and the fs
    // should not be touched. The provider reads the uri regardless.
    it('ignores untitledDocumentData and still reads the uri, which is what VSCode says not to do', async () => {
      const { provider } = createProvider();
      const onDisk = encoder.encode('on-disk');
      workspace.fs.readFile.mockResolvedValue(onDisk);

      const document = await openDocument(provider, '/untitled-1.erd', {
        untitledDocumentData: encoder.encode('never persisted'),
      });

      expect(workspace.fs.readFile).toHaveBeenCalledTimes(1);
      expect(document.content).toBe(onDisk);
    });

    it('seeds the document into the webview map with an empty set, so the first editor has somewhere to register', async () => {
      const { provider, createEditor } = createProvider();
      const opened = await openDocument(provider);
      await provider.resolveCustomEditor(opened, asPanel(createWebviewPanel()));
      const docToWebviewMap = liveMap(createEditor);

      const second = await openDocument(provider, '/workspace/other.erd');

      expect(docToWebviewMap.get(second)).toBeInstanceOf(Set);
      expect(webviewsOf(docToWebviewMap, second).size).toBe(0);
    });

    it('keeps the webviews already registered when the same document instance is opened again', async () => {
      const { provider, createEditor } = createProvider();
      const document = await openDocument(provider);
      const panel = createWebviewPanel();
      await provider.resolveCustomEditor(document, asPanel(panel));
      const docToWebviewMap = liveMap(createEditor);

      // VSCode reuses a CustomDocument for further editors of one resource, so
      // the `has` guard is what stops a second open from resetting the set and
      // orphaning the webview that is already attached.
      const create = vi.spyOn(ErdDocument, 'create').mockReturnValue(document);
      const reopened = await openDocument(provider);
      create.mockRestore();

      expect(reopened).toBe(document);
      expect(webviewsOf(docToWebviewMap, document).has(panel.webview)).toBe(
        true
      );
    });

    it('fires onDidChangeCustomDocument with the document when its content changes, which is what marks the tab dirty', async () => {
      const { provider } = createProvider();
      const document = await openDocument(provider);
      const listener = vi.fn();
      provider.onDidChangeCustomDocument(listener);

      await document.update(encoder.encode('edited'));

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ document });
    });

    it('fires one change event per document, naming the document that actually changed', async () => {
      const { provider } = createProvider();
      const first = await openDocument(provider, '/workspace/a.erd');
      const second = await openDocument(provider, '/workspace/b.erd');
      const listener = vi.fn();
      provider.onDidChangeCustomDocument(listener);

      await second.update(encoder.encode('edited'));

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith({ document: second });
      expect(listener).not.toHaveBeenCalledWith({ document: first });
    });

    it('drops the document from the webview map once it is disposed, so a closed tab is not tracked forever', async () => {
      const { provider, createEditor } = createProvider();
      const document = await openDocument(provider);
      const panel = createWebviewPanel();
      await provider.resolveCustomEditor(document, asPanel(panel));
      const docToWebviewMap = liveMap(createEditor);
      expect(docToWebviewMap.has(document)).toBe(true);

      document.dispose();

      expect(docToWebviewMap.has(document)).toBe(false);
    });

    it('disposes the content subscription it took out when the document goes away', async () => {
      const { provider } = createProvider();
      const { document, subscriptions } =
        await openDocumentTrackingSubscriptions(provider);
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0].dispose).not.toHaveBeenCalled();

      document.dispose();

      expect(subscriptions[0].dispose).toHaveBeenCalledTimes(1);
    });

    it('reports no further changes once the document is disposed, so a closed tab cannot go dirty again', async () => {
      const { provider } = createProvider();
      const document = await openDocument(provider);
      const listener = vi.fn();
      provider.onDidChangeCustomDocument(listener);

      document.dispose();
      await document.update(encoder.encode('edited after close'));

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('resolveCustomEditor', () => {
    it('registers the panel webview against the document and hands createEditor the live map', async () => {
      const { provider, context, createEditor } = createProvider();
      const document = await openDocument(provider);
      const panel = createWebviewPanel();

      await provider.resolveCustomEditor(document, asPanel(panel));

      expect(createEditor).toHaveBeenCalledTimes(1);
      const [passedDocument, passedWebview, passedContext, docToWebviewMap] =
        createEditor.mock.calls[0];
      expect(passedDocument).toBe(document);
      expect(passedWebview).toBe(panel.webview);
      expect(passedContext).toBe(context);
      // `has` is reference identity — a structurally identical clone of the
      // webview would be useless to the editor, which posts messages to it.
      const webviews = webviewsOf(docToWebviewMap, document);
      expect(webviews.has(panel.webview)).toBe(true);
      expect(webviews.size).toBe(1);
    });

    it('adds the webview before createEditor runs, so the editor can already broadcast to it', async () => {
      const { provider, createEditor } = createProvider();
      const document = await openDocument(provider);
      const panel = createWebviewPanel();
      const seenAtCreate: Array<Set<MockWebview>> = [];
      createEditor.mockImplementation(
        (_document, webview, _context, docToWebviewMap) => {
          seenAtCreate.push(new Set(docToWebviewMap.get(_document)));
          return createEditorDouble(webview, resolveImmediately);
        }
      );

      await provider.resolveCustomEditor(document, asPanel(panel));

      expect(seenAtCreate).toHaveLength(1);
      expect(seenAtCreate[0].has(panel.webview)).toBe(true);
      expect(seenAtCreate[0].size).toBe(1);
    });

    it('waits for bootstrapWebview before it resolves — the panel is not ready until the html is in place', async () => {
      let release: ((disposable: EditorDisposable) => void) | undefined;
      const { provider, editors } = createProvider({
        bootstrap: () =>
          new Promise<EditorDisposable>(resolve => {
            release = resolve;
          }),
      });
      const document = await openDocument(provider);
      let settled = false;

      const pending = provider
        .resolveCustomEditor(document, asPanel(createWebviewPanel()))
        .then(() => {
          settled = true;
        });
      await flush();

      expect(editors[0].bootstrapWebview).toHaveBeenCalledTimes(1);
      expect(settled).toBe(false);

      release?.({ dispose: () => undefined });
      await pending;

      expect(settled).toBe(true);
    });

    it('disposes what bootstrapWebview returned when the panel closes', async () => {
      const { provider, editors } = createProvider();
      const document = await openDocument(provider);
      const panel = createWebviewPanel();
      await provider.resolveCustomEditor(document, asPanel(panel));
      expect(editors[0].disposable.dispose).not.toHaveBeenCalled();

      panel.__dispose();

      expect(editors[0].disposable.dispose).toHaveBeenCalledTimes(1);
    });

    it('removes only the closed panel webview, leaving a split-view sibling of the same document connected', async () => {
      const { provider, createEditor, editors } = createProvider();
      const document = await openDocument(provider);
      const first = createWebviewPanel();
      const second = createWebviewPanel();
      await provider.resolveCustomEditor(document, asPanel(first));
      await provider.resolveCustomEditor(document, asPanel(second));
      const webviews = webviewsOf(liveMap(createEditor), document);
      expect(webviews.size).toBe(2);

      first.__dispose();

      expect(webviews.has(first.webview)).toBe(false);
      expect(webviews.has(second.webview)).toBe(true);
      expect(webviews.size).toBe(1);
      expect(editors[0].disposable.dispose).toHaveBeenCalledTimes(1);
      expect(editors[1].disposable.dispose).not.toHaveBeenCalled();
    });

    it('builds an editor for a document it never opened instead of throwing, and still cleans it up', async () => {
      const { provider, createEditor, editors } = createProvider();
      // VSCode always opens before it resolves, but the provider guards the
      // lookup with `?.` — that guard is what this pins down.
      const stray = ErdDocument.create(
        Uri.file('/workspace/stray.erd') as unknown as VscodeUri,
        encoder.encode('stray')
      );
      const panel = createWebviewPanel();

      await provider.resolveCustomEditor(stray, asPanel(panel));

      expect(createEditor).toHaveBeenCalledTimes(1);
      expect(liveMap(createEditor).has(stray)).toBe(false);

      panel.__dispose();

      expect(editors[0].disposable.dispose).toHaveBeenCalledTimes(1);
    });

    it('disposes the editor when the panel closes after its document was already disposed', async () => {
      const { provider, createEditor, editors } = createProvider();
      const document = await openDocument(provider);
      const panel = createWebviewPanel();
      await provider.resolveCustomEditor(document, asPanel(panel));
      const docToWebviewMap = liveMap(createEditor);

      document.dispose();
      panel.__dispose();

      expect(editors[0].disposable.dispose).toHaveBeenCalledTimes(1);
      expect(docToWebviewMap.has(document)).toBe(false);
    });

    // `bootstrapWebview` reads `index.html` off disk, so closing the tab while
    // it is in flight is a real race, not a theoretical one — the dispose event
    // arrives before the editor exists to be disposed.
    it('still disposes the editor when the panel closes while bootstrapWebview is pending', async () => {
      let release: (() => void) | undefined;
      const { provider, createEditor, editors } = createProvider({
        bootstrap: disposable =>
          new Promise<EditorDisposable>(resolve => {
            release = () => resolve(disposable);
          }),
      });
      const document = await openDocument(provider);
      const panel = createWebviewPanel();
      const pending = provider.resolveCustomEditor(document, asPanel(panel));
      await flush();

      panel.__dispose();
      release?.();
      await pending;

      expect(editors[0].disposable.dispose).toHaveBeenCalledTimes(1);
      expect(
        webviewsOf(liveMap(createEditor), document).has(panel.webview)
      ).toBe(false);
    });
  });

  describe('saveCustomDocument', () => {
    it('delegates to the document so a save writes the in-memory content', async () => {
      const { provider } = createProvider();
      const document = await openDocument(provider);
      const save = vi.spyOn(document, 'save').mockResolvedValue(undefined);

      await provider.saveCustomDocument(document);

      expect(save).toHaveBeenCalledTimes(1);
    });

    it('writes to the document uri, not to anywhere else', async () => {
      const { provider } = createProvider();
      workspace.fs.readFile.mockResolvedValue(encoder.encode('on-disk'));
      const document = await openDocument(provider);

      await provider.saveCustomDocument(document);

      expect(workspace.fs.writeFile).toHaveBeenCalledTimes(1);
      const [uri, content] = workspace.fs.writeFile.mock.calls[0];
      expect(uri).toBe(document.uri);
      expect(content).toBe(document.content);
    });
  });

  describe('saveCustomDocumentAs', () => {
    it('forwards the destination uri to the document', async () => {
      const { provider } = createProvider();
      const document = await openDocument(provider);
      const saveAs = vi.spyOn(document, 'saveAs').mockResolvedValue(undefined);
      const destination = Uri.file('/workspace/copy.erd');

      await provider.saveCustomDocumentAs(
        document,
        destination as unknown as VscodeUri
      );

      expect(saveAs).toHaveBeenCalledWith(destination);
    });
  });

  describe('revertCustomDocument', () => {
    it('delegates to the document so the content is reloaded from disk', async () => {
      const { provider } = createProvider();
      const document = await openDocument(provider);
      const revert = vi.spyOn(document, 'revert').mockResolvedValue(undefined);

      await provider.revertCustomDocument(document);

      expect(revert).toHaveBeenCalledTimes(1);
    });

    it('does not raise a change event, so a reverted tab does not stay dirty', async () => {
      const { provider } = createProvider();
      const document = await openDocument(provider);
      const listener = vi.fn();
      provider.onDidChangeCustomDocument(listener);
      const onDisk = encoder.encode('on-disk');
      workspace.fs.readFile.mockResolvedValue(onDisk);

      await provider.revertCustomDocument(document);

      expect(document.content).toBe(onDisk);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('backupCustomDocument', () => {
    it('backs up to context.destination and returns the backup VSCode needs to restore', async () => {
      const { provider } = createProvider();
      const document = await openDocument(provider);
      const destination = Uri.file('/backups/sample.erd');
      const backup = { id: destination.toString(), delete: vi.fn() };
      const spy = vi.spyOn(document, 'backup').mockResolvedValue(backup);
      const backupContext: CustomDocumentBackupContext = {
        destination: destination as unknown as VscodeUri,
      };

      const result = await provider.backupCustomDocument(
        document,
        backupContext
      );

      expect(spy).toHaveBeenCalledWith(destination);
      expect(result).toBe(backup);
    });
  });
});
