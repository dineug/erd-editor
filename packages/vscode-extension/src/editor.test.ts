import { createCommand } from '@dineug/erd-editor-vscode-bridge';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { Editor, widthEditor } from '@/editor';
import { ErdDocument } from '@/erd-document';

import {
  createExtensionContext,
  createWebview,
  Disposable,
  MockWebview,
  resetVscodeMock,
  Uri,
  workspace,
} from '../test/mocks/vscode';

const encoder = new TextEncoder();

/**
 * The shipped `public/index.html`, trimmed to the parts this module touches:
 * one `{{extension-base-url}}` inside `<base href>` and relative asset urls
 * that resolve against it.
 */
const SHIPPED_TEMPLATE =
  '<!doctype html><html><head><base href="{{extension-base-url}}"/>' +
  '<script defer="defer" src="./bundle.6468ad69.js"></script>' +
  '<link href="./bundle.284f3800.css" rel="stylesheet"></head><body></body></html>';

/**
 * What the real `Webview.asWebviewUri` hands back for a local folder — the
 * path is carried over verbatim, trailing slash included.
 */
const WEBVIEW_ASSETS_URL =
  'https://file+.vscode-resource.vscode-cdn.net/ext/public/';

const asDirPath = (path: string) => (path.endsWith('/') ? path : `${path}/`);

/** The smallest thing that satisfies the abstract base. */
class TestEditor extends Editor {
  assetsDir = 'public';

  /** `bridge` is protected on the base; the isolation specs need to see it. */
  get testBridge() {
    return this.bridge;
  }

  async bootstrapWebview() {
    return new Disposable(() => undefined);
  }
}

function createEditor(
  uri: Uri = Uri.file('/workspace/sample.erd'),
  EditorComponent: new (
    ...args: ConstructorParameters<typeof Editor>
  ) => Editor = TestEditor
) {
  const document = ErdDocument.create(uri as any, encoder.encode('{}'));
  const webview = createWebview();
  const context = createExtensionContext();
  const docToWebviewMap = new Map<ErdDocument, Set<MockWebview>>();
  const editor = new EditorComponent(
    document,
    webview as any,
    context as any,
    docToWebviewMap as any
  );

  return { editor, document, webview, context, docToWebviewMap };
}

