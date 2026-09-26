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
  fsError,
  type HubHarness,
  microtasks,
  type OpenedTab,
  servePeer,
  VAULT,
} from '@/__test-utils__/hub';

const NAME = 'a.erd.json';
const PATH = `${VAULT}/${NAME}`;

const add = (version?: number, type = 'table.add') =>
  version === undefined
    ? { type, payload: {} }
    : { type, payload: {}, version };

/**
 * Wakes the waiting join as a save would, with a newer change already noted,
 * as when the join resumes a scheduler turn after the save and a relay lands in it.
 */
function settleWithChangeBehind(
  harness: HubHarness,
  editor: OpenedTab,
  action: unknown
): void {
  const { quiet } = harness.registry.find(PATH)!;
  const settled = quiet.settled!;
  quiet.settled = null;
  harness.relay(editor, [action]);
  Deferred.doneUnsafe(settled, Effect.void);
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('join', () => {
  it('answers at once with content, observed version and readonly when nothing changed since open', async () => {
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME, '{"version":"3.0.0"}');
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
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME, '{}');
    harness.relay(editor, [add(4)]);

    let result: unknown;
    void harness
      .run(harness.handler.join({ path: PATH }, createConnection()))
      .then(value => (result = value));
    await vi.advanceTimersByTimeAsync(200);
    expect(result).toBeUndefined();

    harness.save(editor, '{"tables":1}');
    await vi.advanceTimersByTimeAsync(0);

    expect(result).toEqual({
      initialValue: '{"tables":1}',
      snapshotVersion: 4,
      readonly: false,
    });
  });

  it('with two tabs, wakes on the second save, not the first', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const first = await harness.openReady(NAME, '{}');
    const second = await harness.openReady(NAME);
    harness.relay(first, [add(4)]);

    let result: { initialValue: string } | undefined;
    void harness
      .run(harness.handler.join({ path: PATH }, createConnection()))
      .then(value => (result = value));
    harness.save(first, '{"from":"first"}');
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toBeUndefined();

    harness.save(second, '{"from":"second"}');
    await vi.advanceTimersByTimeAsync(0);
    expect(result?.initialValue).toBe('{"from":"second"}');
  });

  it('wakes on the saves of the tabs the change reached, not on one readied after it', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const first = await harness.openReady(NAME, '{}');
    harness.relay(first, [add(4)]);
    await harness.openReady(NAME);

    let result: { initialValue: string } | undefined;
    void harness
      .run(harness.handler.join({ path: PATH }, createConnection()))
      .then(value => (result = value));
    harness.save(first, '{"from":"first"}');
    await vi.advanceTimersByTimeAsync(0);

    expect(result?.initialValue).toBe('{"from":"first"}');
  });

  it('gives up waiting at the cap and captures what the document holds', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME, '{"old":true}');
    harness.relay(editor, [add(4)]);

    let result: { initialValue: string } | undefined;
    void harness
      .run(harness.handler.join({ path: PATH }, createConnection()))
      .then(value => (result = value));
    await vi.advanceTimersByTimeAsync(JOIN_QUIET_CAP_MS);

    expect(result?.initialValue).toBe('{"old":true}');
  });

  it('waits again for a change noted between the settle and the join resuming', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME, '{}');
    harness.relay(editor, [add(4)]);

    let result: { initialValue: string; snapshotVersion: number } | undefined;
    void harness
      .run(harness.handler.join({ path: PATH }, createConnection()))
      .then(value => (result = value));
    settleWithChangeBehind(harness, editor, add(5));
    await vi.advanceTimersByTimeAsync(100);
    expect(result).toBeUndefined();

    harness.save(editor, '{"saved":5}');
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toEqual({
      initialValue: '{"saved":5}',
      snapshotVersion: 5,
      readonly: false,
    });
  });

  it('still captures at the cap when the change behind the settle is never saved', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME, '{"old":true}');
    harness.relay(editor, [add(4)]);

    let result: { initialValue: string; snapshotVersion: number } | undefined;
    void harness
      .run(harness.handler.join({ path: PATH }, createConnection()))
      .then(value => (result = value));
    settleWithChangeBehind(harness, editor, add(5));
    await vi.advanceTimersByTimeAsync(JOIN_QUIET_CAP_MS - 1);
    expect(result).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1);
    expect(result).toEqual({
      initialValue: '{"old":true}',
      snapshotVersion: 5,
      readonly: false,
    });
  });

  it('counts a peer batch as a change, so the next join waits for a save that can hold it', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME, '{}');
    const writer = createConnection(1);
    await harness.run(harness.handler.join({ path: PATH }, writer));
    await harness.run(
      harness.handler.applyActions({ path: PATH, actions: [add(8)] }, writer)
    );

    let result: { initialValue: string; snapshotVersion: number } | undefined;
    void harness
      .run(harness.handler.join({ path: PATH }, createConnection(2)))
      .then(value => (result = value));
    await microtasks();
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(REPLICA_DEBOUNCE_MS - 1);
    harness.save(editor, '{"before":8}');
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1);
    harness.save(editor, '{"peer":8}');
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toEqual({
      initialValue: '{"peer":8}',
      snapshotVersion: 8,
      readonly: false,
    });
  });

  it('queues deliveries during the window and empties them through both filters', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME, '{}');
    harness.relay(editor, [add(3)]);
    const joining = createConnection(2);

    const joined = harness.run(harness.handler.join({ path: PATH }, joining));
    harness.relay(editor, [add(5), add(undefined, 'table.move')]);
    harness.save(editor, '{"saved":5}');
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
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME, '{}');
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
    harness.save(editor, '{}');
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
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME, '{}');
    harness.relay(editor, [add(4)]);
    const joining = createConnection(2);

    const joined = harness.run(harness.handler.join({ path: PATH }, joining));
    harness.relay(editor, [add(3, 'memo.add')]);
    harness.save(editor, '{"saved":4}');
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

  it('refuses a join whose document closes during the wait', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME, '{}');
    harness.relay(editor, [add(1)]);

    const joined = harness.run(
      harness.handler.join({ path: PATH }, createConnection())
    );
    const rejected = expect(joined).rejects.toMatchObject({
      code: HubErrorCode.notOpen,
      message: `${PATH} closed, or the peer left it, before the join finished`,
    });
    harness.registry.removeTab(editor.tab);
    await vi.advanceTimersByTimeAsync(JOIN_QUIET_CAP_MS);

    await rejected;
  });

  it('refuses a join whose peer hung up during the wait, and never delivers to it', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME, '{}');
    harness.relay(editor, [add(1)]);
    const peer = createConnection();

    const joined = harness.run(harness.handler.join({ path: PATH }, peer));
    const rejected = expect(joined).rejects.toMatchObject({
      code: HubErrorCode.notOpen,
    });
    harness.handler.disconnect(peer);
    harness.save(editor, '{}');

    await rejected;
    harness.relay(editor, [add(2)]);
    expect(peer.notify).not.toHaveBeenCalled();
  });

  it('restarts the window for a peer that joins again, dropping the first queue', async () => {
    vi.useFakeTimers();
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME, '{}');
    const peer = createConnection();

    await harness.run(harness.handler.join({ path: PATH }, peer));
    harness.relay(editor, [add(3)]);
    const again = harness.run(harness.handler.join({ path: PATH }, peer));
    harness.save(editor, '{}');
    await again;
    await vi.advanceTimersByTimeAsync(0);

    expect(actionsSent(peer)).toEqual([]);
    harness.relay(editor, [add(4)]);
    expect(actionsSent(peer)).toEqual([[add(4)]]);
  });

  it('reads a document no tab shows from disk, without a byte order mark and without joining', async () => {
    const harness = createHubHarness();
    harness.addFile(NAME, '﻿{"version":"3.0.0"}');
    const peer = createConnection();

    const result = await harness.run(
      harness.handler.join({ path: PATH }, peer)
    );

    expect(result).toEqual({
      initialValue: '{"version":"3.0.0"}',
      snapshotVersion: 0,
      readonly: false,
    });
    expect(harness.vault.open).not.toHaveBeenCalled();
    const editor = await harness.openReady(NAME);
    harness.relay(editor, [add(1)]);
    expect(peer.notify).not.toHaveBeenCalled();
  });

  it('strips a byte order mark from the text a tab loaded too', async () => {
    const harness = createHubHarness();
    await harness.openReady(NAME, '﻿{}');

    const result = await harness.run(
      harness.handler.join({ path: PATH }, createConnection())
    );

    expect(result.initialValue).toBe('{}');
  });

  it('answers a document that does not exist with notFound, and another read failure with itself', async () => {
    const harness = createHubHarness();

    await expect(
      harness.run(
        harness.handler.join(
          { path: `${VAULT}/missing.erd.json` },
          createConnection()
        )
      )
    ).rejects.toMatchObject({
      code: HubErrorCode.notFound,
      message: `${VAULT}/missing.erd.json does not exist`,
    });
    harness.addFile(NAME);
    harness.fs.readFileString.mockImplementationOnce((path: string) =>
      Effect.fail(fsError('Busy', 'readFileString', path))
    );
    await expect(
      harness.run(harness.handler.join({ path: PATH }, createConnection()))
    ).rejects.toMatchObject({ _tag: 'PlatformError' });
  });

  it('answers a file no tab can read with its text and readonly, and tells the peer when it closes', async () => {
    const harness = createHubHarness();
    const editor = await harness.openUnreadable(NAME, '{"doc": <<<<<<< HEAD');
    const peer = createConnection();

    const result = await harness.run(
      harness.handler.join({ path: PATH }, peer)
    );
    harness.registry.removeTab(editor.tab);

    expect(result).toEqual({
      initialValue: '{"doc": <<<<<<< HEAD',
      snapshotVersion: 0,
      readonly: true,
    });
    expect(closedSent(peer)).toEqual([PATH]);
  });

  it('refuses a path that is no ERD file with badRequest, reading nothing', async () => {
    const harness = createHubHarness();

    await expect(
      harness.run(
        harness.handler.join({ path: `${VAULT}/note.md` }, createConnection())
      )
    ).rejects.toMatchObject({
      code: HubErrorCode.badRequest,
      message: `${VAULT}/note.md is not an ERD file; the hub serves .erd, .vuerd, .erd.json, .vuerd.json only`,
    });
    expect(harness.fs.readFileString).not.toHaveBeenCalled();
  });
});

