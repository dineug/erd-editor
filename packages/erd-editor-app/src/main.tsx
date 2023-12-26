import './styles.css';
import './main.css';

import { Theme } from '@radix-ui/themes';
import React from 'react';
import { createRoot } from 'react-dom/client';

import App from '@/App';

const root = createRoot(document.getElementById('app')!);
root.render(
  <React.StrictMode>
    <Theme
      appearance="dark"
      accentColor="indigo"
      grayColor="slate"
      radius="medium"
      scaling="100%"
      panelBackground="translucent"
    >
      <App />
    </Theme>
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