describe('Editor', () => {
  beforeEach(() => {
    resetVscodeMock();
  });

  describe('readonly', () => {
    it('locks a git-scheme document — the git file system cannot be written back', () => {
      const { editor } = createEditor(Uri.parse('git:/repo/sample.erd'));

      expect(editor.readonly).toBe(true);
    });

    it('locks a conflictResolution document — a merge preview is not an editable file', () => {
      const { editor } = createEditor(
        Uri.parse('conflictResolution:/repo/sample.erd')
      );

      expect(editor.readonly).toBe(true);
    });

    it('leaves a file-scheme document editable', () => {
      const { editor } = createEditor(Uri.file('/workspace/sample.erd'));

      expect(editor.readonly).toBe(false);
    });

    it('leaves an untitled document editable — a new unsaved diagram must accept edits', () => {
      const { editor } = createEditor(Uri.parse('untitled:Untitled-1'));

      expect(editor.readonly).toBe(false);
    });

    it('answers from the document uri, not the extension uri', () => {
      const { editor, context } = createEditor(
        Uri.parse('git:/repo/sample.erd')
      );

      // The extension itself always lives on `file:`; if `readonly` ever read
      // that uri instead, every git document would silently become editable.
      expect(context.extensionUri.scheme).toBe('file');
      expect(editor.readonly).toBe(true);
    });
  });

  describe('buildHtmlForWebview', () => {
    it('reads index.html from <extensionUri>/<assetsDir>', async () => {
      const { editor } = createEditor();

      await editor.buildHtmlForWebview();

      expect(workspace.fs.readFile).toHaveBeenCalledTimes(1);
      const [uri] = workspace.fs.readFile.mock.calls[0];
      expect(uri.toString()).toBe('file:///ext/public/index.html');
    });

    it('honours the subclass assetsDir, including a nested one', async () => {
      class NestedEditor extends TestEditor {
        assetsDir = 'dist/webview';
      }
      const { editor } = createEditor(undefined, NestedEditor);

      await editor.buildHtmlForWebview();

      const [uri] = workspace.fs.readFile.mock.calls[0];
      expect(uri.toString()).toBe('file:///ext/dist/webview/index.html');
    });

    it('resolves the base url from the assets directory, not from index.html', async () => {
      const { editor, webview } = createEditor();

      await editor.buildHtmlForWebview();

      expect(webview.asWebviewUri).toHaveBeenCalledTimes(1);
      const [assetsUri] = webview.asWebviewUri.mock.calls[0];
      const [readUri] = workspace.fs.readFile.mock.calls[0];
      expect(assetsUri.scheme).toBe('file');
      // Production asks for `Uri.joinPath(publicUri, '/')`. The real
      // `Uri.joinPath` is `path.posix.join`, which keeps the trailing slash
      // (`/ext/public/`); the stub in `test/mocks/vscode.ts` normalises it
      // away. The slash is load-bearing for `<base href>`, so it is normalised
      // here instead of pinning either implementation's spelling — what this
      // asserts is the directory, and that it is not the html file itself.
      expect(asDirPath(assetsUri.path)).toBe('/ext/public/');
      expect(readUri.path).toBe(`${asDirPath(assetsUri.path)}index.html`);
    });

    it('substitutes the base url token with the webview-safe uri', async () => {
      const { editor, webview } = createEditor();
      workspace.fs.readFile.mockResolvedValue(encoder.encode(SHIPPED_TEMPLATE));
      // Arranged explicitly rather than leaning on the stub's default mapping,
      // so the expectation below is this spec's, not the stub's.
      webview.asWebviewUri.mockReturnValue(Uri.parse(WEBVIEW_ASSETS_URL));

      const html = await editor.buildHtmlForWebview();

      expect(html).toBe(
        SHIPPED_TEMPLATE.replace('{{extension-base-url}}', WEBVIEW_ASSETS_URL)
      );
      expect(html).not.toContain('{{extension-base-url}}');
      // A raw `file:` uri in the webview is blocked by its CSP — the whole
      // point of routing the assets dir through `asWebviewUri`.
      expect(html).not.toContain('file://');
    });

    it('emits a base url the template relative assets resolve against', async () => {
      const { editor, webview } = createEditor();
      workspace.fs.readFile.mockResolvedValue(encoder.encode(SHIPPED_TEMPLATE));
      webview.asWebviewUri.mockReturnValue(Uri.parse(WEBVIEW_ASSETS_URL));

      const html = await editor.buildHtmlForWebview();

      const baseUrl = /<base href="([^"]*)"/.exec(html)?.[1];
      expect(baseUrl).toBeTruthy();
      // `index.html` links its bundles relatively; if the substituted base url
      // ever loses its trailing directory, every asset resolves one level too
      // high and the webview boots blank.
      expect(new URL('./bundle.6468ad69.js', baseUrl).toString()).toBe(
        `${WEBVIEW_ASSETS_URL}bundle.6468ad69.js`
      );
    });

    it('decodes the template as UTF-8', async () => {
      const { editor, webview } = createEditor();
      workspace.fs.readFile.mockResolvedValue(
        encoder.encode('<title>다이어그램 편집기 — ERD</title>')
      );
      webview.asWebviewUri.mockReturnValue(Uri.parse(WEBVIEW_ASSETS_URL));

      const html = await editor.buildHtmlForWebview();

      expect(html).toBe('<title>다이어그램 편집기 — ERD</title>');
    });

    it('returns a token-free template untouched', async () => {
      const { editor } = createEditor();
      workspace.fs.readFile.mockResolvedValue(
        encoder.encode('<html><body>no token here</body></html>')
      );

      const html = await editor.buildHtmlForWebview();

      expect(html).toBe('<html><body>no token here</body></html>');
    });

    it('propagates a read failure instead of returning half-built html', async () => {
      const { editor } = createEditor();
      workspace.fs.readFile.mockRejectedValue(new Error('ENOENT'));

      // `ErdEditor.bootstrapWebview` assigns the result straight to
      // `webview.html`; a swallowed failure would paint an empty panel.
      await expect(editor.buildHtmlForWebview()).rejects.toThrow('ENOENT');
    });

    it('substitutes every occurrence of the token, not just the first', async () => {
      const { editor, webview } = createEditor();
      workspace.fs.readFile.mockResolvedValue(
        encoder.encode(
          '<base href="{{extension-base-url}}"/>' +
            '<script src="{{extension-base-url}}bundle.js"></script>'
        )
      );
      webview.asWebviewUri.mockReturnValue(Uri.parse(WEBVIEW_ASSETS_URL));

      const html = await editor.buildHtmlForWebview();

      // A string pattern would rewrite one occurrence and ship the literal
      // `{{extension-base-url}}` for the rest, breaking those asset loads.
      expect(html).toBe(
        `<base href="${WEBVIEW_ASSETS_URL}"/>` +
          `<script src="${WEBVIEW_ASSETS_URL}bundle.js"></script>`
      );
      expect(html).not.toContain('{{extension-base-url}}');
    });
  });
});

