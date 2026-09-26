import { HubErrorCode } from '@dineug/erd-editor-agent-hub';
import {
  JOIN_QUIET_CAP_MS,
  REPLICA_DEBOUNCE_MS,
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

  it('wakes on the saves of the webviews the change reached, not on one readied after it', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    const first = await harness.openReady(PATH, '{}');
    harness.relay(first, [add(4)]);
    const late = await harness.resolveView(first.document);
    harness.ready(late);

    let result: { initialValue: string } | undefined;
    harness
      .run(harness.handler.join({ path: PATH }, createConnection()))
      .then(value => (result = value));
    await harness.saveValue(first, '{"from":"first"}');

    expect(result?.initialValue).toBe('{"from":"first"}');
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
