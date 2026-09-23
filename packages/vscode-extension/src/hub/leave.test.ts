import { HubErrorCode } from '@dineug/erd-editor-agent-hub';
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
} from '../../test/mocks/documentHarness';
import { resetVscodeMock } from '../../test/mocks/vscode';

const PATH = '/ws/a.erd.json';
const OTHER = '/ws/b.erd.json';

const batch = (version: number) => [
  { type: 'table.add', payload: { id: `t${version}` }, version },
];

beforeEach(() => {
  resetVscodeMock();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Opens PATH ready and joins every peer to it, past the join window. */
async function joinAll(...peers: ReturnType<typeof createConnection>[]) {
  vi.useFakeTimers();
  const harness = createDocumentHarness();
  const editor = await harness.openReady(PATH, '{}');
  for (const peer of peers)
    await harness.run(harness.handler.join({ path: PATH }, peer));
  await vi.advanceTimersByTimeAsync(0);
  return { harness, editor };
}

describe('leave', () => {
  it('stops every delivery to the peer that left, and only to it', async () => {
    const leaving = createConnection(1);
    const staying = createConnection(2);
    const { harness, editor } = await joinAll(leaving, staying);

    await expect(
      harness.run(harness.handler.leave({ path: PATH }, leaving))
    ).resolves.toEqual({});
    harness.relay(editor, batch(1));
    await harness.run(
      harness.handler.applyActions({ path: PATH, actions: batch(2) }, staying)
    );

    expect(leaving.notify).not.toHaveBeenCalled();
    expect(actionsSent(staying)).toEqual([batch(1)]);
    await expect(
      harness.run(
        harness.handler.applyActions({ path: PATH, actions: batch(3) }, leaving)
      )
    ).rejects.toMatchObject({ code: HubErrorCode.notOpen });
  });

  it('drops the queue of a peer that leaves inside its join window, and its join fails', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    const editor = await harness.openReady(PATH, '{}');
    harness.relay(editor, batch(1));
    const peer = createConnection();

    const joining = harness.run(harness.handler.join({ path: PATH }, peer));
    const rejected = expect(joining).rejects.toMatchObject({
      code: HubErrorCode.notOpen,
    });
    harness.relay(editor, batch(2));
    await harness.run(harness.handler.leave({ path: PATH }, peer));
    await harness.saveValue(editor, '{}');
    await rejected;
    await vi.advanceTimersByTimeAsync(0);

    expect(peer.notify).not.toHaveBeenCalled();
  });

  it('answers a peer that never joined, or a path nothing has open, all the same', async () => {
    const { harness } = await joinAll();

    await expect(
      harness.run(harness.handler.leave({ path: PATH }, createConnection()))
    ).resolves.toEqual({});
    await expect(
      harness.run(harness.handler.leave({ path: OTHER }, createConnection()))
    ).resolves.toEqual({});
  });
});

describe('documentClosed', () => {
  it('tells the peers joined to a document that its editor went away, and no one else', async () => {
    const joined = createConnection(1);
    const elsewhere = createConnection(2);
    const { harness, editor } = await joinAll(joined);
    await harness.openReady(OTHER, '{}');
    await harness.run(harness.handler.join({ path: OTHER }, elsewhere));

    editor.document.dispose();

    expect(joined.notifications).toEqual([
      { method: 'documentClosed', params: { path: PATH } },
    ]);
    expect(elsewhere.notifications).toEqual([]);
  });

  it('makes a reopened document take a fresh join before any batch', async () => {
    const peer = createConnection();
    const { harness, editor } = await joinAll(peer);

    editor.document.dispose();
    const reopened = await harness.openReady(PATH, '{}');

    await expect(
      harness.run(
        harness.handler.applyActions({ path: PATH, actions: batch(1) }, peer)
      )
    ).rejects.toMatchObject({
      code: HubErrorCode.notOpen,
      message: `Join ${PATH} before applying actions to it`,
    });
    harness.relay(reopened, batch(2));
    expect(actionsSent(peer)).toEqual([]);
  });
});

describe('disconnect', () => {
  it('removes a peer whose connection closed from every document', async () => {
    const peer = createConnection(1);
    const { harness, editor } = await joinAll(peer);
    const other = await harness.openReady(OTHER, '{}');
    await harness.run(harness.handler.join({ path: OTHER }, peer));
    await vi.advanceTimersByTimeAsync(0);

    harness.handler.disconnect(peer);
    harness.relay(editor, batch(1));
    harness.relay(other, batch(2));

    expect(peer.notify).not.toHaveBeenCalled();
    expect(harness.registry.isJoined(editor.document, peer)).toBe(false);
    expect(harness.registry.isJoined(other.document, peer)).toBe(false);
  });
});
