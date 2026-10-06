import { act } from 'react';
import { vi } from 'vite-plus/test';

/** One thing a mount did to the element: a prop it set or a method it called. */
export type EditorCall = readonly [name: string, value?: unknown];

const PROPS = [
  'enableThemeBuilder',
  'enableLocalePicker',
  'enableWelcomeScreen',
  'readonly',
] as const;

/**
 * A stand-in for the element, whose real one needs a browser: it records in
 * order what a mount sets and calls, attaching included, and fires the events
 * the editor fires. A spec mocks the package so that only this one registers.
 */
export class FakeErdEditor extends HTMLElement {
  /** Every element made since the last reset, attached or not. */
  static readonly created: FakeErdEditor[] = [];

  readonly calls: EditorCall[] = [];
  readonly props: Record<string, unknown> = {};
  readonly sharedStore = {
    subscribe: vi.fn(() => () => {}),
    dispatch: vi.fn(),
    connection: vi.fn(),
    disconnect: vi.fn(),
  };
  value = '';

  constructor() {
    super();
    FakeErdEditor.created.push(this);
  }

  connectedCallback() {
    this.calls.push(['connected']);
  }

  getSharedStore(config?: unknown) {
    this.calls.push(['getSharedStore', config]);
    return this.sharedStore;
  }

  setInitialValue(value: string) {
    this.calls.push(['setInitialValue', value]);
    this.value = value;
  }

  setPresetTheme(theme: unknown) {
    this.calls.push(['setPresetTheme', theme]);
  }

  setLocale(locale: string) {
    this.calls.push(['setLocale', locale]);
  }

  destroy() {
    this.calls.push(['destroy']);
  }

  /** Where the first call of that name, and value when given, sits; -1 for none. */
  indexOf(name: string, value?: unknown) {
    return this.calls.findIndex(
      call => call[0] === name && (value === undefined || call[1] === value)
    );
  }

  /** The languages setLocale was given, in order. */
  locales() {
    return this.calls
      .filter(([name]) => name === 'setLocale')
      .map(([, value]) => value);
  }

  /** A pick from the editor's language panel or palette. */
  pickLocale(detail: unknown) {
    act(() => {
      this.dispatchEvent(new CustomEvent('changeLocale', { detail }));
    });
  }
}

for (const name of PROPS) {
  Object.defineProperty(FakeErdEditor.prototype, name, {
    get(this: FakeErdEditor) {
      return this.props[name] ?? false;
    },
    set(this: FakeErdEditor, value: unknown) {
      this.props[name] = value;
      this.calls.push([name, value]);
    },
  });
}

/** Registers the stand-in under the element's name, once per test file. */
export function defineFakeErdEditor() {
  if (!customElements.get('erd-editor')) {
    customElements.define('erd-editor', FakeErdEditor);
  }
}

/** The element the mount made last, attached or not. */
export function lastEditor(): FakeErdEditor {
  const editor = FakeErdEditor.created.at(-1);
  if (!editor) throw new Error('No erd-editor was made');
  return editor;
}

/** Forgets the elements made so far, for the next case. */
export function resetEditors() {
  FakeErdEditor.created.length = 0;
}
