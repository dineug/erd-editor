import { HubErrorCode } from '@dineug/erd-editor-agent-hub';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';
import type { Uri as VscodeUri, WebviewPanel } from 'vscode';

import { ErdDocument } from '@/erd-document';
import { DocumentRegistry } from '@/hub/documentRegistry';
import { REPLICA_DEBOUNCE_MS } from '@/hub/joinWindow';

import {
  actionsSent,
  createConnection,
  createDocumentHarness,
  type OpenedEditor,
} from '../../test/mocks/documentHarness';
import { createMemoryHubIo } from '../../test/mocks/hubIo';
import {
  createWebviewPanel,
  resetVscodeMock,
  Uri,
} from '../../test/mocks/vscode';

const PATH = '/ws/a.erd.json';

const batch = (version: number, type = 'table.add') => [
  { type, payload: { id: `t${version}` }, version, tags: 1 },
];

/** What a webview is sent when the hub injects actions into it. */
const injected = (actions: unknown[]) => ({
  type: 'webviewReplicationCommand',
  payload: { actions },
});

function replicationsTo(editor: OpenedEditor): unknown[] {
  return editor.webview.postMessage.mock.calls
    .map(([message]) => message)
    .filter(message => message.type === 'webviewReplicationCommand');
}

beforeEach(() => {
  resetVscodeMock();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Opens PATH in two ready webviews and joins peer to it, past its join window. */
async function openJoined(peers = [createConnection(1)]) {
  vi.useFakeTimers();
  const harness = createDocumentHarness();
  const first = await harness.openReady(PATH, '{}');
  const second = await harness.resolveView(first.document);
  harness.ready(second);
  for (const peer of peers) await harness.handler.join({ path: PATH }, peer);
  await vi.advanceTimersByTimeAsync(0);
  return { harness, first, second };
}

describe('relay to peers', () => {
  it('hands every webview relay to a joined peer', async () => {
    const peer = createConnection();
    const { harness, first, second } = await openJoined([peer]);

    harness.relay(first, batch(1));
    harness.relay(second, batch(2));

    expect(peer.notifications).toEqual([
      { method: 'actions', params: { path: PATH, actions: batch(1) } },
      { method: 'actions', params: { path: PATH, actions: batch(2) } },
    ]);
  });

  it('addresses relays and documentClosed by the real path, not the uri a link opened', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    harness.io.links.set('/link', '/real');
    const editor = await harness.open(
      '/real/a.erd.json',
      '{}',
      Uri.file('/link/a.erd.json')
    );
    harness.ready(editor);
    const peer = createConnection();
    await harness.handler.join({ path: '/real/a.erd.json' }, peer);
    await vi.advanceTimersByTimeAsync(0);

    harness.relay(editor, batch(1));
    editor.document.dispose();

    expect(peer.notifications).toEqual([
      {
        method: 'actions',
        params: { path: '/real/a.erd.json', actions: batch(1) },
      },
      { method: 'documentClosed', params: { path: '/real/a.erd.json' } },
    ]);
  });

  it('ignores a relay that is no array, and one for a document it does not track', async () => {
    const peer = createConnection();
    const { harness, first } = await openJoined([peer]);
    const stray = ErdDocument.create(
      Uri.file('/ws/stray.erd.json') as unknown as VscodeUri,
      new Uint8Array()
    );

    harness.relay(first, { type: 'table.add' });
    harness.registry.onWebviewActions(stray, batch(3));

    expect(peer.notify).not.toHaveBeenCalled();
    expect(harness.registry.observedVersion(first.document)).toBe(0);
  });
});

describe('peer to webviews and peers', () => {
  it('injects a peer batch into every ready webview, the sender view included', async () => {
    const peer = createConnection();
    const { harness, first, second } = await openJoined([peer]);

    const result = await harness.handler.applyActions(
      { path: PATH, actions: batch(4) },
      peer
    );

    expect(result).toEqual({ webviews: 2 });
    expect(replicationsTo(first)).toEqual([injected(batch(4))]);
    expect(replicationsTo(second)).toEqual([injected(batch(4))]);
  });

  it('with two peers and one webview, hands A to the webview and B, never back to A', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    const editor = await harness.openReady(PATH, '{}');
    const a = createConnection(1);
    const b = createConnection(2);
    await harness.handler.join({ path: PATH }, a);
    await harness.handler.join({ path: PATH }, b);
    await vi.advanceTimersByTimeAsync(0);

    await harness.handler.applyActions({ path: PATH, actions: batch(5) }, a);

    expect(replicationsTo(editor)).toEqual([injected(batch(5))]);
    expect(actionsSent(b)).toEqual([batch(5)]);
    expect(actionsSent(a)).toEqual([]);
  });

  it('sends every delivery to a peer through the one per-peer function', async () => {
    const a = createConnection(1);
    const b = createConnection(2);
    const { harness, first, second } = await openJoined([a]);
    const deliver = vi.spyOn(harness.registry, 'deliverToPeer');

    harness.relay(first, batch(1));
    const joining = harness.handler.join({ path: PATH }, b);
    await harness.handler.applyActions({ path: PATH, actions: batch(2) }, a);
    harness.relay(first, batch(3));
    await vi.advanceTimersByTimeAsync(REPLICA_DEBOUNCE_MS);
    await harness.saveValue(first, '{}');
    await harness.saveValue(second, '{}');
    await joining;
    harness.relay(first, batch(4));
    await vi.advanceTimersByTimeAsync(0);

    expect(
      deliver.mock.calls.map(([, to, actions, source]) => [
        to.id,
        actions,
        source,
      ])
    ).toEqual([
      [1, batch(1), 'webview'],
      [2, batch(2), 'peer'],
      [1, batch(3), 'webview'],
      [2, batch(3), 'webview'],
      [1, batch(4), 'webview'],
      [2, batch(4), 'webview'],
      [2, batch(4), 'webview'],
    ]);
    expect(a.notify).toHaveBeenCalledTimes(3);
    expect(actionsSent(b)).toEqual([batch(4)]);
  });
});

