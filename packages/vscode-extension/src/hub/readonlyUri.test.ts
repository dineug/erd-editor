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
import { isReadonlyUri } from '@/hub/readonlyUri';

import {
  createConnection,
  createDocumentHarness,
} from '../../test/mocks/documentHarness';
import {
  commands,
  createTab,
  createTabGroup,
  resetVscodeMock,
  TabInputCustom,
  Uri,
  window,
} from '../../test/mocks/vscode';

beforeEach(() => {
  resetVscodeMock();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isReadonlyUri', () => {
  it.each([
    ['git', Uri.parse('git:/repo/a.erd.json'), true],
    [
      'conflictResolution',
      Uri.parse('conflictResolution:/repo/a.erd.json'),
      true,
    ],
    ['file', Uri.file('/repo/a.erd.json'), false],
    ['untitled', Uri.parse('untitled:Untitled-1'), false],
  ])('answers %s with %s', (_scheme, uri, expected) => {
    expect(isReadonlyUri(uri)).toBe(expected);
  });
});

describe('a read-only view at the hub', () => {
  const PATH = '/ws/a.erd.json';

  async function openGitView() {
    const harness = createDocumentHarness();
    harness.io.addFile(PATH, '{"version":"3.0.0"}');
    const editor = await harness.open(
      PATH,
      undefined,
      Uri.parse(`git:${PATH}`)
    );
    harness.ready(editor);
    return { harness, editor };
  }

  it('joins as readonly, with the content still readable', async () => {
    const { harness } = await openGitView();

    const result = await harness.handler.join(
      { path: PATH },
      createConnection()
    );

    expect(result).toEqual({
      initialValue: '{"version":"3.0.0"}',
      snapshotVersion: 0,
      readonly: true,
    });
  });

  it('refuses applyActions with readonly and reaches no webview', async () => {
    const { harness, editor } = await openGitView();
    const peer = createConnection();
    await harness.handler.join({ path: PATH }, peer);
    editor.webview.postMessage.mockClear();

    await expect(
      harness.handler.applyActions(
        { path: PATH, actions: [{ type: 'table.add', version: 1 }] },
        peer
      )
    ).rejects.toMatchObject({ code: HubErrorCode.readonly });
    expect(editor.webview.postMessage).not.toHaveBeenCalled();
  });

  it('refuses save with readonly', async () => {
    const { harness } = await openGitView();

    await expect(
      harness.handler.save({ path: PATH }, createConnection())
    ).rejects.toMatchObject({
      code: HubErrorCode.readonly,
    });
  });

  it('lists the view as open and readonly, and keeps it out of the lock', async () => {
    const { harness } = await openGitView();
    const publisher = vi.fn(async () => undefined);
    await harness.registry.setPublisher(publisher);

    const { documents } = await harness.handler.listDocuments(
      {},
      createConnection()
    );

    expect(documents).toEqual([
      { path: PATH, open: true, active: true, dirty: false, readonly: true },
    ]);
    expect(publisher).toHaveBeenLastCalledWith([]);
  });

  it('prefers the writable file document when a git view of the same path is open', async () => {
    const { harness } = await openGitView();
    const file = await harness.openReady(PATH);
    const peer = createConnection();

    const result = await harness.handler.join({ path: PATH }, peer);
    const { documents } = await harness.handler.listDocuments(
      {},
      createConnection()
    );

    expect(result.readonly).toBe(false);
    expect(harness.registry.find(PATH)).toBe(file.document);
    expect(documents).toEqual([
      expect.objectContaining({ path: PATH, readonly: false }),
    ]);
    await expect(
      harness.handler.applyActions({ path: PATH, actions: [] }, peer)
    ).resolves.toEqual({ webviews: 1 });
  });

  it('opens the file itself when only a git view of it is open, which then joins writable', async () => {
    const { harness } = await openGitView();
    const opened = harness.serveOpenWith();

    const result = await harness.handler.openDocument(
      { path: PATH },
      createConnection()
    );

    expect(commands.executeCommand).toHaveBeenCalledWith(
      'vscode.openWith',
      Uri.file(PATH),
      VIEW_TYPE,
      { preserveFocus: true, preview: false }
    );
    expect(result).toEqual({ path: PATH, opened: true, webviews: 1 });
    expect(harness.registry.find(PATH)).toBe(opened[0].document);
    await expect(
      harness.handler.join({ path: PATH }, createConnection())
    ).resolves.toMatchObject({ readonly: false });
  });

  it('points a refused batch at openDocument, the way to the file itself', async () => {
    const { harness } = await openGitView();

    await expect(
      harness.handler.applyActions(
        { path: PATH, actions: [] },
        createConnection()
      )
    ).rejects.toMatchObject({
      message: `${PATH} is open only as a read-only view, such as a git revision; openDocument opens the file itself`,
    });
  });

  it('reads dirty from the tabs of the file, never from a git view of the same path', async () => {
    const { harness, editor: view } = await openGitView();
    const file = await harness.openReady(PATH);
    const group = createTabGroup();
    window.tabGroups.all.push(group);
    createTab(
      group,
      new TabInputCustom(file.document.uri as unknown as Uri, VIEW_TYPE)
    );
    createTab(
      group,
      new TabInputCustom(view.document.uri as unknown as Uri, VIEW_TYPE),
      { isDirty: true }
    );

    const { documents } = await harness.handler.listDocuments(
      {},
      createConnection()
    );

    expect(documents).toEqual([
      { path: PATH, open: true, active: true, dirty: false, readonly: false },
    ]);
  });
});
