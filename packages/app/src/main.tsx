import './styles.css';

import * as Sentry from '@sentry/react';
import { Provider } from 'jotai';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate } from 'react-router';
// `RouterProvider` only from `react-router/dom` — the root export of the same
// name omits the `ReactDOM.flushSync` wiring, and importing the wrong one
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
    // Renders nothing, which is what initial hydration already rendered — the
    // point is only to stop the router logging "No `HydrateFallback` element
    // provided" on every cold load. That warning is in
    // `react-router/dist/production/lib/hooks.js`, not just the development
    // build, so it reaches real users' consoles.
    //
    // Two things about the spelling are load-bearing. It must sit on the
    // outermost matched route: the router walks the branch and only warns at
    // index 0, so declaring it on the `live` child does nothing. And it must be
    // truthy — the branch scan is `if (route.HydrateFallback ||
    // route.hydrateFallbackElement)`, so `null` registers no fallback at all
    // and the warning survives. An empty fragment satisfies both while keeping
    // the output identical.
    //
    // Showing an actual loading state here instead is a UX change, not part of
    // the router upgrade.
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
