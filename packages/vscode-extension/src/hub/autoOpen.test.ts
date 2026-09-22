import { readFileSync } from 'node:fs';

import { HubErrorCode } from '@dineug/erd-editor-agent-hub';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { VIEW_TYPE } from '@/constants/viewType';
import {
  ERD_FILE_EXTENSIONS,
  ERD_FILE_GLOB,
  OPEN_READY_TIMEOUT_MS,
} from '@/hub/handlers';

import {
  createConnection,
  createDocumentHarness,
  type DocumentHarness,
} from '../../test/mocks/documentHarness';
import { flush } from '../../test/mocks/hubIo';
import {
  commands,
  createTab,
  createTabGroup,
  resetVscodeMock,
  TabInputCustom,
  Uri,
  window,
  workspace,
} from '../../test/mocks/vscode';

const PATH = '/ws/a.erd.json';
const EMPTY_DOCUMENT = '{"$schema":"schema.json","version":"3.0.0"}';

const manifest: {
  activationEvents: string[];
  contributes: {
    customEditors: Array<{ selector: Array<{ filenamePattern: string }> }>;
  };
} = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')
);

beforeEach(() => {
  resetVscodeMock();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('applyActions never opens an editor', () => {
  it('refuses a document no editor has open with notOpen', async () => {
    const harness = createDocumentHarness();
    harness.io.addFile(PATH, '{}');

    await expect(
      harness.handler.applyActions(
        { path: PATH, actions: [{ type: 'table.add', version: 1 }] },
        createConnection()
      )
    ).rejects.toMatchObject({ code: HubErrorCode.notOpen });
    expect(commands.executeCommand).not.toHaveBeenCalled();
  });

  it('refuses a registered document whose webview has not reported ready', async () => {
    const harness = createDocumentHarness();
    await harness.open(PATH, '{}');
    const peer = createConnection();
    await harness.handler.join({ path: PATH }, peer);

    await expect(
      harness.handler.applyActions({ path: PATH, actions: [] }, peer)
    ).rejects.toMatchObject({
      code: HubErrorCode.notOpen,
      message: expect.stringContaining('open it with openDocument, then join'),
    });
  });

  it('refuses a peer that has not joined the document, which would miss the webview edits', async () => {
    const harness = createDocumentHarness();
    const editor = await harness.openReady(PATH, '{}');

    await expect(
      harness.handler.applyActions(
        { path: PATH, actions: [] },
        createConnection()
      )
    ).rejects.toMatchObject({
      code: HubErrorCode.notOpen,
      message: `Join ${PATH} before applying actions to it`,
    });
    expect(editor.webview.postMessage).toHaveBeenCalledTimes(3);
  });
});

describe('openDocument', () => {
  it('opens the document with the ERD editor and answers only once its webview is ready', async () => {
    const harness = createDocumentHarness();
    harness.io.addFile(PATH, '{}');
    const opened = harness.serveOpenWith(false);
    let result: unknown;

    harness.handler
      .openDocument({ path: PATH }, createConnection())
      .then(value => (result = value));
    await flush();

    expect(commands.executeCommand).toHaveBeenCalledWith(
      'vscode.openWith',
      Uri.file(PATH),
      VIEW_TYPE,
      { preserveFocus: true, preview: false }
    );
    expect(opened).toHaveLength(1);
    expect(result).toBeUndefined();

    harness.ready(opened[0]);
    await flush();
    expect(result).toEqual({ path: PATH, opened: true, webviews: 1 });
  });

  it('gives up after its cap with notOpen and nothing else, even if the webview turns ready later', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    harness.io.addFile(PATH, '{}');
    const opened = harness.serveOpenWith(false);

    const pending = harness.handler.openDocument(
      { path: PATH },
      createConnection()
    );
    const rejected = expect(pending).rejects.toMatchObject({
      code: HubErrorCode.notOpen,
      message: `No ERD editor on ${PATH} reported ready within ${OPEN_READY_TIMEOUT_MS} ms`,
    });
    await vi.advanceTimersByTimeAsync(OPEN_READY_TIMEOUT_MS - 1);
    await vi.advanceTimersByTimeAsync(1);
    await rejected;

    harness.ready(opened[0]);
    expect(commands.executeCommand).toHaveBeenCalledTimes(1);
    expect(opened[0].webview.postMessage).toHaveBeenCalledTimes(3);
  });

  it('answers at once, opening nothing, when a ready editor already shows the document', async () => {
    const harness = createDocumentHarness();
    await harness.openReady(PATH, '{}');

    const result = await harness.handler.openDocument(
      { path: PATH, create: true, initialValue: EMPTY_DOCUMENT },
      createConnection()
    );

    expect(result).toEqual({ path: PATH, opened: false, webviews: 1 });
    expect(commands.executeCommand).not.toHaveBeenCalled();
    expect(harness.io.createFile).not.toHaveBeenCalled();
  });

  it('shows a registered document whose webview is still loading and waits for it', async () => {
    const harness = createDocumentHarness();
    const editor = await harness.open(PATH, '{}');
    commands.executeCommand.mockImplementation(async () => {
      harness.ready(editor);
      return undefined;
    });

    const result = await harness.handler.openDocument(
      { path: PATH },
      createConnection()
    );

    expect(result).toEqual({ path: PATH, opened: true, webviews: 1 });
  });

  it('creates a missing document from initialValue with an exclusive create, then opens it', async () => {
    const harness = createDocumentHarness();
    harness.io.addDir('/ws');
    harness.serveOpenWith();

    const result = await harness.handler.openDocument(
      { path: PATH, create: true, initialValue: EMPTY_DOCUMENT },
      createConnection()
    );

    expect(harness.io.createFile).toHaveBeenCalledWith(PATH, EMPTY_DOCUMENT);
    expect(harness.io.files.get(PATH)?.data).toBe(EMPTY_DOCUMENT);
    expect(result).toEqual({ path: PATH, opened: true, webviews: 1 });
  });

  it('leaves an existing document untouched when asked to create it', async () => {
    const harness = createDocumentHarness();
    harness.io.addFile(PATH, '{"mine":true}');
    harness.serveOpenWith();

    await harness.handler.openDocument(
      { path: PATH, create: true, initialValue: EMPTY_DOCUMENT },
      createConnection()
    );

    expect(harness.io.files.get(PATH)?.data).toBe('{"mine":true}');
    expect(harness.io.writeFile).not.toHaveBeenCalled();
  });

  it('refuses create without initialValue with badRequest, writing and opening nothing', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    harness.io.addDir('/ws');

    await expect(
      harness.handler.openDocument(
        { path: PATH, create: true },
        createConnection()
      )
    ).rejects.toMatchObject({ code: HubErrorCode.badRequest });
    expect(harness.io.createFile).not.toHaveBeenCalled();
    expect(commands.executeCommand).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    [
      'a missing document without create',
      { path: PATH },
      { code: HubErrorCode.notFound, message: `${PATH} does not exist` },
    ],
    [
      'a document to create in a missing folder',
      { path: '/ws/new/b.erd.json', create: true, initialValue: '{}' },
      {
        code: HubErrorCode.notFound,
        message: 'The folder of /ws/new/b.erd.json does not exist',
      },
    ],
  ])('answers %s with notFound', async (_label, params, error) => {
    const harness = createDocumentHarness();
    harness.io.addDir('/ws');

    await expect(
      harness.handler.openDocument(params, createConnection())
    ).rejects.toMatchObject(error);
    expect(commands.executeCommand).not.toHaveBeenCalled();
  });

  it('passes on a file system failure it has no code for', async () => {
    const harness = createDocumentHarness();
    harness.io.createFile.mockRejectedValueOnce(
      Object.assign(new Error('EACCES'), { code: 'EACCES' })
    );
    harness.io.stat.mockRejectedValueOnce(
      Object.assign(new Error('EIO'), { code: 'EIO' })
    );

    await expect(
      harness.handler.openDocument(
        { path: PATH, create: true, initialValue: '{}' },
        createConnection()
      )
    ).rejects.toMatchObject({ message: 'EACCES' });
    await expect(
      harness.handler.openDocument({ path: PATH }, createConnection())
    ).rejects.toMatchObject({ message: 'EIO' });
  });

  it('answers notOpen, with the reason, when VS Code cannot open the editor', async () => {
    const harness = createDocumentHarness();
    harness.io.addFile(PATH, '{}');
    commands.executeCommand.mockRejectedValueOnce(new Error('no such editor'));

    await expect(
      harness.handler.openDocument({ path: PATH }, createConnection())
    ).rejects.toMatchObject({
      code: HubErrorCode.notOpen,
      message: `VS Code could not open ${PATH} in the ERD editor: Error: no such editor`,
    });
  });
});

