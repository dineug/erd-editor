import { HubErrorCode } from '@dineug/erd-editor-agent-hub';
import {
  JOIN_QUIET_CAP_MS,
  REPLICA_DEBOUNCE_MS,
} from '@dineug/erd-editor-agent-hub-host';
import { Deferred, Effect } from 'effect';
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
  FakeTab,
  microtasks,
  VAULT,
} from '@/__test-utils__/hub';
import { DocumentRegistry } from '@/hub/registry';

const NAME = 'a.erd';
const PATH = `${VAULT}/${NAME}`;

const add = (version: number, type = 'table.add') => ({
  type,
  payload: {},
  version,
});

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('tabs', () => {
  it('keeps the tabs of a file in the order they opened, the first writing it', async () => {
    const harness = createHubHarness();
    const first = await harness.openReady(NAME);
    const second = await harness.openReady(NAME);
    const document = harness.registry.find(PATH)!;

    expect(harness.registry.tabsOf(first.file)).toEqual([
      first.tab,
      second.tab,
    ]);
    expect(harness.registry.writer(document)).toBe(first.tab);

    harness.registry.removeTab(first.tab);
    expect(harness.registry.writer(document)).toBe(second.tab);
    harness.registry.removeTab(second.tab);
    expect(harness.registry.tabsOf(first.file)).toBeUndefined();
  });

  it('moves a tab that opens another file, closing the first document behind it', async () => {
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME);
    const peer = createConnection();
    await harness.run(harness.handler.join({ path: PATH }, peer));
    const other = harness.addFile('b.erd');

    harness.registry.addTab(other, editor.tab);

    expect(harness.registry.tabsOf(editor.file)).toBeUndefined();
    expect(harness.registry.tabsOf(other)).toEqual([editor.tab]);
    expect(closedSent(peer)).toEqual([PATH]);
  });

  it('counts a tab ready only once live and resolved, and not while unreadable', async () => {
    const harness = createHubHarness();
    let resolve!: (path: string) => void;
    harness.realpath.mockImplementationOnce(
      () => new Promise(done => (resolve = done))
    );
    const { tab } = harness.addTab(NAME);
    harness.registry.setTabState(tab, { live: true, unreadable: false });
    const document = harness.registry.find(PATH)!;
    expect(harness.registry.readyTabCount(document)).toBe(0);

    resolve(PATH);
    await microtasks();
    expect(harness.registry.readyTabCount(document)).toBe(1);

    harness.registry.setTabState(tab, { live: true, unreadable: true });
    expect(harness.registry.readyTabCount(document)).toBe(0);
    expect(harness.registry.isReadonly(document)).toBe(true);
    harness.registry.setTabState(tab, { live: false, unreadable: false });
    expect(harness.registry.readyTabCount(document)).toBe(0);
    expect(harness.registry.isReadonly(document)).toBe(false);
  });

  it('ignores what a tab it does not hold reports', () => {
    const harness = createHubHarness();
    const stranger = new FakeTab();

    harness.registry.removeTab(stranger);
    harness.registry.setTabState(stranger, { live: true, unreadable: false });
    harness.registry.loaded(stranger, '{}', true);
    harness.registry.relay(stranger, [add(1)]);
    harness.registry.valueSaved(stranger, '{}');
    harness.registry.setActive(stranger);
    harness.registry.renamed({ path: 'nothing.erd' });

    expect(harness.registry.documents()).toEqual([]);
  });

  it('prefers a document a tab can edit over one only unreadable tabs show at the same real path', async () => {
    const harness = createHubHarness();
    harness.links.set(`${VAULT}/link.erd`, PATH);
    const view = await harness.openUnreadable('link.erd');
    const editor = await harness.openReady(NAME);

    const found = harness.registry.find(PATH)!;
    expect(harness.registry.tabsOf(editor.file)).toContain(found.tabs[0]);
    expect(harness.registry.findWritable(PATH)).toBe(found);
    harness.registry.removeTab(editor.tab);
    expect(harness.registry.find(PATH)?.tabs).toEqual([view.tab]);
    expect(harness.registry.findWritable(PATH)).toBeUndefined();
  });
});

