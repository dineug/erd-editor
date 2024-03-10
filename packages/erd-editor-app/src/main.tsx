import './styles.css';
import 'core-js/stable';

import * as Sentry from '@sentry/react';
import { Provider } from 'jotai';
import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from 'react-router-dom';

import App from '@/components/app/App';
import LiveCollaborativeError from '@/components/live-collaborative/live-collaborative-error/LiveCollaborativeError';
import { registerSW } from '@/registerSW';
import Root from '@/routes/root/Root';
import { store } from '@/store';

if (import.meta.env.MODE === 'production') {
  Sentry.init({
    dsn: 'https://5b4c9b08f73bd4ac0eb48d0251500577@o245231.ingest.us.sentry.io/4506887368736768',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    errorElement: <LiveCollaborativeError />,
    children: [
      {
        index: true,
        element: <App />,
      },
      {
        path: 'live',
        lazy: async () => {
          const { default: Component } = await import(
            '@/components/live-collaborative/LiveCollaborative'
          );
          return { Component };
        },
        errorElement: <LiveCollaborativeError />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

const root = createRoot(document.getElementById('app')!);
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  </React.StrictMode>
);

if (import.meta.env.MODE === 'production') {
  registerSW();
}
