import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { Emitter, toggleSearchAction } from '@/utils/emitter';
import { globalEmitter } from '@/utils/globalEmitter';

afterEach(() => {
  globalEmitter.clear();
});

describe('globalEmitter', () => {
  it('is a ready to use Emitter instance', () => {
    expect(globalEmitter).toBeInstanceOf(Emitter);
  });

  it('routes emitted actions to its listeners', () => {
    const onToggleSearch = vi.fn();

    const unsubscribe = globalEmitter.on({ toggleSearch: onToggleSearch });
    globalEmitter.emit(toggleSearchAction());
    unsubscribe();
    globalEmitter.emit(toggleSearchAction());

    expect(onToggleSearch).toHaveBeenCalledTimes(1);
  });

  it('is the same singleton for every importer', async () => {
    const again = await import('@/utils/globalEmitter');
    const onToggleSearch = vi.fn();

    globalEmitter.on({ toggleSearch: onToggleSearch });
    again.globalEmitter.emit(toggleSearchAction());

    expect(again.globalEmitter).toBe(globalEmitter);
    expect(onToggleSearch).toHaveBeenCalledOnce();
  });
});
