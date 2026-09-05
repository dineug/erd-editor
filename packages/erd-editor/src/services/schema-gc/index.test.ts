import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { SchemaGCService } from '@/services/schema-gc/schemaGCService';

const mocks = vi.hoisted(() => ({
  sharedWorker: vi.fn<(options: any) => any>(),
  wrap: vi.fn<(target: any) => any>(),
  remoteRun: vi.fn<(source: string) => Promise<any>>(),
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
  return await import('@/services/schema-gc');
};

const throws = (message: string) => () => {
  throw new Error(message);
};

beforeEach(() => {
  Reflect.set(globalThis, 'SharedWorker', SharedWorkerMock);
  lastWorker = null;
  mocks.sharedWorker.mockReset();
  mocks.wrap.mockReset();
  mocks.remoteRun.mockReset().mockResolvedValue({ from: 'worker' });
  mocks.wrap.mockImplementation(() => ({ run: mocks.remoteRun }));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getSchemaGCService', () => {
  it('runs a collection through the shared worker port when one can be created', async () => {
    const workerPort = port();
    mocks.sharedWorker.mockReturnValue(workerPort);

    const { getSchemaGCService } = await importFresh();
    const service = getSchemaGCService();
    const result = await service!.run('{"version":"3.0.0"}');

    expect(mocks.sharedWorker).toHaveBeenCalledTimes(1);
    expect(mocks.wrap).toHaveBeenCalledWith(workerPort);
    expect(mocks.remoteRun).toHaveBeenCalledWith('{"version":"3.0.0"}');
    expect(result).toEqual({ from: 'worker' });
  });

  it('collects in-process once the worker errors after construction', async () => {
    const workerPort = port();
    mocks.sharedWorker.mockReturnValue(workerPort);
    mocks.remoteRun.mockReturnValue(new Promise(() => {}));

    const { getSchemaGCService } = await importFresh();
    const service = getSchemaGCService();
    const pending = service!.run(JSON.stringify({ version: '3.0.0' }));
    lastWorker!.onerror!();
    const result = await pending;

    const { SchemaGCService: FreshSchemaGCService } =
      await import('@/services/schema-gc/schemaGCService');
    expect(result.tableIds).toEqual([]);
    expect(workerPort.close).toHaveBeenCalledTimes(1);
    expect(getSchemaGCService()).toBeInstanceOf(FreshSchemaGCService);
    expect(console.warn).toHaveBeenCalledWith(
      '[schema-gc] the shared worker gave way, collecting in-process',
      expect.any(Error)
    );
  });

  it('gives the worker up when a collection goes unanswered', async () => {
    vi.useFakeTimers();
    mocks.sharedWorker.mockReturnValue(port());
    mocks.remoteRun.mockReturnValue(new Promise(() => {}));

    const { getSchemaGCService } = await importFresh();
    const pending = getSchemaGCService()!.run(
      JSON.stringify({ version: '3.0.0' })
    );
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await pending;

    const { SchemaGCService: FreshSchemaGCService } =
      await import('@/services/schema-gc/schemaGCService');
    expect(result.memoIds).toEqual([]);
    expect(getSchemaGCService()).toBeInstanceOf(FreshSchemaGCService);
  });

  it('names the shared worker with the app version', async () => {
    mocks.sharedWorker.mockReturnValue(port());

    const { getSchemaGCService } = await importFresh();
    getSchemaGCService();

    const [options] = mocks.sharedWorker.mock.calls[0];
    expect(options.name).toMatch(
      /^@dineug\/erd-editor-schema-gc-worker\?v\d+\.\d+\.\d+/
    );
  });

  it('falls straight to the in-process service when the SharedWorker constructor throws', async () => {
    mocks.sharedWorker.mockImplementation(throws('no SharedWorker'));

    const { getSchemaGCService } = await importFresh();
    const service = getSchemaGCService();
    const { SchemaGCService: FreshSchemaGCService } =
      await import('@/services/schema-gc/schemaGCService');

    expect(mocks.sharedWorker).toHaveBeenCalledTimes(1);
    expect(mocks.wrap).not.toHaveBeenCalled();
    expect(service).toBeInstanceOf(FreshSchemaGCService);
    expect(service?.constructor.name).toBe(SchemaGCService.name);
  });

  it('says on the console which rung it landed on', async () => {
    mocks.sharedWorker.mockImplementation(throws('no SharedWorker'));

    const { getSchemaGCService } = await importFresh();
    getSchemaGCService();

    expect(console.warn).toHaveBeenCalledWith(
      '[schema-gc] this host built no shared worker',
      expect.any(Error)
    );
  });

  it('the in-process fallback is a usable service', async () => {
    mocks.sharedWorker.mockImplementation(throws('no SharedWorker'));

    const { getSchemaGCService } = await importFresh();
    const service = getSchemaGCService();
    const result = await service!.run(JSON.stringify({ version: '3.0.0' }));

    expect(result).toEqual({
      tableIds: [],
      tableColumnIds: [],
      relationshipIds: [],
      indexIds: [],
      indexColumnIds: [],
      memoIds: [],
    });
  });

  it('memoizes the remote service across calls', async () => {
    mocks.sharedWorker.mockReturnValue(port());

    const { getSchemaGCService } = await importFresh();
    const first = getSchemaGCService();
    const second = getSchemaGCService();

    expect(second).toBe(first);
    expect(mocks.sharedWorker).toHaveBeenCalledTimes(1);
    expect(mocks.wrap).toHaveBeenCalledTimes(1);
  });

  it('memoizes the in-process fallback too', async () => {
    mocks.sharedWorker.mockImplementation(throws('no SharedWorker'));

    const { getSchemaGCService } = await importFresh();
    const first = getSchemaGCService();
    const second = getSchemaGCService();

    expect(second).toBe(first);
    expect(mocks.sharedWorker).toHaveBeenCalledTimes(1);
  });
});

const SOURCE_ROOT = join(process.cwd(), 'src');

/**
 * A dedicated worker import, which the bundler answers by inlining a second
 * copy of everything the entry reaches. The shared worker spelling is a
 * different query, so it does not match.
 */
const DEDICATED_WORKER_IMPORT = /\?worker(&|')/;

function sourceFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      sourceFiles(path, found);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      found.push(path);
    }
  }

  return found;
}

const posix = (path: string) =>
  relative(SOURCE_ROOT, path).split(sep).join('/');

describe('the worker ladder is two rungs everywhere', () => {
  it('leaves no dedicated worker import in any shipped file', () => {
    const importers = sourceFiles(SOURCE_ROOT)
      .filter(path => !/\.test\.tsx?$/.test(path))
      .filter(path => DEDICATED_WORKER_IMPORT.test(readFileSync(path, 'utf8')))
      .map(posix)
      .sort();

    expect(importers).toEqual([]);
  });

  it('reaches its own worker only through the spawn module, which names it as a url', () => {
    const index = readFileSync(
      join(SOURCE_ROOT, 'services', 'schema-gc', 'index.ts'),
      'utf8'
    );
    const spawn = readFileSync(
      join(SOURCE_ROOT, 'workers', 'spawn.ts'),
      'utf8'
    );
    const specifiers = [...index.matchAll(/^import\s.*?'([^']+)'/gm)].map(
      ([, specifier]) => specifier
    );

    expect(specifiers.filter(one => one.includes('worker'))).toEqual([
      '@/workers/spawn',
    ]);
    expect(spawn).toContain(
      "new URL('../services/schema-gc/schemaGC.shared-worker.ts', import.meta.url)"
    );
  });
});
