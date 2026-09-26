import { HubErrorCode } from '@dineug/erd-editor-agent-hub';
import {
  OPEN_READY_TIMEOUT_MS,
  REPLICA_DEBOUNCE_MS,
  SAVE_QUIET_CAP_MS,
} from '@dineug/erd-editor-agent-hub-host';
import { Effect } from 'effect';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  actionsSent,
  closedSent,
  createConnection,
  createHubHarness,
  fsError,
  microtasks,
  VAULT,
} from '@/__test-utils__/hub';

const NAME = 'a.erd.json';
const PATH = `${VAULT}/${NAME}`;
const EMPTY = '{"version":"3.0.0"}';

const add = (version: number, type = 'table.add') => ({
  type,
  payload: {},
  version,
});

const UNREADABLE_EDIT = `${PATH} is open only as a read-only view, since the editor cannot read the file as a diagram; fix the file, then call again`;

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('applyActions', () => {
  it('injects a peer batch into every ready tab and every other peer, never back to the sender', async () => {
    const harness = createHubHarness();
    const first = await harness.openReady(NAME);
    const second = await harness.openReady(NAME);
    const a = createConnection(1);
    const b = createConnection(2);
    await harness.run(harness.handler.join({ path: PATH }, a));
    await harness.run(harness.handler.join({ path: PATH }, b));
    await new Promise(resolve => setTimeout(resolve, 0));

    const result = await harness.run(
      harness.handler.applyActions({ path: PATH, actions: [add(3)] }, a)
    );

    expect(result).toEqual({ webviews: 2 });
    expect(first.tab.received).toEqual([[add(3)]]);
    expect(second.tab.received).toEqual([[add(3)]]);
    expect(actionsSent(b)).toEqual([[add(3)]]);
    expect(actionsSent(a)).toEqual([]);
  });

  it('refuses a document no tab shows with notOpen, opening nothing', async () => {
    const harness = createHubHarness();
    harness.addFile(NAME);

    await expect(
      harness.run(
        harness.handler.applyActions(
          { path: PATH, actions: [] },
          createConnection()
        )
      )
    ).rejects.toMatchObject({
      code: HubErrorCode.notOpen,
      message: `${PATH} is not open in an ERD editor that is ready; open it with openDocument, then join`,
    });
    expect(harness.vault.open).not.toHaveBeenCalled();
  });

  it('refuses a tab that is not ready yet, and one whose path has not resolved', async () => {
    const harness = createHubHarness();
    const loading = harness.addTab(NAME);
    const peer = createConnection();
    await microtasks();

    await expect(
      harness.run(
        harness.handler.applyActions({ path: PATH, actions: [] }, peer)
      )
    ).rejects.toMatchObject({ code: HubErrorCode.notOpen });
    expect(loading.tab.received).toEqual([]);

    let resolve!: (path: string) => void;
    harness.realpath.mockImplementationOnce(
      () => new Promise(done => (resolve = done))
    );
    const other = harness.addTab('b.erd');
    harness.registry.setTabState(other.tab, { live: true, unreadable: false });
    await expect(
      harness.run(
        harness.handler.applyActions(
          { path: `${VAULT}/b.erd`, actions: [] },
          peer
        )
      )
    ).rejects.toMatchObject({ code: HubErrorCode.notOpen });
    resolve(`${VAULT}/b.erd`);
  });

  it('refuses a peer that has not joined the document, which would miss the tab edits', async () => {
    const harness = createHubHarness();
    await harness.openReady(NAME);

    await expect(
      harness.run(
        harness.handler.applyActions(
          { path: PATH, actions: [] },
          createConnection()
        )
      )
    ).rejects.toMatchObject({
      code: HubErrorCode.notOpen,
      message: `Join ${PATH} before applying actions to it`,
    });
  });

  it('refuses a file no tab can read as read-only, ahead of the ready check', async () => {
    const harness = createHubHarness();
    await harness.openUnreadable(NAME);

    await expect(
      harness.run(
        harness.handler.applyActions(
          { path: PATH, actions: [] },
          createConnection()
        )
      )
    ).rejects.toMatchObject({
      code: HubErrorCode.readonly,
      message: UNREADABLE_EDIT,
    });
  });

  it('refuses a path that is no ERD file with badRequest', async () => {
    const harness = createHubHarness();

    await expect(
      harness.run(
        harness.handler.applyActions(
          { path: `${VAULT}/a.json`, actions: [] },
          createConnection()
        )
      )
    ).rejects.toMatchObject({ code: HubErrorCode.badRequest });
  });
});

