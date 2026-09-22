import {
  getLWWAction,
  SHARED_FOCUS_TRACKER_TIMEOUT,
  sharedFocusTrackerAction,
} from '@/engine/modules/editor/atom.actions';
import type { RxStore } from '@/engine/rx-store';
import { toSharedFocus, toSharedFocusKey } from '@/utils/focus';

/** A third of the expiry, so two beats can go missing before a peer drops the cell. */
export const FOCUS_HEARTBEAT_MS = SHARED_FOCUS_TRACKER_TIMEOUT / 3;

export type FocusPresence = {
  destroy: () => void;
};

/** A Node timer keeps a finished MCP process alive unless released; a browser one is a number. */
const release = (timer: unknown) => {
  (timer as { unref?: () => void } | null)?.unref?.();
};

/**
 * The focus half of the element's presence tracker: the focused cell goes out
 * when it changes, again on every heartbeat and whenever a peer joins. Mouse,
 * selection and drag selection are never sent.
 */
export function createFocusPresence(
  store: Pick<RxStore, 'state' | 'subscribe' | 'dispatch'>
): FocusPresence {
  let focusKey = '';

  const broadcast = (force: boolean) => {
    const focus = toSharedFocus(store.state.editor.focusTable);
    const key = toSharedFocusKey(focus);
    if (key === focusKey && !force) return;

    focusKey = key;
    store.dispatch(sharedFocusTrackerAction({ focus }));
  };

  const unsubscribe = store.subscribe(actions => {
    broadcast(actions.some(action => action.type === getLWWAction.type));
  });

  const intervalId = setInterval(() => {
    focusKey && broadcast(true);
  }, FOCUS_HEARTBEAT_MS);
  release(intervalId);

  return Object.freeze({
    destroy: () => {
      unsubscribe();
      clearInterval(intervalId);
    },
  });
}
