import { HubErrorCode } from '@dineug/erd-editor-agent-hub';
import * as Effect from 'effect/Effect';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  actionType,
  actionVersion,
  createQuietState,
  filterJoinQueue,
  hasChangeAction,
  JOIN_QUIET_CAP_MS,
  maxVersion,
  noteChange,
  noteSave,
  recount,
  REPLICA_DEBOUNCE_MS,
  waitForQuiet,
} from '@/hub/joinWindow';

import {
  actionsSent,
  createConnection,
  createDocumentHarness,
  microtasks,
} from '../../test/mocks/documentHarness';
import {
  createMemoryHubServer,
  flush,
  fsError,
  helloFrame,
} from '../../test/mocks/hubLayers';
import { resetVscodeMock } from '../../test/mocks/vscode';

const PATH = '/ws/a.erd.json';

const add = (version?: number, type = 'table.add') =>
  version === undefined
    ? { type, payload: {} }
    : { type, payload: {}, version };

beforeEach(() => {
  resetVscodeMock();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('action fields', () => {
  it('reads a finite numeric version and a string type, nothing else', () => {
    expect(actionVersion({ version: 4 })).toBe(4);
    expect(actionVersion({ version: '4' })).toBeUndefined();
    expect(actionVersion({ version: Number.NaN })).toBeUndefined();
    expect(actionVersion([4])).toBeUndefined();
    expect(actionVersion(null)).toBeUndefined();
    expect(actionType({ type: 'memo.add' })).toBe('memo.add');
    expect(actionType({ type: 3 })).toBe('unknown');
  });

  it('takes the highest version, skipping the version-less compressed stream actions', () => {
    expect(maxVersion(3, [add(7), add(), add(5)])).toBe(7);
    expect(maxVersion(9, [add(2), { type: 'table.move' }])).toBe(9);
    expect(maxVersion(0, [])).toBe(0);
  });

  it('counts anything but presence and the LWW handshake as a change', () => {
    expect(
      hasChangeAction([
        { type: 'editor.getLWW' },
        { type: 'editor.mergeLWW' },
        { type: 'editor.sharedFocusTracker' },
      ])
    ).toBe(false);
    expect(hasChangeAction([{ type: 'editor.getLWW' }, add(1)])).toBe(true);
    expect(hasChangeAction([{ payload: {} }])).toBe(true);
    expect(hasChangeAction([])).toBe(false);
  });
});

describe('quiet state', () => {
  it('resolves true at once with no change pending', async () => {
    const state = createQuietState();
    noteSave(state, 1, 0);

    await expect(Effect.runPromise(waitForQuiet(state))).resolves.toBe(true);
    expect(state.pending).toBe(false);
  });

  it('wakes on the last save a pending change expects, one per ready webview', async () => {
    vi.useFakeTimers();
    const state = createQuietState();
    noteChange(state, 'webview', 0);
    let woken: boolean | undefined;
    void Effect.runPromise(waitForQuiet(state)).then(
      settled => (woken = settled)
    );

    noteSave(state, 2, 0);
    await microtasks();
    expect(woken).toBeUndefined();

    noteSave(state, 2, 0);
    await microtasks();
    expect(woken).toBe(true);
    expect(state.settled).toBeNull();
  });

  it('starts counting again when another change lands mid-wait', async () => {
    vi.useFakeTimers();
    const state = createQuietState();
    noteChange(state, 'webview', 0);
    let woken: boolean | undefined;
    void Effect.runPromise(waitForQuiet(state)).then(
      settled => (woken = settled)
    );

    noteSave(state, 2, 0);
    noteChange(state, 'webview', 0);
    noteSave(state, 2, 0);
    await microtasks();
    expect(woken).toBeUndefined();

    noteSave(state, 2, 0);
    await microtasks();
    expect(woken).toBe(true);
  });

  it('ignores a save sent before its replica could hold the latest peer batch', () => {
    const state = createQuietState();
    noteChange(state, 'peer', 1_000);

    noteSave(state, 1, 1_000 + REPLICA_DEBOUNCE_MS - 1);
    expect(state.pending).toBe(true);
    noteSave(state, 1, 1_000 + REPLICA_DEBOUNCE_MS);
    expect(state.pending).toBe(false);
  });

  it('keeps the bound of a peer batch through a later relay, which sets none of its own', () => {
    const state = createQuietState();
    noteChange(state, 'peer', 1_000);
    noteChange(state, 'webview', 1_100);

    noteSave(state, 1, 1_150);
    expect(state.pending).toBe(true);
    noteSave(state, 1, 1_000 + REPLICA_DEBOUNCE_MS);
    expect(state.pending).toBe(false);

    noteChange(state, 'webview', 5_000);
    noteSave(state, 1, 5_000);
    expect(state.pending).toBe(false);
  });

  it('expects one save even with no ready webview, and resolves false at the cap', async () => {
    vi.useFakeTimers();
    const state = createQuietState();
    noteChange(state, 'webview', 0);
    let woken: boolean | undefined;
    void Effect.runPromise(waitForQuiet(state)).then(
      settled => (woken = settled)
    );

    await vi.advanceTimersByTimeAsync(JOIN_QUIET_CAP_MS - 1);
    expect(woken).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(woken).toBe(false);
    expect(state.pending).toBe(true);

    noteSave(state, 0, 0);
    expect(state.pending).toBe(false);
  });

  it('settles on a recount once fewer saves are expected than already came, never with none', async () => {
    vi.useFakeTimers();
    const state = createQuietState();
    noteChange(state, 'webview', 0);
    let woken: boolean | undefined;
    void Effect.runPromise(waitForQuiet(state)).then(
      settled => (woken = settled)
    );

    recount(state, 0);
    expect(state.pending).toBe(true);
    noteSave(state, 2, 0);
    recount(state, 2);
    await microtasks();
    expect(woken).toBeUndefined();

    recount(state, 1);
    await microtasks();
    expect(woken).toBe(true);
    expect(state.settled).toBeNull();
    recount(state, 1);
    expect(state.pending).toBe(false);
  });
});

describe('filterJoinQueue', () => {
  it('drops what the snapshot holds and what has no version, counting by source and type', () => {
    const { batches, dropped, droppedCount } = filterJoinQueue(
      [
        { source: 'webview', actions: [add(3), add(5), add(6)] },
        {
          source: 'peer',
          actions: [add(undefined, 'table.move'), add(2, 'memo.add')],
        },
        { source: 'webview', actions: [add(undefined, 'table.move')] },
        { source: 'peer', actions: [add(9, 'memo.add')] },
      ],
      5
    );

    expect(batches).toEqual([
      { source: 'webview', actions: [add(6)] },
      { source: 'peer', actions: [add(9, 'memo.add')] },
    ]);
    expect(dropped).toEqual({
      webview: { 'table.add': 2, 'table.move': 1 },
      peer: { 'table.move': 1, 'memo.add': 1 },
    });
    expect(droppedCount).toBe(5);
  });

  it('keeps everything newer than the snapshot', () => {
    expect(filterJoinQueue([{ source: 'peer', actions: [add(1)] }], 0)).toEqual(
      {
        batches: [{ source: 'peer', actions: [add(1)] }],
        dropped: {},
        droppedCount: 0,
      }
    );
  });
});

describe('join', () => {
  it('answers at once with content, observed version and readonly when nothing changed since open', async () => {
    const harness = createDocumentHarness();
    const editor = await harness.openReady(PATH, '{"version":"3.0.0"}');
    harness.relay(editor, [{ type: 'editor.getLWW', version: 2 }]);

    const result = await harness.run(
      harness.handler.join({ path: PATH }, createConnection())
    );

    expect(result).toEqual({
      initialValue: '{"version":"3.0.0"}',
      snapshotVersion: 2,
      readonly: false,
    });
  });

  it('waits after a change for the replica save and captures what it saved', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    const editor = await harness.openReady(PATH, '{}');
    harness.relay(editor, [add(4)]);

    let result: unknown;
    harness
      .run(harness.handler.join({ path: PATH }, createConnection()))
      .then(value => (result = value));
    await vi.advanceTimersByTimeAsync(200);
    expect(result).toBeUndefined();

    await harness.saveValue(editor, '{"tables":1}');

    expect(result).toEqual({
      initialValue: '{"tables":1}',
      snapshotVersion: 4,
      readonly: false,
    });
  });

  it('with two webviews, wakes on the second save, not the first', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    const first = await harness.openReady(PATH, '{}');
    const second = await harness.resolveView(first.document);
    harness.ready(second);
    harness.relay(first, [add(4)]);

    let result: { initialValue: string } | undefined;
    harness
      .run(harness.handler.join({ path: PATH }, createConnection()))
      .then(value => (result = value));
    await harness.saveValue(first, '{"from":"first"}');
    expect(result).toBeUndefined();

    await harness.saveValue(second, '{"from":"second"}');
    expect(result?.initialValue).toBe('{"from":"second"}');
  });

  it('gives up waiting at the cap and captures what the document holds', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    const editor = await harness.openReady(PATH, '{"old":true}');
    harness.relay(editor, [add(4)]);

    let result: { initialValue: string } | undefined;
    harness
      .run(harness.handler.join({ path: PATH }, createConnection()))
      .then(value => (result = value));
    await vi.advanceTimersByTimeAsync(JOIN_QUIET_CAP_MS);

    expect(result?.initialValue).toBe('{"old":true}');
  });

  it('counts a peer batch as a change, so the next join waits for a save that can hold it', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    const editor = await harness.openReady(PATH, '{}');
    const writer = createConnection(1);
    await harness.run(harness.handler.join({ path: PATH }, writer));
    await harness.run(
      harness.handler.applyActions({ path: PATH, actions: [add(8)] }, writer)
    );

    let result: { initialValue: string; snapshotVersion: number } | undefined;
    harness
      .run(harness.handler.join({ path: PATH }, createConnection(2)))
      .then(value => (result = value));
    await microtasks();
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(REPLICA_DEBOUNCE_MS - 1);
    await harness.saveValue(editor, '{"before":8}');
    expect(result).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1);
    await harness.saveValue(editor, '{"peer":8}');
    expect(result).toEqual({
      initialValue: '{"peer":8}',
      snapshotVersion: 8,
      readonly: false,
    });
  });

  it('queues deliveries during the window and empties them through both filters', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    const editor = await harness.openReady(PATH, '{}');
    harness.relay(editor, [add(3)]);
    const joining = createConnection(2);

    const joined = harness.run(harness.handler.join({ path: PATH }, joining));
    harness.relay(editor, [add(5), add(undefined, 'table.move')]);
    await harness.saveValue(editor, '{"saved":5}');
    const result = await joined;
    harness.relay(editor, [add(6, 'memo.add')]);
    expect(actionsSent(joining)).toEqual([]);

    await vi.advanceTimersByTimeAsync(0);

    expect(result.snapshotVersion).toBe(5);
    expect(actionsSent(joining)).toEqual([[add(6, 'memo.add')]]);
    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      `dropped 2 queued actions joining ${PATH}: versioned at most 5, or unversioned`,
      { webview: { 'table.add': 1, 'table.move': 1 } }
    );
  });

  it('queues a batch another peer applies during the window and filters it the same way', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    const editor = await harness.openReady(PATH, '{}');
    const writer = createConnection(1);
    await harness.run(harness.handler.join({ path: PATH }, writer));
    await vi.advanceTimersByTimeAsync(0);
    harness.relay(editor, [add(2)]);
    const joining = createConnection(2);

    const joined = harness.run(harness.handler.join({ path: PATH }, joining));
    harness.relay(editor, [add(3)]);
    await harness.run(
      harness.handler.applyActions(
        {
          path: PATH,
          actions: [add(2, 'memo.add'), add(undefined, 'memo.move')],
        },
        writer
      )
    );
    await harness.run(
      harness.handler.applyActions(
        { path: PATH, actions: [add(7, 'memo.add')] },
        writer
      )
    );
    await vi.advanceTimersByTimeAsync(REPLICA_DEBOUNCE_MS);
    await harness.saveValue(editor, '{}');
    const result = await joined;
    await vi.advanceTimersByTimeAsync(0);

    expect(result.snapshotVersion).toBe(7);
    expect(actionsSent(joining)).toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      `dropped 4 queued actions joining ${PATH}: versioned at most 7, or unversioned`,
      { webview: { 'table.add': 1 }, peer: { 'memo.add': 2, 'memo.move': 1 } }
    );
  });

  it('delivers whole, in order, what arrives between the snapshot and the end of the window', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    const editor = await harness.openReady(PATH, '{}');
    harness.relay(editor, [add(4)]);
    const joining = createConnection(2);

    const joined = harness.run(harness.handler.join({ path: PATH }, joining));
    harness.relay(editor, [add(3, 'memo.add')]);
    await harness.saveValue(editor, '{"saved":4}');
    const result = await joined;
    harness.relay(editor, [add(undefined, 'table.move'), add(2, 'memo.add')]);
    harness.relay(editor, [add(9)]);
    await vi.advanceTimersByTimeAsync(0);

    expect(result.snapshotVersion).toBe(4);
    expect(actionsSent(joining)).toEqual([
      [add(undefined, 'table.move'), add(2, 'memo.add')],
      [add(9)],
    ]);
    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      `dropped 1 queued actions joining ${PATH}: versioned at most 4, or unversioned`,
      { webview: { 'memo.add': 1 } }
    );
  });

  it('writes the join response before any queued actions notification', async () => {
    const harness = createDocumentHarness();
    const editor = await harness.openReady(PATH, '{}');
    const server = createMemoryHubServer({
      token: 'token',
      ide: 'vscode',
      version: '2.9.0',
      handler: harness.handler,
      authorize: path => Effect.succeed(path),
    });
    const { client } = server.accept();
    client.send(helloFrame('token'));
    await flush();
    harness.relay(editor, [add(1)]);
    const response = {
      id: 2,
      ok: true,
      method: 'join',
      result: {
        initialValue: '{"saved":2}',
        snapshotVersion: 2,
        readonly: false,
      },
    };

    client.send({ id: 2, method: 'join', params: { path: PATH } });
    await flush();
    harness.relay(editor, [add(2)]);
    await harness.saveValue(editor, '{"saved":2}');
    await microtasks();
    harness.relay(editor, [add(3)]);

    await flush();

    // In order: the response is framed before the window empties its queue.
    expect(client.received.slice(1)).toEqual([
      response,
      { method: 'actions', params: { path: PATH, actions: [add(3)] } },
    ]);
  });

  it('refuses a join whose document closes during the wait', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    const editor = await harness.openReady(PATH, '{}');
    harness.relay(editor, [add(1)]);

    const joined = harness.run(
      harness.handler.join({ path: PATH }, createConnection())
    );
    const rejected = expect(joined).rejects.toMatchObject({
      code: HubErrorCode.notOpen,
    });
    editor.document.dispose();
    await vi.advanceTimersByTimeAsync(JOIN_QUIET_CAP_MS);

    await rejected;
  });

  it('refuses a join whose peer hung up during the wait, and never delivers to it', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    const editor = await harness.openReady(PATH, '{}');
    harness.relay(editor, [add(1)]);
    const peer = createConnection();

    const joined = harness.run(harness.handler.join({ path: PATH }, peer));
    const rejected = expect(joined).rejects.toMatchObject({
      code: HubErrorCode.notOpen,
    });
    harness.handler.disconnect(peer);
    await harness.saveValue(editor, '{}');

    await rejected;
    harness.relay(editor, [add(2)]);
    expect(peer.notify).not.toHaveBeenCalled();
  });

  it('restarts the window for a peer that joins again, dropping the first queue', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    const editor = await harness.openReady(PATH, '{}');
    const peer = createConnection();

    await harness.run(harness.handler.join({ path: PATH }, peer));
    harness.relay(editor, [add(3)]);
    const again = harness.run(harness.handler.join({ path: PATH }, peer));
    await harness.saveValue(editor, '{}');
    await again;
    await vi.advanceTimersByTimeAsync(0);

    expect(actionsSent(peer)).toEqual([]);
    harness.relay(editor, [add(4)]);
    expect(actionsSent(peer)).toEqual([[add(4)]]);
  });

  it('reads a document no editor has open from disk, without a byte order mark and without joining', async () => {
    const harness = createDocumentHarness();
    harness.io.addFile(PATH, '\uFEFF{"version":"3.0.0"}');

    const result = await harness.run(
      harness.handler.join({ path: PATH }, createConnection())
    );

    expect(result).toEqual({
      initialValue: '{"version":"3.0.0"}',
      snapshotVersion: 0,
      readonly: false,
    });
  });

  it('answers a document that does not exist with notFound, and another read failure with itself', async () => {
    const harness = createDocumentHarness();

    await expect(
      harness.run(
        harness.handler.join(
          { path: '/ws/missing.erd.json' },
          createConnection()
        )
      )
    ).rejects.toMatchObject({ code: HubErrorCode.notFound });
    harness.io.fs.readFileString.mockImplementationOnce((path: string) =>
      Effect.fail(fsError('Busy', 'readFileString', path))
    );
    await expect(
      harness.run(harness.handler.join({ path: PATH }, createConnection()))
    ).rejects.toMatchObject({ _tag: 'PlatformError' });
  });
});