describe('the read paths open nothing', () => {
  it('lists open and unopened documents without opening an editor', async () => {
    const harness = createDocumentHarness();
    harness.io.addFile('/real/c.erd.json', '{}');
    harness.io.links.set('/link', '/real');
    const open = await harness.openReady(PATH, '{}');
    workspace.findFiles.mockResolvedValue([
      Uri.file(PATH),
      Uri.file('/ws/b.vuerd.json'),
      Uri.file('/link/c.erd.json'),
    ]);
    const group = createTabGroup();
    window.tabGroups.all.push(group);
    createTab(group, new TabInputCustom(open.document.uri as any, VIEW_TYPE), {
      isDirty: true,
    });
    createTab(
      group,
      new TabInputCustom(Uri.file('/ws/b.vuerd.json'), VIEW_TYPE),
      {
        isDirty: true,
      }
    );
    createTab(
      group,
      new TabInputCustom(Uri.file('/link/c.erd.json'), 'other'),
      {
        isDirty: true,
      }
    );

    const { documents } = await harness.handler.listDocuments(
      {},
      createConnection()
    );

    expect(workspace.findFiles).toHaveBeenCalledWith(
      ERD_FILE_GLOB,
      '**/node_modules/**'
    );
    expect(documents).toEqual([
      { path: PATH, open: true, active: true, dirty: true, readonly: false },
      {
        path: '/ws/b.vuerd.json',
        open: false,
        active: false,
        dirty: true,
        readonly: false,
      },
      {
        path: '/real/c.erd.json',
        open: false,
        active: false,
        dirty: false,
        readonly: false,
      },
    ]);
    expect(commands.executeCommand).not.toHaveBeenCalled();
  });

  it('joins an unopened document from disk without opening it', async () => {
    const harness = createDocumentHarness();
    harness.io.addFile(PATH, '{}');

    await harness.handler.join({ path: PATH }, createConnection());

    expect(commands.executeCommand).not.toHaveBeenCalled();
    expect(harness.registry.find(PATH)).toBeUndefined();
  });

  it('searches with the activation glob, so it lists what wakes the extension', () => {
    expect(manifest.activationEvents).toContain(
      `workspaceContains:${ERD_FILE_GLOB}`
    );
  });
});