describe('relay to peers', () => {
  it('hands every relay of a tab to a joined peer, as its shared store emitted it', async () => {
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME);
    const peer = createConnection();
    await harness.run(harness.handler.join({ path: PATH }, peer));
    await new Promise(resolve => setTimeout(resolve, 0));

    harness.relay(editor, [add(1)]);
    harness.relay(editor, [{ type: 'editor.getLWW', version: 1 }]);
    harness.relay(editor, { not: 'an array' });

    expect(actionsSent(peer)).toEqual([
      [add(1)],
      [{ type: 'editor.getLWW', version: 1 }],
    ]);
  });

  it('observes every version from the moment a tab opens, whether or not a peer joined', async () => {
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME);

    harness.relay(editor, [add(3), { type: 'table.move' }]);
    harness.relay(editor, [add(2)]);
    const result = await harness.run(
      harness.handler.join({ path: PATH }, createConnection())
    );

    expect(result.snapshotVersion).toBe(3);
  });

  it('never injects into a tab that is not ready', async () => {
    const harness = createHubHarness();
    const ready = await harness.openReady(NAME);
    const loading = harness.addTab(NAME);
    const peer = createConnection();
    await harness.run(harness.handler.join({ path: PATH }, peer));

    const result = await harness.run(
      harness.handler.applyActions({ path: PATH, actions: [add(1)] }, peer)
    );

    expect(result).toEqual({ webviews: 1 });
    expect(ready.tab.received).toEqual([[add(1)]]);
    expect(loading.tab.received).toEqual([]);
  });
});

describe('the quiet wait', () => {
  it('settles a pending edit when the tab still owing a save closes after the other saved', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const first = await harness.openReady(NAME);
    const second = await harness.openReady(NAME);
    harness.relay(first, [add(1)]);

    let result: unknown;
    void harness
      .run(harness.handler.join({ path: PATH }, createConnection()))
      .then(value => (result = value));
    harness.save(first, '{"saved":1}');
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toBeUndefined();
    harness.registry.removeTab(second.tab);
    await vi.advanceTimersByTimeAsync(0);

    expect(result).toMatchObject({ initialValue: '{"saved":1}' });
  });

  it('waits for one save from any tab when every tab the change reached closed or stopped before saving', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const first = await harness.openReady(NAME);
    const second = await harness.openReady(NAME);
    harness.relay(first, [add(1)]);

    let result: unknown;
    void harness
      .run(harness.handler.join({ path: PATH }, createConnection()))
      .then(value => (result = value));
    harness.registry.setTabState(second.tab, {
      live: false,
      unreadable: false,
    });
    harness.registry.removeTab(first.tab);
    await vi.advanceTimersByTimeAsync(JOIN_QUIET_CAP_MS - 1);
    expect(result).toBeUndefined();

    harness.save(second, '{"saved":1}');
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toMatchObject({ initialValue: '{"saved":1}' });
  });

  it('awaits every live tab a change reached, even before the path resolved', async () => {
    const harness = createHubHarness();
    let resolveReal!: (path: string) => void;
    harness.realpath.mockImplementationOnce(
      () => new Promise<string>(resolve => (resolveReal = resolve))
    );
    const first = harness.addTab(NAME);
    const second = harness.addTab(NAME);
    for (const { tab } of [first, second]) {
      harness.registry.setTabState(tab, { live: true, unreadable: false });
    }
    harness.relay(first, [add(1)]);
    harness.save(second, '{"second":1}');
    resolveReal(PATH);
    await microtasks();
    const document = harness.registry.find(PATH)!;

    expect(document.resolved).toBe(true);
    expect(document.quiet.pending).toBe(true);
    harness.save(first, '{"first":1}');
    expect(document.quiet.pending).toBe(false);
  });

  it('awaits only the ready tabs a change reached, so a tab still loading holds nothing open', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME);
    harness.addTab(NAME);
    harness.relay(editor, [add(1)]);

    let result: unknown;
    void harness
      .run(harness.handler.join({ path: PATH }, createConnection()))
      .then(value => (result = value));
    harness.save(editor, '{"saved":1}');
    await vi.advanceTimersByTimeAsync(0);

    expect(result).toMatchObject({ initialValue: '{"saved":1}' });
  });
});