describe('leave', () => {
  it('stops every delivery to the peer that left, and only to it', async () => {
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME);
    const leaving = createConnection(1);
    const staying = createConnection(2);
    await harness.run(harness.handler.join({ path: PATH }, leaving));
    await harness.run(harness.handler.join({ path: PATH }, staying));
    await new Promise(resolve => setTimeout(resolve, 0));

    const result = await harness.run(
      harness.handler.leave({ path: PATH }, leaving)
    );
    harness.relay(editor, [add(1)]);

    expect(result).toEqual({});
    expect(actionsSent(leaving)).toEqual([]);
    expect(actionsSent(staying)).toEqual([[add(1)]]);
    await expect(
      harness.run(
        harness.handler.applyActions({ path: PATH, actions: [] }, leaving)
      )
    ).rejects.toMatchObject({
      message: `Join ${PATH} before applying actions to it`,
    });
  });

  it('drops the queue of a peer that leaves inside its join window, and its join fails', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME);
    harness.relay(editor, [add(1)]);
    const peer = createConnection();

    const joined = harness.run(harness.handler.join({ path: PATH }, peer));
    const rejected = expect(joined).rejects.toMatchObject({
      code: HubErrorCode.notOpen,
    });
    harness.relay(editor, [add(2)]);
    await harness.run(harness.handler.leave({ path: PATH }, peer));
    harness.save(editor, '{}');
    await rejected;
    await vi.advanceTimersByTimeAsync(0);

    expect(peer.notify).not.toHaveBeenCalled();
  });

  it('answers a peer that never joined, or a path no tab shows, all the same', async () => {
    const harness = createHubHarness();
    await harness.openReady(NAME);

    await expect(
      harness.run(harness.handler.leave({ path: PATH }, createConnection()))
    ).resolves.toEqual({});
    await expect(
      harness.run(
        harness.handler.leave({ path: `${VAULT}/b.erd` }, createConnection())
      )
    ).resolves.toEqual({});
  });
});

