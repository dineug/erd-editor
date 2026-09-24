import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createFakeGis } from '@/__test-utils__/gdrive';
import {
  createGisLoader,
  GIS_LOAD_TIMEOUT_MS,
  GIS_SCRIPT_URL,
  GisBlockedError,
  type GisOAuth2,
} from '@/services/gdrive/gis';

/** A head outside the document, so happy-dom never fetches the script it holds. */
function detachedDocument() {
  const head = document.createElement('div');
  return {
    doc: {
      createElement: document.createElement.bind(document),
      head,
    } as unknown as Pick<Document, 'createElement' | 'head'>,
    scripts: () => Array.from(head.querySelectorAll('script')),
  };
}

describe('createGisLoader', () => {
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(globalThis, 'google');
  });

  it('adds one script tag and hands every caller the same promise', async () => {
    const { doc, scripts } = detachedDocument();
    const gis = createFakeGis();
    const page: { oauth2?: GisOAuth2 } = {};
    const load = createGisLoader({
      document: doc,
      getOAuth2: () => page.oauth2,
    });

    const first = load();
    const second = load();

    expect(second).toBe(first);
    expect(scripts()).toHaveLength(1);
    expect(scripts()[0].src).toBe(GIS_SCRIPT_URL);
    expect(scripts()[0].async).toBe(true);

    page.oauth2 = gis.oauth2;
    scripts()[0].dispatchEvent(new Event('load'));

    await expect(first).resolves.toBe(gis.oauth2);
    expect(load()).toBe(first);
    expect(scripts()).toHaveLength(1);
  });

  it('is blocked when the script fails, and adds it again on the next call', async () => {
    const { doc, scripts } = detachedDocument();
    const load = createGisLoader({ document: doc, getOAuth2: () => undefined });

    const failed = load();
    scripts()[0].dispatchEvent(new Event('error'));

    await expect(failed).rejects.toBeInstanceOf(GisBlockedError);
    expect(scripts()).toHaveLength(0);

    const retried = load();
    expect(retried).not.toBe(failed);
    expect(scripts()).toHaveLength(1);
    scripts()[0].dispatchEvent(new Event('error'));
    await expect(retried).rejects.toBeInstanceOf(GisBlockedError);
  });

  it('is blocked when the script loads without the token client', async () => {
    const { doc, scripts } = detachedDocument();
    const load = createGisLoader({ document: doc, getOAuth2: () => undefined });

    const loading = load();
    scripts()[0].dispatchEvent(new Event('load'));

    await expect(loading).rejects.toThrow('Google sign-in could not load');
  });

  it('is blocked when nothing happens for ten seconds', async () => {
    vi.useFakeTimers();
    const { doc, scripts } = detachedDocument();
    const load = createGisLoader({ document: doc, getOAuth2: () => undefined });

    const loading = load();
    const [script] = scripts();
    const settled = vi.fn();
    loading.catch(settled);
    await vi.advanceTimersByTimeAsync(GIS_LOAD_TIMEOUT_MS - 1);
    expect(settled).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await expect(loading).rejects.toBeInstanceOf(GisBlockedError);
    expect(scripts()).toHaveLength(0);

    // The script arriving late settles nothing twice.
    script.dispatchEvent(new Event('load'));
    expect(load()).not.toBe(loading);
  });

  it('takes a client already on the page from window.google, adding no tag', async () => {
    const { doc, scripts } = detachedDocument();
    const gis = createFakeGis();
    Reflect.set(globalThis, 'google', { accounts: { oauth2: gis.oauth2 } });

    await expect(createGisLoader({ document: doc })()).resolves.toBe(
      gis.oauth2
    );
    expect(scripts()).toHaveLength(0);
  });

  it('reads window.google once the script has loaded', async () => {
    const { doc, scripts } = detachedDocument();
    const gis = createFakeGis();
    const loading = createGisLoader({ document: doc })();

    Reflect.set(globalThis, 'google', { accounts: { oauth2: gis.oauth2 } });
    scripts()[0].dispatchEvent(new Event('load'));

    await expect(loading).resolves.toBe(gis.oauth2);
  });
});
