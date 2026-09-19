import { appUpdateStatusAtom, workboxAtom } from '@/atoms/modules/app-update';
import { store } from '@/store';

const UPDATE_CHECK_INTERVAL = 1000 * 60 * 60;

/**
 * A chunk the page loads late can be gone after a deploy, dropped with the old
 * precache and from the server. Vite reports every failed dynamic import as
 * vite:preloadError, left unprevented so the import still rejects to its caller.
 */
export function watchStaleChunks() {
  window.addEventListener('vite:preloadError', () => {
    // Any other status already offers the reload that fixes it.
    if (store.get(appUpdateStatusAtom) === 'idle') {
      store.set(appUpdateStatusAtom, 'outdated');
    }
  });
}

/**
 * A new worker waits until the user takes it from the prompt, so an update
 * never reloads a tab mid-edit. Every tab it then takes over hears it, and
 * only the one that asked reloads on its own.
 */
export async function registerSW() {
  watchStaleChunks();
  if (!('serviceWorker' in navigator)) return;

  const { Workbox } = await import('workbox-window');
  const wb = new Workbox('/sw.js', { scope: '/' });
  // False on a first visit, whose controller change is clientsClaim() taking
  // the page over rather than a new version arriving.
  let controlled = Boolean(navigator.serviceWorker.controller);

  wb.addEventListener('waiting', () => {
    const status = store.get(appUpdateStatusAtom);

    // A waiting worker is the better offer to an outdated page: taking it
    // loads the new version rather than the cached old one again.
    if (status === 'idle' || status === 'outdated') {
      store.set(appUpdateStatusAtom, 'available');
    }
  });

  wb.addEventListener('controlling', () => {
    if (store.get(appUpdateStatusAtom) === 'updating') {
      window.location.reload();
    } else if (controlled) {
      store.set(appUpdateStatusAtom, 'updatedElsewhere');
    }
    controlled = true;
  });

  store.set(workboxAtom, wb);

  try {
    await wb.register();
  } catch (error) {
    console.error('Service Worker registration error!', error);
    return;
  }

  // Rejects offline or while the script is unreachable; the next check retries.
  const checkForUpdate = () => wb.update().catch(() => {});

  window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
}
