import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

const mocks = vi.hoisted(() => ({
  sharedWorker: vi.fn<(options: any) => any>(),
  wrap: vi.fn<(target: any) => any>(),
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

vi.mock('comlink', async importOriginal => {
  const actual = await importOriginal<typeof import('comlink')>();
  return { ...actual, wrap: (target: any) => mocks.wrap(target) };
});

const importFresh = async () => {
  vi.resetModules();
  return await import('@/services/shiki');
};

beforeEach(() => {
  Reflect.set(globalThis, 'SharedWorker', SharedWorkerMock);
  lastWorker = null;
  mocks.sharedWorker
    .mockReset()
    .mockReturnValue({ id: 'port', close: vi.fn() });
  mocks.wrap.mockReset().mockImplementation(() => ({ codeToHtml: vi.fn() }));
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'SharedWorker');
});

describe('getShikiService', () => {
  it('wraps the shared worker port and answers from it', async () => {
    const { getShikiService } = await importFresh();

    const service = getShikiService();

    expect(mocks.sharedWorker).toHaveBeenCalledTimes(1);
    expect(mocks.wrap).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'port' })
    );
    expect(service).toBeTruthy();
  });

  it('builds one worker for the session, however many panels ask', async () => {
    const { getShikiService } = await importFresh();

    const first = getShikiService();
    const second = getShikiService();

    expect(second).toBe(first);
    expect(mocks.sharedWorker).toHaveBeenCalledTimes(1);
  });

  it('stamps the version into the worker name, so two editor versions never share one', async () => {
    const { getShikiService } = await importFresh();

    getShikiService();

    expect(mocks.sharedWorker).toHaveBeenCalledWith({
      type: 'module',
      name: `@dineug/erd-editor-shiki-worker?v${__APP_VERSION__}`,
    });
  });

  it('answers null where the host builds no shared worker, and warns why', async () => {
    Reflect.deleteProperty(globalThis, 'SharedWorker');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { getShikiService } = await importFresh();

    expect(getShikiService()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('attempts the worker once, so a blocked host is not told off on every panel', async () => {
    Reflect.deleteProperty(globalThis, 'SharedWorker');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { getShikiService } = await importFresh();
    getShikiService();
    getShikiService();

    expect(getShikiService()).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('gives the highlighter up when the worker fails after its constructor returned', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { getShikiService } = await importFresh();
    expect(getShikiService()).toBeTruthy();

    lastWorker?.onerror?.();

    expect(getShikiService()).toBeNull();
    expect(lastWorker?.port.close).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
