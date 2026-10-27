import type { RouteObject } from 'react-router';
import { Navigate } from 'react-router';

import App from '@/components/app/App';
import LiveCollaborativeError from '@/components/live-collaborative/live-collaborative-error/LiveCollaborativeError';
import Root from '@/routes/root/Root';

/**
 * The app's route table, which main.tsx hands to the browser router. It lives
 * apart from main.tsx so a spec can mount it without the render and the
 * service worker registration that importing main.tsx would run.
 */
export const routes: RouteObject[] = [
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
      {
        path: 'gdrive',
        lazy: async () => {
          const { default: Component } =
            await import('@/components/gdrive/GdriveRoute');
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
];