describe('ready webviews', () => {
  it('counts a webview once however many times it says it is ready', async () => {
    const harness = createDocumentHarness();
    const editor = await harness.openReady(PATH, '{}');

    harness.ready(editor);

    expect(harness.registry.readyWebviewCount(editor.document)).toBe(1);
  });

  it('drops to one when one of two panels closes, to zero with both, and then refuses a batch', async () => {
    const peer = createConnection();
    const { harness, first, second } = await openJoined([peer]);

    first.panel.__dispose();
    expect(harness.registry.readyWebviewCount(first.document)).toBe(1);
    second.panel.__dispose();
    expect(harness.registry.readyWebviewCount(first.document)).toBe(0);

    await expect(
      harness.handler.applyActions({ path: PATH, actions: batch(1) }, peer)
    ).rejects.toMatchObject({ code: HubErrorCode.notOpen });
  });

  it('never injects into a webview that has not reported ready', async () => {
    const peer = createConnection();
    const harness = createDocumentHarness();
    const ready = await harness.openReady(PATH, '{}');
    const loading = await harness.resolveView(ready.document);
    await harness.handler.join({ path: PATH }, peer);

    const result = await harness.handler.applyActions(
      { path: PATH, actions: batch(1) },
      peer
    );

    expect(result).toEqual({ webviews: 1 });
    expect(replicationsTo(ready)).toEqual([injected(batch(1))]);
    expect(replicationsTo(loading)).toEqual([]);
  });

  it('ignores a ready signal from a webview it never added, or for a document it does not track', async () => {
    const harness = createDocumentHarness();
    const editor = await harness.openReady(PATH, '{}');
    const stranger = createWebviewPanel();
    const stray = ErdDocument.create(
      Uri.file('/ws/stray.erd.json') as unknown as VscodeUri,
      new Uint8Array()
    );

    harness.registry.onWebviewReady(editor.document, stranger.webview as any);
    harness.registry.onWebviewReady(stray, stranger.webview as any);
    harness.registry.onValueSaved(stray);
    harness.registry.addWebview(stray, stranger as unknown as WebviewPanel);
    harness.registry.removeWebview(stray, stranger as unknown as WebviewPanel);

    expect(harness.registry.readyWebviewCount(editor.document)).toBe(1);
    expect(harness.registry.readyWebviewCount(stray)).toBe(0);
    expect(harness.registry.panelOf(stray)).toBeUndefined();
    expect(harness.registry.injectToWebviews(stray, batch(1))).toBe(0);
    expect(
      harness.registry.applyPeerActions(stray, createConnection(), [])
    ).toBe(0);
    harness.registry.injectToPeers(stray, createConnection(), batch(1));
    await expect(harness.registry.whenQuiet(stray, 100)).resolves.toBe(true);
  });

  it('hands the next panel to reveal once the first of two closes', async () => {
    const harness = createDocumentHarness();
    const first = await harness.openReady(PATH, '{}');
    const second = await harness.resolveView(first.document);

    first.panel.__dispose();

    expect(harness.registry.panelOf(first.document)).toBe(second.panel);
  });

  it('answers for an untracked document or a peer that never joined with nothing', async () => {
    const harness = createDocumentHarness();
    const editor = await harness.openReady(PATH, '{}');
    const stranger = createConnection();
    const stray = ErdDocument.create(
      Uri.file('/ws/stray.erd.json') as unknown as VscodeUri,
      new Uint8Array()
    );

    harness.registry.deliverToPeer(editor.document, stranger, batch(1), 'peer');
    harness.registry.deliverToPeer(stray, stranger, batch(1), 'peer');

    expect(stranger.notify).not.toHaveBeenCalled();
    expect(harness.registry.observedVersion(stray)).toBe(0);
    expect(harness.registry.isJoined(stray, stranger)).toBe(false);
    await expect(harness.registry.join(stray, stranger)).rejects.toMatchObject({
      code: HubErrorCode.notOpen,
      message:
        '/ws/stray.erd.json closed, or the peer left it, before the join finished',
    });
  });
});

