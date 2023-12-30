import './styles.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Workbox } from 'workbox-window';

import App from '@/components/app/App';

const root = createRoot(document.getElementById('app')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (import.meta.env.MODE === 'production') {
  if ('serviceWorker' in navigator) {
    const wb = new Workbox('/sw.js');
    wb.register();
  }
}
