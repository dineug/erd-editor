import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { SchemaGCService } from '@/services/schema-gc/schemaGCService';

const mocks = vi.hoisted(() => ({
  sharedWorker: vi.fn<(options: any) => any>(),
  wrap: vi.fn<(target: any) => any>(),
}));

vi.mock('./schemaGC.shared-worker?sharedworker&inline', () => ({
  default: class SharedWorkerMock {
    port: any;
    constructor(options: any) {
      this.port = mocks.sharedWorker(options);
    }
  },
}));

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
  mocks.sharedWorker.mockReset();
  mocks.wrap.mockReset();
  mocks.wrap.mockImplementation(target => ({ remoteOf: target }));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('getSchemaGCService', () => {
  it('wraps the shared worker port when a SharedWorker can be created', async () => {
    const port = { id: 'port' };
    mocks.sharedWorker.mockReturnValue(port);

    const { getSchemaGCService } = await importFresh();
    const service = getSchemaGCService();

    expect(mocks.sharedWorker).toHaveBeenCalledTimes(1);
    expect(mocks.wrap).toHaveBeenCalledWith(port);
    expect(service).toEqual({ remoteOf: port });
  });

  it('names the shared worker with the app version', async () => {
    mocks.sharedWorker.mockReturnValue({});

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
    mocks.sharedWorker.mockReturnValue({ id: 'port' });

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

  it('reaches its own worker only through the shared worker spelling', () => {
    const source = readFileSync(
      join(SOURCE_ROOT, 'services', 'schema-gc', 'index.ts'),
      'utf8'
    );
    const specifiers = [...source.matchAll(/^import\s.*?'([^']+)'/gm)].map(
      ([, specifier]) => specifier
    );

    expect(specifiers).toContain(
      './schemaGC.shared-worker?sharedworker&inline'
    );
    expect(specifiers.filter(one => one.includes('worker'))).toHaveLength(1);
  });
});
