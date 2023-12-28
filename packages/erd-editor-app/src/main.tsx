import './styles.css';

import React from 'react';
import { createRoot } from 'react-dom/client';

import App from '@/components/app/App';

const root = createRoot(document.getElementById('app')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (import.meta.env.MODE === 'production') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => {
        console.log('Service worker registered!');
      })
      .catch(error => {
        console.warn('Error registering service worker:');
        console.warn(error);
      });
  }
}
