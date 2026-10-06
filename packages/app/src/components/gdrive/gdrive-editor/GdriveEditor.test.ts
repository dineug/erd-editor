import * as Sentry from '@sentry/react';
import { createStore, Provider } from 'jotai';
import { act, createElement } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test';

import {
  defineFakeErdEditor,
  lastEditor,
  resetEditors,
} from '@/__test-utils__/erdEditor';
import { render } from '@/__test-utils__/render';
import { localeAtom } from '@/atoms/modules/locale';
import GdriveEditor from '@/components/gdrive/gdrive-editor/GdriveEditor';
import type { DocumentController, EditorAdapter } from '@/services/gdrive';

// The real element needs a browser, where e2e runs it; this pins the calls.
vi.mock('@dineug/erd-editor', () => ({}));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

const VALUE = '{"version":"3.0.0"}';

/** A controller whose load is in that phase; it hands an editor the value as the real one does. */
function stubController(
  phase: 'ready' | 'loading',
  attach = (adapter: EditorAdapter) => {
    adapter.setInitialValue(VALUE);
    return () => {};
  }
) {
  return {
    getSnapshot: () => ({ phase }),
    attach: vi.fn(attach),
  } as unknown as DocumentController;
}

function mount(controller: DocumentController, store = createStore()) {
  const view = render(
    createElement(
      Provider,
      { store },
      createElement(GdriveEditor, { controller, readonly: false })
    )
  );
  return { ...view, store, editor: lastEditor() };
}

beforeAll(defineFakeErdEditor);

afterEach(() => {
  resetEditors();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('the Drive file editor', () => {
  it('turns the locale picker on, and the welcome screen once the load is in, before attaching', () => {
    const { editor, unmount } = mount(stubController('ready'));

    expect(editor.props).toMatchObject({
      enableLocalePicker: true,
      enableWelcomeScreen: true,
    });
    expect(editor.indexOf('enableLocalePicker', true)).toBeLessThan(
      editor.indexOf('setInitialValue', VALUE)
    );
    expect(editor.indexOf('setInitialValue')).toBeLessThan(
      editor.indexOf('enableWelcomeScreen', true)
    );
    expect(editor.indexOf('enableWelcomeScreen')).toBeLessThan(
      editor.indexOf('connected')
    );
    unmount();
  });

  it('leaves the welcome screen off for a load another replaced', () => {
    const { editor, unmount } = mount(stubController('loading'));

    expect(editor.props.enableLocalePicker).toBe(true);
    expect(editor.indexOf('enableWelcomeScreen')).toBe(-1);
    unmount();
  });

  it('leaves the welcome screen off when the editor could not take the load', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('attach failed');
    const { editor, unmount } = mount(
      stubController('ready', () => {
        throw failure;
      })
    );

    expect(editor.indexOf('enableWelcomeScreen')).toBe(-1);
    expect(Sentry.captureException).toHaveBeenCalledWith(failure);
    unmount();
  });

  it('hands the editor the stored language and stores a pick from it', () => {
    const store = createStore();
    store.set(localeAtom, 'ko-KR');
    const { editor, unmount } = mount(stubController('ready'), store);
    expect(editor.locales()).toEqual(['ko-KR']);

    editor.pickLocale({ locale: 'system' });

    expect(store.get(localeAtom)).toBe('system');
    expect(window.localStorage.getItem('@locale')).toBe('"system"');
    expect(editor.locales()).toEqual(['ko-KR', 'system']);
    unmount();
  });

  it('follows a language another tab picked, and stops listening once it is gone', () => {
    const { editor, store, unmount } = mount(stubController('ready'));

    act(() => store.set(localeAtom, 'he-IL'));
    expect(editor.locales()).toEqual(['system', 'he-IL']);

    unmount();
    editor.pickLocale({ locale: 'ja-JP' });
    expect(store.get(localeAtom)).toBe('he-IL');
  });
});
