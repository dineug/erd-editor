import { createStore, Provider } from 'jotai';
import { act, createElement } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test';

import {
  defineFakeErdEditor,
  lastEditor,
  resetEditors,
} from '@/__test-utils__/erdEditor';
import { render } from '@/__test-utils__/render';
import { localeAtom } from '@/atoms/modules/locale';
import LiveCollaborative from '@/components/live-collaborative/LiveCollaborative';
import type { GuestHandlers } from '@/services/collaborative/guest';

const guest = vi.hoisted(() => ({
  handlers: null as GuestHandlers | null,
}));

// The real element needs a browser, and a guest a relay, where e2e runs both.
vi.mock('@dineug/erd-editor', () => ({}));
vi.mock('@/services/indexeddb', () => ({ getAppDatabaseService: () => null }));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));
vi.mock('@/services/collaborative/guest', () => ({
  RELAY_TIMEOUT: 1000,
  createCollaborativeGuest: (
    _roomId: string,
    _secretKey: string,
    handlers: GuestHandlers
  ) => {
    guest.handlers = handlers;
    return { setNickname: () => {}, dispatch: () => {}, close: () => {} };
  },
}));

const VALUE = '{"version":"3.0.0"}';

function mount(store = createStore()) {
  const view = render(
    createElement(
      Provider,
      { store },
      createElement(
        MemoryRouter,
        { initialEntries: ['/live#room-1,secret-1'] },
        createElement(LiveCollaborative)
      )
    )
  );
  return { ...view, store, editor: lastEditor() };
}

/** The host's snapshot arriving, which the guest view attaches the editor on. */
async function receiveSnapshot() {
  await act(async () => {
    guest.handlers?.onSchema(VALUE);
  });
}

beforeAll(defineFakeErdEditor);

afterEach(() => {
  resetEditors();
  guest.handlers = null;
  window.localStorage.clear();
});

describe('the live session guest view', () => {
  it('turns the locale picker and the welcome screen on before the snapshot attaches it', async () => {
    const { editor, unmount } = mount();

    expect(editor.props).toMatchObject({
      enableLocalePicker: true,
      enableWelcomeScreen: true,
    });
    expect(editor.locales()).toEqual(['system']);
    expect(editor.indexOf('connected')).toBe(-1);

    await receiveSnapshot();

    expect(editor.indexOf('setInitialValue', VALUE)).toBeLessThan(
      editor.indexOf('connected')
    );
    expect(editor.indexOf('enableWelcomeScreen', true)).toBeLessThan(
      editor.indexOf('connected')
    );
    unmount();
  });

  it('hands the editor the stored language and stores a pick from it', async () => {
    const store = createStore();
    store.set(localeAtom, 'ar-SA');
    const { editor, unmount } = mount(store);
    await receiveSnapshot();
    expect(editor.locales()).toEqual(['ar-SA']);

    editor.pickLocale({ locale: 'zh-TW' });

    expect(store.get(localeAtom)).toBe('zh-TW');
    expect(window.localStorage.getItem('@locale')).toBe('"zh-TW"');
    expect(editor.locales()).toEqual(['ar-SA', 'zh-TW']);
    unmount();
  });

  it('follows a language another tab picked, and stops listening once it is gone', async () => {
    const { editor, store, unmount } = mount();
    await receiveSnapshot();

    act(() => store.set(localeAtom, 'pt-BR'));
    expect(editor.locales()).toEqual(['system', 'pt-BR']);

    unmount();
    editor.pickLocale({ locale: 'ja-JP' });
    expect(store.get(localeAtom)).toBe('pt-BR');
  });
});
