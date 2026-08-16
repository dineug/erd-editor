import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  getShikiService,
  setGetShikiServiceCallback,
  type ShikiService,
} from '@/services/shikiService';
import { globalEmitter } from '@/utils/globalEmitter';

const createService = (html: string): ShikiService => ({
  codeToHtml: async () => html,
});

afterEach(() => {
  globalEmitter.clear();
  setGetShikiServiceCallback(() => null);
  globalEmitter.clear();
});

describe('shikiService', () => {
  it('resolves to null before any callback is registered', async () => {
    vi.resetModules();
    const mod = await import('@/services/shikiService');

    expect(mod.getShikiService()).toBeNull();
  });

  it('returns whatever the registered callback returns', () => {
    const service = createService('<pre>select 1</pre>');
    setGetShikiServiceCallback(() => service);

    expect(getShikiService()).toBe(service);
  });

  it('calls the callback on every read so the result can change over time', () => {
    const first = createService('<pre>first</pre>');
    const second = createService('<pre>second</pre>');
    let current = first;
    const callback = vi.fn(() => current);

    setGetShikiServiceCallback(callback);

    expect(getShikiService()).toBe(first);
    current = second;
    expect(getShikiService()).toBe(second);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('lets the callback keep returning null', () => {
    setGetShikiServiceCallback(() => null);

    expect(getShikiService()).toBeNull();
  });

  it('emits loadShikiService on the global emitter when a callback is set', () => {
    const loadShikiService = vi.fn();
    globalEmitter.on({ loadShikiService });

    setGetShikiServiceCallback(() => null);

    expect(loadShikiService).toHaveBeenCalledTimes(1);
    expect(loadShikiService).toHaveBeenCalledWith({
      type: 'loadShikiService',
      payload: undefined,
    });
  });

  it('replaces the previous callback', async () => {
    const service = createService('<pre>latest</pre>');
    setGetShikiServiceCallback(() => null);
    setGetShikiServiceCallback(() => service);

    const resolved = getShikiService();
    expect(resolved).toBe(service);
    await expect(
      resolved?.codeToHtml('select 1', { lang: 'sql' })
    ).resolves.toBe('<pre>latest</pre>');
  });
});
