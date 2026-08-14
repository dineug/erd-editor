import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Leader = typeof import('@/services/collaborative/leader');

type PendingRequest = {
  name: string;
  options: { signal?: AbortSignal };
  callback: () => Promise<void>;
};

function stubLockManager() {
  const pending: PendingRequest[] = [];

  const request = vi.fn(
    (name: string, options: { signal?: AbortSignal }, callback: () => any) => {
      const entry: PendingRequest = { name, options, callback };
      pending.push(entry);

      return new Promise<void>((resolve, reject) => {
        options.signal?.addEventListener('abort', () =>
          reject(new Error('AbortError'))
        );
        entry.callback = () =>
          Promise.resolve(callback()).then(resolve, reject);
      });
    }
  );

  Object.defineProperty(globalThis.navigator, 'locks', {
    value: { request },
    configurable: true,
  });

  return { request, pending };
}

function removeLockManager() {
  Object.defineProperty(globalThis.navigator, 'locks', {
    value: undefined,
    configurable: true,
  });
}

async function importLeader(): Promise<Leader> {
  vi.resetModules();
  return await import('@/services/collaborative/leader');
}

describe('leader', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    removeLockManager();
  });

  it('is not the leader until leadership is requested', async () => {
    stubLockManager();
    const { isLeader } = await importLeader();

    expect(isLeader()).toBe(false);
  });

  it('elects this tab once the lock is granted', async () => {
    const { pending } = stubLockManager();
    const { isLeader, requestLeadership } = await importLeader();
    const onElected = vi.fn();

    requestLeadership(onElected);
    expect(onElected).not.toHaveBeenCalled();
    expect(isLeader()).toBe(false);

    // The lock manager grants the lock by invoking the holder's callback.
    pending[0].callback();

    expect(onElected).toHaveBeenCalledTimes(1);
    expect(isLeader()).toBe(true);
  });

  it('requests an exclusive-by-default named lock with an abort signal', async () => {
    const { request } = stubLockManager();
    const { requestLeadership } = await importLeader();

    requestLeadership(vi.fn());

    expect(request).toHaveBeenCalledWith(
      '@dineug/erd-editor-app/collaborative-leader',
      { signal: expect.any(AbortSignal) },
      expect.any(Function)
    );
  });

  it('releases the lock — resolving the holder promise — when it steps down', async () => {
    const { pending } = stubLockManager();
    const { isLeader, requestLeadership } = await importLeader();

    const release = requestLeadership(vi.fn());
    const held = pending[0].callback();
    expect(isLeader()).toBe(true);

    release();

    expect(isLeader()).toBe(false);
    await expect(held).resolves.toBeUndefined();
  });

  it('aborts a request that has not been granted yet', async () => {
    const { pending } = stubLockManager();
    const { requestLeadership } = await importLeader();

    const release = requestLeadership(vi.fn());
    release();

    expect(pending[0].options.signal?.aborted).toBe(true);
  });

  it('keeps a throwing callback from taking the lock down', async () => {
    const { pending } = stubLockManager();
    const { isLeader, requestLeadership } = await importLeader();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    requestLeadership(() => {
      throw new Error('boom');
    });
    const held = pending[0].callback();

    expect(isLeader()).toBe(true);
    await expect(
      Promise.race([held, Promise.resolve('pending')])
    ).resolves.toBe('pending');
  });

  it('falls back to a self-elected leader when Web Locks is unavailable', async () => {
    removeLockManager();
    const { isLeader, requestLeadership } = await importLeader();
    const onElected = vi.fn();

    const release = requestLeadership(onElected);

    expect(onElected).toHaveBeenCalledTimes(1);
    expect(isLeader()).toBe(true);

    release();
    expect(isLeader()).toBe(false);
  });
});
