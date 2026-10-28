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
import { i18nAtom } from '@/atoms/modules/locale';
import { themeAtom } from '@/atoms/modules/theme';
import { koKR } from '@/i18n/messages/ko-KR';
import { createI18n } from '@/i18n/translate';
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
  window.localStorage.clear();
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

  it.each([
    ['available', '/embed'],
    ['outdated', '/embed'],
    ['available', '/embed?src='],
    ['outdated', '/embed?theme=light&src=&src=x'],
  ] as const)(
    "shows the builder under Root, in the app's theme and language, with the %s prompt at %s",
    async (status, entry) => {
      const store = storeWith(status);
      store.set(themeAtom, {
        appearance: 'light',
        accentColor: 'crimson',
        grayColor: 'sand',
      });
      store.set(i18nAtom, createI18n('ko-KR', koKR));

      const { container, unmount } = await renderRoutes(routes, entry, store);
      const theme = container.querySelector('.radix-themes');

      expect(theme?.classList.contains('light')).toBe(true);
      expect(theme?.getAttribute('data-accent-color')).toBe('crimson');
      expect(theme?.getAttribute('data-gray-color')).toBe('sand');
      expect(container.querySelector('h1')?.textContent).toBe(
        koKR['embed.title']
      );
      // The builder's copy statuses come first, empty until a copy.
      const statuses = Array.from(
        container.querySelectorAll('[role="status"]'),
        status => status.textContent
      );
      expect(statuses).toContainEqual(
        expect.stringContaining(koKR['update.available'])
      );
      expect(container.querySelectorAll('erd-viewer')).toHaveLength(1);
      expect(lastViewer().indexOf('src')).toBe(-1);
      unmount();
    }
  );
});