describe('documentClosed', () => {
  it('tells the peers of a document when its last tab closes, and no one else', async () => {
    const harness = createHubHarness();
    const first = await harness.openReady(NAME);
    const second = await harness.openReady(NAME);
    await harness.openReady('b.erd');
    const peer = createConnection(1);
    const other = createConnection(2);
    await harness.run(harness.handler.join({ path: PATH }, peer));
    await harness.run(harness.handler.join({ path: `${VAULT}/b.erd` }, other));

    harness.registry.removeTab(first.tab);
    expect(closedSent(peer)).toEqual([]);
    harness.registry.removeTab(second.tab);

    expect(closedSent(peer)).toEqual([PATH]);
    expect(closedSent(other)).toEqual([]);
  });

  it('addresses it by the real path, not the vault path the tab opened', async () => {
    const harness = createHubHarness();
    harness.links.set(PATH, '/real/a.erd.json');
    const editor = await harness.openReady(NAME);
    const peer = createConnection();
    await harness.run(harness.handler.join({ path: '/real/a.erd.json' }, peer));

    harness.registry.removeTab(editor.tab);

    expect(closedSent(peer)).toEqual(['/real/a.erd.json']);
  });

  it('makes a reopened document take a fresh join before any batch', async () => {
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME);
    const peer = createConnection();
    await harness.run(harness.handler.join({ path: PATH }, peer));
    harness.registry.removeTab(editor.tab);

    await harness.openReady(NAME);

    await expect(
      harness.run(
        harness.handler.applyActions({ path: PATH, actions: [] }, peer)
      )
    ).rejects.toMatchObject({
      message: `Join ${PATH} before applying actions to it`,
    });
  });

  it('tells the peers of a reload from an outside change, keeping the observed version', async () => {
    const harness = createHubHarness();
    const first = await harness.openReady(NAME);
    const second = await harness.openReady(NAME);
    harness.relay(first, [add(7)]);
    harness.save(first, '{}');
    harness.save(second, '{}');
    const peer = createConnection();
    await harness.run(harness.handler.join({ path: PATH }, peer));

    harness.registry.loaded(first.tab, '{"outside":1}', true);
    harness.registry.loaded(second.tab, '{"outside":1}', true);
    const again = await harness.run(
      harness.handler.join({ path: PATH }, createConnection(2))
    );

    expect(closedSent(peer)).toEqual([PATH]);
    expect(again).toEqual({
      initialValue: '{"outside":1}',
      snapshotVersion: 7,
      readonly: false,
    });
    await expect(
      harness.run(
        harness.handler.applyActions({ path: PATH, actions: [] }, peer)
      )
    ).rejects.toMatchObject({ code: HubErrorCode.notOpen });
  });

  it('owes no save of the document a reload replaced: a save already waiting runs out its cap, later calls find it quiet', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME);
    harness.relay(editor, [add(4)]);
    let waiting: unknown;
    void harness
      .run(harness.handler.save({ path: PATH }, createConnection()))
      .then(value => (waiting = value));

    harness.registry.loaded(editor.tab, '{"outside":1}', true);
    editor.tab.savedText = '{"outside":1}';
    const listed = await harness.run(
      harness.handler.listDocuments({}, createConnection())
    );
    const saved = await harness.run(
      harness.handler.save({ path: PATH }, createConnection())
    );
    const joined = await harness.run(
      harness.handler.join({ path: PATH }, createConnection(2))
    );
    await vi.advanceTimersByTimeAsync(SAVE_QUIET_CAP_MS - 1);
    expect(waiting).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);

    expect(listed.documents).toEqual([
      expect.objectContaining({ path: PATH, dirty: false }),
    ]);
    expect(saved).toEqual({ saved: true });
    expect(joined).toEqual({
      initialValue: '{"outside":1}',
      snapshotVersion: 4,
      readonly: false,
    });
    expect(waiting).toEqual({ saved: false });
    expect(editor.tab.saveDocument).toHaveBeenCalledTimes(1);
  });

  it('tells the peers of a rename by the old path and serves the new one', async () => {
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME);
    const peer = createConnection();
    await harness.run(harness.handler.join({ path: PATH }, peer));
    const publish = vi.fn(async (_: string[]) => undefined);
    await harness.registry.setPublisher(publish);

    Object.assign(editor.file, { path: 'moved/a.erd.json' });
    harness.registry.renamed(editor.file);
    await microtasks();

    expect(closedSent(peer)).toEqual([PATH]);
    expect(publish).toHaveBeenLastCalledWith([`${VAULT}/moved/a.erd.json`]);
    expect(harness.registry.find(PATH)).toBeUndefined();
    const result = await harness.run(
      harness.handler.openDocument(
        { path: `${VAULT}/moved/a.erd.json` },
        createConnection(2)
      )
    );
    expect(result).toEqual({
      path: `${VAULT}/moved/a.erd.json`,
      opened: false,
      webviews: 1,
    });
  });
});

describe('disconnect', () => {
  it('removes a peer whose connection closed from every document', async () => {
    const harness = createHubHarness();
    const a = await harness.openReady(NAME);
    const b = await harness.openReady('b.erd');
    const peer = createConnection();
    await harness.run(harness.handler.join({ path: PATH }, peer));
    await harness.run(harness.handler.join({ path: `${VAULT}/b.erd` }, peer));
    await new Promise(resolve => setTimeout(resolve, 0));

    harness.handler.disconnect(peer);
    harness.relay(a, [add(1)]);
    harness.relay(b, [add(1)]);
    harness.registry.removeTab(a.tab);

    expect(peer.notify).not.toHaveBeenCalled();
  });
});

