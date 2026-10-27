import { act } from 'react';

/** One thing a mount did to the viewer: a prop it set or a method it called. */
export type ViewerCall = readonly [name: string, value?: unknown];

const PROPS = ['src', 'value', 'nameView', 'minimap', 'controls'] as const;

/**
 * A stand-in for the viewer, whose real one needs a browser: it records in
 * order what a mount sets and calls, attaching and detaching included, and
 * fires the events the viewer fires. A spec mocks its entry so this registers.
 */
export class FakeErdViewer extends HTMLElement {
  /** Every viewer made since the last reset, attached or not. */
  static readonly created: FakeErdViewer[] = [];

  readonly calls: ViewerCall[] = [];
  readonly props: Record<string, unknown> = {};

  constructor() {
    super();
    FakeErdViewer.created.push(this);
  }

  connectedCallback() {
    this.calls.push(['connected']);
  }

  disconnectedCallback() {
    this.calls.push(['disconnected']);
  }

  setPresetTheme(theme: unknown) {
    this.calls.push(['setPresetTheme', theme]);
  }

  async setLocale(locale: string) {
    this.calls.push(['setLocale', locale]);
  }

  async setSystemLocale(locale: string | null) {
    this.calls.push(['setSystemLocale', locale]);
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

  /** The values each call of that name was given, in order. */
  valuesOf(name: string) {
    return this.calls
      .filter(([callName]) => callName === name)
      .map(([, value]) => value);
  }

  /** Fires an event the viewer fires, such as load or error, on the element. */
  fire(type: string, detail?: unknown) {
    act(() => {
      this.dispatchEvent(new CustomEvent(type, { detail }));
    });
  }
}

for (const name of PROPS) {
  Object.defineProperty(FakeErdViewer.prototype, name, {
    get(this: FakeErdViewer) {
      return this.props[name];
    },
    set(this: FakeErdViewer, value: unknown) {
      this.props[name] = value;
      this.calls.push([name, value]);
    },
  });
}

/** Registers the stand-in under the viewer's name, once per test file. */
export function defineFakeErdViewer() {
  if (!customElements.get('erd-viewer')) {
    customElements.define('erd-viewer', FakeErdViewer);
  }
}

/** The viewer the mount made last, attached or not. */
export function lastViewer(): FakeErdViewer {
  const viewer = FakeErdViewer.created.at(-1);
  if (!viewer) throw new Error('No erd-viewer was made');
  return viewer;
}

/** Forgets the viewers made so far, for the next case. */
export function resetViewers() {
  FakeErdViewer.created.length = 0;
}