describe('observedVersion', () => {
  it('rises with numeric versions from webviews and peers, and ignores version-less actions', async () => {
    const peer = createConnection();
    const { harness, first } = await openJoined([peer]);

    harness.relay(first, [...batch(3), { type: 'table.move', payload: {} }]);
    expect(harness.registry.observedVersion(first.document)).toBe(3);

    await harness.handler.applyActions(
      { path: PATH, actions: [...batch(7), { type: 'memo.resize' }] },
      peer
    );
    expect(harness.registry.observedVersion(first.document)).toBe(7);

    harness.relay(first, batch(5));
    expect(harness.registry.observedVersion(first.document)).toBe(7);
  });
});

describe('registration and the lock', () => {
  it('publishes the real paths of file documents on register and unregister, and register waits for it', async () => {
    const io = createMemoryHubIo();
    io.addFile('/real/a.erd.json');
    io.links.set('/link', '/real');
    const registry = new DocumentRegistry(io);
    const published: string[][] = [];
    let release!: () => void;
    await registry.setPublisher(async documents => {
      published.push(documents);
      if (documents.length) {
        await new Promise<void>(resolve => (release = resolve));
      }
    });
    const document = ErdDocument.create(
      Uri.file('/link/a.erd.json') as unknown as VscodeUri,
      new Uint8Array()
    );
    let registered = false;

    const pending = registry.register(document).then(() => (registered = true));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(registered).toBe(false);
    release();
    await pending;
    await registry.unregister(document);

    expect(published).toEqual([[], ['/real/a.erd.json'], []]);
    expect(registry.find('/real/a.erd.json')).toBeUndefined();
    await expect(registry.unregister(document)).resolves.toBeUndefined();
  });

  it('never rejects when the publisher fails, and logs it', async () => {
    const registry = new DocumentRegistry(createMemoryHubIo());
    await registry.setPublisher(async () => {
      throw new Error('disk full');
    });
    const document = ErdDocument.create(
      Uri.file('/ws/a.erd.json') as unknown as VscodeUri,
      new Uint8Array()
    );

    await expect(registry.register(document)).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      'could not list the open documents in the lock',
      expect.objectContaining({ message: 'disk full' })
    );
  });

  it('keeps an untitled document out of the file system and out of the lock', async () => {
    const io = createMemoryHubIo();
    const registry = new DocumentRegistry(io);
    const publisher = vi.fn(async () => undefined);
    await registry.setPublisher(publisher);
    const document = ErdDocument.create(
      Uri.parse('untitled:Untitled-1') as unknown as VscodeUri,
      new Uint8Array()
    );

    await registry.register(document);

    expect(io.realpath).not.toHaveBeenCalled();
    expect(publisher).toHaveBeenLastCalledWith([]);
    expect(registry.documents()).toEqual([{ document, path: 'Untitled-1' }]);
  });

  it('resolves a win32 document path with win32 rules', async () => {
    const io = createMemoryHubIo({ platform: 'win32' });
    io.realpath.mockImplementation(async () => 'd:\\real\\a.erd.json');
    const registry = new DocumentRegistry(io);
    const document = ErdDocument.create(
      { scheme: 'file', fsPath: 'c:\\ws\\a.erd.json' } as unknown as VscodeUri,
      new Uint8Array()
    );

    await registry.register(document);

    expect(io.realpath).toHaveBeenCalledWith('c:\\ws\\a.erd.json');
    expect(registry.documents()).toEqual([
      { document, path: 'd:\\real\\a.erd.json' },
    ]);
    expect(registry.find('D:\\REAL\\A.ERD.JSON')).toBe(document);
  });

  it('lists a file open under a link and under its real path once in the lock', async () => {
    const io = createMemoryHubIo();
    io.addFile('/real/a.erd.json');
    io.links.set('/link', '/real');
    const registry = new DocumentRegistry(io);
    const publisher = vi.fn(async () => undefined);
    await registry.setPublisher(publisher);

    for (const path of ['/link/a.erd.json', '/real/a.erd.json']) {
      await registry.register(
        ErdDocument.create(
          Uri.file(path) as unknown as VscodeUri,
          new Uint8Array()
        )
      );
    }

    expect(registry.documents()).toHaveLength(2);
    expect(publisher).toHaveBeenLastCalledWith(['/real/a.erd.json']);
  });

  it('matches paths without regard to case on darwin', async () => {
    const harness = createDocumentHarness({ platform: 'darwin' });
    const editor = await harness.openReady(PATH, '{}');

    expect(harness.registry.find('/WS/A.erd.json')).toBe(editor.document);
    expect(harness.registry.find('/ws/b.erd.json')).toBeUndefined();
  });
});

