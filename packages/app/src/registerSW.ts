export async function registerSW() {
  if ('serviceWorker' in navigator) {
    const { Workbox } = await import('workbox-window');
    const wb = new Workbox('/sw.js', { scope: '/' });

    wb.addEventListener('activated', event => {
      if (event.isUpdate || event.isExternal) {
        // autoUpdate
        window.location.reload();
      }
    });

    wb.register()
      .then(() => {
        console.log('Service Worker registered');
      })
      .catch(e => {
        console.error('Service Worker registration error!', e);
      });
  }
}