describe('over a socket', () => {
  it('writes the join response before any queued actions notification', async () => {
    const harness = createHubHarness();
    const editor = await harness.openReady(NAME, '{}');
    const peer = await servePeer(harness.handler);
    try {
      harness.relay(editor, [add(1)]);

      peer.send({ id: 2, method: 'join', params: { path: PATH } });
      await vi.waitFor(() =>
        expect(harness.registry.find(PATH)!.peers.size).toBe(1)
      );
      harness.relay(editor, [add(2)]);
      harness.save(editor, '{"saved":2}');
      await microtasks();
      harness.relay(editor, [add(3)]);
      await peer.receivedAtLeast(3);

      // In order: the response is framed before the window empties its queue.
      expect(peer.received.slice(1)).toEqual([
        {
          id: 2,
          ok: true,
          method: 'join',
          result: {
            initialValue: '{"saved":2}',
            snapshotVersion: 2,
            readonly: false,
          },
        },
        { method: 'actions', params: { path: PATH, actions: [add(3)] } },
      ]);
    } finally {
      await peer.close();
    }
  });

  it('answers a join after shutdown from disk, and only then tells the peer documentClosed', async () => {
    const harness = createHubHarness();
    await harness.openReady(NAME, '{"on":"disk"}');
    const peer = await servePeer(harness.handler);
    try {
      harness.registry.shutdown();

      peer.send({ id: 2, method: 'join', params: { path: PATH } });
      await peer.receivedAtLeast(3);

      expect(peer.received.slice(1)).toEqual([
        {
          id: 2,
          ok: true,
          method: 'join',
          result: {
            initialValue: '{"on":"disk"}',
            snapshotVersion: 0,
            readonly: false,
          },
        },
        { method: 'documentClosed', params: { path: PATH } },
      ]);
    } finally {
      await peer.close();
    }
  });
});
