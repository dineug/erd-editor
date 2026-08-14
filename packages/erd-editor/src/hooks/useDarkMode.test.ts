import { FC, html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { flush, mountAndFlush, Mounted } from '@/__test-utils__/index';
import { useDarkMode } from '@/hooks/useDarkMode';

type ChangeListener = (event: MediaQueryListEvent) => void;

function createMediaQueryList(matches: boolean) {
  const listeners = new Set<ChangeListener>();

  const mediaQueryList = {
    matches,
    addEventListener: vi.fn((type: string, listener: ChangeListener) => {
      if (type === 'change') listeners.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: ChangeListener) => {
      if (type === 'change') listeners.delete(listener);
    }),
    emit(next: boolean) {
      mediaQueryList.matches = next;
      listeners.forEach(listener =>
        listener({ matches: next } as MediaQueryListEvent)
      );
    },
    get listenerCount() {
      return listeners.size;
    },
  };

  return mediaQueryList;
}

type MediaQueryListMock = ReturnType<typeof createMediaQueryList>;

function stubMatchMedia(mediaQueryList: MediaQueryListMock) {
  const matchMedia = vi.fn(() => mediaQueryList);
  vi.stubGlobal('matchMedia', matchMedia);
  return matchMedia;
}

const Probe: FC<{}> = () => {
  const { state } = useDarkMode();

  return () =>
    html`<div class="probe">${state.isDark ? 'dark' : 'light'}</div>`;
};

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.unstubAllGlobals();
});

describe('useDarkMode', () => {
  it('seeds the state from the media query when it does not match', async () => {
    const mediaQueryList = createMediaQueryList(false);
    const matchMedia = stubMatchMedia(mediaQueryList);

    mounted = await mountAndFlush(html`<${Probe} />`);

    expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    expect(mounted.container.textContent).toContain('light');
  });

  it('seeds the state from the media query when it already matches', async () => {
    stubMatchMedia(createMediaQueryList(true));

    mounted = await mountAndFlush(html`<${Probe} />`);

    expect(mounted.container.textContent).toContain('dark');
  });

  it('subscribes to change events once the component is mounted', async () => {
    const mediaQueryList = createMediaQueryList(false);
    stubMatchMedia(mediaQueryList);

    mounted = await mountAndFlush(html`<${Probe} />`);

    expect(mediaQueryList.addEventListener).toHaveBeenCalledTimes(1);
    expect(mediaQueryList.addEventListener.mock.calls[0][0]).toBe('change');
    expect(mediaQueryList.listenerCount).toBe(1);
  });

  it('re-renders when the media query flips to dark and back', async () => {
    const mediaQueryList = createMediaQueryList(false);
    stubMatchMedia(mediaQueryList);

    mounted = await mountAndFlush(html`<${Probe} />`);
    expect(mounted.container.textContent).toContain('light');

    mediaQueryList.emit(true);
    await flush();
    expect(mounted.container.textContent).toContain('dark');

    mediaQueryList.emit(false);
    await flush();
    expect(mounted.container.textContent).toContain('light');
  });

  it('removes the change listener on unmount', async () => {
    const mediaQueryList = createMediaQueryList(false);
    stubMatchMedia(mediaQueryList);

    mounted = await mountAndFlush(html`<${Probe} />`);
    const registered = mediaQueryList.addEventListener.mock.calls[0][1];

    mounted.unmount();
    mounted = null;

    expect(mediaQueryList.removeEventListener).toHaveBeenCalledTimes(1);
    expect(mediaQueryList.removeEventListener.mock.calls[0][0]).toBe('change');
    expect(mediaQueryList.removeEventListener.mock.calls[0][1]).toBe(
      registered
    );
    expect(mediaQueryList.listenerCount).toBe(0);
  });

  it('stops reacting to media query changes after unmount', async () => {
    const mediaQueryList = createMediaQueryList(false);
    stubMatchMedia(mediaQueryList);

    mounted = await mountAndFlush(html`<${Probe} />`);
    const container = mounted.container;
    mounted.unmount();
    mounted = null;

    mediaQueryList.emit(true);
    await flush();

    expect(container.textContent).not.toContain('dark');
  });
});
