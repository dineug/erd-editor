import { HubErrorCode } from '@dineug/erd-editor-agent-hub';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';
import type { Uri as VscodeUri } from 'vscode';

import { SAVE_QUIET_CAP_MS } from '@/hub/handlers';
import { REPLICA_DEBOUNCE_MS } from '@/hub/joinWindow';

import {
  createConnection,
  createDocumentHarness,
  type DocumentHarness,
  microtasks,
  type OpenedEditor,
} from '../../test/mocks/documentHarness';
import {
  commands,
  type MockTab,
  resetVscodeMock,
  Uri,
  workspace,
} from '../../test/mocks/vscode';

const PATH = '/ws/a.erd.json';
const EDIT = [{ type: 'table.add', payload: { id: 't1' }, version: 3 }];

beforeEach(() => {
  resetVscodeMock();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/**
 * An open document with a tab whose dirty flag follows the document, a
 * joined peer, and an edit the replica has saved into document.content.
 */
async function editedDocument() {
  vi.useFakeTimers();
  const harness = createDocumentHarness();
  const editor = await harness.openReady(PATH, '{}');
  const tab = harness.trackTab(editor);
  const peer = createConnection();
  await harness.handler.join({ path: PATH }, peer);
  await harness.handler.applyActions({ path: PATH, actions: EDIT }, peer);
  await vi.advanceTimersByTimeAsync(REPLICA_DEBOUNCE_MS);
  await harness.saveValue(editor, '{"tables":["t1"]}');
  return { harness, editor, tab, peer };
}

/** workspace.save the way VS Code runs it for a custom editor: saveCustomDocument, then clean. */
function serveWorkspaceSave(
  harness: DocumentHarness,
  editor: OpenedEditor,
  tab: MockTab
) {
  workspace.save.mockImplementation(async uri => {
    await harness.provider.saveCustomDocument(editor.document);
    tab.isDirty = false;
    return uri;
  });
}

describe('save', () => {
  it('leaves the edit in memory and the tab dirty until saved, writing no file', async () => {
    const { harness, tab } = await editedDocument();

    expect(tab.isDirty).toBe(true);
    expect(workspace.fs.writeFile).not.toHaveBeenCalled();
    expect(harness.io.files.get(PATH)?.data).toBe('{}');
  });

  it('saves through workspace.save first, which writes the bytes and clears dirty', async () => {
    const { harness, editor, tab } = await editedDocument();
    serveWorkspaceSave(harness, editor, tab);

    const result = await harness.handler.save(
      { path: PATH },
      createConnection()
    );

    expect(result).toEqual({ saved: true });
    expect(workspace.save).toHaveBeenCalledWith(editor.document.uri);
    expect(harness.io.files.get(PATH)?.data).toBe('{"tables":["t1"]}');
    expect(tab.isDirty).toBe(false);
    expect(commands.executeCommand).not.toHaveBeenCalled();
    expect(editor.panel.reveal).not.toHaveBeenCalled();
  });

  it('falls back to revealing the panel and the save command when the tab stays dirty', async () => {
    const { harness, editor, tab } = await editedDocument();
    const order: string[] = [];
    workspace.save.mockImplementation(async () => {
      order.push('workspace.save');
      return undefined;
    });
    editor.panel.reveal.mockImplementation(() => order.push('reveal'));
    commands.executeCommand.mockImplementation(async (...args: unknown[]) => {
      order.push(String(args[0]));
      tab.isDirty = false;
      return undefined;
    });

    const result = await harness.handler.save(
      { path: PATH },
      createConnection()
    );

    expect(result).toEqual({ saved: true });
    expect(order).toEqual([
      'workspace.save',
      'reveal',
      'workbench.action.files.save',
    ]);
  });

  it('moves to the second rung when workspace.save throws', async () => {
    const { harness, tab } = await editedDocument();
    workspace.save.mockRejectedValueOnce(new Error('no editor'));
    commands.executeCommand.mockImplementation(async () => {
      tab.isDirty = false;
      return undefined;
    });

    await expect(
      harness.handler.save({ path: PATH }, createConnection())
    ).resolves.toEqual({
      saved: true,
    });
    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      `workspace.save failed for ${PATH}`,
      expect.objectContaining({ message: 'no editor' })
    );
  });

  it('answers saved false, honestly, when no rung clears dirty, never writing the file itself', async () => {
    const { harness } = await editedDocument();
    workspace.save.mockResolvedValue(undefined);
    commands.executeCommand.mockRejectedValueOnce(new Error('busy'));

    const result = await harness.handler.save(
      { path: PATH },
      createConnection()
    );

    expect(result).toEqual({ saved: false });
    expect(workspace.fs.writeFile).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      `workbench.action.files.save failed for ${PATH}`,
      expect.objectContaining({ message: 'busy' })
    );
    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      `${PATH} is still dirty after every way to save it`
    );
  });

  it('skips the second rung when the document has no panel left to reveal', async () => {
    const harness = createDocumentHarness();
    harness.io.addFile(PATH, '{}');
    const document = await harness.provider.openCustomDocument(
      Uri.file(PATH) as unknown as VscodeUri,
      { backupId: undefined, untitledDocumentData: undefined }
    );
    harness.trackTab({ document } as OpenedEditor).isDirty = true;
    workspace.save.mockResolvedValue(undefined);

    await expect(
      harness.handler.save({ path: PATH }, createConnection())
    ).resolves.toEqual({
      saved: false,
    });
    expect(commands.executeCommand).not.toHaveBeenCalled();
  });

  it('waits for the replica to save a fresh edit before it saves the document', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    const editor = await harness.openReady(PATH, '{}');
    const tab = harness.trackTab(editor);
    serveWorkspaceSave(harness, editor, tab);
    const peer = createConnection();
    await harness.handler.join({ path: PATH }, peer);
    await harness.handler.applyActions({ path: PATH, actions: EDIT }, peer);

    const saved = harness.handler.save({ path: PATH }, createConnection());
    await microtasks();
    expect(workspace.save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(REPLICA_DEBOUNCE_MS);
    await harness.saveValue(editor, '{"tables":["t1"]}');
    await expect(saved).resolves.toEqual({ saved: true });
    expect(harness.io.files.get(PATH)?.data).toBe('{"tables":["t1"]}');
  });

  it('answers saved false and writes nothing when no replica saves the edit within its cap', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    const editor = await harness.openReady(PATH, '{}');
    const tab = harness.trackTab(editor);
    serveWorkspaceSave(harness, editor, tab);
    const peer = createConnection();
    await harness.handler.join({ path: PATH }, peer);
    await harness.handler.applyActions({ path: PATH, actions: EDIT }, peer);

    const saved = harness.handler.save({ path: PATH }, createConnection());
    await vi.advanceTimersByTimeAsync(SAVE_QUIET_CAP_MS);

    await expect(saved).resolves.toEqual({ saved: false });
    expect(workspace.save).not.toHaveBeenCalled();
    expect(harness.io.files.get(PATH)?.data).toBe('{}');
    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      `${PATH} has an edit no replica saved within ${SAVE_QUIET_CAP_MS} ms; its bytes may lack it, so nothing was saved`
    );
  });

  it('never takes a save sent before the replica held the batch for the one that holds it', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    const editor = await harness.openReady(PATH, '{}');
    const tab = harness.trackTab(editor);
    serveWorkspaceSave(harness, editor, tab);
    const peer = createConnection();
    await harness.handler.join({ path: PATH }, peer);
    harness.relay(editor, [{ type: 'table.add', payload: { id: 'u1' } }]);
    await vi.advanceTimersByTimeAsync(150);
    await harness.handler.applyActions({ path: PATH, actions: EDIT }, peer);

    const saved = harness.handler.save({ path: PATH }, createConnection());
    await vi.advanceTimersByTimeAsync(60);
    await harness.saveValue(editor, '{"tables":["u1"]}');
    expect(workspace.save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(REPLICA_DEBOUNCE_MS - 60);
    await harness.saveValue(editor, '{"tables":["u1","t1"]}');
    await expect(saved).resolves.toEqual({ saved: true });
    expect(harness.io.files.get(PATH)?.data).toBe('{"tables":["u1","t1"]}');
  });

  it('refuses with notOpen when the document closes while save waits for its replica', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    const editor = await harness.openReady(PATH, '{}');
    const peer = createConnection();
    await harness.handler.join({ path: PATH }, peer);
    await harness.handler.applyActions({ path: PATH, actions: EDIT }, peer);

    const saved = harness.handler.save({ path: PATH }, createConnection());
    const rejected = expect(saved).rejects.toMatchObject({
      code: HubErrorCode.notOpen,
      message: `${PATH} closed before it could be saved`,
    });
    editor.document.dispose();
    await vi.advanceTimersByTimeAsync(SAVE_QUIET_CAP_MS);

    await rejected;
    expect(workspace.save).not.toHaveBeenCalled();
  });

  it('refuses a path that is no ERD file with badRequest, saving nothing', async () => {
    const harness = createDocumentHarness();

    await expect(
      harness.handler.save({ path: '/ws/schema.sql' }, createConnection())
    ).rejects.toMatchObject({ code: HubErrorCode.badRequest });
    expect(workspace.save).not.toHaveBeenCalled();
  });

  it('refuses a document no editor has open with notOpen', async () => {
    const harness = createDocumentHarness();
    harness.io.addFile(PATH, '{}');

    await expect(
      harness.handler.save({ path: PATH }, createConnection())
    ).rejects.toMatchObject({
      code: HubErrorCode.notOpen,
    });
    expect(workspace.save).not.toHaveBeenCalled();
  });
});
