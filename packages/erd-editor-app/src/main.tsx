import React from 'react';
import ReactDOM from 'react-dom/client';

import App from '@/App';

const root = ReactDOM.createRoot(document.getElementById('root')!);
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
