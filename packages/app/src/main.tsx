import './styles.css';

import * as Sentry from '@sentry/react';
import { Provider } from 'jotai';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate } from 'react-router';
// RouterProvider only from react-router/dom — the root export of the same
// name omits the ReactDOM.flushSync wiring, and importing the wrong one
// typechecks clean.
import { RouterProvider } from 'react-router/dom';

import App from '@/components/app/App';
import LiveCollaborativeError from '@/components/live-collaborative/live-collaborative-error/LiveCollaborativeError';
import { registerSW } from '@/registerSW';
import Root from '@/routes/root/Root';
import { store } from '@/store';

if (import.meta.env.MODE === 'production') {
  Sentry.init({
    dsn: 'https://77d8b1a5cdead25c1dea4978fba38a70@o245231.ingest.us.sentry.io/4506887372668928',
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 1.0,
  });
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    errorElement: <LiveCollaborativeError />,
    // Renders nothing, which is what hydration already rendered; the point is
    // to stop the router warning on every cold load. It has to sit on the
    // outermost matched route and be truthy, which an empty fragment satisfies.
    hydrateFallbackElement: <></>,
    children: [
      {
        index: true,
        element: <App />,
      },
      {
        path: 'live',
        lazy: async () => {
          const { default: Component } =
            await import('@/components/live-collaborative/LiveCollaborative');
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
