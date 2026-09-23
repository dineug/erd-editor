import { HubErrorCode } from '@dineug/erd-editor-agent-hub';
import { Effect } from 'effect';
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
import { REPLICA_DEBOUNCE_MS } from '@/hub/joinWindow';
import { textDecoder } from '@/utils';

import {
  actionsSent,
  createConnection,
  createDocumentHarness,
  type OpenedEditor,
} from '../../test/mocks/documentHarness';
import {
  createMemoryHub,
  createMemoryRegistry,
  createPendingRegistry,
  flush,
  runHub,
} from '../../test/mocks/hubLayers';
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
  for (const peer of peers)
    await harness.run(harness.handler.join({ path: PATH }, peer));
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
    await harness.run(harness.handler.join({ path: '/real/a.erd.json' }, peer));
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

    const result = await harness.run(
      harness.handler.applyActions({ path: PATH, actions: batch(4) }, peer)
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
    await harness.run(harness.handler.join({ path: PATH }, a));
    await harness.run(harness.handler.join({ path: PATH }, b));
    await vi.advanceTimersByTimeAsync(0);

    await harness.run(
      harness.handler.applyActions({ path: PATH, actions: batch(5) }, a)
    );

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
    const joining = harness.run(harness.handler.join({ path: PATH }, b));
    await harness.run(
      harness.handler.applyActions({ path: PATH, actions: batch(2) }, a)
    );
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
      harness.run(
        harness.handler.applyActions({ path: PATH, actions: batch(1) }, peer)
      )
    ).rejects.toMatchObject({ code: HubErrorCode.notOpen });
  });

  it('forgets a closed panel without reading its webview, which VS Code refuses once disposed', async () => {
    const peer = createConnection();
    const { harness, first, second } = await openJoined([peer]);

    first.panel.__dispose();

    expect(() => first.panel.webview).toThrow('Webview is disposed');
    expect(harness.registry.docToWebviewMap.get(first.document)).toEqual(
      new Set([second.webview])
    );
    await expect(
      harness.run(
        harness.handler.applyActions({ path: PATH, actions: batch(1) }, peer)
      )
    ).resolves.toEqual({ webviews: 1 });
    expect(replicationsTo(first)).toEqual([]);
    expect(replicationsTo(second)).toEqual([injected(batch(1))]);

    let settled: boolean | undefined;
    runHub(harness.registry.whenQuiet(first.document, 1_000)).then(
      value => (settled = value)
    );
    await vi.advanceTimersByTimeAsync(REPLICA_DEBOUNCE_MS);
    await harness.saveValue(second, '{"tables":["t1"]}');
    expect(settled).toBe(true);
  });

  it('settles a pending edit when the panel still owing a save closes after the other saved', async () => {
    const peer = createConnection();
    const { harness, first, second } = await openJoined([peer]);
    await expect(
      harness.run(
        harness.handler.applyActions({ path: PATH, actions: batch(1) }, peer)
      )
    ).resolves.toEqual({ webviews: 2 });

    let settled: boolean | undefined;
    runHub(harness.registry.whenQuiet(first.document, 1_000)).then(
      value => (settled = value)
    );
    await vi.advanceTimersByTimeAsync(REPLICA_DEBOUNCE_MS);
    await harness.saveValue(second, '{"tables":["t1"]}');
    expect(settled).toBeUndefined();

    first.panel.__dispose();
    await vi.advanceTimersByTimeAsync(0);

    expect(settled).toBe(true);
    await expect(
      harness.run(harness.handler.save({ path: PATH }, peer))
    ).resolves.toEqual({
      saved: true,
    });
    expect(textDecoder.decode(first.document.content)).toBe(
      '{"tables":["t1"]}'
    );
  });

  it('keeps a pending edit waiting when a panel closes before any replica saved it', async () => {
    const peer = createConnection();
    const { harness, first, second } = await openJoined([peer]);
    await harness.run(
      harness.handler.applyActions({ path: PATH, actions: batch(1) }, peer)
    );
    let settled: boolean | undefined;
    runHub(harness.registry.whenQuiet(first.document, 1_000)).then(
      value => (settled = value)
    );

    first.panel.__dispose();
    second.panel.__dispose();
    await vi.advanceTimersByTimeAsync(REPLICA_DEBOUNCE_MS);
    expect(settled).toBeUndefined();

    await vi.advanceTimersByTimeAsync(1_000 - REPLICA_DEBOUNCE_MS);
    expect(settled).toBe(false);
  });

  it('never injects into a webview that has not reported ready', async () => {
    const peer = createConnection();
    const harness = createDocumentHarness();
    const ready = await harness.openReady(PATH, '{}');
    const loading = await harness.resolveView(ready.document);
    await harness.run(harness.handler.join({ path: PATH }, peer));

    const result = await harness.run(
      harness.handler.applyActions({ path: PATH, actions: batch(1) }, peer)
    );

    expect(result).toEqual({ webviews: 1 });
    expect(replicationsTo(ready)).toEqual([injected(batch(1))]);
    expect(replicationsTo(loading)).toEqual([]);
  });

  it('awaits the replicas a batch reached, so a webview still loading holds nothing open', async () => {
    vi.useFakeTimers();
    const peer = createConnection();
    const harness = createDocumentHarness();
    const ready = await harness.openReady(PATH, '{}');
    const loading = await harness.resolveView(ready.document);
    await harness.run(harness.handler.join({ path: PATH }, peer));
    await harness.run(
      harness.handler.applyActions({ path: PATH, actions: batch(1) }, peer)
    );

    let settled: boolean | undefined;
    runHub(harness.registry.whenQuiet(ready.document, 1_000)).then(
      value => (settled = value)
    );
    await vi.advanceTimersByTimeAsync(REPLICA_DEBOUNCE_MS);
    expect(settled).toBeUndefined();

    await harness.saveValue(ready, '{"tables":["t1"]}');

    expect(settled).toBe(true);
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
    harness.registry.onValueSaved(stray, stranger.webview as any);
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
    await expect(runHub(harness.registry.whenQuiet(stray, 100))).resolves.toBe(
      true
    );
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
    await expect(
      runHub(harness.registry.join(stray, stranger))
    ).rejects.toMatchObject({
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

    await harness.run(
      harness.handler.applyActions(
        { path: PATH, actions: [...batch(7), { type: 'memo.resize' }] },
        peer
      )
    );
    expect(harness.registry.observedVersion(first.document)).toBe(7);

    harness.relay(first, batch(5));
    expect(harness.registry.observedVersion(first.document)).toBe(7);
  });
});

