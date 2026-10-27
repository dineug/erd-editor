import './styles.css';

import * as Sentry from '@sentry/react';
import { Provider } from 'jotai';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
// RouterProvider only from react-router/dom — the root export of the same
// name omits the ReactDOM.flushSync wiring, and importing the wrong one
// typechecks clean.
import { RouterProvider } from 'react-router/dom';

import { watchDisplayLanguage } from '@/atoms/modules/locale';
import { registerSW } from '@/registerSW';
import { routes } from '@/routes/routes';
import { store } from '@/store';
import { isEmbedViewerUrl } from '@/utils/embedPath';
import { reportError } from '@/utils/reportError';
import { sentryPrivacyOptions } from '@/utils/sentryScrub';

if (import.meta.env.MODE === 'production') {
  // Drive file ids, file names and the account's id stay out (Limited Use),
  // and so do a /live invite's key and the document URL of an /embed page.
  const privacy = sentryPrivacyOptions(() => location.pathname);
  Sentry.init({
    dsn: 'https://77d8b1a5cdead25c1dea4978fba38a70@o245231.ingest.us.sentry.io/4506887372668928',
    integrations: [Sentry.browserTracingIntegration(privacy.tracing)],
    tracesSampleRate: 0.1,
    ...privacy.init,
  });
}

const router = createBrowserRouter(routes);

const root = createRoot(document.getElementById('app')!);

const render = () => {
  root.render(
    <React.StrictMode>
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    </React.StrictMode>
  );
};

// The first render waits for the language's dictionary, so no other language
// shows English first. An embedded viewer has no app text, and its system
// language reads the page's lang, which the wait would set, so it renders at once.
if (isEmbedViewerUrl(window.location)) {
  render();
} else {
  watchDisplayLanguage(store, document.documentElement)
    .catch(reportError)
    .finally(render);
}

if (import.meta.env.MODE === 'production') {
  registerSW();
}