describe('seeding a tab opened beside others', () => {
  it('seeds at once when no edit is pending, and a cancel after it does nothing', async () => {
    const harness = createHubHarness();
    await harness.openReady(NAME);
    const { tab } = harness.addTab(NAME);
    const seed = vi.fn();

    const cancel = harness.registry.seedWhenQuiet(tab, seed);
    cancel();

    expect(seed).toHaveBeenCalledTimes(1);
  });

  it('waits for the replica save of an edit made just before, the new tab not ready meanwhile', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const first = await harness.openReady(NAME, '{}');
    harness.relay(first, [add(1)]);
    const second = harness.addTab(NAME);
    const document = harness.registry.find(PATH)!;
    const seeded: Array<string | null> = [];

    harness.registry.seedWhenQuiet(second.tab, () =>
      seeded.push(document.content)
    );
    await vi.advanceTimersByTimeAsync(REPLICA_DEBOUNCE_MS);
    expect(seeded).toEqual([]);
    expect(harness.registry.readyTabCount(document)).toBe(1);

    harness.save(first, '{"tables":1}');
    await vi.advanceTimersByTimeAsync(0);
    expect(seeded).toEqual(['{"tables":1}']);
  });

  it('waits again for an edit that lands between the settling save and the seed', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const first = await harness.openReady(NAME, '{}');
    harness.relay(first, [add(1)]);
    const second = harness.addTab(NAME);
    const { quiet } = harness.registry.find(PATH)!;
    const seed = vi.fn();
    harness.registry.seedWhenQuiet(second.tab, seed);

    const settled = quiet.settled!;
    quiet.settled = null;
    harness.relay(first, [add(2)]);
    Deferred.doneUnsafe(settled, Effect.void);
    await vi.advanceTimersByTimeAsync(0);
    expect(seed).not.toHaveBeenCalled();

    harness.save(first, '{"tables":2}');
    await vi.advanceTimersByTimeAsync(0);
    expect(seed).toHaveBeenCalledTimes(1);
  });

  it('seeds at the join cap when no replica saves', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const first = await harness.openReady(NAME);
    harness.relay(first, [add(1)]);
    const second = harness.addTab(NAME);
    const seed = vi.fn();

    harness.registry.seedWhenQuiet(second.tab, seed);
    await vi.advanceTimersByTimeAsync(JOIN_QUIET_CAP_MS - 1);
    expect(seed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(seed).toHaveBeenCalledTimes(1);
  });

  it('never seeds a tab that left its file or was cancelled while it waited', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const first = await harness.openReady(NAME);
    harness.relay(first, [add(1)]);
    const leaving = harness.addTab(NAME);
    const cancelled = harness.addTab(NAME);
    const seed = vi.fn();

    harness.registry.seedWhenQuiet(leaving.tab, seed);
    const cancel = harness.registry.seedWhenQuiet(cancelled.tab, seed);
    harness.registry.removeTab(leaving.tab);
    cancel();
    harness.save(first, '{"tables":1}');
    await vi.advanceTimersByTimeAsync(JOIN_QUIET_CAP_MS);

    expect(seed).not.toHaveBeenCalled();
  });
});