describe('widthEditor', () => {
  beforeEach(() => {
    resetVscodeMock();
  });

  it('constructs the given class with the four host arguments in order', () => {
    const create = widthEditor(TestEditor);
    const document = ErdDocument.create(
      Uri.file('/workspace/sample.erd') as any,
      encoder.encode('{}')
    );
    const webview = createWebview();
    const context = createExtensionContext();
    const docToWebviewMap = new Map<ErdDocument, Set<MockWebview>>();

    const editor = create(
      document,
      webview as any,
      context as any,
      docToWebviewMap as any
    );

    expect(editor).toBeInstanceOf(TestEditor);
    expect(editor.document).toBe(document);
    expect(editor.webview).toBe(webview);
    expect(editor.context).toBe(context);
    expect(editor.docToWebviewMap).toBe(docToWebviewMap);
  });

  it('builds a fresh editor per call — one webview panel must not share another one state', () => {
    const create = widthEditor(TestEditor);
    const document = ErdDocument.create(
      Uri.file('/workspace/sample.erd') as any,
      encoder.encode('{}')
    );
    const context = createExtensionContext();
    const docToWebviewMap = new Map<ErdDocument, Set<MockWebview>>();
    const first = createWebview();
    const second = createWebview();

    const one = create(
      document,
      first as any,
      context as any,
      docToWebviewMap as any
    ) as TestEditor;
    const two = create(
      document,
      second as any,
      context as any,
      docToWebviewMap as any
    ) as TestEditor;

    expect(one).not.toBe(two);
    expect(one.webview).toBe(first);
    expect(two.webview).toBe(second);
    expect(one.testBridge).not.toBe(two.testBridge);
  });

  it('gives each editor its own bridge — a message to one panel stays there', () => {
    const create = widthEditor(TestEditor);
    const document = ErdDocument.create(
      Uri.file('/workspace/sample.erd') as any,
      encoder.encode('{}')
    );
    const context = createExtensionContext();
    const docToWebviewMap = new Map<ErdDocument, Set<MockWebview>>();
    const command = createCommand<{ value: string }>('test.command');
    const onOne = vi.fn();
    const onTwo = vi.fn();

    const one = create(
      document,
      createWebview() as any,
      context as any,
      docToWebviewMap as any
    ) as TestEditor;
    const two = create(
      document,
      createWebview() as any,
      context as any,
      docToWebviewMap as any
    ) as TestEditor;
    one.testBridge.registerCommand(command, onOne);
    two.testBridge.registerCommand(command, onTwo);

    one.testBridge.executeAction({
      type: command.type,
      payload: { value: 'one' },
    });

    expect(onOne).toHaveBeenCalledTimes(1);
    expect(onOne).toHaveBeenCalledWith({ value: 'one' });
    expect(onTwo).not.toHaveBeenCalled();
  });
});
