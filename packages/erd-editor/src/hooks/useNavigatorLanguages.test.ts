import { defineCustomElement, FC, html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import { useNavigatorLanguages } from '@/hooks/useNavigatorLanguages';

let mounted: Mounted | null = null;
let held: { languages: string[] } | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  held = null;
  vi.restoreAllMocks();
});

/** Chromium's navigator.languages, a frozen array handed out the same each read. */
function spyLanguages(initial: string[]) {
  let languages: readonly string[] = Object.freeze([...initial]);
  const spy = vi
    .spyOn(window.navigator, 'languages', 'get')
    .mockImplementation(() => languages as string[]);

  return {
    spy,
    current: () => languages,
    change(next: string[]) {
      languages = Object.freeze([...next]);
      window.dispatchEvent(new Event('languagechange'));
    },
  };
}

const Probe: FC<{}> = () => {
  const { state } = useNavigatorLanguages();
  held = state;

  return () => html`<div class="probe">${state.languages.join(',')}</div>`;
};

const text = () => mounted!.container.querySelector('.probe')!.textContent;

const PROBE_ELEMENT = 'navigator-languages-probe';

/** The hook in a custom element, which mounts on every append, as erd-editor does. */
defineCustomElement(PROBE_ELEMENT, { render: Probe });

describe('useNavigatorLanguages', () => {
  it('holds the browser languages as it mounts', async () => {
    spyLanguages(['ko-KR', 'en']);

    mounted = await mountAndFlush(html`<${Probe} />`);

    expect(text()).toBe('ko-KR,en');
  });

  it('holds a copy of the frozen array, which a render can track', async () => {
    const languages = spyLanguages(['ko-KR']);

    mounted = await mountAndFlush(html`<${Probe} />`);

    expect(held!.languages).toEqual(['ko-KR']);
    expect(held!.languages).not.toBe(languages.current());
    expect(Object.isFrozen(held!.languages)).toBe(false);
  });

  it('renders again on a languagechange event', async () => {
    const languages = spyLanguages(['en-US']);
    mounted = await mountAndFlush(html`<${Probe} />`);

    languages.change(['ja', 'en-US']);
    await flush();

    expect(text()).toBe('ja,en-US');
    expect(held!.languages).not.toBe(languages.current());
    expect(Object.isFrozen(held!.languages)).toBe(false);
  });

  it('reads the languages again when it is attached, which no event reached while it was out', async () => {
    const languages = spyLanguages(['en-US']);
    const probe = document.createElement(PROBE_ELEMENT);
    document.body.append(probe);
    await flush();
    const state = held!;

    probe.remove();
    languages.change(['ko-KR']);
    await flush();
    expect(state.languages).toEqual(['en-US']);

    document.body.append(probe);
    await flush();
    expect(state.languages).toEqual(['ko-KR']);

    languages.change(['ja']);
    await flush();
    expect(state.languages).toEqual(['ja']);
    probe.remove();
  });

  it('removes its listener on unmount', async () => {
    const languages = spyLanguages(['en-US']);
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    mounted = await mountAndFlush(html`<${Probe} />`);
    const state = held!;
    const listener = add.mock.calls.find(
      ([type]) => type === 'languagechange'
    )?.[1];

    mounted.unmount();
    mounted = null;
    languages.change(['fr']);
    await flush();

    expect(listener).toBeTypeOf('function');
    expect(remove).toHaveBeenCalledWith('languagechange', listener);
    expect(state.languages).toEqual(['en-US']);
  });
});
