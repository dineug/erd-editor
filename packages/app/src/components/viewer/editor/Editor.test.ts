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
import Editor from '@/components/viewer/editor/Editor';
import type { SchemaEntity } from '@/services/indexeddb/modules/schema';

// The real element needs a browser, where e2e runs it; this pins the calls.
vi.mock('@dineug/erd-editor', () => ({}));
vi.mock('@/services/indexeddb', () => ({ getAppDatabaseService: () => null }));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

const ENTITY: SchemaEntity = {
  id: 'schema-1',
  name: 'Schema',
  value: '{"version":"3.0.0"}',
  createAt: 0,
  updateAt: 0,
};

function mount(store = createStore()) {
  const view = render(
    createElement(
      Provider,
      { store },
      createElement(Editor, { entity: ENTITY })
    )
  );
  return { ...view, store, editor: lastEditor() };
}

beforeAll(defineFakeErdEditor);

afterEach(() => {
  resetEditors();
  window.localStorage.clear();
});

describe('the schema editor', () => {
  it('turns the locale picker on, and the welcome screen once the value is in, before attaching', () => {
    const { editor, unmount } = mount();

    expect(editor.props).toMatchObject({
      enableLocalePicker: true,
      enableWelcomeScreen: true,
    });
    expect(editor.indexOf('enableLocalePicker', true)).toBeLessThan(
      editor.indexOf('setInitialValue', ENTITY.value)
    );
    expect(editor.indexOf('setInitialValue')).toBeLessThan(
      editor.indexOf('enableWelcomeScreen', true)
    );
    expect(editor.indexOf('enableWelcomeScreen')).toBeLessThan(
      editor.indexOf('connected')
    );
    unmount();
  });

  it('follows the system language until one is picked', () => {
    const { editor, unmount } = mount();

    expect(editor.locales()).toEqual(['system']);
    unmount();
  });

  it('hands the editor the stored language as it mounts', () => {
    const store = createStore();
    store.set(localeAtom, 'ko-KR');
    const { editor, unmount } = mount(store);

    expect(editor.locales()).toEqual(['ko-KR']);
    unmount();
  });

  it('stores a pick from the editor and hands it back', () => {
    const { editor, store, unmount } = mount();

    editor.pickLocale({ locale: 'ja-JP' });

    expect(store.get(localeAtom)).toBe('ja-JP');
    expect(window.localStorage.getItem('@locale')).toBe('"ja-JP"');
    expect(editor.locales()).toEqual(['system', 'ja-JP']);
    unmount();
  });

  it('follows a language another tab picked', () => {
    const { editor, store, unmount } = mount();

    act(() => store.set(localeAtom, 'fr-FR'));

    expect(editor.locales()).toEqual(['system', 'fr-FR']);
    unmount();
  });

  it('stops listening for picks once it is gone', () => {
    const { editor, store, unmount } = mount();
    unmount();

    editor.pickLocale({ locale: 'ja-JP' });

    expect(store.get(localeAtom)).toBe('system');
    expect(editor.indexOf('destroy')).not.toBe(-1);
  });
});
