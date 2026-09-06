import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { TablePlacement } from '@/constants/tablePlacement';
import type { ElkLayoutRequest } from '@/services/elk-layout/elkGraph';

const mocks = vi.hoisted(() => ({
  sharedWorker: vi.fn<(options: any) => any>(),
  wrap: vi.fn<(target: any) => any>(),
  remoteReady: vi.fn<() => Promise<boolean>>(),
  remoteLayout: vi.fn<(request: any) => Promise<any>>(),
}));

/** The last worker the code under test built, so a spec can fail it from outside. */
let lastWorker: SharedWorkerMock | null = null;

const remember = (worker: SharedWorkerMock) => {
  lastWorker = worker;
};

/** Stands in for the host's SharedWorker; the url is Vite's business, not this spec's. */
class SharedWorkerMock {
  port: any;
  onerror: null | (() => void) = null;
  constructor(_url: URL | string, options: any) {
    this.port = mocks.sharedWorker(options);
    remember(this);
  }
}

const port = () => ({ id: 'port', close: vi.fn() });

vi.mock('comlink', async importOriginal => {
  const actual = await importOriginal<typeof import('comlink')>();
  return { ...actual, wrap: (target: any) => mocks.wrap(target) };
});

const importFresh = async () => {
  vi.resetModules();
  return await import('@/services/elk-layout');
};

const request: ElkLayoutRequest = {
  placement: TablePlacement.layeredHorizontal,
  nodes: [{ id: 't1', width: 200, height: 100 }],
  edges: [],
};

beforeEach(() => {
  Reflect.set(globalThis, 'SharedWorker', SharedWorkerMock);
  lastWorker = null;
  mocks.sharedWorker.mockReset().mockReturnValue(port());
  mocks.wrap.mockReset();
  mocks.remoteReady.mockReset().mockResolvedValue(true);
  mocks.remoteLayout
    .mockReset()
    .mockResolvedValue([{ id: 't1', x: 10, y: 20 }]);
  mocks.wrap.mockImplementation(() => ({
    ready: mocks.remoteReady,
    layout: mocks.remoteLayout,
  }));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(globalThis, 'SharedWorker');
});

describe('createElkLayout', () => {
  it('asks the worker over the port comlink wrapped', async () => {
    const { createElkLayout } = await importFresh();

    const points = await createElkLayout(request);

    expect(mocks.wrap).toHaveBeenCalledWith(lastWorker!.port);
    expect(mocks.remoteLayout).toHaveBeenCalledWith(request);
    expect(points).toEqual([{ id: 't1', x: 10, y: 20 }]);
  });

  it('names the worker so two versions on one host stay apart', async () => {
    const { createElkLayout } = await importFresh();

    await createElkLayout(request);

    expect(mocks.sharedWorker.mock.calls[0][0].name).toContain(
      '@dineug/erd-editor-elk-layout-worker'
    );
  });

  it('builds the worker once and asks it again for a second placement', async () => {
    const { createElkLayout } = await importFresh();

    await createElkLayout(request);
    await createElkLayout(request);

    expect(mocks.sharedWorker).toHaveBeenCalledTimes(1);
    expect(mocks.remoteLayout).toHaveBeenCalledTimes(2);
  });

  it('shakes hands before the first layout, and only then', async () => {
    const { createElkLayout } = await importFresh();

    await createElkLayout(request);
    await createElkLayout(request);

    expect(mocks.remoteReady).toHaveBeenCalledTimes(1);
  });

  it('refuses on a host that runs no shared worker', async () => {
    Reflect.deleteProperty(globalThis, 'SharedWorker');
    const { createElkLayout } = await importFresh();

    await expect(createElkLayout(request)).rejects.toThrow(
      'this host runs no shared worker'
    );
    expect(mocks.sharedWorker).not.toHaveBeenCalled();
  });

  it('refuses, rather than laying out in process, when the worker never answers', async () => {
    vi.useFakeTimers();
    mocks.remoteReady.mockImplementation(() => new Promise(() => {}));
    const { createElkLayout } = await importFresh();

    const pending = createElkLayout(request);
    const settled = expect(pending).rejects.toThrow('did not answer');
    await vi.advanceTimersByTimeAsync(30_000);

    await settled;
    expect(mocks.remoteLayout).not.toHaveBeenCalled();
  });

  it('closes the port of a worker that failed to start', async () => {
    const workerPort = port();
    mocks.sharedWorker.mockReturnValue(workerPort);
    mocks.remoteReady.mockRejectedValue(new Error('boom'));
    const { createElkLayout } = await importFresh();

    await expect(createElkLayout(request)).rejects.toThrow('boom');

    expect(workerPort.close).toHaveBeenCalledTimes(1);
  });

  it('builds a worker again after one failed, rather than inheriting its error', async () => {
    mocks.remoteReady.mockRejectedValueOnce(new Error('boom'));
    const { createElkLayout } = await importFresh();

    await expect(createElkLayout(request)).rejects.toThrow('boom');
    await expect(createElkLayout(request)).resolves.toEqual([
      { id: 't1', x: 10, y: 20 },
    ]);

    expect(mocks.sharedWorker).toHaveBeenCalledTimes(2);
  });

  it('refuses when the worker raises an error event instead of answering', async () => {
    mocks.remoteReady.mockImplementation(() => new Promise(() => {}));
    const { createElkLayout } = await importFresh();

    const pending = createElkLayout(request);
    await Promise.resolve();
    lastWorker?.onerror?.();

    await expect(pending).rejects.toThrow('failed to start');
  });

  it('hands a failed layout back to the caller', async () => {
    mocks.remoteLayout.mockRejectedValue(new Error('no layout'));
    const { createElkLayout } = await importFresh();

    await expect(createElkLayout(request)).rejects.toThrow('no layout');
  });
});
