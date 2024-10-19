import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

const CONTENTHASH = /\.[0-9a-f]{8,}\./;
const ASSET_EXTENSIONS = /\.(png|svg|jpg|jpeg|gif|woff|woff2|eot|ttf|otf)$/i;
const EXTENSIONS = /\.(js|css)$/i;

function isStaticExtensions(value: string) {
  return ASSET_EXTENSIONS.test(value) || EXTENSIONS.test(value);
}

function isAssetExtensions(value: string) {
  return ASSET_EXTENSIONS.test(value);
}

function isContenthash(value: string) {
  return CONTENTHASH.test(value);
}

registerRoute(
  ({ url, sameOrigin }) => {
    return (
      sameOrigin &&
      isStaticExtensions(url.pathname) &&
      isContenthash(url.pathname)
    );
  },
  new CacheFirst({
    cacheName: 'static',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 365,
        purgeOnQuotaError: true,
      }),
    ],
  }),
  'GET'
);

registerRoute(
  ({ url, sameOrigin }) => {
    return sameOrigin && isAssetExtensions(url.pathname);
  },
  new StaleWhileRevalidate({
    cacheName: 'assets',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 365,
        purgeOnQuotaError: true,
      }),
    ],
  }),
  'GET'
);

registerRoute(
  /^https:\/\/fonts\.googleapis\.com/,
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 10,
      }),
    ],
  }),
  'GET'
);

registerRoute(
  /^https:\/\/fonts\.gstatic\.com/,
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 365,
        purgeOnQuotaError: true,
      }),
    ],
  }),
  'GET'
);

self.skipWaiting();
clientsClaim();
