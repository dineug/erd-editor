import {
  getLWWAction,
  SHARED_FOCUS_TRACKER_TIMEOUT,
  sharedFocusTrackerAction,
} from '@/engine/modules/editor/atom.actions';
import type { Editor } from '@/engine/modules/editor/state';
import type { RxStore } from '@/engine/rx-store';
import { toSharedFocus, toSharedFocusKey } from '@/utils/focus';

/** A third of the expiry, so two beats can go missing before a peer drops the cell. */
export const FOCUS_HEARTBEAT_MS = SHARED_FOCUS_TRACKER_TIMEOUT / 3;

export type FocusPresence = {
  destroy: () => void;
};

/** A Node timer keeps a finished host process alive unless released; a browser one is a number. */
const release = (timer: unknown) => {
  (timer as { unref?: () => void } | null)?.unref?.();
};

const SHARED_TRACKER_MAPS = [
  'sharedMouseTrackerMap',
  'sharedFocusTrackerMap',
  'sharedSelectionTrackerMap',
  'sharedDragSelectTrackerMap',
] as const;

type SharedTrackerMaps = Pick<Editor, (typeof SHARED_TRACKER_MAPS)[number]>;

/**
 * Clears the expiry the engine set on every tracker another peer sent, and the
 * trackers with it. A pending expiry is a Node timer the reducer never releases,
 * so a closed peer's process would wait up to 90 seconds for it.
 */
export function clearSharedTrackers(editor: SharedTrackerMaps) {
  for (const key of SHARED_TRACKER_MAPS) {
    const trackers: Record<string, { timeoutId: unknown }> = editor[key];

    for (const id of Object.keys(trackers)) {
      clearTimeout(trackers[id].timeoutId as ReturnType<typeof setTimeout>);
      Reflect.deleteProperty(trackers, id);
    }
  }
}

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
