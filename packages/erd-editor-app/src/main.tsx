import './styles.css';

import { Provider } from 'jotai';
import React from 'react';
import { createRoot } from 'react-dom/client';

import App from '@/components/app/App';
import { store } from '@/store';

const root = createRoot(document.getElementById('app')!);
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);

async function registerSW() {
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

if (import.meta.env.MODE === 'production') {
  registerSW();
}
