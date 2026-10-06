import type { Lnb } from '@/components/settings/settings-lnb/SettingsLnb';
import { CanvasType } from '@/constants/schema';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import type { RxStore } from '@/engine/rx-store';

const requestedPages = new WeakMap<RxStore, Lnb>();

/**
 * Takes the reader to a page of the Settings tab from outside it, the welcome
 * screen's Shortcuts row say: the tab opens, and reads the page as it mounts.
 */
export function requestSettingsPage(store: RxStore, page: Lnb) {
  requestedPages.set(store, page);
  store.dispatch(changeCanvasTypeAction({ value: CanvasType.settings }));
}

/** The page asked for since the Settings tab last mounted, handed out once. */
export function takeSettingsPage(store: RxStore): Lnb | undefined {
  const page = requestedPages.get(store);
  requestedPages.delete(store);
  return page;
}