describe('active document', () => {
  it('follows the panel that took focus last and forgets a closed document', async () => {
    const harness = createDocumentHarness();
    const a = await harness.openReady('/ws/a.erd.json', '{}');
    const b = await harness.openReady('/ws/b.erd.json', '{}');
    expect(harness.registry.isActive(b.document)).toBe(true);

    a.panel.__changeViewState({ active: true, visible: true });
    expect(harness.registry.isActive(a.document)).toBe(true);
    expect(harness.registry.isActive(b.document)).toBe(false);

    a.document.dispose();
    expect(harness.registry.isActive(a.document)).toBe(false);
    harness.registry.setActive(a.document);
    expect(harness.registry.isActive(a.document)).toBe(false);
  });

  it('leaves the active document alone when an inactive panel opens', async () => {
    const harness = createDocumentHarness();
    const a = await harness.openReady('/ws/a.erd.json', '{}');
    harness.io.addFile('/ws/b.erd.json', '{}');
    const b = await harness.provider.openCustomDocument(
      Uri.file('/ws/b.erd.json') as unknown as VscodeUri,
      { backupId: undefined, untitledDocumentData: undefined }
    );
    const panel = createWebviewPanel();
    panel.active = false;

    harness.registry.addWebview(b, panel as unknown as WebviewPanel);

    expect(harness.registry.isActive(a.document)).toBe(true);
    expect(harness.registry.panelOf(b)).toBe(panel);
  });
});

describe('waitForReady', () => {
  it('resolves with the document once a webview of the path reports ready', async () => {
    const harness = createDocumentHarness();
    const { ready } = harness.registry.waitForReady(PATH, 5_000);

    const editor = await harness.openReady(PATH, '{}');

    await expect(ready).resolves.toBe(editor.document);
  });

  it('stays waiting while a git view of the same path reports ready', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    harness.io.addFile(PATH, '{}');
    const { ready } = harness.registry.waitForReady(PATH, 100);
    let settled: unknown = 'pending';
    ready.then(value => (settled = value));

    const view = await harness.open(PATH, '{}', Uri.parse(`git:${PATH}`));
    harness.ready(view);
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe('pending');
    expect(harness.registry.readyWebviewCount(view.document)).toBe(1);

    const file = await harness.openReady(PATH);
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(file.document);
  });

  it('stays waiting while a webview of another document reports ready', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    const { ready } = harness.registry.waitForReady(PATH, 100);
    let settled: unknown = 'pending';
    ready.then(value => (settled = value));

    await harness.openReady('/ws/other.erd.json', '{}');
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe('pending');

    await vi.advanceTimersByTimeAsync(100);
    expect(settled).toBeNull();
  });

  it('resolves with null after the timeout, or at once on cancel', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    const timed = harness.registry.waitForReady(PATH, 100);
    const cancelled = harness.registry.waitForReady(PATH, 100);

    cancelled.cancel();
    await expect(cancelled.ready).resolves.toBeNull();
    await vi.advanceTimersByTimeAsync(100);
    await expect(timed.ready).resolves.toBeNull();
  });
});
