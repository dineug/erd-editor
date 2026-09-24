import { safeCallback } from '@/utils/safeCallback';

export const FILE_LOCK_PREFIX = '@dineug/erd-editor-app/gdrive-file';

export type FileLockOptions = {
  signal?: AbortSignal;
  ifAvailable?: boolean;
  steal?: boolean;
};

/** navigator.locks as far as a file's leader goes: exclusive requests and query. */
export type FileLockManagerLike = {
  request(
    name: string,
    options: FileLockOptions,
    callback: (lock: unknown) => Promise<void>
  ): Promise<void>;
  query(): Promise<{ held?: Array<{ name?: string }> }>;
};

/** How a tab came to lead: the lock was free, its holder left, or the person took it over. */
export type Election = 'probe' | 'handoff' | 'steal';

export type ProbeResult = 'leader' | 'follower-with-holder';

/** The lock of one file for one account, so another account's tabs never lead it. */
export function fileLockName(sub: string, fileId: string): string {
  return `${FILE_LOCK_PREFIX}/${sub}/${fileId}`;
}

export function browserLocks(): FileLockManagerLike | null {
  return globalThis.navigator?.locks ?? null;
}

/** Whether a tab holds the file's lock; null without Web Locks, where no query can tell. */
export async function isFileOpen(
  locks: FileLockManagerLike | null,
  name: string
): Promise<boolean | null> {
  if (!locks) return null;
  const { held = [] } = await locks.query();
  return held.some(lock => lock.name === name);
}

export type FileLeaderDeps = {
  locks: FileLockManagerLike | null;
  name: string;
  /** A handoff or a steal made this tab the leader; probe answers for itself. */
  onElected: (how: Election) => void;
  /** Another tab stole the lock. */
  onLost: () => void;
};

/**
 * One tab per file saves it: the holder of the file's lock. A lock is held for
 * as long as its callback's promise is pending, so a closed tab hands it to the
 * next in line. Without Web Locks every tab leads, as in the collaboration leader.
 */
export function createFileLeader({
  locks,
  name,
  onElected,
  onLost,
}: FileLeaderDeps) {
  /** Turns false as a steal's rejection arrives, which a query waits behind. */
  let leader = false;
  let released = false;
  /** The grant this tab holds; a late rejection of an older one changes nothing. */
  let current: object | null = null;
  let release: (() => void) | null = null;
  let waiting: AbortController | null = null;

  const hold = (how: Election) =>
    new Promise<void>(resolve => {
      leader = true;
      release = resolve;
      if (how !== 'probe') safeCallback(onElected, how);
    });

  /** Settles once the callback runs: true when granted, false when unavailable or aborted. */
  const request = (
    lockManager: FileLockManagerLike,
    options: FileLockOptions,
    how: Election
  ) =>
    new Promise<boolean>(settle => {
      const grant = {};
      let granted = false;
      lockManager
        .request(name, options, async lock => {
          if (!lock || released) {
            settle(false);
            return;
          }
          granted = true;
          current = grant;
          const holding = hold(how);
          settle(true);
          return holding;
        })
        .catch(() => {
          // Before the grant this is our own abort; after it, a steal: the holder's
          // promise rejects while its callback still waits.
          settle(false);
          if (!granted || current !== grant || released) return;
          current = null;
          leader = false;
          release?.();
          release = null;
          safeCallback(onLost);
        });
    });

  return {
    isLeader: () => leader,

    /** Takes the lock if it is free; otherwise another tab holds it. */
    async probe(): Promise<ProbeResult> {
      if (!locks) {
        leader = true;
        return 'leader';
      }
      return (await request(locks, { ifAvailable: true }, 'probe'))
        ? 'leader'
        : 'follower-with-holder';
    },

    /** Queues for the lock, to lead once the holder leaves. */
    wait() {
      if (!locks || leader || waiting || released) return;
      const controller = new AbortController();
      waiting = controller;
      void request(locks, { signal: controller.signal }, 'handoff').then(() => {
        if (waiting === controller) waiting = null;
      });
    },

    /** Takes the lock from a holder that no longer answers. */
    async steal(): Promise<void> {
      if (released || leader) return;
      if (!locks) {
        leader = true;
        safeCallback(onElected, 'steal');
        return;
      }
      waiting?.abort();
      waiting = null;
      await request(locks, { steal: true }, 'steal');
    },

    /**
     * Asked before a save starts and again before its PATCH. The fence is the
     * flag a steal's rejection clears; the query, which lists the thief's lock
     * under the same name, only lets a rejection already on its way land first.
     */
    async isStillLeader(): Promise<boolean> {
      if (!leader) return false;
      if (locks) await locks.query();
      return leader;
    },

    /** Lets go for good: the held lock, or the request still queued. */
    release() {
      released = true;
      leader = false;
      current = null;
      waiting?.abort();
      waiting = null;
      release?.();
      release = null;
    },
  };
}

export type FileLeader = ReturnType<typeof createFileLeader>;