describe('content', () => {
  it('starts from what the first tab loaded, and a later tab never replaces it', async () => {
    const harness = createHubHarness();
    const first = await harness.openReady(NAME, '{"first":1}');
    harness.save(first, '{"edited":1}');
    await harness.openReady(NAME, '{"stale":1}');

    const result = await harness.run(
      harness.handler.join({ path: PATH }, createConnection())
    );

    expect(result.initialValue).toBe('{"edited":1}');
  });

  it('reads dirty off the writer: its content against what the file last took, or a save still owed', async () => {
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME, '{}');
    const document = harness.registry.find(PATH)!;
    expect(harness.registry.isDirty(document)).toBe(false);

    harness.save(editor, '{"edited":1}');
    expect(harness.registry.isDirty(document)).toBe(true);
    editor.tab.savedText = '{"edited":1}';
    expect(harness.registry.isDirty(document)).toBe(false);
    editor.tab.savedText = null;
    expect(harness.registry.isDirty(document)).toBe(false);

    harness.relay(editor, [add(1)]);
    expect(harness.registry.isDirty(document)).toBe(true);
  });
});

describe('the active document', () => {
  it('follows the tab that took focus last and forgets a closed document', async () => {
    const harness = createHubHarness();
    const a = await harness.openReady(NAME);
    const b = await harness.openReady('b.erd');

    harness.registry.setActive(a.tab);
    harness.registry.setActive(b.tab);
    const documentA = harness.registry.find(PATH)!;
    const documentB = harness.registry.find(`${VAULT}/b.erd`)!;
    expect(harness.registry.isActive(documentA)).toBe(false);
    expect(harness.registry.isActive(documentB)).toBe(true);

    harness.registry.removeTab(b.tab);
    expect(harness.registry.isActive(documentB)).toBe(false);
    harness.registry.setActive(a.tab);
    expect(harness.registry.isActive(documentA)).toBe(true);
  });

  it('puts back the document active before a background tab took focus for a moment', async () => {
    const harness = createHubHarness();
    const a = await harness.openReady(NAME);
    harness.registry.setActive(a.tab);
    const documentA = harness.registry.find(PATH)!;

    const restore = harness.registry.keepActive();
    const background = await harness.openReady('b.erd');
    harness.registry.setActive(background.tab);
    restore();

    expect(harness.registry.isActive(documentA)).toBe(true);
    expect(
      harness.registry.isActive(harness.registry.find(`${VAULT}/b.erd`)!)
    ).toBe(false);
  });

  it('puts back none when nothing was active, or the active document closed meanwhile', async () => {
    const harness = createHubHarness();
    const restoreNone = harness.registry.keepActive();
    const a = await harness.openReady(NAME);
    harness.registry.setActive(a.tab);
    restoreNone();
    const documentA = harness.registry.find(PATH)!;
    expect(harness.registry.isActive(documentA)).toBe(false);

    harness.registry.setActive(a.tab);
    const restoreClosed = harness.registry.keepActive();
    harness.registry.removeTab(a.tab);
    const reopened = await harness.openReady(NAME);
    harness.registry.setActive(reopened.tab);
    restoreClosed();

    expect(harness.registry.isActive(harness.registry.find(PATH)!)).toBe(false);
  });
});