describe('paths that are no ERD file', () => {
  const peer = createConnection();

  it.each([
    [
      'openDocument',
      (harness: DocumentHarness) =>
        harness.handler.openDocument({ path: '/ws/schema.sql' }, peer),
    ],
    [
      'openDocument with create',
      (harness: DocumentHarness) =>
        harness.handler.openDocument(
          {
            path: '/ws/notes.txt',
            create: true,
            initialValue: EMPTY_DOCUMENT,
          },
          peer
        ),
    ],
    [
      'join',
      (harness: DocumentHarness) =>
        harness.handler.join({ path: '/ws/schema.sql' }, peer),
    ],
    [
      'applyActions',
      (harness: DocumentHarness) =>
        harness.handler.applyActions(
          { path: '/ws/schema.sql', actions: [] },
          peer
        ),
    ],
  ])(
    'refuses %s with badRequest, opening, reading and writing nothing',
    async (_label, request) => {
      const harness = createDocumentHarness();
      harness.io.addFile('/ws/schema.sql', 'create table a (id int);');

      await expect(request(harness)).rejects.toMatchObject({
        code: HubErrorCode.badRequest,
      });
      expect(commands.executeCommand).not.toHaveBeenCalled();
      expect(harness.io.createFile).not.toHaveBeenCalled();
      expect(harness.io.readFile).not.toHaveBeenCalled();
    }
  );

  it('names the extensions it serves, matching them without regard to case', async () => {
    const harness = createDocumentHarness();

    await expect(
      harness.handler.join({ path: '/ws/schema.sql' }, peer)
    ).rejects.toMatchObject({
      message:
        '/ws/schema.sql is not an ERD file; the hub serves .erd, .vuerd, .erd.json, .vuerd.json only',
    });
    await expect(
      harness.handler.join({ path: '/ws/MODEL.VUERD.JSON' }, peer)
    ).rejects.toMatchObject({ code: HubErrorCode.notFound });
  });

  it('serves the extensions of the custom editor selector, no more and no fewer', () => {
    const patterns = manifest.contributes.customEditors.flatMap(
      ({ selector }) => selector.map(({ filenamePattern }) => filenamePattern)
    );

    expect([...patterns].sort()).toEqual(
      ERD_FILE_EXTENSIONS.map(extension => `*.${extension}`).sort()
    );
  });
});
