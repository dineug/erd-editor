import { createStore, Provider } from 'jotai';
import { act, createElement } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test';

import {
  defineFakeErdViewer,
  type FakeErdViewer,
  lastViewer,
  resetViewers,
} from '@/__test-utils__/erdViewer';
import { pressKey, render, typeText } from '@/__test-utils__/render';
import EmbedBuilder from '@/components/embed/embed-builder/EmbedBuilder';
import { copyToClipboard } from '@/utils/clipboard';
import { parseEmbedParams, toIframeSnippet } from '@/utils/embedOptions';

// The real viewer needs a browser, where e2e runs it; this pins the calls.
vi.mock('@dineug/erd-editor/erd-viewer.js', () => ({}));
// e2e reads the real clipboard; here a copy ends when its promise does.
vi.mock('@/utils/clipboard', () => ({
  copyToClipboard: vi.fn(() => Promise.resolve()),
}));

const DOC = 'https://docs.test/a.erd.json';
const GITHUB = 'https://github.com/o/r/blob/main/a.erd.json';
const RAW = 'https://raw.githubusercontent.com/o/r/main/a.erd.json';

function mount(builder: React.FC = EmbedBuilder, store = createStore()) {
  const view = render(
    createElement(Provider, { store }, createElement(builder))
  );
  return { ...view, viewer: lastViewer() };
}

function labelOf(text: string) {
  const found = Array.from(document.querySelectorAll('label')).find(
    each => each.textContent === text
  );
  if (!found) throw new Error(`no label ${text}`);
  return found;
}

/** The control a visible label names. */
function control(label: string) {
  const found = document.getElementById(labelOf(label).htmlFor);
  if (!found) throw new Error(`no control labelled ${label}`);
  return found;
}

/** The field a visible label names. */
function field(label: string) {
  const input = control(label);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`no field labelled ${label}`);
  }
  return input;
}

function copyButtons() {
  return Array.from(document.querySelectorAll('button')).filter(button =>
    /^(Copy|Copied)$/.test(button.textContent ?? '')
  );
}

/** The copy button of the result a label names. */
function copyOf(result: string) {
  const button = labelOf(result)
    .closest('[role="group"]')
    ?.querySelector('button');
  if (!button) throw new Error(`no copy button for ${result}`);
  return button;
}

/** The status announcing a copy of the result a label names. */
function statusOf(result: string) {
  const status = labelOf(result)
    .closest('[role="group"]')
    ?.querySelector('[role="status"]');
  if (!status) throw new Error(`no status for ${result}`);
  return status;
}

/** Clicks a copy button and lets the copy it starts end. */
async function copy(button: HTMLButtonElement) {
  await act(async () => {
    button.click();
    await vi.mocked(copyToClipboard).mock.results.at(-1)?.value;
  });
}

/** The address the preview fetches, on the line describing the URL field. */
function fetchUrl() {
  const line = field('Document URL').getAttribute('aria-describedby');
  const code = line && document.getElementById(line)?.querySelector('code');
  return code ? code.textContent : null;
}

/** Every line naming what the preview fetches, found by its text, described or not. */
function fetchLines() {
  return Array.from(document.querySelectorAll('p')).filter(line =>
    line.textContent?.startsWith('Loads from')
  );
}

/** Presses a target with a mouse's main button, the press a select's trigger opens on. */
function pressWithMouse(target: Element) {
  act(() => {
    target.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        pointerId: 1,
        pointerType: 'mouse',
      })
    );
  });
}

/** Types a URL and applies it with Enter. */
function apply(url: string) {
  const input = field('Document URL');
  act(() => input.focus());
  typeText(input, url);
  pressKey(input, 'Enter');
}

/** The sources the mount handed the viewer, src and value alike, in order. */
function sources(viewer: FakeErdViewer) {
  return viewer.calls.filter(([name]) => name === 'src' || name === 'value');
}

beforeAll(defineFakeErdViewer);