describe('save', () => {
  it('saves through the tab that writes the file and answers what it reports', async () => {
    const harness = createHubHarness();
    const writer = await harness.openReady(NAME);
    const other = await harness.openReady(NAME);

    const result = await harness.run(
      harness.handler.save({ path: PATH }, createConnection())
    );

    expect(result).toEqual({ saved: true });
    expect(writer.tab.saveDocument).toHaveBeenCalledTimes(1);
    expect(other.tab.saveDocument).not.toHaveBeenCalled();
  });

  it('answers saved false, logging it, when the tab reports the file still unsaved or its save throws', async () => {
    const harness = createHubHarness();
    const writer = await harness.openReady(NAME);

    writer.tab.saveResult = false;
    await expect(
      harness.run(harness.handler.save({ path: PATH }, createConnection()))
    ).resolves.toEqual({ saved: false });
    writer.tab.saveResult = new Error('EACCES');
    await expect(
      harness.run(harness.handler.save({ path: PATH }, createConnection()))
    ).resolves.toEqual({ saved: false });

    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      `${PATH} is still unsaved after its tab saved it`
    );
  });

  it('waits for the replica to save a fresh edit before it saves the document', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME);
    harness.relay(editor, [add(1)]);

    let result: unknown;
    void harness
      .run(harness.handler.save({ path: PATH }, createConnection()))
      .then(value => (result = value));
    await vi.advanceTimersByTimeAsync(100);
    expect(editor.tab.saveDocument).not.toHaveBeenCalled();

    harness.save(editor, '{"saved":1}');
    await vi.advanceTimersByTimeAsync(0);

    expect(result).toEqual({ saved: true });
    expect(editor.tab.saveDocument).toHaveBeenCalledTimes(1);
  });

  it('answers saved false and writes nothing when no replica saves the edit within its cap', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME);
    harness.relay(editor, [add(1)]);

    const saving = harness.run(
      harness.handler.save({ path: PATH }, createConnection())
    );
    await vi.advanceTimersByTimeAsync(SAVE_QUIET_CAP_MS);

    await expect(saving).resolves.toEqual({ saved: false });
    expect(editor.tab.saveDocument).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      `${PATH} has an edit no replica saved within ${SAVE_QUIET_CAP_MS} ms; its bytes may lack it, so nothing was saved`
    );
  });

  it('never takes a save sent before the replica held the batch for the one that holds it', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME);
    const peer = createConnection();
    await harness.run(harness.handler.join({ path: PATH }, peer));
    await harness.run(
      harness.handler.applyActions({ path: PATH, actions: [add(2)] }, peer)
    );

    let result: unknown;
    void harness
      .run(harness.handler.save({ path: PATH }, peer))
      .then(value => (result = value));
    harness.save(editor, '{"before":2}');
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toBeUndefined();

    await vi.advanceTimersByTimeAsync(REPLICA_DEBOUNCE_MS);
    harness.save(editor, '{"peer":2}');
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toEqual({ saved: true });
  });

  it('refuses with notOpen when the document closes while save waits for its replica', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME);
    harness.relay(editor, [add(1)]);

    const saving = harness.run(
      harness.handler.save({ path: PATH }, createConnection())
    );
    const rejected = expect(saving).rejects.toMatchObject({
      code: HubErrorCode.notOpen,
      message: `${PATH} closed before it could be saved`,
    });
    harness.registry.removeTab(editor.tab);
    await vi.advanceTimersByTimeAsync(SAVE_QUIET_CAP_MS);

    await rejected;
  });

  it('refuses a document no tab shows with notOpen, and a file no tab can read as read-only', async () => {
    const harness = createHubHarness();

    await expect(
      harness.run(harness.handler.save({ path: PATH }, createConnection()))
    ).rejects.toMatchObject({
      code: HubErrorCode.notOpen,
      message: `${PATH} is not open in an ERD editor`,
    });
    await harness.openUnreadable(NAME);
    await expect(
      harness.run(harness.handler.save({ path: PATH }, createConnection()))
    ).rejects.toMatchObject({
      code: HubErrorCode.readonly,
      message: `${PATH} is open only as a read-only view, since the editor cannot read the file as a diagram, and cannot be saved`,
    });
  });

  it('refuses a path that is no ERD file with badRequest, saving nothing', async () => {
    const harness = createHubHarness();

    await expect(
      harness.run(
        harness.handler.save({ path: `${VAULT}/a.md` }, createConnection())
      )
    ).rejects.toMatchObject({ code: HubErrorCode.badRequest });
  });
});

