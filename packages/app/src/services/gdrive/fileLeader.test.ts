import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createLockManager,
  type FakeLockManager,
} from '@/__test-utils__/gdrive';
import {
  browserLocks,
  createFileLeader,
  type Election,
  FILE_LOCK_PREFIX,
  type FileLockManagerLike,
  fileLockName,
  isFileOpen,
} from '@/services/gdrive/fileLeader';

const NAME = fileLockName('sub-1', 'file-1');

/** Lets granted locks run their callbacks and rejected requests their handlers. */
const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

function tab(locks: FileLockManagerLike | null, name = NAME) {
  const elected: Election[] = [];
  const onLost = vi.fn();
  const leader = createFileLeader({
    locks,
    name,
    onElected: how => elected.push(how),
    onLost,
  });
  return { leader, elected, onLost };
}

describe('fileLockName', () => {
  it('names the account and the file, so another account never shares a leader', () => {
    expect(NAME).toBe(`${FILE_LOCK_PREFIX}/sub-1/file-1`);
    expect(FILE_LOCK_PREFIX).toBe('@dineug/erd-editor-app/gdrive-file');
    expect(fileLockName('sub-2', 'file-1')).not.toBe(NAME);
  });
});

describe('createFileLeader', () => {
  let locks: FakeLockManager;
  const tabs: Array<ReturnType<typeof tab>> = [];
  const open = (name = NAME) => {
    const next = tab(locks, name);
    tabs.push(next);
    return next;
  };

  afterEach(() => {
    tabs.splice(0).forEach(({ leader }) => leader.release());
    vi.restoreAllMocks();
  });

  describe('as the collaboration leader does', () => {
    it('is not the leader until the lock is granted', async () => {
      locks = createLockManager();
      const first = open();
      const second = open();
      await first.leader.probe();

      second.leader.wait();
      await settle();

      expect(second.leader.isLeader()).toBe(false);
      expect(second.elected).toEqual([]);
    });

    it('elects the next tab in line once the holder lets go', async () => {
      locks = createLockManager();
      const first = open();
      const second = open();
      await first.leader.probe();
      second.leader.wait();

      first.leader.release();
      await settle();

      expect(second.elected).toEqual(['handoff']);
      expect(second.leader.isLeader()).toBe(true);
      expect(locks.isHeld(NAME)).toBe(true);
    });

    it('queues with an abort signal, under the file lock name', async () => {
      locks = createLockManager();
      const first = open();
      await first.leader.probe();

      open().leader.wait();

      expect(locks.calls.at(-1)).toEqual({
        name: NAME,
        options: { signal: expect.any(AbortSignal) },
      });
    });

    it('frees the lock, resolving the holder, when it steps down', async () => {
      locks = createLockManager();
      const { leader } = open();
      await leader.probe();
      expect(locks.isHeld(NAME)).toBe(true);

      leader.release();
      await settle();

      expect(leader.isLeader()).toBe(false);
      expect(locks.isHeld(NAME)).toBe(false);
    });

    it('aborts a request that has not been granted yet', async () => {
      locks = createLockManager();
      const first = open();
      const second = open();
      await first.leader.probe();
      second.leader.wait();
      const { options } = locks.calls.at(-1)!;

      second.leader.release();
      first.leader.release();
      await settle();

      expect(options.signal?.aborted).toBe(true);
      expect(second.elected).toEqual([]);
      expect(locks.isHeld(NAME)).toBe(false);
    });

    it('keeps a throwing callback from taking the lock down', async () => {
      locks = createLockManager();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const first = open();
      await first.leader.probe();
      const leader = createFileLeader({
        locks,
        name: NAME,
        onElected: () => {
          throw new Error('boom');
        },
        onLost: () => {},
      });
      tabs.push({ leader, elected: [], onLost: vi.fn() });
      leader.wait();

      first.leader.release();
      await settle();

      expect(leader.isLeader()).toBe(true);
      expect(locks.isHeld(NAME)).toBe(true);
    });

    it('falls back to a self-elected leader when Web Locks is missing', async () => {
      const { leader, elected } = tab(null);

      expect(await leader.probe()).toBe('leader');
      expect(leader.isLeader()).toBe(true);
      expect(await leader.isStillLeader()).toBe(true);

      leader.wait();
      await leader.steal();
      expect(elected).toEqual([]);

      leader.release();
      expect(leader.isLeader()).toBe(false);
      expect(await leader.isStillLeader()).toBe(false);
    });
  });

  describe('probe', () => {
    it('takes a free lock at once, asking only if it is available', async () => {
      locks = createLockManager();
      const { leader, elected } = open();

      expect(await leader.probe()).toBe('leader');
      expect(locks.calls).toEqual([
        { name: NAME, options: { ifAvailable: true } },
      ]);
      // Probe answers for itself; onElected is for a handoff or a steal.
      expect(elected).toEqual([]);
    });

    it('reports a holder without queueing behind it', async () => {
      locks = createLockManager();
      await open().leader.probe();
      const second = open();

      expect(await second.leader.probe()).toBe('follower-with-holder');
      expect(second.leader.isLeader()).toBe(false);
      expect(locks.waitingFor(NAME)).toBe(0);
    });

    it('never leads a file under another account’s lock', async () => {
      locks = createLockManager();
      await open().leader.probe();

      expect(await open(fileLockName('sub-2', 'file-1')).leader.probe()).toBe(
        'leader'
      );
    });
  });

  describe('steal', () => {
    it('takes the lock from its holder, which learns it lost it', async () => {
      locks = createLockManager();
      const first = open();
      const second = open();
      await first.leader.probe();

      await second.leader.steal();
      await settle();

      expect(second.elected).toEqual(['steal']);
      expect(second.leader.isLeader()).toBe(true);
      expect(first.onLost).toHaveBeenCalledTimes(1);
      expect(first.leader.isLeader()).toBe(false);
      expect(await first.leader.isStillLeader()).toBe(false);
      expect(await second.leader.isStillLeader()).toBe(true);
    });

    it('drops its own queued request first, so it holds the lock once', async () => {
      locks = createLockManager();
      const first = open();
      const second = open();
      await first.leader.probe();
      second.leader.wait();
      const queued = locks.calls.at(-1)!.options;

      await second.leader.steal();
      await settle();

      expect(queued.signal?.aborted).toBe(true);
      expect(locks.waitingFor(NAME)).toBe(0);
      expect(locks.calls.at(-1)).toEqual({
        name: NAME,
        options: { steal: true },
      });
    });

    it('does nothing for a tab that already leads', async () => {
      locks = createLockManager();
      const { leader } = open();
      await leader.probe();
      const before = locks.calls.length;

      await leader.steal();

      expect(locks.calls).toHaveLength(before);
    });

    it('lets the old leader queue again and lead once the thief leaves', async () => {
      locks = createLockManager();
      const first = open();
      const second = open();
      await first.leader.probe();
      await second.leader.steal();
      await settle();

      first.leader.wait();
      second.leader.release();
      await settle();

      expect(first.elected).toEqual(['handoff']);
      expect(first.leader.isLeader()).toBe(true);
      expect(first.onLost).toHaveBeenCalledTimes(1);
    });

    it('elects a tab without Web Locks when it asks', async () => {
      const { leader, elected } = tab(null);

      await leader.steal();

      expect(elected).toEqual(['steal']);
      expect(leader.isLeader()).toBe(true);
    });
  });

  describe('isStillLeader', () => {
    it('asks the lock manager, which a steal may have reached first', async () => {
      locks = createLockManager();
      const { leader } = open();
      await leader.probe();
      const query = vi
        .spyOn(locks, 'query')
        .mockResolvedValueOnce({ held: [] });

      expect(await leader.isStillLeader()).toBe(false);
      expect(await leader.isStillLeader()).toBe(true);
      expect(query).toHaveBeenCalledTimes(2);
    });

    it('is false for a follower without a query', async () => {
      locks = createLockManager();
      await open().leader.probe();
      const second = open();
      await second.leader.probe();
      const query = vi.spyOn(locks, 'query');

      expect(await second.leader.isStillLeader()).toBe(false);
      expect(query).not.toHaveBeenCalled();
    });
  });

  it('never leads after a release, even when a grant was on its way', async () => {
    locks = createLockManager();
    const first = open();
    const second = open();
    await first.leader.probe();
    second.leader.wait();

    first.leader.release();
    second.leader.release();
    await settle();

    expect(second.elected).toEqual([]);
    second.leader.wait();
    await second.leader.steal();
    expect(second.leader.isLeader()).toBe(false);
  });
});

describe('isFileOpen', () => {
  it('tells from the held locks whether any tab has the file', async () => {
    const locks = createLockManager();
    const { leader } = tab(locks);

    expect(await isFileOpen(locks, NAME)).toBe(false);
    await leader.probe();
    expect(await isFileOpen(locks, NAME)).toBe(true);
    expect(await isFileOpen(locks, fileLockName('sub-1', 'file-2'))).toBe(
      false
    );
    leader.release();
  });

  it('cannot tell without Web Locks', async () => {
    expect(await isFileOpen(null, NAME)).toBeNull();
  });
});

describe('browserLocks', () => {
  it('is the browser’s lock manager, or null where there is none', () => {
    const locks = createLockManager();
    Object.defineProperty(globalThis.navigator, 'locks', {
      value: locks,
      configurable: true,
    });
    expect(browserLocks()).toBe(locks);

    Object.defineProperty(globalThis.navigator, 'locks', {
      value: undefined,
      configurable: true,
    });
    expect(browserLocks()).toBeNull();
  });
});
