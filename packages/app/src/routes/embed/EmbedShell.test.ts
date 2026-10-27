import { createStore } from 'jotai';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test';

import {
  defineFakeErdViewer,
  lastViewer,
  resetViewers,
} from '@/__test-utils__/erdViewer';
import { renderRoutes } from '@/__test-utils__/render';
import {
  type AppUpdateStatus,
  appUpdateStatusAtom,
} from '@/atoms/modules/app-update';
import { routes } from '@/routes/routes';

// The real viewer needs a browser, and the schema list its database; the
// shell around them is what this pins, on the app's own route table.
vi.mock('@dineug/erd-editor/erd-viewer.js', () => ({}));
vi.mock('@/components/app/App', () => ({ default: () => null }));
vi.mock('@/services/indexeddb', () => ({ getAppDatabaseService: () => null }));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

const DOC = 'https://docs.test/a.erd.json';
// Both statuses show the same words, outdated asking for a reload too.
const PROMPT = 'A new version of ERD Editor is available.';

function storeWith(status: AppUpdateStatus) {
  const store = createStore();
  store.set(appUpdateStatusAtom, status);
  return store;
}

beforeAll(defineFakeErdViewer);

afterEach(() => {
  resetViewers();
  document.documentElement.className = '';
  document.documentElement.removeAttribute('style');
});

describe('the /embed shell', () => {
  it.each([
    ['available', `/embed?src=${encodeURIComponent(DOC)}`],
    ['outdated', `/embed?src=${encodeURIComponent(DOC)}`],
    ['available', `/EMBED?src=${encodeURIComponent(DOC)}`],
    ['outdated', `/%65mbed/?src=${encodeURIComponent(DOC)}`],
  ] as const)(
    'shows a viewer and no prompt or app theme on %s at %s',
    async (status, entry) => {
      const { container, unmount } = await renderRoutes(
        routes,
        entry,
        storeWith(status)
      );

      expect(container.querySelectorAll('erd-viewer')).toHaveLength(1);
      expect(lastViewer().props.src).toBe(DOC);
      expect(container.querySelector('[role="status"]')).toBeNull();
      expect(container.querySelector('.radix-themes')).toBeNull();
      expect(container.textContent).not.toContain(PROMPT);
      unmount();
    }
  );

  it.each(['available', 'outdated'] as const)(
    "shows the %s prompt in the app's own theme on its other pages, from the same store",
    async status => {
      const { container, unmount } = await renderRoutes(
        routes,
        '/',
        storeWith(status)
      );

      expect(container.querySelector('.radix-themes')).not.toBeNull();
      expect(container.querySelector('[role="status"]')?.textContent).toContain(
        PROMPT
      );
      expect(container.querySelector('erd-viewer')).toBeNull();
      unmount();
    }
  );
});
