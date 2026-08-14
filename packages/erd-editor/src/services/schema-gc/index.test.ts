import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SchemaGCService } from '@/services/schema-gc/schemaGCService';

const mocks = vi.hoisted(() => ({
  sharedWorker: vi.fn<(options: any) => any>(),
  worker: vi.fn<(options: any) => any>(),
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

vi.mock('./schemaGC.worker?worker&inline', () => ({
  default: class WorkerMock {
    options: any;
    constructor(options: any) {
      this.options = mocks.worker(options);
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
  mocks.worker.mockReset();
  mocks.wrap.mockReset();
  mocks.wrap.mockImplementation(target => ({ remoteOf: target }));
});

describe('getSchemaGCService', () => {
  it('wraps the shared worker port when a SharedWorker can be created', async () => {
    const port = { id: 'port' };
    mocks.sharedWorker.mockReturnValue(port);

    const { getSchemaGCService } = await importFresh();
    const service = await getSchemaGCService();

    expect(mocks.sharedWorker).toHaveBeenCalledTimes(1);
    expect(mocks.worker).not.toHaveBeenCalled();
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

  it('falls back to a dedicated Worker when the SharedWorker constructor throws', async () => {
    mocks.sharedWorker.mockImplementation(throws('no SharedWorker'));
    mocks.worker.mockReturnValue(undefined);

    const { getSchemaGCService } = await importFresh();
    const service = await getSchemaGCService();

    expect(mocks.sharedWorker).toHaveBeenCalledTimes(1);
    expect(mocks.worker).toHaveBeenCalledTimes(1);
    expect(mocks.wrap).toHaveBeenCalledTimes(1);
    expect((service as any).remoteOf).toBeInstanceOf(Object);
    expect(mocks.wrap.mock.calls[0][0].constructor.name).toBe('WorkerMock');
  });

  it('passes the same worker name down to the dedicated Worker fallback', async () => {
    mocks.sharedWorker.mockImplementation(throws('no SharedWorker'));

    const { getSchemaGCService } = await importFresh();
    getSchemaGCService();

    const [options] = mocks.worker.mock.calls[0];
    expect(options.name).toMatch(
      /^@dineug\/erd-editor-schema-gc-worker\?v\d+\.\d+\.\d+/
    );
  });

  it('falls back to an in-process service when both worker constructors throw', async () => {
    mocks.sharedWorker.mockImplementation(throws('no SharedWorker'));
    mocks.worker.mockImplementation(throws('no Worker'));

    const { getSchemaGCService } = await importFresh();
    const service = await getSchemaGCService();
    const { SchemaGCService: FreshSchemaGCService } = await import(
      '@/services/schema-gc/schemaGCService'
    );

    expect(mocks.wrap).not.toHaveBeenCalled();
    expect(service).toBeInstanceOf(FreshSchemaGCService);
    expect(service?.constructor.name).toBe(SchemaGCService.name);
  });

  it('the in-process fallback is a usable service', async () => {
    mocks.sharedWorker.mockImplementation(throws('no SharedWorker'));
    mocks.worker.mockImplementation(throws('no Worker'));

    const { getSchemaGCService } = await importFresh();
    const service = await getSchemaGCService();
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
    mocks.worker.mockImplementation(throws('no Worker'));

    const { getSchemaGCService } = await importFresh();
    const first = getSchemaGCService();
    const second = getSchemaGCService();

    expect(second).toBe(first);
    expect(mocks.sharedWorker).toHaveBeenCalledTimes(1);
    expect(mocks.worker).toHaveBeenCalledTimes(1);
  });
});
