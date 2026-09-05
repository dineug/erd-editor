import { safeCallback } from '@/utils/safeCallback';

const LOCK_NAME = '@dineug/erd-editor-app/collaborative-leader';

let leader = false;

/**
 * Whether this tab currently owns the peer connections. Everything else has to
 * route its outbound traffic through the leader over the BroadcastChannel bridge.
 */
export const isLeader = () => leader;

/**
 * Elects a single tab to host the WebRTC sessions. navigator.locks holds a lock
 * for as long as the holder's callback promise is pending, so closing the leader
 * tab hands the lock — and the sessions — to whichever tab is next in line.
 */
export function requestLeadership(onElected: () => void): () => void {
  if (!globalThis.navigator?.locks) {
    leader = true;
    safeCallback(onElected);
    return () => {
      leader = false;
    };
  }

  const controller = new AbortController();
  let release: (() => void) | null = null;

  navigator.locks
    .request(LOCK_NAME, { signal: controller.signal }, () => {
      leader = true;
      safeCallback(onElected);
      return new Promise<void>(resolve => {
        release = resolve;
      });
    })
    // An aborted request rejects with AbortError, which is the expected path
    // whenever a tab unmounts before the lock is granted.
    .catch(() => {});

  return () => {
    leader = false;
    release ? release() : controller.abort();
  };
}