describe('openDocument', () => {
  it('opens a background tab and answers once it is ready', async () => {
    const harness = createHubHarness();
    harness.addFile(NAME, EMPTY);

    const result = await harness.run(
      harness.handler.openDocument({ path: PATH }, createConnection())
    );

    expect(result).toEqual({ path: PATH, opened: true, webviews: 1 });
    expect(harness.vault.open).toHaveBeenCalledWith(PATH);
  });

  it('answers at once, opening and writing nothing, when a ready tab already shows the file', async () => {
    const harness = createHubHarness();
    await harness.openReady(NAME);

    const result = await harness.run(
      harness.handler.openDocument(
        { path: PATH, create: true, initialValue: EMPTY },
        createConnection()
      )
    );

    expect(result).toEqual({ path: PATH, opened: false, webviews: 1 });
    expect(harness.vault.open).not.toHaveBeenCalled();
    expect(harness.vault.create).not.toHaveBeenCalled();
  });

  it('waits for a tab that is still loading, and answers opened', async () => {
    const harness = createHubHarness();
    const loading = harness.addTab(NAME);
    harness.setOpen(async () => {
      harness.registry.setTabState(loading.tab, {
        live: true,
        unreadable: false,
      });
    });

    const result = await harness.run(
      harness.handler.openDocument({ path: PATH }, createConnection())
    );

    expect(result).toEqual({ path: PATH, opened: true, webviews: 1 });
  });

  it('gives up after its cap with notOpen, even if the tab turns ready later', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    harness.addFile(NAME);
    harness.setOpen(async () => undefined);

    const opening = harness.run(
      harness.handler.openDocument({ path: PATH }, createConnection())
    );
    const rejected = expect(opening).rejects.toMatchObject({
      code: HubErrorCode.notOpen,
      message: `No ERD editor on ${PATH} reported ready within ${OPEN_READY_TIMEOUT_MS} ms`,
    });
    await vi.advanceTimersByTimeAsync(OPEN_READY_TIMEOUT_MS);
    await rejected;

    await harness.openReady(NAME);
  });

  it('answers a file no tab can read as read-only at once, and one that opens unreadable once it has', async () => {
    const harness = createHubHarness();
    await harness.openUnreadable(NAME);
    harness.addFile('b.erd', 'not json');
    harness.setOpen(async () => void harness.openUnreadable('b.erd'));

    await expect(
      harness.run(
        harness.handler.openDocument({ path: PATH }, createConnection())
      )
    ).rejects.toMatchObject({
      code: HubErrorCode.readonly,
      message: UNREADABLE_EDIT,
    });
    expect(harness.vault.open).not.toHaveBeenCalled();
    await expect(
      harness.run(
        harness.handler.openDocument(
          { path: `${VAULT}/b.erd` },
          createConnection()
        )
      )
    ).rejects.toMatchObject({ code: HubErrorCode.readonly });
  });

  it('creates a missing document from initialValue, then opens it', async () => {
    const harness = createHubHarness();

    const result = await harness.run(
      harness.handler.openDocument(
        { path: PATH, create: true, initialValue: EMPTY },
        createConnection()
      )
    );

    expect(harness.vault.create).toHaveBeenCalledWith(PATH, EMPTY);
    expect(harness.disk.get(PATH)).toBe(EMPTY);
    expect(result).toEqual({ path: PATH, opened: true, webviews: 1 });
  });

  it('leaves an existing document untouched when asked to create it', async () => {
    const harness = createHubHarness();
    harness.addFile(NAME, '{"kept":true}');

    await harness.run(
      harness.handler.openDocument(
        { path: PATH, create: true, initialValue: EMPTY },
        createConnection()
      )
    );

    expect(harness.disk.get(PATH)).toBe('{"kept":true}');
  });

  it('refuses create without initialValue with badRequest, writing and opening nothing', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();

    await expect(
      harness.run(
        harness.handler.openDocument(
          { path: PATH, create: true },
          createConnection()
        )
      )
    ).rejects.toMatchObject({
      code: HubErrorCode.badRequest,
      message:
        'openDocument with create needs a string initialValue, the bytes of an empty document',
    });
    expect(harness.vault.create).not.toHaveBeenCalled();
    expect(harness.vault.open).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('answers notFound for a missing file, and for a folder that does not exist on create', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();

    await expect(
      harness.run(
        harness.handler.openDocument({ path: PATH }, createConnection())
      )
    ).rejects.toMatchObject({
      code: HubErrorCode.notFound,
      message: `${PATH} does not exist`,
    });
    await expect(
      harness.run(
        harness.handler.openDocument(
          { path: `${VAULT}/gone/a.erd`, create: true, initialValue: EMPTY },
          createConnection()
        )
      )
    ).rejects.toMatchObject({
      code: HubErrorCode.notFound,
      message: `The folder of ${VAULT}/gone/a.erd does not exist`,
    });
    expect(harness.vault.open).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('passes on a failure it has no code for, cancelling its ready wait', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    harness.addFile(NAME);
    harness.fs.stat.mockImplementationOnce((path: string) =>
      Effect.fail(fsError('Busy', 'stat', path))
    );

    await expect(
      harness.run(
        harness.handler.openDocument({ path: PATH }, createConnection())
      )
    ).rejects.toMatchObject({ _tag: 'PlatformError' });
    harness.vault.create.mockRejectedValueOnce(new Error('EIO'));
    await expect(
      harness.run(
        harness.handler.openDocument(
          { path: PATH, create: true, initialValue: EMPTY },
          createConnection()
        )
      )
    ).rejects.toThrow('EIO');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('answers notOpen, with the reason, when Obsidian cannot open the tab', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    harness.addFile(NAME);
    harness.setOpen(() =>
      Promise.reject(new Error('the vault does not list the file'))
    );

    await expect(
      harness.run(
        harness.handler.openDocument({ path: PATH }, createConnection())
      )
    ).rejects.toMatchObject({
      code: HubErrorCode.notOpen,
      message: `Obsidian could not open ${PATH} in the ERD editor: Error: the vault does not list the file`,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('refuses a path that is no ERD file before it looks at the disk', async () => {
    const harness = createHubHarness();

    await expect(
      harness.run(
        harness.handler.openDocument(
          { path: `${VAULT}/MODEL.VUERD.JSON.bak` },
          createConnection()
        )
      )
    ).rejects.toMatchObject({ code: HubErrorCode.badRequest });
    await expect(
      harness.run(
        harness.handler.openDocument(
          { path: `${VAULT}/MODEL.VUERD.JSON` },
          createConnection()
        )
      )
    ).rejects.toMatchObject({ code: HubErrorCode.notFound });
    expect(harness.fs.stat).toHaveBeenCalledTimes(1);
  });
});

describe('listDocuments', () => {
  it('lists the open documents first, then every ERD file of the vault, each once by its real path', async () => {
    const harness = createHubHarness();
    harness.addFile('z.erd');
    harness.addFile('notes.md', '# notes');
    harness.addFile('link.vuerd');
    harness.links.set(`${VAULT}/link.vuerd`, `${VAULT}/b.erd.json`);
    harness.addFile('b.erd.json');
    await harness.openReady('c.erd');
    const open = await harness.openReady(NAME);
    harness.registry.setActive(open.tab);
    harness.relay(open, [add(1)]);

    const { documents } = await harness.run(
      harness.handler.listDocuments({}, createConnection())
    );

    const closed = (path: string) => ({
      path,
      open: false,
      active: false,
      dirty: false,
      readonly: false,
    });
    expect(documents).toEqual([
      {
        path: `${VAULT}/c.erd`,
        open: true,
        active: false,
        dirty: false,
        readonly: false,
      },
      { path: PATH, open: true, active: true, dirty: true, readonly: false },
      closed(`${VAULT}/z.erd`),
      closed(`${VAULT}/b.erd.json`),
    ]);
    expect(harness.vault.open).not.toHaveBeenCalled();
  });

  it('lists a document only its unreadable tabs show after the writable ones, as read-only', async () => {
    const harness = createHubHarness();
    await harness.openUnreadable('broken.erd');
    await harness.openReady(NAME);

    const { documents } = await harness.run(
      harness.handler.listDocuments({}, createConnection())
    );

    expect(documents.map(({ path, readonly }) => ({ path, readonly }))).toEqual(
      [
        { path: PATH, readonly: false },
        { path: `${VAULT}/broken.erd`, readonly: true },
      ]
    );
  });
});