afterEach(() => {
  resetViewers();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('the embed builder', () => {
  it('fetches nothing while the URL is typed, then once on Enter, and not again on blur', () => {
    const { viewer, unmount } = mount();
    const input = field('Document URL');

    act(() => input.focus());
    typeText(input, 'https://docs.test/');
    typeText(input, DOC);
    expect(viewer.valuesOf('src')).toEqual([]);

    pressKey(input, 'Enter');
    expect(viewer.valuesOf('src')).toEqual([DOC]);

    act(() => input.blur());
    expect(viewer.valuesOf('src')).toEqual([DOC]);
    unmount();
  });

  it('applies the URL as the field loses focus', () => {
    const { viewer, unmount } = mount();
    const input = field('Document URL');

    act(() => input.focus());
    typeText(input, DOC);
    expect(viewer.valuesOf('src')).toEqual([]);

    act(() => input.blur());
    expect(viewer.valuesOf('src')).toEqual([DOC]);
    unmount();
  });

  it('applies the URL without the spaces around it, and spaces alone as nothing', () => {
    const { viewer, unmount } = mount();
    const input = field('Document URL');

    apply('   ');
    act(() => input.blur());
    expect(sources(viewer)).toEqual([]);
    expect(fetchUrl()).toBeNull();
    expect(fetchLines()).toEqual([]);

    apply(`  ${DOC}\n`);
    expect(viewer.valuesOf('src')).toEqual([DOC]);
    unmount();
  });

  it('starts with no document, nothing to copy and empty results', () => {
    const { viewer, unmount } = mount();

    expect(sources(viewer)).toEqual([]);
    expect(viewer.indexOf('connected')).toBeGreaterThanOrEqual(0);
    expect(copyButtons()).toHaveLength(2);
    expect(copyButtons().every(button => button.disabled)).toBe(true);
    expect(statusOf('Embed URL').textContent).toBe('');
    expect(statusOf('Embed code').textContent).toBe('');
    expect(fetchLines()).toEqual([]);
    expect(field('Embed URL').value).toBe('');
    expect(field('Embed code').value).toBe('');
    unmount();
  });

  it('writes the URL and its iframe once a document is applied, with the default height', () => {
    const { unmount } = mount();

    apply(DOC);

    const url = field('Embed URL').value;
    expect(new URL(url).pathname).toBe('/embed');
    expect(parseEmbedParams(new URL(url).search).src).toBe(DOC);
    expect(field('Embed code').value).toBe(toIframeSnippet(url, 480));
    expect(copyButtons().every(button => !button.disabled)).toBe(true);
    unmount();
  });

  it('empties the canvas when the URL is cleared, since a src emptied alone keeps the document drawn', () => {
    const { viewer, unmount } = mount();

    apply(DOC);
    apply('');

    expect(sources(viewer)).toEqual([
      ['src', DOC],
      ['src', ''],
      ['value', ''],
    ]);
    expect(copyButtons().every(button => button.disabled)).toBe(true);
    expect(fetchUrl()).toBeNull();
    expect(fetchLines()).toEqual([]);
    unmount();
  });

  it('fetches a GitHub file page from its raw host, shows that address, and keeps the page in the URL', () => {
    const { viewer, unmount } = mount();

    apply(GITHUB);

    expect(fetchUrl()).toBe(RAW);
    expect(viewer.valuesOf('src')).toEqual([RAW]);
    expect(parseEmbedParams(new URL(field('Embed URL').value).search).src).toBe(
      GITHUB
    );
    unmount();
  });

  it('shows any other address as it was given', () => {
    const { viewer, unmount } = mount();

    expect(fetchUrl()).toBeNull();
    expect(fetchLines()).toEqual([]);
    apply(DOC);

    expect(fetchUrl()).toBe(DOC);
    expect(fetchLines()).toHaveLength(1);
    expect(viewer.valuesOf('src')).toEqual([DOC]);
    unmount();
  });

  it('toggles a switch from a click on its label, and labels the height field', () => {
    const { unmount } = mount();
    apply(DOC);
    const minimap = control('Minimap');
    expect(minimap.getAttribute('role')).toBe('switch');
    expect(minimap.getAttribute('aria-checked')).toBe('true');

    act(() => labelOf('Minimap').click());

    expect(minimap.getAttribute('aria-checked')).toBe('false');
    expect(field('Embed URL').value).toContain('minimap=false');
    expect(field('Height').value).toBe('480');
    unmount();
  });

  it("opens a select's list from its label every time, a mouse press on its trigger between", () => {
    const { unmount } = mount();
    const theme = control('Theme');
    const expanded = () => theme.getAttribute('aria-expanded');
    expect(theme.getAttribute('role')).toBe('combobox');

    act(() => labelOf('Theme').click());
    expect(expanded()).toBe('true');
    pressKey(document.body, 'Escape');
    expect(expanded()).toBe('false');

    pressWithMouse(theme);
    expect(expanded()).toBe('true');
    pressKey(document.body, 'Escape');
    expect(expanded()).toBe('false');

    act(() => labelOf('Theme').click());
    expect(expanded()).toBe('true');
    pressKey(document.body, 'Escape');
    unmount();
  });

  it('says Copied on the button and in its status, then Copy again as soon as the value it copied changes', async () => {
    const { unmount } = mount();
    apply(DOC);
    const code = copyOf('Embed code');

    await copy(code);
    expect(copyToClipboard).toHaveBeenLastCalledWith(field('Embed code').value);
    expect(code.textContent).toBe('Copied');
    expect(statusOf('Embed code').textContent).toBe('Copied');
    expect(statusOf('Embed URL').textContent).toBe('');

    act(() => control('Minimap').click());
    expect(field('Embed code').value).toContain('minimap=false');
    expect(code.textContent).toBe('Copy');
    expect(statusOf('Embed code').textContent).toBe('');

    const url = copyOf('Embed URL');
    await copy(url);
    expect(url.textContent).toBe('Copied');
    expect(statusOf('Embed URL').textContent).toBe('Copied');

    apply('');
    expect(url.disabled).toBe(true);
    expect(url.textContent).toBe('Copy');
    expect(statusOf('Embed URL').textContent).toBe('');
    unmount();
  });

  it('starts no Copied moment for a copy that ends after the builder left', async () => {
    let finish = () => {};
    const copying = new Promise<void>(resolve => {
      finish = resolve;
    });
    vi.mocked(copyToClipboard).mockReturnValueOnce(copying);
    const { unmount } = mount();
    apply(DOC);
    const timers = vi.spyOn(window, 'setTimeout');

    act(() => copyOf('Embed code').click());
    unmount();
    finish();
    await copying;

    expect(timers.mock.calls.filter(([, delay]) => delay === 2000)).toEqual([]);
  });

  it('keeps one viewer for the whole visit', () => {
    const { unmount } = mount();

    apply(DOC);
    apply(GITHUB);

    expect(lastViewer().valuesOf('src')).toEqual([DOC, RAW]);
    expect(document.querySelectorAll('erd-viewer')).toHaveLength(1);
    unmount();
  });
});

describe("the embed builder's preview language", () => {
  it("is the browser's as the system one, never the app's stored language", async () => {
    // The languages atom reads the browser as its module loads, so the stub
    // goes in before the builder and the atoms load again.
    vi.resetModules();
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR']);
    const { default: Builder } =
      await import('@/components/embed/embed-builder/EmbedBuilder');
    const { localeAtom } = await import('@/atoms/modules/locale');
    const store = createStore();
    store.set(localeAtom, 'ko-KR');

    const { viewer, unmount } = mount(Builder, store);

    expect(viewer.valuesOf('setSystemLocale')[0]).toBe('fr-FR');
    expect(viewer.valuesOf('setLocale')).toContain('system');
    expect(JSON.stringify(viewer.calls)).not.toContain('ko-KR');
    unmount();
  });
});
