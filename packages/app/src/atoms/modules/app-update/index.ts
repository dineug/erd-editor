import { atom, useAtomValue, useSetAtom } from 'jotai';
import type { Workbox } from 'workbox-window';

/**
 * Where this tab stands with new code. updating: it asked the waiting worker to
 * take over and reloads once it does. updatedElsewhere: another tab did, so
 * this page runs old code. outdated: a chunk it loads late is gone.
 */
export type AppUpdateStatus =
  | 'idle'
  | 'available'
  | 'updating'
  | 'updatedElsewhere'
  | 'outdated';

export const appUpdateStatusAtom = atom<AppUpdateStatus>('idle');

/** Set by registerSW, so it stays null wherever no worker is registered. */
export const workboxAtom = atom<Workbox | null>(null);

/** The status the prompt was closed on; a later status shows it again. */
const dismissedStatusAtom = atom<AppUpdateStatus | null>(null);

const visibleStatusAtom = atom(get => {
  const status = get(appUpdateStatusAtom);
  return status === 'idle' || status === get(dismissedStatusAtom)
    ? null
    : status;
});

const applyAppUpdateAtom = atom(null, (get, set) => {
  const wb = get(workboxAtom);

  if (wb && get(appUpdateStatusAtom) === 'available') {
    set(appUpdateStatusAtom, 'updating');
    wb.messageSkipWaiting();
    return;
  }

  window.location.reload();
});

const dismissAppUpdateAtom = atom(null, (get, set) => {
  set(dismissedStatusAtom, get(appUpdateStatusAtom));
});

export const useAppUpdateStatus = () => useAtomValue(visibleStatusAtom);
export const useApplyAppUpdate = () => useSetAtom(applyAppUpdateAtom);
export const useDismissAppUpdate = () => useSetAtom(dismissAppUpdateAtom);