describe('waitForReady', () => {
  it('resolves with the document once a tab of the path is ready', async () => {
    const harness = createHubHarness();
    const { ready } = harness.registry.waitForReady(PATH, 1_000);

    await harness.openReady(NAME);

    await expect(harness.run(ready)).resolves.toBe(harness.registry.find(PATH));
  });

  it('stays waiting while a tab of another document turns ready', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const { ready } = harness.registry.waitForReady(PATH, 1_000);
    let result: unknown = 'pending';
    void harness.run(ready).then(value => (result = value));

    await harness.openReady('b.erd');
    await vi.advanceTimersByTimeAsync(0);

    expect(result).toBe('pending');
  });

  it('resolves with null after the timeout, or at once on cancel', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const timed = harness.registry.waitForReady(PATH, 1_000);
    const cancelled = harness.registry.waitForReady(PATH, 1_000);

    cancelled.cancel();
    await expect(harness.run(cancelled.ready)).resolves.toBeNull();
    const result = harness.run(timed.ready);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(result).resolves.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('the lock documents', () => {
  it('publishes the real paths of resolved documents on register and unregister, each once', async () => {
    const harness = createHubHarness();
    harness.links.set(`${VAULT}/link.erd`, PATH);
    const publish = vi.fn(async (_: string[]) => undefined);
    await harness.registry.setPublisher(publish);
    expect(publish).toHaveBeenLastCalledWith([]);

    const a = await harness.openReady(NAME);
    expect(publish).toHaveBeenLastCalledWith([PATH]);
    const link = await harness.openReady('link.erd');
    expect(publish).toHaveBeenLastCalledWith([PATH]);
    await harness.openReady(NAME);
    expect(publish).toHaveBeenCalledTimes(3);

    harness.registry.removeTab(link.tab);
    await microtasks();
    expect(publish).toHaveBeenLastCalledWith([PATH]);
    harness.registry.removeTab(a.tab);
    expect(publish).toHaveBeenCalledTimes(4);
  });

  it('lists a document once resolved, and only then', async () => {
    const harness = createHubHarness();
    let resolve!: (path: string) => void;
    harness.realpath.mockImplementationOnce(
      () => new Promise(done => (resolve = done))
    );
    const publish = vi.fn(async (_: string[]) => undefined);
    await harness.registry.setPublisher(publish);

    harness.addTab(NAME);
    await harness.openReady('b.erd');
    expect(publish).toHaveBeenLastCalledWith([`${VAULT}/b.erd`]);

    resolve('/real/a.erd');
    await microtasks();
    expect(publish).toHaveBeenLastCalledWith(['/real/a.erd', `${VAULT}/b.erd`]);
  });

  it('drops a realpath step that lands after its document closed or was renamed', async () => {
    const harness = createHubHarness();
    const steps: Array<(path: string) => void> = [];
    harness.realpath.mockImplementation(
      () => new Promise(done => void steps.push(done))
    );
    const publish = vi.fn(async (_: string[]) => undefined);
    await harness.registry.setPublisher(publish);

    const closed = harness.addTab(NAME);
    harness.registry.removeTab(closed.tab);
    const renamed = harness.addTab('b.erd');
    Object.assign(renamed.file, { path: 'c.erd' });
    harness.registry.renamed(renamed.file);
    steps[0]('/real/a.erd');
    steps[1]('/real/b.erd');
    await microtasks();
    expect(publish).not.toHaveBeenCalledWith(['/real/b.erd']);

    steps[2]('/real/c.erd');
    await microtasks();
    expect(publish).toHaveBeenLastCalledWith(['/real/c.erd']);
    expect(harness.registry.find('/real/c.erd')?.file).toBe(renamed.file);
  });

  it('keys a document by the path given when resolving it fails, and still lists it', async () => {
    const harness = createHubHarness();
    harness.realpath.mockRejectedValueOnce(new Error('EACCES'));
    const publish = vi.fn(async (_: string[]) => undefined);
    await harness.registry.setPublisher(publish);

    await harness.openReady(NAME);

    expect(publish).toHaveBeenLastCalledWith([PATH]);
  });

  it('never rejects when the publisher fails, and logs it', async () => {
    const harness = createHubHarness();
    const failure = new Error('disk full');

    await expect(
      harness.registry.setPublisher(() => Promise.reject(failure))
    ).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      'could not list the open documents in the lock',
      failure
    );
  });

  it('matches paths without regard to case on darwin', async () => {
    const registry = new DocumentRegistry<FakeTab>({
      platform: 'darwin',
      fullPath: file => `/Vault/${file.path}`,
      realpath: async path => path,
    });
    const tab = new FakeTab();
    registry.addTab({ path: 'A.erd' }, tab);
    await microtasks();

    expect(registry.find('/vault/a.erd')?.tabs).toEqual([tab]);
  });
});

describe('shutdown', () => {
  it('tells every peer documentClosed for every path it joined, left or read, and names who it told', async () => {
    const harness = createHubHarness();
    await harness.openReady(NAME);
    await harness.openReady('b.erd');
    harness.addFile('c.erd');
    const peer = createConnection(1);
    const reader = createConnection(2);
    const idle = createConnection(3);
    await harness.run(harness.handler.join({ path: PATH }, peer));
    await harness.run(harness.handler.join({ path: PATH }, peer));
    await harness.run(harness.handler.join({ path: `${VAULT}/b.erd` }, peer));
    await harness.run(harness.handler.leave({ path: `${VAULT}/b.erd` }, peer));
    await harness.run(harness.handler.join({ path: `${VAULT}/c.erd` }, reader));
    await harness.run(harness.handler.listDocuments({}, idle));

    const told = harness.registry.shutdown();

    expect(told).toEqual([peer, reader]);
    expect(closedSent(peer)).toEqual([PATH, `${VAULT}/b.erd`]);
    expect(closedSent(reader)).toEqual([`${VAULT}/c.erd`]);
    expect(closedSent(idle)).toEqual([]);
    expect(harness.registry.closed).toBe(true);
  });

  it('tells a peer inside its join window too, whose join then fails', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME);
    harness.relay(editor, [add(1)]);
    const peer = createConnection();

    const joined = harness.run(harness.handler.join({ path: PATH }, peer));
    const rejected = expect(joined).rejects.toMatchObject({
      code: HubErrorCode.notOpen,
    });
    harness.registry.shutdown();
    harness.save(editor, '{}');
    await rejected;

    expect(closedSent(peer)).toEqual([PATH]);
  });

  it('does not tell a peer again of a document whose close it already heard', async () => {
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME);
    const peer = createConnection();
    await harness.run(harness.handler.join({ path: PATH }, peer));
    harness.registry.removeTab(editor.tab);

    expect(harness.registry.shutdown()).toEqual([]);
    expect(closedSent(peer)).toEqual([PATH]);
  });

  it('registers no peer after it: a join is read from disk and closed after its answer', async () => {
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME, '{"on":"disk"}');
    const publish = vi.fn(async (_: string[]) => undefined);
    await harness.registry.setPublisher(publish);
    publish.mockClear();
    harness.registry.shutdown();
    const peer = createConnection();

    const result = await harness.run(
      harness.handler.join({ path: PATH }, peer)
    );
    // A peer that heard documentClosed before this answer would take the join for a registration.
    expect(closedSent(peer)).toEqual([]);
    await expect(
      harness.run(harness.registry.join(harness.registry.find(PATH)!, peer))
    ).rejects.toMatchObject({ code: HubErrorCode.notOpen });
    harness.relay(editor, [add(1)]);
    harness.registry.removeTab(editor.tab);
    await new Promise(resolve => setTimeout(resolve));

    expect(result).toEqual({
      initialValue: '{"on":"disk"}',
      snapshotVersion: 0,
      readonly: false,
    });
    expect(closedSent(peer)).toEqual([PATH]);
    expect(actionsSent(peer)).toEqual([]);
    expect(publish).not.toHaveBeenCalled();
  });

  it('refuses an open after it, on a file a tab still shows ready as on any other', async () => {
    const harness = createHubHarness();
    await harness.openReady(NAME);
    harness.registry.shutdown();

    for (const path of [PATH, `${VAULT}/b.erd`]) {
      await expect(
        harness.run(harness.handler.openDocument({ path }, createConnection()))
      ).rejects.toMatchObject({
        code: HubErrorCode.notOpen,
        message: `Obsidian could not open ${path} in the ERD editor: the ERD Editor plugin is turning off`,
      });
    }
    expect(harness.vault.open).not.toHaveBeenCalled();
  });
});
