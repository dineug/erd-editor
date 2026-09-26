import { type HubConnection } from '@dineug/erd-editor-agent-hub-host';
import { afterEach, describe, expect, it, type Mock, vi } from 'vite-plus/test';

import { createConnection, microtasks } from '@/__test-utils__/hub';
import { DRAIN_CAP_MS, HubLifecycle } from '@/hub/lifecycle';
import { type HubRuntime } from '@/hub/runtime';

const CLOSING_KEY = Symbol.for('erd-editor-obsidian/hub-closing');

type FakeRuntime = {
  [K in keyof HubRuntime]: Mock<HubRuntime[K]>;
};

/** A runtime double recording the order of what the lifecycle asks of it into log. */
function createRuntime(log: string[], name = 'hub'): FakeRuntime {
  return {
    start: vi.fn(async () => void log.push(`${name} start`)),
    dispose: vi.fn(async () => void log.push(`${name} dispose`)),
    releaseSync: vi.fn(() => void log.push(`${name} release`)),
  };
}

function createDocuments(connections: HubConnection[] = []) {
  return { shutdown: vi.fn(() => connections) };
}

afterEach(async () => {
  vi.useRealTimers();
  const scope = globalThis as unknown as Record<symbol, Promise<void>>;
  await scope[CLOSING_KEY];
});

describe('HubLifecycle', () => {
  it('builds the runtime on start, once', async () => {
    const log: string[] = [];
    const runtime = createRuntime(log);
    const create = vi.fn(() => runtime);
    const lifecycle = new HubLifecycle(createDocuments(), create);

    await Promise.all([lifecycle.start(), lifecycle.start()]);

    expect(create).toHaveBeenCalledTimes(1);
    expect(log).toEqual(['hub start']);
    await lifecycle.stop();
  });

  it('stops in order: the peers hear documentClosed, their frames go out, then the hub closes', async () => {
    const log: string[] = [];
    const connection = createConnection();
    let flushed!: () => void;
    connection.drain.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          flushed = () => {
            log.push('drained');
            resolve();
          };
        })
    );
    const documents = createDocuments([connection]);
    documents.shutdown.mockImplementation(() => {
      log.push('shutdown');
      return [connection];
    });
    const lifecycle = new HubLifecycle(documents, () => createRuntime(log));
    await lifecycle.start();

    const stopping = lifecycle.stop();
    await microtasks();
    expect(log).toEqual(['hub start', 'shutdown']);
    flushed();
    await stopping;

    expect(log).toEqual(['hub start', 'shutdown', 'drained', 'hub dispose']);
    expect(lifecycle.stop()).toBe(stopping);
    expect(documents.shutdown).toHaveBeenCalledTimes(1);
  });

  it('closes the hub at the cap when a peer never takes its frames', async () => {
    vi.useFakeTimers();
    const log: string[] = [];
    const stuck = createConnection();
    stuck.drain.mockImplementation(() => new Promise(() => undefined));
    const failing = createConnection(2);
    failing.drain.mockRejectedValue(new Error('EPIPE'));
    const lifecycle = new HubLifecycle(createDocuments([stuck, failing]), () =>
      createRuntime(log)
    );
    await lifecycle.start();

    const stopping = lifecycle.stop();
    await vi.advanceTimersByTimeAsync(DRAIN_CAP_MS - 1);
    expect(log).toEqual(['hub start']);
    await vi.advanceTimersByTimeAsync(1);
    await stopping;

    expect(log).toEqual(['hub start', 'hub dispose']);
  });

  it('starts a new instance of the window only once the one before it has closed', async () => {
    const log: string[] = [];
    const connection = createConnection();
    let flushed!: () => void;
    connection.drain.mockImplementation(
      () => new Promise<void>(resolve => (flushed = resolve))
    );
    const before = new HubLifecycle(createDocuments([connection]), () =>
      createRuntime(log, 'before')
    );
    await before.start();
    const after = new HubLifecycle(createDocuments(), () =>
      createRuntime(log, 'after')
    );

    void before.stop();
    const starting = after.start();
    await microtasks();
    expect(log).toEqual(['before start']);
    flushed();
    await starting;

    expect(log).toEqual(['before start', 'before dispose', 'after start']);
    await after.stop();
  });

  it('never builds a runtime when stopped before the one before it closed', async () => {
    const create = vi.fn(() => createRuntime([]));
    const lifecycle = new HubLifecycle(createDocuments(), create);
    const scope = globalThis as unknown as Record<symbol, Promise<void>>;
    let closed!: () => void;
    scope[CLOSING_KEY] = new Promise(resolve => (closed = resolve));

    const starting = lifecycle.start();
    await lifecycle.stop();
    closed();
    await starting;

    expect(create).not.toHaveBeenCalled();
  });

  it('releases the runtime at once when asked, and nothing before one is built', async () => {
    const log: string[] = [];
    const lifecycle = new HubLifecycle(createDocuments(), () =>
      createRuntime(log)
    );

    lifecycle.releaseSync();
    await lifecycle.start();
    lifecycle.releaseSync();

    expect(log).toEqual(['hub start', 'hub release']);
    await lifecycle.stop();
  });

  it('starts a third instance only once the first closed, though the second stopped before it had a hub', async () => {
    const log: string[] = [];
    const first = createRuntime(log, 'first');
    let disposed!: () => void;
    first.dispose.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          disposed = () => {
            log.push('first dispose');
            resolve();
          };
        })
    );
    const before = new HubLifecycle(createDocuments(), () => first);
    await before.start();
    void before.stop();
    await microtasks();

    const between = new HubLifecycle(createDocuments(), () =>
      createRuntime(log, 'second')
    );
    const betweenStarting = between.start();
    await between.stop();
    const after = new HubLifecycle(createDocuments(), () =>
      createRuntime(log, 'third')
    );
    const afterStarting = after.start();
    await microtasks();
    expect(log).toEqual(['first start']);

    disposed();
    await Promise.all([betweenStarting, afterStarting]);
    expect(log).toEqual(['first start', 'first dispose', 'third start']);
    await after.stop();
  });

  it('forgets a close once it is done, unless a later close took its place', async () => {
    const scope = globalThis as unknown as Record<symbol, Promise<void>>;
    const lifecycle = new HubLifecycle(createDocuments(), () =>
      createRuntime([])
    );
    await lifecycle.start();

    await lifecycle.stop();
    await microtasks();
    expect(scope[CLOSING_KEY]).toBeUndefined();

    const first = new HubLifecycle(createDocuments(), () => createRuntime([]));
    await first.start();
    const connection = createConnection();
    let drained!: () => void;
    connection.drain.mockImplementation(
      () => new Promise<void>(resolve => (drained = resolve))
    );
    const later = new HubLifecycle(createDocuments([connection]), () =>
      createRuntime([])
    );
    await later.start();

    const firstClosed = first.stop();
    const laterClosed = later.stop();
    const pending = scope[CLOSING_KEY];
    await firstClosed;
    await microtasks();
    expect(scope[CLOSING_KEY]).toBe(pending);

    drained();
    await laterClosed;
    await microtasks();
    expect(scope[CLOSING_KEY]).toBeUndefined();
  });
});