describe('registration and the lock', () => {
  it('publishes the real paths of file documents on register and unregister, and register waits for it', async () => {
    const io = createMemoryHub();
    io.addFile('/real/a.erd.json');
    io.links.set('/link', '/real');
    const registry = createMemoryRegistry(io);
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
    const registry = createMemoryRegistry(createMemoryHub());
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
    const io = createMemoryHub();
    const registry = createMemoryRegistry(io);
    const publisher = vi.fn(async () => undefined);
    await registry.setPublisher(publisher);
    const document = ErdDocument.create(
      Uri.parse('untitled:Untitled-1') as unknown as VscodeUri,
      new Uint8Array()
    );

    await registry.register(document);

    expect(io.fs.realPath).not.toHaveBeenCalled();
    expect(publisher).toHaveBeenLastCalledWith([]);
    expect(registry.documents()).toEqual([{ document, path: 'Untitled-1' }]);
  });

  it('resolves a win32 document path with win32 rules', async () => {
    const io = createMemoryHub({ platform: 'win32' });
    io.fs.realPath.mockImplementation(() =>
      Effect.succeed('d:\\real\\a.erd.json')
    );
    const registry = createMemoryRegistry(io);
    const document = ErdDocument.create(
      { scheme: 'file', fsPath: 'c:\\ws\\a.erd.json' } as unknown as VscodeUri,
      new Uint8Array()
    );

    await registry.register(document);

    expect(io.fs.realPath).toHaveBeenCalledWith('c:\\ws\\a.erd.json');
    expect(registry.documents()).toEqual([
      { document, path: 'd:\\real\\a.erd.json' },
    ]);
    expect(registry.find('D:\\REAL\\A.ERD.JSON')).toBe(document);
  });

  it('lists a file open under a link and under its real path once in the lock', async () => {
    const io = createMemoryHub();
    io.addFile('/real/a.erd.json');
    io.links.set('/link', '/real');
    const registry = createMemoryRegistry(io);
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

  it('queues what arrives before its layer builds, and applies it in arrival order once it has', async () => {
    const io = createMemoryHub();
    for (const name of ['a', 'b', 'c', 'd'])
      io.addFile(`/real/${name}.erd.json`);
    io.links.set('/link', '/real');
    const { registry, attach } = createPendingRegistry(io);
    const publisher = vi.fn(async (_documents: string[]) => undefined);
    await registry.setPublisher(publisher);
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(name =>
      ErdDocument.create(
        Uri.file(`/link/${name}.erd.json`) as unknown as VscodeUri,
        new Uint8Array()
      )
    );
    const settled: string[] = [];
    const track = (label: string, pending: Promise<void>) =>
      pending.then(() => void settled.push(label));

    const queued = [
      track('register a', registry.register(a)),
      track('register b', registry.register(b)),
      track('unregister b', registry.unregister(b)),
      track('register c', registry.register(c)),
    ];
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(settled).toEqual([]);
    expect(io.fs.realPath).not.toHaveBeenCalled();
    expect(registry.docToWebviewMap.has(a)).toBe(true);
    expect(registry.docToWebviewMap.has(b)).toBe(false);

    attach();
    await Promise.all(queued);
    await registry.register(d);

    expect(settled).toEqual([
      'register a',
      'register b',
      'unregister b',
      'register c',
    ]);
    expect(io.fs.realPath.mock.calls.map(([path]) => path)).toEqual([
      '/link/a.erd.json',
      '/link/c.erd.json',
      '/link/d.erd.json',
    ]);
    expect(publisher.mock.calls.map(([documents]) => documents)).toEqual([
      [],
      ['/real/a.erd.json'],
      ['/real/a.erd.json'],
      ['/real/a.erd.json'],
      ['/real/a.erd.json', '/real/c.erd.json'],
      ['/real/a.erd.json', '/real/c.erd.json', '/real/d.erd.json'],
    ]);
  });

  it('settles what it still queues without IO when closed before its layer builds, and publishes no more', async () => {
    const io = createMemoryHub();
    const { registry, attach } = createPendingRegistry(io);
    const publisher = vi.fn(async (_documents: string[]) => undefined);
    await registry.setPublisher(publisher);
    const open = (path: string) =>
      ErdDocument.create(
        Uri.file(path) as unknown as VscodeUri,
        new Uint8Array()
      );
    const pending = registry.register(open('/ws/a.erd.json'));

    registry.close();
    await pending;
    await registry.register(open('/ws/b.erd.json'));
    attach();
    await registry.register(open('/ws/c.erd.json'));

    expect(io.fs.realPath).not.toHaveBeenCalled();
    expect(publisher).toHaveBeenCalledTimes(1);
    expect(registry.documents().map(({ path }) => path)).toEqual([
      '/ws/a.erd.json',
      '/ws/b.erd.json',
      '/ws/c.erd.json',
    ]);
  });

  it('interrupts the path it is resolving and settles the rest when its layer closes', async () => {
    const io = createMemoryHub();
    io.fs.realPath.mockImplementation(() => Effect.never);
    const { registry, attach, close } = createPendingRegistry(io);
    const open = (path: string) =>
      registry.register(
        ErdDocument.create(
          Uri.file(path) as unknown as VscodeUri,
          new Uint8Array()
        )
      );
    const pending = [open('/ws/a.erd.json'), open('/ws/b.erd.json')];
    attach();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(io.fs.realPath).toHaveBeenCalledTimes(1);

    await close();

    await expect(Promise.all(pending)).resolves.toEqual([undefined, undefined]);
    expect(io.fs.realPath).toHaveBeenCalledTimes(1);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('resolves and lists a path registered once its layer is up while an earlier realpath hangs', async () => {
    const io = createMemoryHub();
    io.addFile('/real/b.erd.json');
    io.links.set('/link', '/real');
    io.fs.realPath.mockImplementationOnce(() => Effect.never);
    const { registry, attach, close } = createPendingRegistry(io);
    attach();
    const publisher = vi.fn(async (_documents: string[]) => undefined);
    await registry.setPublisher(publisher);
    const [a, b] = ['a', 'b'].map(name =>
      ErdDocument.create(
        Uri.file(`/link/${name}.erd.json`) as unknown as VscodeUri,
        new Uint8Array()
      )
    );

    const first = registry.register(a);
    const second = registry.register(b);
    await flush();

    expect(io.fs.realPath.mock.calls.map(([path]) => path)).toEqual([
      '/link/a.erd.json',
      '/link/b.erd.json',
    ]);
    expect(registry.find('/real/b.erd.json')).toBe(b);
    await second;
    await registry.unregister(b);
    expect(publisher.mock.calls.map(([documents]) => documents)).toEqual([
      [],
      ['/real/b.erd.json'],
      [],
    ]);

    await close();
    await expect(first).resolves.toBeUndefined();
    expect(registry.documents()).toEqual([
      { document: a, path: '/link/a.erd.json' },
    ]);
  });

  it('resolves the next queued path while the lock write that listed the one before it hangs', async () => {
    const io = createMemoryHub();
    io.addFile('/real/a.erd.json');
    io.addFile('/real/b.erd.json');
    io.links.set('/link', '/real');
    const { registry, attach } = createPendingRegistry(io);
    const published: string[][] = [];
    await registry.setPublisher(documents => {
      published.push(documents);
      return documents.length === 1
        ? new Promise<void>(() => undefined)
        : Promise.resolve();
    });
    const [a, b] = ['a', 'b'].map(name =>
      ErdDocument.create(
        Uri.file(`/link/${name}.erd.json`) as unknown as VscodeUri,
        new Uint8Array()
      )
    );
    let firstSettled = false;
    void registry.register(a).then(() => (firstSettled = true));
    const second = registry.register(b);

    attach();
    await flush();

    expect(registry.find('/real/b.erd.json')).toBe(b);
    await second;
    expect(firstSettled).toBe(false);
    expect(published).toEqual([
      [],
      ['/real/a.erd.json'],
      ['/real/a.erd.json', '/real/b.erd.json'],
    ]);
  });

  it('keys a document by the path given when resolving it dies, and still lists it', async () => {
    const io = createMemoryHub();
    io.fs.realPath.mockImplementation(() =>
      Effect.die(new Error('EIO under /ws'))
    );
    const registry = createMemoryRegistry(io);
    const publisher = vi.fn(async (_documents: string[]) => undefined);
    await registry.setPublisher(publisher);

    await registry.register(
      ErdDocument.create(
        Uri.file('/ws/a.erd.json') as unknown as VscodeUri,
        new Uint8Array()
      )
    );

    expect(publisher).toHaveBeenLastCalledWith(['/ws/a.erd.json']);
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

    await expect(runHub(ready)).resolves.toBe(editor.document);
  });

  it('stays waiting while a git view of the same path reports ready', async () => {
    vi.useFakeTimers();
    const harness = createDocumentHarness();
    harness.io.addFile(PATH, '{}');
    const { ready } = harness.registry.waitForReady(PATH, 100);
    let settled: unknown = 'pending';
    void runHub(ready).then(value => (settled = value));

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
    void runHub(ready).then(value => (settled = value));

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
    await expect(runHub(cancelled.ready)).resolves.toBeNull();
    await vi.advanceTimersByTimeAsync(100);
    await expect(runHub(timed.ready)).resolves.toBeNull();
  });
});
